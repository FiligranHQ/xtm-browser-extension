# Filigran XTM Browser Extension

[![CI](https://github.com/FiligranHQ/xtm-browser-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/FiligranHQ/xtm-browser-extension/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/FiligranHQ/xtm-browser-extension/graph/badge.svg)](https://codecov.io/gh/FiligranHQ/xtm-browser-extension)

The **Filigran XTM Browser Extension** transforms your web browser into a powerful threat intelligence workstation. Seamlessly integrated with [OpenCTI](https://filigran.io/solutions/open-cti/) (Cyber Threat Intelligence), [OpenAEV](https://filigran.io/solutions/openaev/) (Adversarial Exposure Validation), and [XTM One](https://filigran.io/solutions/xtm-one/) (Agentic AI Platform) platforms, this extension enables security analysts to detect, enrich, and operationalize threat data directly from any web page.

**Turn any threat report into actionable intelligence in seconds.** Automatically scan pages for indicators of compromise (IOCs), threat actors, malware families, MITRE ATT&CK techniques, vulnerabilities, and more. With a single click, create structured reports, launch investigations, or generate attack scenarios—all without leaving your browser.

### Why Use This Extension?

- 🔗 **Seamless Platform Integration** — Connect to multiple OpenCTI, OpenAEV, and XTM One instances simultaneously
- ⚡ **Real-Time Detection** — Instantly identify threats, observables, and entities as you browse
- 🧠 **AI-Powered Analysis** — Generate intelligent descriptions, attack scenarios, and atomic tests (Enterprise Edition)
- 📄 **One-Click Capture** — Create professional PDF snapshots and structured reports from any article
- 🎯 **Visual Intelligence** — Color-coded highlights show what's known, new, or dangerous
- 🔒 **Defanged IOC Support** — Automatically detect and refang `example[.]com`, `hxxps://` formats
- 🏢 **Enterprise Ready** — Multi-platform support with Enterprise Edition AI capabilities

## Quick Start

1. **Install**: Load the extension in your browser (see [Installation](./docs/installation.md))
2. **Configure**: Add your OpenCTI and/or OpenAEV platform credentials; optionally connect XTM One for AI features
3. **Scan**: Click "Scan Page" to detect threats and observables

## Features

### OpenCTI Integration
- 🔍 **Page Scanning** - Detect observables (IPs, domains, hashes, CVEs, etc.) and STIX entities
- 📄 **PDF Scanning** - Full PDF document scanning with integrated viewer, vertical scrolling, and entity highlighting
- 🎯 **Visual Highlighting** - Color-coded indicators (green = found, amber = new) with scroll-to-highlight glow effect
- 📋 **Quick Actions** - Create reports, cases, groupings, and investigations
- 📊 **Entity Details** - View author, creator, confidence/score, labels, markings, and containers
- 🔄 **Entity Cache** - Fast offline detection with background refresh
- 🤖 **AI Description Generation** - Generate container descriptions using AI (Enterprise Edition)
- 📄 **PDF Generation** - Capture web pages as PDF attachments for containers
- 🔮 **AI Discovery on Empty Results** - Trigger AI-based entity discovery even when initial scan finds nothing

**Detected Entity Types:**
- **Threat Entities**: Threat Actor Groups/Individuals, Intrusion Sets (APT29, Cozy Bear...), Malware, Tools, Campaigns
- **Disinformation**: Narratives, Channels (Telegram groups, Discord servers, forums)
- **Observables**: IPs, Domains, URLs, Hashes, Emails, CVEs, Crypto Wallets, MAC Addresses
- **Defanged IOCs**: Automatic detection of defanged indicators (e.g., `example[.]com`, `hxxps://`)
- **MITRE ATT&CK**: Attack Patterns (T1566, T1059.001...)
- **Locations**: Countries, Regions, Cities, Administrative Areas
- **Identities**: Organizations, Sectors, Individuals, Systems

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

### XTM One Integration (Enterprise Edition)

[XTM One](https://filigran.io/solutions/xtm-one/) is Filigran's agentic AI platform and the sole AI backend for the extension. All AI features are delegated to dedicated XTM One agents — no BYOK LLM keys required.

- 📝 **Container Description AI** - Generate intelligent descriptions for OpenCTI containers
- 🎬 **Full Scenario Generation** - Generate complete attack scenarios with AI-created injects, payloads, or email content based on page context
- 🎭 **Theme-Aware Generation** - AI adapts to selected scenario theme with domain-specific knowledge
- ✉️ **Multi-Language Emails** - Generate realistic email content in 13 languages for table-top exercises
- ⚡ **Atomic Testing AI** - Generate proper command lines for atomic tests with cleanup commands
- 🔍 **Smart Entity Discovery** - Discover additional entities that regex patterns might miss with three options:
  - "Entities (AI)" for entity-only discovery
  - "Relations (AI)" for relationship discovery between entities
  - "Scan All (AI)" for combined entity and relationship discovery
- 🔗 **Relationship Resolution** - AI identifies relationships using valid STIX 2.1 and OpenCTI relationship types only

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

Tests run automatically on push and pull requests via GitHub Actions with unified coverage reporting:

| Job | Description |
|-----|-------------|
| **Lint & Type Check** | ESLint and TypeScript compilation check (runs first) |
| **Unit Tests** | Fast unit tests for shared utilities, patterns, and detection logic |
| **OpenCTI Integration** | Spins up Redis, Elasticsearch, MinIO, RabbitMQ, and OpenCTI |
| **OpenAEV Integration** | Spins up PostgreSQL, Elasticsearch, MinIO, RabbitMQ, and OpenAEV |
| **Coverage Upload** | Aggregates all coverage reports and uploads to Codecov |

See `.github/workflows/ci.yml` for details.

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
| Chrome  | ✅ Full Support | Native side panel + floating panel |
| Edge    | ✅ Full Support | Native side panel + floating panel |
| Firefox | ✅ Full Support | Native sidebar + floating panel |
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

### AI Configuration (XTM One — Enterprise Edition Only)

AI features require at least one connected Enterprise Edition platform (OpenCTI or OpenAEV) **and** a configured [XTM One](https://filigran.io/solutions/xtm-one/) instance. XTM One is Filigran's agentic AI platform and the sole AI backend — no BYOK LLM keys required.

Configure your XTM One connection in **Settings > AI**:

| Field | Description |
|-------|-------------|
| **XTM One URL** | Base URL of your XTM One instance (e.g. `https://xtmone.example.com`) |
| **API Token** | Personal API token generated from your XTM One profile |

After entering your credentials, click **Test Connection** to validate the connection.

> **Note**: If you don't have an Enterprise Edition license, clicking AI buttons will show a dialog to start a free 30-day trial at [filigran.io/enterprise-editions-trial](https://filigran.io/enterprise-editions-trial/)

## Project Structure

```
xtm-browser-extension/
├── src/
│   ├── background/              # Service worker (API clients, cache, messaging)
│   │   ├── index.ts             # Main entry, client init, message handling
│   │   ├── handlers/            # Message handlers split by domain
│   │   │   ├── ai-handlers.ts       # AI generation requests
│   │   │   ├── container-handlers.ts # Container creation
│   │   │   ├── entity-handlers.ts   # Entity operations
│   │   │   ├── misc-handlers.ts     # Misc handlers (injection, panel, PDF)
│   │   │   ├── openaev-handlers.ts  # OpenAEV API operations
│   │   │   ├── opencti-handlers.ts  # OpenCTI API operations
│   │   │   ├── pdf-handlers.ts      # PDF scanning handlers
│   │   │   ├── platform-utils.ts    # Shared platform utilities
│   │   │   ├── scan-handlers.ts     # Page scanning logic
│   │   │   ├── scenario-handlers.ts # Scenario creation
│   │   │   └── types.ts             # Handler type definitions
│   │   └── services/            # Background services
│   │       ├── cache-manager.ts     # Entity cache management
│   │       ├── client-manager.ts    # API client lifecycle
│   │       └── message-dispatcher.ts # Message routing
│   │
│   ├── content/                 # Content script (injected into pages)
│   │   ├── index.ts             # Main entry, event coordination
│   │   ├── styles.ts            # CSS for highlights, tooltips, panel
│   │   ├── highlighting.ts      # Entity highlighting engine
│   │   ├── message-handlers.ts  # Message handling from background/panel
│   │   ├── extraction.ts        # Content extraction for PDFs
│   │   ├── page-content.ts      # Page content utilities
│   │   ├── panel.ts             # Side panel iframe management
│   │   ├── toast.ts             # Toast notifications
│   │   └── utils/
│   │       └── highlight.ts     # Shared highlighting utilities
│   │
│   ├── panel/                   # Side panel (entity details, forms)
│   │   ├── App.tsx              # Main orchestrator component
│   │   ├── views/               # Panel mode view components
│   │   │   ├── CommonPlatformSelectView.tsx  # Platform selection
│   │   │   ├── CommonPreviewView.tsx         # Import preview
│   │   │   ├── CommonScanResultsView.tsx     # Scan results display
│   │   │   ├── CommonUnifiedSearchView.tsx   # Multi-platform search
│   │   │   ├── OAEVAtomicTestingView.tsx     # Atomic testing
│   │   │   ├── OAEVEntityView.tsx            # OpenAEV entity details
│   │   │   ├── OAEVScenarioView.tsx          # Scenario creation
│   │   │   ├── OCTIAddSelectionView.tsx      # Add from selection
│   │   │   ├── OCTIAddView.tsx               # Manual entity addition
│   │   │   ├── OCTIContainerFormView.tsx     # Container form
│   │   │   ├── OCTIContainerTypeView.tsx     # Container type selection
│   │   │   ├── OCTIEntityView.tsx            # OpenCTI entity details
│   │   │   ├── OCTIExistingContainersView.tsx # Existing containers
│   │   │   ├── OCTIImportResultsView.tsx     # Import results
│   │   │   └── OCTIInvestigationView.tsx     # Investigation view
│   │   ├── components/          # Reusable UI components
│   │   │   ├── CommonEmptyView.tsx
│   │   │   ├── CommonLoadingView.tsx
│   │   │   ├── CommonNotFoundView.tsx
│   │   │   ├── scan-results/    # Scan results components
│   │   │   │   ├── ScanResultsAIButtons.tsx
│   │   │   │   ├── ScanResultsEntityItem.tsx
│   │   │   │   ├── ScanResultsFilters.tsx
│   │   │   │   ├── ScanResultsRelationshipItem.tsx
│   │   │   │   └── ScanResultsSelectionActions.tsx
│   │   │   └── scenario/        # Scenario components
│   │   │       ├── ScenarioFormView.tsx
│   │   │       ├── ScenarioInjectSelector.tsx
│   │   │       ├── ScenarioPlatformSelector.tsx
│   │   │       ├── ScenarioSummary.tsx
│   │   │       └── ScenarioTypeSelector.tsx
│   │   ├── hooks/               # React hooks
│   │   │   ├── useAddSelectionState.ts  # Add selection state
│   │   │   ├── useAIState.ts            # AI state
│   │   │   ├── useAtomicTestingState.ts # Atomic testing state
│   │   │   ├── useContainerActions.ts   # Container actions
│   │   │   ├── useContainerState.ts     # Container state
│   │   │   ├── useEntityDisplay.ts      # Entity display helpers
│   │   │   ├── useEntityState.ts        # Entity state
│   │   │   ├── useInvestigationActions.ts # Investigation actions
│   │   │   ├── useInvestigationState.ts # Investigation state
│   │   │   ├── usePlatformNavigation.ts # Platform navigation (shared)
│   │   │   ├── usePlatforms.ts          # Platform data
│   │   │   ├── useScanResultsState.ts   # Scan results state
│   │   │   ├── useScenarioState.ts      # Scenario state
│   │   │   ├── useSearchState.ts        # Search state
│   │   │   └── useToast.ts              # Toast notifications
│   │   ├── handlers/            # Message handlers
│   │   │   └── scan-results-handler.ts  # Scan results handler
│   │   ├── utils/               # Panel utilities
│   │   │   ├── ai-entity-helpers.ts     # AI entity payload utilities
│   │   │   ├── platform-helpers.tsx     # Platform icons, colors, AI theme
│   │   │   ├── cvss-helpers.ts          # CVSS score formatting
│   │   │   ├── marking-helpers.ts       # TLP/PAP colors
│   │   │   ├── description-helpers.ts   # Description generation
│   │   │   └── content-messaging.ts     # Content script messaging
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
│   ├── pdf-scanner/             # PDF viewer with scanning
│   │   ├── App.tsx              # PDF viewer component
│   │   ├── index.html           # Entry point
│   │   └── main.tsx             # React entry
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
│       │   ├── theme-dark.ts
│       │   ├── theme-light.ts
│       │   └── colors.ts
│       ├── components/          # Shared React components
│       │   ├── ItemIcon.tsx         # Entity type icons
│       │   ├── ActionButton.tsx     # Stylized action button
│       │   └── ActionButtonsGrid.tsx # Action buttons layout grid
│       ├── types/               # TypeScript definitions
│       │   ├── ai.ts                # AI provider types, model selection, affinities
│       │   ├── common.ts            # Common response types and utilities
│       │   ├── messages.ts          # Extension message types and payloads
│       │   ├── observables.ts       # Observable types (IoCs) and detection interfaces
│       │   ├── openaev.ts           # OpenAEV entities, scenarios, atomic testing
│       │   ├── opencti.ts           # OpenCTI types (GraphQL, STIX, entities, containers)
│       │   ├── platform.ts          # Cross-platform matching and enrichment types
│       │   ├── scan.ts              # Scan result types
│       │   └── settings.ts          # Platform config, detection settings, extension settings
│       └── utils/               # Utilities
│           ├── entity.ts            # Entity helpers
│           ├── formatters.ts        # Data formatters
│           ├── highlight-colors.ts  # Highlight color utilities
│           ├── logger.ts            # Logging
│           └── storage.ts           # Chrome storage wrapper
│
├── tests/
│   ├── unit/                    # Unit tests (25+ test files)
│   │   ├── ai-client.test.ts        # AI client tests
│   │   ├── cache-manager.test.ts    # Cache tests
│   │   ├── client-manager.test.ts   # Client manager tests
│   │   ├── client-registry.test.ts  # Client registry tests
│   │   ├── constants.test.ts        # Constants tests
│   │   ├── defang.test.ts           # Defanging tests
│   │   ├── detection.test.ts        # Detection tests
│   │   ├── detector.test.ts         # Detector tests
│   │   ├── entity-handlers.test.ts  # Entity handlers tests
│   │   ├── entity-utils.test.ts     # Entity utils tests
│   │   ├── formatters.test.ts       # Formatters tests
│   │   ├── handler-types.test.ts    # Handler types tests
│   │   ├── logger.test.ts           # Logger tests
│   │   ├── matching.test.ts         # Matching tests
│   │   ├── message-dispatcher.test.ts # Dispatcher tests
│   │   ├── messages.test.ts         # Messages tests
│   │   ├── misc-handlers.test.ts    # Misc handlers tests
│   │   ├── openaev-client.test.ts   # OpenAEV client tests
│   │   ├── opencti-client.test.ts   # OpenCTI client tests
│   │   ├── panel-utils.test.ts      # Panel utils tests
│   │   ├── patterns.test.ts         # Pattern tests
│   │   ├── pdf-scanner-utils.test.ts # PDF scanner tests
│   │   ├── refang.test.ts           # Refanging tests
│   │   ├── scan-handlers.test.ts    # Scan handlers tests
│   │   └── storage.test.ts          # Storage tests
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
- [XTM One Documentation](https://docs.filigran.io/xtm-one)
- [Community](https://community.filigran.io)
- [GitHub Issues](https://github.com/FiligranHQ/xtm-browser-extension/issues)

---
© 2026 Filigran
