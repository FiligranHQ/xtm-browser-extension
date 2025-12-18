# Filigran XTM Browser Extension

[![OpenCTI Integration Tests](https://github.com/FiligranHQ/xtm-browser-extension/actions/workflows/ci-test-opencti.yml/badge.svg)](https://github.com/FiligranHQ/xtm-browser-extension/actions/workflows/ci-test-opencti.yml)
[![OpenAEV Integration Tests](https://github.com/FiligranHQ/xtm-browser-extension/actions/workflows/ci-test-openaev.yml/badge.svg)](https://github.com/FiligranHQ/xtm-browser-extension/actions/workflows/ci-test-openaev.yml)

The **Filigran XTM Browser Extension** transforms your web browser into a powerful threat intelligence workstation. Seamlessly integrated with [OpenCTI](https://filigran.io/solutions/open-cti/) (Cyber Threat Intelligence) and [OpenAEV](https://filigran.io/solutions/openaev/) (Adversarial Exposure Validation) platforms, this extension enables security analysts to detect, enrich, and operationalize threat data directly from any web page.

**Turn any threat report into actionable intelligence in seconds.** Automatically scan pages for indicators of compromise (IOCs), threat actors, malware families, MITRE ATT&CK techniques, vulnerabilities, and more. With a single click, create structured reports, launch investigations, or generate attack scenarios—all without leaving your browser.

### Why Use This Extension?

- 🔗 **Seamless Platform Integration** — Connect to multiple OpenCTI and OpenAEV instances simultaneously
- ⚡ **Real-Time Detection** — Instantly identify threats, observables, and entities as you browse
- 🧠 **AI-Powered Analysis** — Generate intelligent descriptions, attack scenarios, and atomic tests (Enterprise Edition)
- 📄 **One-Click Capture** — Create professional PDF snapshots and structured reports from any article
- 🎯 **Visual Intelligence** — Color-coded highlights show what's known, new, or dangerous
- 🔒 **Defanged IOC Support** — Automatically detect and refang `example[.]com`, `hxxps://` formats
- 🏢 **Enterprise Ready** — Multi-platform support with Enterprise Edition AI capabilities

## Quick Start

1. **Install**: Load the extension in your browser (see [Installation](./docs/installation.md))
2. **Configure**: Add your OpenCTI and/or OpenAEV platform credentials
3. **Scan**: Click "Scan Page" to detect threats and observables

## Features

### OpenCTI Integration
- 🔍 **Page Scanning** - Detect observables (IPs, domains, hashes, CVEs, etc.) and STIX entities
- 🎯 **Visual Highlighting** - Color-coded indicators (green = found, amber = new) with scroll-to-highlight glow effect
- 📋 **Quick Actions** - Create reports, cases, groupings, and investigations
- 📊 **Entity Details** - View author, creator, confidence/score, labels, markings, and containers
- 🔄 **Entity Cache** - Fast offline detection with background refresh
- 🤖 **AI Description Generation** - Generate container descriptions using AI (Enterprise Edition)
- 📄 **PDF Generation** - Capture web pages as PDF attachments for containers
- 🔮 **AI Discovery on Empty Results** - Trigger AI-based entity discovery even when initial scan finds nothing

**Detected Entity Types:**
- **Threat Entities**: Threat Actor Groups, Intrusion Sets (APT29, Cozy Bear...), Malware, Campaigns
- **Observables**: IPs, Domains, URLs, Hashes, Emails, CVEs, Crypto Wallets, MAC Addresses
- **Defanged IOCs**: Automatic detection of defanged indicators (e.g., `example[.]com`, `hxxps://`)
- **MITRE ATT&CK**: Attack Patterns (T1566, T1059.001...)
- **Locations**: Countries, Regions, Cities
- **Identities**: Organizations, Sectors, Individuals

### OpenAEV Integration
- 🖥️ **Asset Detection** - Find endpoints matching by name, hostname, IP addresses, and MAC addresses
- 👥 **Team & Player Matching** - Detect teams and players from page content
- 🎯 **Attack Pattern Matching** - Match MITRE ATT&CK patterns by ID (T1566, T1059.001)
- 🔍 **Findings Detection** - Match security findings by value with exact matching
- 🛡️ **Vulnerability Detection** - Detect CVEs and lookup in OpenAEV vulnerability database
- 🎮 **Scenario Generation** - Create attack scenarios from web page content
- 🤖 **Full AI Scenario Generation** - Generate complete scenarios with AI-created payloads (technical) or email content (table-top) based on page context (Enterprise Edition)
- 🎭 **Themed Scenarios** - Choose from 6 scenario themes for diverse table-top exercises
- ⚡ **Atomic Testing** - Create on-the-fly atomic tests with AI-generated command lines

### Scenario Themes (Table-Top Exercises)

Generate AI-powered table-top exercises across diverse domains:

| Theme | Description |
|-------|-------------|
| 🔐 **Cybersecurity & Technology** | Cyber attacks, data breaches, ransomware, phishing, IT security incidents |
| 🏢 **Physical Security & Safety** | Facility breaches, unauthorized access, workplace violence, theft |
| 🔄 **Business Continuity** | Natural disasters, supply chain failures, system outages, operational resilience |
| 📢 **Crisis Communication** | Media incidents, reputation management, public relations crises |
| ⚕️ **Health & Safety** | Workplace accidents, pandemic response, environmental hazards |
| 🌍 **Geopolitical & Economic** | Sanctions, trade restrictions, political instability, regulatory changes |

### PDF Generation & Content Extraction
- 📄 **Reader-View PDF** - Clean, formatted PDFs using Mozilla Readability extraction
- 🖼️ **Image Preservation** - Content images are preserved in generated PDFs
- 📰 **Smart Extraction** - Automatic hero image detection and lazy-loaded image handling
- 📋 **Container Attachments** - Optionally attach PDF snapshots to OpenCTI containers
- 🎨 **Professional Formatting** - Headers, footers, page numbers, and Filigran branding

### AI Features (Enterprise Edition)
- 🧠 **Multiple LLM Support** - OpenAI, Anthropic (Claude), and Google Gemini
- 📝 **Container Description AI** - Generate intelligent descriptions for OpenCTI containers
- 🎬 **Full Scenario Generation** - Generate complete attack scenarios with AI-created injects, payloads, or email content based on page context
- 🎭 **Theme-Aware Generation** - AI adapts to selected scenario theme with domain-specific knowledge
- ✉️ **Multi-Language Emails** - Generate realistic email content in 13 languages for table-top exercises
- ⚡ **Atomic Testing AI** - Generate proper command lines for atomic tests with cleanup commands
- 🔍 **Smart Entity Discovery** - Discover additional entities that regex patterns might miss (only visible/highlightable entities included)
- 🔗 **Relationship Resolution** - AI identifies relationships using valid STIX 2.1 and OpenCTI relationship types only
- 📊 **Model Selection** - Browse and select from available models for each provider
- 🔮 **Coming Soon**: XTM One (Filigran Agentic AI Platform) integration

### General
- 🎨 **Theme Integration** - Follows your preferred theme (auto/dark/light)
- 🔗 **Multi-Platform** - Connect to multiple OpenCTI and OpenAEV instances
- 📱 **Side Panel** - Detailed entity view with metadata, labels, markings, and containers
- 🔎 **MITRE ID Detection** - Exact word-boundary matching for MITRE ATT&CK IDs
- 🏢 **Enterprise Edition Detection** - Automatic detection of EE platforms for AI features

## Development

```bash
# Install dependencies
npm install

# Generate icons
npm run icons

# Development mode with hot reload
npm run dev

# Build for all browsers
npm run build:all

# Build for specific browser
npm run build:chrome
npm run build:firefox
npm run build:edge
```

## Testing

The extension includes comprehensive unit and integration tests:

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run OpenCTI integration tests
npm run test:opencti

# Run OpenAEV integration tests  
npm run test:openaev

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Local Integration Testing

To run integration tests locally against running OpenCTI/OpenAEV instances:

**PowerShell (Windows):**
```powershell
.\scripts\test-local.ps1
```

**Bash (Linux/macOS):**
```bash
./scripts/test-local.sh
```

### CI/CD

Integration tests run automatically on push and pull requests via GitHub Actions:
- **OpenCTI Tests**: Spins up Redis, Elasticsearch, MinIO, RabbitMQ, and OpenCTI
- **OpenAEV Tests**: Spins up PostgreSQL, Elasticsearch, MinIO, RabbitMQ, and OpenAEV

See `.github/workflows/ci-test-opencti.yml` and `.github/workflows/ci-test-openaev.yml` for details.

## Documentation

Full documentation is available in the [docs](./docs) folder:

- [Overview](./docs/overview.md) - Architecture and concepts
- [Architecture](./docs/architecture.md) - Technical architecture, state management, and workflows
- [Installation](./docs/installation.md) - Browser-specific installation guides
- [Configuration](./docs/configuration.md) - Platform setup and settings
- [Features](./docs/features.md) - Detailed feature documentation
- [Detection Settings](./docs/detection.md) - Observable and entity type configuration
- [Development](./docs/development.md) - Development guide and testing
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions

## Browser Support

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome  | ✅ Full Support | Side panel supported |
| Edge    | ✅ Full Support | Side panel supported |
| Firefox | ✅ Full Support | Sidebar action |
| Safari  | ⚠️ Experimental | Requires wrapper |

## API Requirements

### OpenCTI
- Version 6.0+ recommended
- API token with read access (write for creating entities)
- Enterprise Edition required for AI features

### OpenAEV  
- Version 2.0+ recommended
- API token with appropriate permissions
- Enterprise Edition required for AI features

### AI Configuration (Enterprise Edition Only)

AI features require at least one connected Enterprise Edition platform. Configure your preferred LLM provider in Settings > AI Assistant:

| Provider | Models | API Key Required |
|----------|--------|------------------|
| OpenAI | GPT-4o, GPT-4 Turbo, GPT-4 | Yes |
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus | Yes |
| Google | Gemini 1.5 Pro, Gemini 1.5 Flash | Yes |

After entering your API key, click **Test Connection** to validate and fetch available models. Select your preferred model from the dropdown.

> **Note**: If you don't have an Enterprise Edition license, clicking AI buttons will show a dialog to start a free 30-day trial at [filigran.io/enterprise-editions-trial](https://filigran.io/enterprise-editions-trial/)

## Project Structure

```
xtm-browser-extension/
├── src/
│   ├── background/              # Service worker (API clients, cache, messaging)
│   │   ├── index.ts             # Main entry, client init, message handling
│   │   ├── handlers/            # Message handlers split by domain
│   │   │   ├── ai-handlers.ts       # AI generation requests
│   │   │   ├── cache-handlers.ts    # Cache management
│   │   │   ├── openaev-handlers.ts  # OpenAEV API operations
│   │   │   ├── opencti-handlers.ts  # OpenCTI API operations
│   │   │   ├── scan-handlers.ts     # Page scanning logic
│   │   │   └── settings-handlers.ts # Settings management
│   │   └── services/            # Background services
│   │       ├── cache-manager.ts     # Entity cache management
│   │       ├── client-manager.ts    # API client lifecycle
│   │       └── message-dispatcher.ts # Message routing
│   │
│   ├── content/                 # Content script (injected into pages)
│   │   ├── index.ts             # Main entry, event coordination
│   │   ├── styles.ts            # CSS for highlights, tooltips, panel
│   │   ├── highlighting.ts      # Entity highlighting engine
│   │   ├── extraction.ts        # Content extraction for PDFs
│   │   ├── page-content.ts      # Page content utilities
│   │   ├── panel.ts             # Side panel iframe management
│   │   ├── toast.ts             # Toast notifications
│   │   └── message-handlers.ts  # Message handling
│   │
│   ├── panel/                   # Side panel (entity details, forms)
│   │   ├── App.tsx              # Main orchestrator component
│   │   ├── views/               # Panel mode view components
│   │   │   ├── CommonScanResultsView.tsx     # Scan results display
│   │   │   ├── CommonUnifiedSearchView.tsx   # Multi-platform search
│   │   │   ├── CommonPreviewView.tsx         # Import preview
│   │   │   ├── CommonPlatformSelectView.tsx  # Platform selection
│   │   │   ├── OCTIContainerTypeView.tsx     # Container type selection
│   │   │   ├── OCTIContainerFormView.tsx     # Container form
│   │   │   ├── OCTIAddView.tsx               # Manual entity addition
│   │   │   ├── OCTIAddSelectionView.tsx      # Add from selection
│   │   │   ├── OCTIEntityView.tsx            # OpenCTI entity details
│   │   │   ├── OCTIExistingContainersView.tsx # Existing containers
│   │   │   ├── OCTIImportResultsView.tsx     # Import results
│   │   │   ├── OCTIInvestigationView.tsx     # Investigation view
│   │   │   ├── OAEVEntityView.tsx            # OpenAEV entity details
│   │   │   ├── OAEVScenarioView.tsx          # Scenario creation
│   │   │   ├── OAEVScenarioOverviewView.tsx  # Scenario overview
│   │   │   └── OAEVAtomicTestingView.tsx     # Atomic testing
│   │   ├── components/          # Reusable UI components
│   │   │   ├── CommonEmptyView.tsx
│   │   │   ├── CommonLoadingView.tsx
│   │   │   └── CommonNotFoundView.tsx
│   │   ├── hooks/               # React hooks
│   │   │   ├── usePanelState.ts         # Centralized state management
│   │   │   ├── usePlatforms.ts          # Platform data
│   │   │   ├── useToast.ts              # Toast notifications
│   │   │   ├── useContainerState.ts     # Container state
│   │   │   ├── useContainerActions.ts   # Container actions
│   │   │   ├── useEntityState.ts        # Entity state
│   │   │   ├── useEntityDisplay.ts      # Entity display helpers
│   │   │   ├── useScenarioState.ts      # Scenario state
│   │   │   ├── useAtomicTestingState.ts # Atomic testing state
│   │   │   ├── useInvestigationState.ts # Investigation state
│   │   │   ├── useInvestigationActions.ts # Investigation actions
│   │   │   ├── useScanResultsState.ts   # Scan results state
│   │   │   ├── useSearchState.ts        # Search state
│   │   │   ├── useAddSelectionState.ts  # Add selection state
│   │   │   └── useAIState.ts            # AI state
│   │   ├── handlers/            # Message handlers
│   │   │   ├── message-handlers.ts      # Panel message handlers
│   │   │   └── scan-results-handler.ts  # Scan results handler
│   │   ├── utils/               # Panel utilities
│   │   │   ├── platform-helpers.tsx     # Platform icons, colors, AI theme
│   │   │   ├── cvss-helpers.ts          # CVSS score formatting
│   │   │   ├── marking-helpers.ts       # TLP/PAP colors
│   │   │   └── description-helpers.ts
│   │   └── types/               # TypeScript definitions
│   │       ├── panel-types.ts           # Panel-specific types
│   │       └── view-props.ts            # View component props
│   │
│   ├── options/                 # Settings page
│   │   ├── App.tsx              # Settings orchestrator
│   │   └── components/          # Settings tabs
│   │       ├── OpenCTITab.tsx       # OpenCTI configuration
│   │       ├── OpenAEVTab.tsx       # OpenAEV configuration
│   │       ├── AITab.tsx            # AI provider settings
│   │       ├── DetectionTab.tsx     # Detection settings
│   │       └── AppearanceTab.tsx    # Theme settings
│   │
│   ├── popup/                   # Quick action popup
│   │   └── App.tsx              # Popup UI
│   │
│   └── shared/                  # Shared modules
│       ├── api/                 # API clients
│       │   ├── ai-client.ts         # AI provider client (unified interface)
│       │   ├── opencti-client.ts    # OpenCTI GraphQL client
│       │   ├── openaev-client.ts    # OpenAEV REST client
│       │   ├── ai/                  # AI provider modules
│       │   │   ├── types.ts         # AI type definitions
│       │   │   ├── prompts.ts       # AI prompt templates (system prompts, builders)
│       │   │   └── json-parser.ts   # AI response parsing
│       │   ├── opencti/             # OpenCTI GraphQL modules
│       │   │   ├── types.ts         # OpenCTI query result types
│       │   │   ├── fragments.ts     # GraphQL fragments
│       │   │   ├── queries.ts       # GraphQL queries & mutations
│       │   │   └── observable-utils.ts # Observable helpers
│       │   └── openaev/             # OpenAEV REST modules
│       │       ├── types.ts         # API request/response types
│       │       └── filters.ts       # Filter builders & payload builders
│       ├── detection/           # Detection engine
│       │   ├── detector.ts          # Main detection orchestrator
│       │   ├── patterns.ts          # Regex patterns
│       │   └── matching.ts          # Entity matching
│       ├── extraction/          # Content extraction
│       │   ├── content-extractor.ts # Content extraction
│       │   └── pdf-generator.ts     # PDF generation
│       ├── platform/            # Platform abstractions
│       │   └── registry.ts          # Platform type registry
│       ├── theme/               # Theme definitions
│       │   ├── ThemeDark.ts
│       │   ├── ThemeLight.ts
│       │   └── colors.ts
│       ├── components/          # Shared React components
│       │   ├── ItemIcon.tsx         # Entity type icons
│       │   ├── ActionButton.tsx     # Stylized action button
│       │   └── ActionButtonsGrid.tsx # Action buttons layout grid
│       ├── types/               # TypeScript definitions
│       │   ├── settings.ts          # Platform config, detection settings, extension settings
│       │   ├── ai.ts                # AI provider types, model selection, affinities
│       │   ├── observables.ts       # Observable types (IoCs) and detection interfaces
│       │   ├── platform.ts          # Cross-platform matching and enrichment types
│       │   ├── opencti.ts           # OpenCTI types (GraphQL, STIX, entities, containers)
│       │   ├── openaev.ts           # OpenAEV entities, scenarios, atomic testing
│       │   └── messages.ts          # Extension message types and payloads
│       └── utils/               # Utilities
│           ├── logger.ts            # Logging
│           ├── storage.ts           # Chrome storage wrapper
│           ├── formatters.ts        # Data formatters
│           └── entity.ts            # Entity helpers
│
├── tests/
│   ├── unit/                    # Unit tests
│   │   ├── patterns.test.ts
│   │   ├── defang.test.ts
│   │   ├── ai-client.test.ts
│   │   └── logger.test.ts
│   └── integration/             # Integration tests
│       ├── opencti/
│       └── openaev/
│
├── docs/                        # Documentation
├── scripts/                     # Build and test scripts
└── dist/                        # Built extensions
    ├── chrome/
    ├── firefox/
    └── edge/
```

## License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

## Links

- [Filigran Website](https://filigran.io)
- [OpenCTI Documentation](https://docs.opencti.io)
- [OpenAEV Documentation](https://docs.filigran.io/openaev)
- [Community](https://community.filigran.io)
- [GitHub Issues](https://github.com/FiligranHQ/xtm-browser-extension/issues)

---
© 2025 Filigran
