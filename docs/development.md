# Development Guide

## Prerequisites

- Node.js 18.0+ 
- npm 9.0+
- Git

## Getting Started

### Clone and Install

```bash
git clone https://github.com/FiligranHQ/xtm-browser-extension.git
cd xtm-browser-extension
npm install
```

### Generate Icons

The extension requires icons in multiple sizes. Generate them from the source SVG:

```bash
npm run icons
```

### Development Mode

Start the development server with hot reload:

```bash
npm run dev
```

This builds the extension in watch mode, automatically rebuilding on file changes.

### Build for Production

```bash
# Build for all browsers
npm run build:all

# Build for specific browser
npm run build:chrome
npm run build:firefox
npm run build:edge
```

Output is written to `dist/<browser>/`.

## Project Structure

```
src/
├── background/          # Background service worker
│   └── index.ts         # Main service worker (API clients, cache, message handling)
├── content/             # Content script injected into pages
│   └── index.ts         # Page scanning, highlighting, DOM manipulation
├── popup/               # Extension popup
│   ├── App.tsx          # Popup React component
│   ├── index.html       # Popup HTML
│   └── main.tsx         # Popup entry point
├── panel/               # Side panel for entity details
│   ├── App.tsx          # Panel React component
│   ├── index.html       # Panel HTML
│   └── main.tsx         # Panel entry point
├── options/             # Settings page
│   ├── App.tsx          # Options React component
│   ├── index.html       # Options HTML
│   └── main.tsx         # Options entry point
├── shared/              # Shared code
│   ├── api/             # API clients (modular architecture)
│   │   ├── ai-client.ts         # AI/LLM provider client
│   │   ├── opencti-client.ts    # OpenCTI GraphQL client
│   │   ├── openaev-client.ts    # OpenAEV REST client
│   │   ├── ai/                  # AI modules
│   │   │   ├── prompts.ts       # Prompt templates & builders
│   │   │   ├── types.ts         # AI types
│   │   │   └── json-parser.ts   # Response parsing
│   │   ├── opencti/             # OpenCTI modules
│   │   │   ├── queries.ts       # GraphQL queries & filters
│   │   │   ├── fragments.ts     # GraphQL fragments
│   │   │   ├── observable-mapping.ts # Observable type mapping
│   │   │   └── types.ts         # Response types
│   │   └── openaev/             # OpenAEV modules
│   │       ├── types.ts         # API request/response types
│   │       └── filters.ts       # Filter & payload builders
│   ├── components/      # Shared React components
│   │   ├── ItemIcon.tsx         # Entity type icons
│   │   ├── ActionButton.tsx     # Stylized action button
│   │   └── ActionButtonsGrid.tsx # Action buttons grid
│   ├── detection/       # Detection engine
│   │   ├── detector.ts  # Entity and observable detection
│   │   ├── patterns.ts  # Regex patterns for observables
│   │   ├── matching.ts  # Entity matching logic
│   │   └── text-extraction.ts # Text extraction from DOM
│   ├── extraction/      # Content extraction & PDF
│   │   ├── content-extractor.ts # Mozilla Readability wrapper
│   │   ├── pdf-generator.ts     # jsPDF-based PDF generation
│   │   └── native-pdf.ts        # Chrome Debugger API PDF
│   ├── platform/        # Platform registry
│   │   └── registry.ts  # Platform type definitions
│   ├── theme/           # Theme configuration
│   ├── types/           # TypeScript type definitions
│   │   ├── settings.ts      # Platform config, detection settings
│   │   ├── ai.ts            # AI provider types, model selection
│   │   ├── observables.ts   # Observable types (IoCs) and detection
│   │   ├── platform.ts      # Cross-platform matching types
│   │   ├── opencti.ts       # OpenCTI types (GraphQL, STIX, entities)
│   │   ├── openaev.ts       # OpenAEV entities, scenarios
│   │   └── messages.ts      # Extension message types
│   └── utils/           # Utilities
│       ├── logger.ts    # Structured logging
│       ├── messaging.ts # Extension message helpers
│       ├── formatters.ts # Value formatters
│       └── storage.ts   # Chrome storage helpers
├── assets/              # Static assets (icons, logos, CSS)
└── manifest.*.json      # Browser-specific manifests
```

## Testing

### Test Structure

```
tests/
├── setup.ts                    # Vitest setup (Chrome API mocks)
├── unit/                       # Unit tests (no external dependencies)
│   ├── ai-client.test.ts       # AI client and JSON parsing tests
│   ├── defang.test.ts          # IOC defanging/refanging tests
│   ├── detection.test.ts       # Observable detection and text extraction
│   ├── handler-types.test.ts   # Response helpers and handler context
│   ├── logger.test.ts          # Logger utility tests
│   ├── message-dispatcher.test.ts # Message routing tests
│   ├── messages.test.ts        # Message types coverage (prevents accidental deletions)
│   ├── patterns.test.ts        # Regex pattern tests
│   └── visualization.test.ts   # Graph layout and styling tests
├── integration/                # Integration tests (require running platforms)
│   ├── opencti/
│   │   └── client.test.ts      # OpenCTI API tests
│   └── openaev/
│       └── client.test.ts      # OpenAEV API tests
└── manual/                     # Manual test HTML files for scanning
```

### Test Coverage

The test suite includes:
- **Message Type Coverage**: Ensures all message types have handlers (prevents accidental deletion)
- **Handler Registry Tests**: Verifies handler modules export correct functions
- **Dispatcher Tests**: Tests message routing and error handling
- **Visualization Tests**: Tests graph layout algorithms and styling
- **Detection Tests**: Tests observable pattern matching and type normalization

### Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run OpenCTI integration tests
npm run test:opencti

# Run OpenAEV integration tests
npm run test:openaev

# Run with coverage report
npm run test:coverage

# Watch mode for TDD
npm run test:watch
```

### Local Integration Testing

For integration tests, you need running OpenCTI and/or OpenAEV instances.

#### Using Local Scripts

**PowerShell (Windows):**
```powershell
$env:OPENCTI_URL = "http://localhost:8080"
$env:OPENCTI_TOKEN = "your-api-token"
.\scripts\test-local.ps1
```

**Bash (Linux/macOS):**
```bash
export OPENCTI_URL="http://localhost:8080"
export OPENCTI_TOKEN="your-api-token"
./scripts/test-local.sh
```

#### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCTI_URL` | OpenCTI platform URL | `http://localhost:8080` |
| `OPENCTI_TOKEN` | OpenCTI API token | (none) |
| `OPENAEV_URL` | OpenAEV platform URL | `http://localhost:8080` |
| `OPENAEV_TOKEN` | OpenAEV API token | (none) |

### Test Behavior

- **Unit tests**: Always run, no external dependencies
- **Integration tests**: Skip gracefully when platform unavailable
- **CI/CD**: Integration tests run with full platform stack via GitHub Actions

## Logging

The extension uses structured logging with configurable levels:

```typescript
import { loggers } from './shared/utils/logger';

// Use module-specific logger
loggers.background.debug('Cache refreshed', { count: 100 });
loggers.content.info('Page scanned', { observables: 5 });
loggers.popup.warn('No entities found');
loggers.panel.error('API error', { error: err.message });
```

Log levels: `debug`, `info`, `warn`, `error`

Set log level via browser console:
```javascript
localStorage.setItem('LOG_LEVEL', 'debug');
```

## API Clients

### Modular Architecture

API clients are organized into modular structures for maintainability:

```
src/shared/api/
├── ai-client.ts          # Main AI client (imports from ai/)
├── opencti-client.ts     # Main OpenCTI client (imports from opencti/)
├── openaev-client.ts     # Main OpenAEV client (imports from openaev/)
├── ai/
│   ├── prompts.ts        # All prompt templates (~560 lines)
│   ├── types.ts          # AI type definitions
│   └── json-parser.ts    # Response parsing utilities
├── opencti/
│   ├── queries.ts        # GraphQL queries/mutations & filter builders (~350 lines)
│   ├── fragments.ts      # Reusable GraphQL fragments
│   └── types.ts          # Query response types
└── openaev/
    └── filters.ts        # Filter builders & payload utilities (~300 lines)
```

### OpenCTI Client

GraphQL client for OpenCTI platform:

```typescript
import { OpenCTIClient } from './shared/api/opencti-client';

const client = new OpenCTIClient({
  url: 'https://opencti.example.com',
  apiToken: 'your-api-token'
});

// Test connection
const info = await client.testConnection();

// Search entities
const results = await client.globalSearch('APT29');

// Get SDOs for caching
const sdos = await client.fetchSDOsForCache('Intrusion-Set');
```

### OpenAEV Client

REST client for OpenAEV platform:

```typescript
import { OpenAEVClient } from './shared/api/openaev-client';

const client = new OpenAEVClient({
  id: 'platform-1',
  name: 'My OpenAEV',
  url: 'https://openaev.example.com',
  apiToken: 'your-api-token'
});

// Get assets
const assets = await client.getAllAssets();

// Get attack patterns
const patterns = await client.getAllAttackPatterns();

// Search with filters (using filter builders)
const results = await client.searchAssets('server-01');
```

### Using Modular Components Directly

You can import and use the modular components directly:

```typescript
// Import filter builders for custom queries
import { buildAssetSearchFilter, buildSearchBody } from './shared/api/openaev/filters';

// Import GraphQL queries for custom operations
import { GLOBAL_SEARCH_QUERY, buildValueFilter } from './shared/api/opencti/queries';

// Import prompt builders for AI customization
import { buildScenarioPrompt, TABLE_TOP_THEMES } from './shared/api/ai/prompts';
```

## Detection Engine

### Observable Detection

Regex-based detection for observables, including defanged IOCs:

```typescript
import { detectObservables } from './shared/detection/detector';

const text = 'Check this IP: 192.168.1.1 and domain evil[.]com';
const observables = detectObservables(text);
// Returns: [
//   { type: 'IPv4-Addr', value: '192.168.1.1' },
//   { type: 'Domain-Name', value: 'evil[.]com', refangedValue: 'evil.com', isDefanged: true }
// ]
```

### Entity Detection

Cache-based exact matching for entities:

```typescript
import { detectSDOsFromCache, detectOAEVEntitiesFromCache } from './shared/detection/detector';

// OpenCTI entities
const sdos = detectSDOsFromCache(text, sdoCache);

// OpenAEV entities  
const oaevEntities = detectOAEVEntitiesFromCache(text, oaevCache);
```

## Content Extraction

### Extracting Article Content

```typescript
import { extractContent, generateReaderView } from './shared/extraction';

// Extract clean article from current page
const content = extractContent();
// Returns: { title, byline, content, textContent, images, url, ... }

// Generate reader-view HTML
const readerHtml = generateReaderView(content);
```

### PDF Generation

```typescript
import { generatePDF, requestNativePDF } from './shared/extraction';

// Generate PDF from extracted content
const result = await generatePDF(content, {
  includeImages: true,
  paperSize: 'a4',
  headerText: 'Custom Header',
});
// result.data = Base64 PDF, result.filename, result.method

// Request native PDF via background script (higher quality)
const nativePdf = await requestNativePDF(tabId);
```

### Image Loading (CORS Bypass)

Images from cross-origin sources are fetched via the background script:

```typescript
// Content script sends message to background
chrome.runtime.sendMessage({
  type: 'FETCH_IMAGE_AS_DATA_URL',
  payload: { url: imageUrl }
}, (response) => {
  if (response.success) {
    const dataUrl = response.dataUrl;
    // Use in PDF or canvas
  }
});
```

## AI Client

### Using AI Features

```typescript
import { AIClient } from './shared/api/ai-client';

const client = new AIClient({
  provider: 'openai',
  apiKey: 'sk-...',
  model: 'gpt-4o',
});

// Generate description
const description = await client.generateDescription(pageContent);

// Fetch available models
const models = await client.fetchModels();
// Returns: [{ id: 'gpt-4o', name: 'GPT-4o' }, ...]
```

## Message Passing

Communication between extension components uses Chrome's message passing:

```typescript
// Send message from popup to background
chrome.runtime.sendMessage({ 
  type: 'SCAN_PAGE',
  platformId: 'platform-1'
}, (response) => {
  console.log('Scan results:', response);
});

// Handle in background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCAN_PAGE') {
    // Process scan
    sendResponse({ success: true, results: [...] });
  }
  return true; // Keep channel open for async response
});
```

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `SCAN_PAGE` | Popup → Background | Trigger page scan |
| `SCAN_ALL` | Popup → Background | Unified scan (all platforms) |
| `GET_ENTITY` | Panel → Background | Fetch entity details |
| `REFRESH_CACHE` | Options → Background | Refresh SDO/OAEV cache |
| `CLEAR_SDO_CACHE` | Options → Background | Clear OpenCTI cache |
| `CLEAR_OAEV_CACHE` | Options → Background | Clear OpenAEV cache |
| `HIGHLIGHT_RESULTS` | Background → Content | Apply highlights to page |
| `GENERATE_NATIVE_PDF` | Content → Background | Generate PDF via Debugger API |
| `FETCH_IMAGE_AS_DATA_URL` | Content → Background | Fetch image bypassing CORS |
| `AI_GENERATE_DESCRIPTION` | Panel → Background | Generate AI description |
| `AI_GENERATE_SCENARIO` | Panel → Background | Generate AI scenario |
| `AI_GENERATE_FULL_SCENARIO` | Panel → Background | Generate complete AI scenario with injects |
| `AI_GENERATE_EMAILS` | Panel → Background | Generate email content for table-top scenarios |
| `AI_GENERATE_ATOMIC_TEST` | Panel → Background | Generate atomic test payload |
| `AI_DISCOVER_ENTITIES` | Panel → Background | Discover entities using AI |
| `AI_TEST_AND_FETCH_MODELS` | Options → Background | Test AI key & fetch models |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Write tests for new functionality
4. Ensure all tests pass: `npm test`
5. Commit with clear messages
6. Push and create a Pull Request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.
