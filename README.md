# Filigran XTM Browser Extension

A cross-browser extension for integrating with OpenCTI and OpenAEV platforms. Detect threats, observables, and security entities directly from any web page. Features AI-powered content analysis and scenario generation for Enterprise Edition users.

[![OpenCTI Integration Tests](https://github.com/FiligranHQ/xtm-browser-extension/actions/workflows/ci-test-opencti.yml/badge.svg)](https://github.com/FiligranHQ/xtm-browser-extension/actions/workflows/ci-test-opencti.yml)
[![OpenAEV Integration Tests](https://github.com/FiligranHQ/xtm-browser-extension/actions/workflows/ci-test-openaev.yml/badge.svg)](https://github.com/FiligranHQ/xtm-browser-extension/actions/workflows/ci-test-openaev.yml)

## Quick Start

1. **Install**: Load the extension in your browser (see [Installation](./docs/installation.md))
2. **Configure**: Add your OpenCTI and/or OpenAEV platform credentials
3. **Scan**: Click "Scan Page" to detect threats and observables

## Features

### OpenCTI Integration
- 🔍 **Page Scanning** - Detect observables (IPs, domains, hashes, CVEs, etc.) and STIX entities
- 🎯 **Visual Highlighting** - Color-coded indicators (green = found, amber = new)
- 📋 **Quick Actions** - Create reports, cases, groupings, and investigations
- 📊 **Entity Details** - View author, creator, confidence/score, labels, markings, and containers
- 🔄 **Entity Cache** - Fast offline detection with background refresh
- 🤖 **AI Description Generation** - Generate container descriptions using AI (Enterprise Edition)

**Detected Entity Types:**
- **Threat Entities**: Threat Actor Groups, Intrusion Sets (APT29, Cozy Bear...), Malware, Campaigns
- **Observables**: IPs, Domains, URLs, Hashes, Emails, CVEs, Crypto Wallets, MAC Addresses
- **MITRE ATT&CK**: Attack Patterns (T1566, T1059.001...)
- **Locations**: Countries, Regions, Cities
- **Identities**: Organizations, Sectors, Individuals

### OpenAEV Integration
- 🖥️ **Asset Detection** - Find endpoints matching by name, hostname, IP addresses, and MAC addresses
- 👥 **Team & Player Matching** - Detect teams and players from page content
- 🎯 **Attack Pattern Matching** - Match MITRE ATT&CK patterns by ID (T1566, T1059.001)
- 🔍 **Findings Detection** - Match security findings by value with exact matching
- 🎮 **Scenario Generation** - Create attack scenarios from web page content
- 🤖 **AI-Powered Scenarios** - Generate comprehensive attack scenarios using AI (Enterprise Edition)
- ⚡ **Atomic Testing** - Create on-the-fly atomic tests with AI-generated command lines

### AI Features (Enterprise Edition)
- 🧠 **Multiple LLM Support** - OpenAI, Anthropic (Claude), and Google Gemini
- 📝 **Container Description AI** - Generate intelligent descriptions for OpenCTI containers
- 🎬 **Scenario AI** - Generate full attack scenarios with proper injects and affinities
- ⚡ **Atomic Testing AI** - Generate proper command lines for atomic tests
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
| OpenAI | GPT-4, GPT-4 Turbo | Yes |
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus | Yes |
| Google | Gemini 1.5 Pro, Gemini 1.5 Flash | Yes |

> **Note**: If you don't have an Enterprise Edition license, clicking AI buttons will show a dialog to start a free 30-day trial at [filigran.io/enterprise-editions-trial](https://filigran.io/enterprise-editions-trial/)

## Project Structure

```
xtm-browser-extension/
├── src/
│   ├── background/      # Service worker (API clients, cache, messaging)
│   ├── content/         # Content script (page scanning, highlighting)
│   ├── popup/           # Popup UI (quick actions)
│   ├── panel/           # Side panel (entity details)
│   ├── options/         # Settings page
│   └── shared/          # Shared utilities, types, API clients
├── tests/
│   ├── unit/            # Unit tests (patterns, logger)
│   └── integration/     # Integration tests (OpenCTI, OpenAEV)
├── docs/                # Documentation
├── scripts/             # Build and test scripts
└── dist/                # Built extensions (chrome, firefox, edge)
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
