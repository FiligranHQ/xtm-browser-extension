# Architecture Design: XTM One Integration

## The Goal
Route every AI capability in `xtm-browser-extension` through XTM One. XTM One is the sole AI backend — BYOK (Bring Your Own Key) modes and direct LLM provider calls are removed.

## The Architectural Flaw in the Previous Extension
The extension used to act as the "Brain": it built giant system prompts, defined the JSON schema, and POSTed raw text to `https://api.openai.com/v1/chat/completions` (or the Anthropic / Gemini equivalents). It treated the AI as a dumb text processor and stored each analyst's LLM API key in browser extension storage.

That model has three problems:
1. **Security**: provider API keys sit in extension storage, exposed to any compromised content script.
2. **Inconsistency**: every analyst tunes prompts and providers independently — quality varies between teammates.
3. **Release coupling**: prompt improvements require a new extension release.

XTM One is an *agentic AI platform*. The right shape for this integration is "thin client, thick platform": the extension ships raw context to XTM One, which owns the prompt, model selection, RBAC, quotas, and structured output schema.

## Product Strategy

* **Single backend**: XTM One is the only supported AI backend. There is no fallback to OpenAI / Anthropic / Gemini / custom OpenAI-compatible endpoints.
* **Breaking change**: this migration ships as a major or minor version bump, not a silent update. Users who relied on BYOK must configure XTM One after upgrading.
* **EE gating (transitional)**: the AI tab remains gated behind at least one Enterprise Edition OpenCTI/OpenAEV platform. The EE-or-XTM-One question is tracked separately and may evolve in a follow-up.

## User Journey & Interfaces

* **Frictionless setup**: the AI settings tab exposes two fields: `XTM One URL` and `XTM One API Token`. Once the user types a URL, the helper text under the token field becomes a clickable link directing them to `{xtmOneUrl}/profile/api-keys`.
* **Disabled until configured**: if XTM One is not configured, every AI affordance in the extension is disabled and surfaces a prompt to configure the endpoint in settings.
* **Perceived latency**: XTM One executes agentic workflows that may run longer than a raw LLM completion. Loading copy is branded: *"XTM One is analyzing the page…"* / *"XTM One is generating your scenario…"*
* **Human-readable error states** (mapped in `AIClient`):
  * `401 Unauthorized` → *"Your XTM One token is invalid or expired. Please generate a new one."*
  * `403 Forbidden` → *"Your XTM One token is not authorized to run this task."*
  * `404 Not Found` → *"The XTM One agent for task X was not found. Your XTM One server may need an update."*
  * `422 Unprocessable Entity` → *"Your XTM One server needs an update to use this feature."*
  * `429 Too Many Requests` → *"You have reached your XTM One AI quota. Please try again later."*
  * `5xx` → *"XTM One server error (status). Please try again later."*

## Authentication & Connection Layer

* **Mechanism**: the user supplies the XTM One base URL and a Personal Access Token (tokens start with `fcp-`). Both live in the existing `AISettings` slot of the extension's chrome.storage, replacing the BYOK provider/api-key/model fields.
* **Wire format**: `AIClient` attaches `Authorization: Bearer fcp-…` to every request. XTM One's `get_current_user` dependency maps the token to the XTM One user, applying RBAC and quotas.
* **Connection test**: `GET /api/v1/auth/me` — validates the token end-to-end without burning LLM tokens.
* **No LLM provider credentials are stored anywhere in the extension after migration.**

## Logic Boundary — Who is the "Brain"?

* **Rule**: the extension owns no prompt logic. `src/shared/api/ai/prompts.ts` is removed. The inline mega-prompt in the legacy `AI_SCAN_ALL` handler is removed.
* **Resolution**: the extension forwards raw context to a stateless execution endpoint, identifying the target agent by slug and shipping the payload as a serialized JSON string.

## API Surface — `/api/v1/extension/execute-task`

```
POST {xtmOneUrl}/api/v1/extension/execute-task
Authorization: Bearer fcp-…
Content-Type: application/json

{
  "agent_slug": "browser-scan-all",
  "content": "{ ... task-specific payload as JSON string ... }",
  "max_tokens": 10000
}
```

### Why a dedicated endpoint instead of `/api/v1/platform/chat/messages`?

The browser extension's utility tasks (scan, generate scenario, extract entities) are **stateless data-processing jobs**, not interactive conversations. Using the chat API would:

1. **Pollute the user's Chat History**: every "Scan Page" click creates a `Conversation` + `Message` row in XTM One. An analyst scanning 20 pages/day generates 20 unreadable JSON conversations.
2. **Lose schema validation**: the chat API accepts a single `content` string — all typed payload structure is lost.
3. **Add unnecessary overhead**: conversation creation, history rehydration, message persistence, and channel migration logic are all irrelevant for ephemeral utility tasks.

The `/extension/execute-task` endpoint resolves the agent by slug from the database, calls `run_agent_chat()` with empty history and no conversation persistence, enforces quotas via `check_agentic_quota()`, and returns the parsed JSON result in a `{ "data": { ... } }` envelope.

### Why not an `llm_proxy`?

An `llm_proxy` would forward arbitrary prompts, letting a compromised extension burn the company's LLM budget on unauthorized requests. The execute-task endpoint only accepts known agent slugs.

## Agent Registry

Eight agents are seeded in XTM One's `builtin_agents.py` with `disable_chat=True` (hidden from the chat UI) and `output_format="json"`. Their personas live in `seed_data/agent_persona/browser-*.md`.

| Agent slug | Browser-extension feature |
| --- | --- |
| `browser-container-description` | Container description generation |
| `browser-scenario-generation` | Inject-set scenario generation |
| `browser-full-scenario-generation` | End-to-end scenario generation |
| `browser-atomic-test-generation` | On-the-fly atomic test generation |
| `browser-email-generation` | Table-top email content generation |
| `browser-entity-discovery` | Smart entity discovery |
| `browser-relationship-resolution` | STIX relationship resolution |
| `browser-scan-all` | Combined entity + relationship scan |

Adding a new task requires: (1) seeding a new agent in `builtin_agents.py` with a persona file, (2) adding a wrapper method in the extension's `AIClient`. No server-side endpoint code changes needed.

## CORS and Network Boundaries

* All XTM One HTTP calls originate from the background service worker (Manifest V3). Background scripts bypass CORS when the target URL matches the extension's `host_permissions`.
* The endpoint stays under standard authenticated routes (`/api/v1/extension/…`) — it is **not** exposed via a public middleware.

## Observability and Data Privacy

* **Statelessness**: the execute-task endpoint is ephemeral. No `Conversation` or `Message` rows are written. Page content is processed by the agent and discarded.
* **Langfuse tracing**: `run_agent_chat()` traces all agent execution via Langfuse, so admins can attribute LLM spend and debug agent behavior.
* **Quota enforcement**: `check_agentic_quota()` is called before every execution, returning HTTP 429 if the user's quota is exceeded.

## Request Flow Summary

1. User triggers an AI feature (e.g. "Generate Scenario").
2. Panel renders branded loading copy.
3. The panel posts a message (e.g. `AI_GENERATE_FULL_SCENARIO`) to the background service worker.
4. `ai-handlers.ts` checks `isAIAvailable(settings.ai)`, instantiates `AIClient`, optionally truncates oversize content, and calls `client.generateFullScenario(payload)`.
5. `AIClient` POSTs to `{xtmOneUrl}/api/v1/extension/execute-task` with the `Bearer fcp-…` header, sending `{ agent_slug, content, max_tokens }`.
6. XTM One validates the token, enforces quota (`429` if exceeded), resolves the agent by slug (`404` if missing), and calls `run_agent_chat()` statelessly.
7. The endpoint parses the agent's JSON output and returns `{ "data": { ... } }`.
8. The handler applies optional post-processing (entity deduplication, relationship index → value mapping) and forwards the result to the panel.
9. Panel renders results.

## Data Lifecycle

The extension is a **staging area**. AI-generated data (discovered entities, generated scenarios) is displayed in the extension panel and cached temporarily in `chrome.storage.local`. The user curates the results and explicitly clicks "Export to OpenCTI" or "Export to OpenAEV" to persist them to the correct platform database. No intermediate data is persisted in XTM One.

## Out of Scope

* Interactive "Ask Ariane" chat in the extension — if added in the future, it should use the stateful `/api/v1/platform/chat/messages` API (not the stateless execute-task endpoint).
* Detection logic, entity highlighting, PDF generation, OpenCTI / OpenAEV API calls — unchanged.
* UI redesign for AI features beyond the settings panel.
