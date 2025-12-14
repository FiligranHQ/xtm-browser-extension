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
│   ├── api/             # API clients
│   │   ├── opencti-client.ts    # OpenCTI GraphQL client
│   │   └── openaev-client.ts    # OpenAEV REST client
│   ├── components/      # Shared React components
│   ├── detection/       # Detection engine
│   │   ├── detector.ts  # Entity and observable detection
│   │   └── patterns.ts  # Regex patterns for observables
│   ├── theme/           # Theme configuration
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utilities
│       ├── logger.ts    # Structured logging
│       └── storage.ts   # Chrome storage helpers
├── assets/              # Static assets (icons, logos, CSS)
└── manifest.*.json      # Browser-specific manifests
```

## Testing

### Test Structure

```
tests/
├── setup.ts             # Vitest setup (Chrome API mocks)
├── unit/                # Unit tests (no external dependencies)
│   ├── logger.test.ts   # Logger utility tests
│   └── patterns.test.ts # Regex pattern tests
└── integration/         # Integration tests (require running platforms)
    ├── opencti/
    │   └── client.test.ts   # OpenCTI API tests
    └── openaev/
        └── client.test.ts   # OpenAEV API tests
```

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

### OpenCTI Client

GraphQL client for OpenCTI platform:

```typescript
import { OpenCTIClient } from './shared/api/opencti-client';

const client = new OpenCTIClient({
  url: 'https://opencti.example.com',
  token: 'your-api-token'
});

// Test connection
const version = await client.testConnection();

// Search entities
const results = await client.searchEntities('APT29');

// Get SDOs for caching
const sdos = await client.getSDOsByTypes(['Intrusion-Set', 'Malware'], 1000);
```

### OpenAEV Client

REST client for OpenAEV platform:

```typescript
import { OpenAEVClient } from './shared/api/openaev-client';

const client = new OpenAEVClient({
  url: 'https://openaev.example.com',
  token: 'your-api-token'
});

// Get assets
const assets = await client.getAssets();

// Get attack patterns
const patterns = await client.getAttackPatterns();
```

## Detection Engine

### Observable Detection

Regex-based detection for observables:

```typescript
import { detectObservables } from './shared/detection/detector';

const text = 'Check this IP: 192.168.1.1 and domain evil.com';
const observables = detectObservables(text);
// Returns: [{ type: 'IPv4-Addr', value: '192.168.1.1' }, { type: 'Domain-Name', value: 'evil.com' }]
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
| `GET_ENTITY` | Panel → Background | Fetch entity details |
| `REFRESH_CACHE` | Options → Background | Refresh SDO/OAEV cache |
| `CLEAR_SDO_CACHE` | Options → Background | Clear OpenCTI cache |
| `CLEAR_OAEV_CACHE` | Options → Background | Clear OpenAEV cache |
| `HIGHLIGHT_RESULTS` | Background → Content | Apply highlights to page |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Write tests for new functionality
4. Ensure all tests pass: `npm test`
5. Commit with clear messages
6. Push and create a Pull Request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.
