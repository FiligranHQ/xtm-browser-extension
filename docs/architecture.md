# Architecture

This document describes the technical architecture of the Filigran XTM Browser Extension, including component structure, state management, message passing, and technical workflows.

## Table of Contents

- [Overview](#overview)
- [Component Architecture](#component-architecture)
- [State Management](#state-management)
- [Message Passing](#message-passing)
- [Technical Workflows](#technical-workflows)
- [Module Structure](#module-structure)

## Overview

The extension follows a standard browser extension architecture with four main components:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser Extension                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │    Popup     │    │   Options    │    │    Panel     │          │
│  │  (Quick UI)  │    │  (Settings)  │    │ (Side Panel) │          │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘          │
│         │                   │                   │                   │
│         └───────────────────┼───────────────────┘                   │
│                             │                                       │
│                    chrome.runtime.sendMessage                       │
│                             │                                       │
│                    ┌────────▼────────┐                              │
│                    │   Background    │                              │
│                    │ Service Worker  │                              │
│                    └────────┬────────┘                              │
│                             │                                       │
│         ┌───────────────────┼───────────────────┐                   │
│         │                   │                   │                   │
│  ┌──────▼───────┐    ┌──────▼───────┐    ┌──────▼───────┐          │
│  │   OpenCTI    │    │   OpenAEV    │    │      AI      │          │
│  │    Client    │    │    Client    │    │    Client    │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                      Content Script                          │   │
│  │  (Injected into web pages for scanning and highlighting)     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Background Service Worker (`src/background/`)

The background service worker is the central hub that:
- Manages API clients for OpenCTI and OpenAEV
- Handles entity caching (SDO cache for fast lookups)
- Processes all inter-component messages
- Manages context menus

**Structure:**
```
src/background/
├── index.ts                 # Main entry point, client initialization, cache management
├── handlers/                # Message handlers split by domain
│   ├── index.ts            # Handler registry and exports
│   ├── types.ts            # Handler type definitions
│   ├── ai-handlers.ts      # AI-related message handlers
│   ├── cache-handlers.ts   # Cache management handlers
│   ├── misc-handlers.ts    # Miscellaneous handlers
│   ├── openaev-handlers.ts # OpenAEV-specific handlers
│   ├── opencti-handlers.ts # OpenCTI-specific handlers
│   ├── scan-handlers.ts    # Page scanning handlers
│   └── settings-handlers.ts # Settings management handlers
└── services/
    ├── client-manager.ts   # API client lifecycle management
    └── message-dispatcher.ts # Centralized message routing
```

**Key State:**
- `platformClients` - Registry of OpenCTI and OpenAEV client instances
- `sdoCache` - Cached SDO entities per platform for fast detection
- `oaevCache` - Cached OpenAEV entities (attack patterns, assets, etc.)

### 2. Content Script (`src/content/`)

Injected into web pages to provide scanning, highlighting, and panel management.

**Structure:**
```
src/content/
├── index.ts              # Main entry point, event handlers, initialization
├── styles.ts             # CSS styles for highlights, tooltips, panel
├── highlighting.ts       # Entity highlighting logic
├── extraction.ts         # Content extraction for PDFs and descriptions
├── page-content.ts       # Page content utilities
├── panel.ts              # Side panel iframe management
├── toast.ts              # Toast notification system
└── message-handlers.ts   # Background/panel message handlers
```

**Key State:**
- `scanResults` - Current page scan results
- `selectedForImport` - Entities selected for import
- `currentScanMode` - Active scan mode (scan/atomic/scenario/investigation)
- `panelFrame` - Reference to the side panel iframe
- `isPanelReady` - Panel initialization state

### 3. Panel (`src/panel/`)

The side panel UI for entity details, search, and container creation.

**Structure:**
```
src/panel/
├── App.tsx               # Main panel component (orchestrates views)
├── main.tsx              # React entry point
├── index.html            # Panel HTML shell
├── types.ts              # Panel-specific type definitions
├── components/           # Reusable UI components
│   ├── EmptyView.tsx     # Empty state view
│   ├── LoadingView.tsx   # Loading state view
│   ├── NotFoundView.tsx  # Entity not found view
│   ├── PanelHeader.tsx   # Panel header with actions
│   ├── PlatformNavigation.tsx # Multi-platform navigation
│   └── ItemIcon.tsx      # Entity type icons
├── views/                # Panel mode views (extracted from App.tsx)
│   ├── index.ts          # View exports
│   ├── ScanResultsView.tsx    # Scan results display
│   ├── SearchView.tsx         # OpenCTI search
│   ├── UnifiedSearchView.tsx  # Multi-platform search
│   ├── PreviewView.tsx        # Import preview
│   ├── ImportResultsView.tsx  # Import results
│   ├── ContainerTypeView.tsx  # Container type selection
│   ├── PlatformSelectView.tsx # Platform selection
│   └── AddView.tsx            # Manual entity addition
├── hooks/                # Custom React hooks
│   ├── usePanelState.ts  # Centralized panel state management
│   ├── usePlatforms.ts   # Platform data hooks
│   └── useToast.ts       # Toast notification hook
├── utils/                # Panel utilities
│   ├── content-helpers.ts
│   ├── cvss-helpers.ts
│   ├── description-helpers.ts
│   └── platform-helpers.tsx
└── types/                # Type definitions
    ├── index.ts          # Type exports
    └── view-props.ts     # View component prop types
```

**Panel Modes:**
| Mode | Description |
|------|-------------|
| `empty` | Initial state, no entity selected |
| `loading` | Loading entity data |
| `entity` | Displaying entity details |
| `not-found` | Entity not found in any platform |
| `add` | Manual entity creation form |
| `preview` | Import selection preview |
| `platform-select` | Platform selection for multi-platform |
| `container-type` | Container type selection |
| `container-form` | Container creation form |
| `investigation` | Investigation workbench creation |
| `search` | OpenCTI search |
| `oaev-search` | OpenAEV search |
| `unified-search` | Multi-platform search |
| `scan-results` | Scan results display |
| `atomic-testing` | Atomic testing creation |
| `scenario-overview` | Scenario overview |
| `scenario-form` | Scenario creation form |
| `import-results` | Import operation results |
| `add-selection` | Add selected text from context menu |

### 4. Options Page (`src/options/`)

Settings configuration interface.

**Structure:**
```
src/options/
├── App.tsx               # Main options component
├── main.tsx              # React entry point
├── constants.ts          # Options-specific constants
└── components/           # Settings tabs
    ├── Sidebar.tsx       # Navigation sidebar
    ├── OpenCTITab.tsx    # OpenCTI platform configuration
    ├── OpenAEVTab.tsx    # OpenAEV platform configuration
    ├── DetectionTab.tsx  # Detection settings
    ├── AITab.tsx         # AI provider configuration
    ├── AppearanceTab.tsx # Theme settings
    └── AboutTab.tsx      # About and version info
```

### 5. Popup (`src/popup/`)

Quick action popup interface.

### 6. Shared Modules (`src/shared/`)

Common code shared across all components.

**Structure:**
```
src/shared/
├── api/                  # API clients
│   ├── opencti-client.ts # OpenCTI GraphQL client
│   ├── openaev-client.ts # OpenAEV REST client
│   └── ai/               # AI provider clients
│       ├── index.ts
│       ├── openai.ts
│       ├── anthropic.ts
│       ├── gemini.ts
│       └── json-parser.ts
├── detection/            # Detection engine
│   ├── detector.ts       # Main detection orchestrator
│   ├── patterns.ts       # Regex patterns for entity types
│   └── defang.ts         # Defanged IOC handling
├── extraction/           # Content extraction
│   ├── content-extractor.ts # Main extractor
│   └── pdf-generator.ts     # PDF generation
├── platform/             # Platform abstractions
│   ├── registry.ts       # Platform type registry
│   └── index.ts
├── types/                # TypeScript definitions
│   ├── index.ts          # Main type exports
│   ├── config.ts         # Configuration types
│   ├── messages.ts       # Message types
│   ├── detection.ts      # Detection types
│   ├── observable.ts     # Observable types
│   ├── sdo.ts            # SDO types
│   └── ai.ts             # AI types
├── theme/                # Theme definitions
│   ├── ThemeDark.ts
│   ├── ThemeLight.ts
│   └── colors.ts
├── components/           # Shared React components
│   └── ItemIcon.tsx      # Entity type icons
└── utils/                # Utilities
    ├── logger.ts         # Logging utility
    ├── storage.ts        # Chrome storage wrapper
    ├── formatters.ts     # Data formatters
    └── entity.ts         # Entity helpers
```

## State Management

### Background Service State

```typescript
// Platform clients (API connections)
const platformClients: {
  opencti: Map<string, OpenCTIClient>,
  openaev: Map<string, OpenAEVClient>
}

// SDO Cache (for fast detection)
// Stored in chrome.storage.local per platform
interface SDOCache {
  [platformId: string]: {
    lastRefresh: number;
    entities: CachedEntity[];
  }
}

// OpenAEV Cache (attack patterns, tags, kill chain phases)
interface OAEVCache {
  [platformId: string]: {
    attackPatterns: Map<string, AttackPattern>;
    tags: Map<string, Tag>;
    killChainPhases: Map<string, KillChainPhase>;
  }
}
```

### Content Script State

```typescript
// Current scan results
let scanResults: ScanResultPayload | null = null;

// Entities selected for import
const selectedForImport: Set<string> = new Set();

// Current scan mode
let currentScanMode: 'scan' | 'atomic' | 'scenario' | 'investigation' | null = null;

// Panel state
let panelFrame: HTMLIFrameElement | null = null;
let isPanelReady: boolean = false;
```

### Panel State (via `usePanelState` hook)

The panel uses a centralized state hook that manages:

```typescript
interface PanelState {
  // UI State
  mode: 'dark' | 'light';
  panelMode: PanelMode;
  
  // Entity State
  entity: EntityData | null;
  multiPlatformResults: MultiPlatformResult[];
  currentPlatformIndex: number;
  
  // Search State
  searchQuery: string;
  searchResults: SearchResult[];
  searching: boolean;
  
  // Container State
  containerType: string;
  containerForm: ContainerFormState;
  entitiesToAdd: EntityData[];
  
  // Scan Results State
  scanResultsEntities: ScanResultEntity[];
  selectedScanItems: Set<string>;
  
  // AI State
  aiSettings: AISettings;
  aiDiscoveringEntities: boolean;
  resolvedRelationships: ResolvedRelationship[];
  
  // Platform State
  availablePlatforms: PlatformInfo[];
  selectedPlatformId: string;
  
  // ... and more
}
```

## Message Passing

### Message Flow

```
┌─────────────┐     chrome.runtime.sendMessage     ┌─────────────┐
│   Content   │ ────────────────────────────────► │  Background │
│   Script    │ ◄──────────────────────────────── │   Worker    │
└─────────────┘         sendResponse               └─────────────┘
       │                                                  │
       │ window.postMessage                               │
       ▼                                                  │
┌─────────────┐     chrome.runtime.sendMessage           │
│    Panel    │ ──────────────────────────────────────►  │
│   (iframe)  │ ◄──────────────────────────────────────  │
└─────────────┘                                          │
                                                         │
┌─────────────┐     chrome.runtime.sendMessage           │
│   Options   │ ──────────────────────────────────────►  │
│    Page     │ ◄──────────────────────────────────────  │
└─────────────┘                                          │
```

### Message Types

**Content Script ↔ Background:**
| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `SCAN_PAGE` | Content → BG | Request page scan |
| `SCAN_RESULTS` | BG → Content | Return scan results |
| `GET_ENTITY_DETAILS` | Content → BG | Fetch entity details |
| `GET_SETTINGS` | Any → BG | Get extension settings |
| `SAVE_SETTINGS` | Options → BG | Save settings |

**Panel ↔ Background:**
| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `SEARCH_ENTITIES` | Panel → BG | Search entities |
| `CREATE_CONTAINER` | Panel → BG | Create container |
| `IMPORT_ENTITIES` | Panel → BG | Import entities |
| `AI_GENERATE_DESCRIPTION` | Panel → BG | Generate AI description |
| `AI_RESOLVE_RELATIONSHIPS` | Panel → BG | Resolve entity relationships |

**Content Script ↔ Panel:**
| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `SHOW_ENTITY` | Content → Panel | Show entity details |
| `SCAN_RESULTS_UPDATE` | Content → Panel | Update scan results |
| `XTM_TOGGLE_SELECTION` | Panel → Content | Toggle entity selection |
| `XTM_SCROLL_TO_FIRST` | Panel → Content | Scroll to first highlight |

### Handler Registry

Background handlers are organized by domain:

```typescript
// Handler registration
const handlerRegistry = new Map<string, MessageHandler>();

// Domain handlers
openctiHandlers: GET_ENTITY_DETAILS, SEARCH_ENTITIES, CREATE_ENTITY, ...
openaevHandlers: OAEV_SEARCH, GET_OAEV_ENTITY_DETAILS, CREATE_SCENARIO, ...
aiHandlers: AI_GENERATE_DESCRIPTION, AI_GENERATE_SCENARIO, AI_DISCOVER_ENTITIES, ...
settingsHandlers: GET_SETTINGS, SAVE_SETTINGS, TEST_CONNECTION, ...
scanHandlers: SCAN_PAGE, SCAN_OAEV, ...
cacheHandlers: REFRESH_SDO_CACHE, GET_CACHE_STATS, CLEAR_CACHE, ...
```

## Technical Workflows

### 1. Page Scan Workflow

```
User clicks "Scan Page"
         │
         ▼
┌─────────────────┐
│ Content Script  │
│ getTextNodes()  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Detector     │
│ detectPatterns()│
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Background: SCAN_PAGE   │
│ - Check SDO cache       │
│ - Query platforms       │
│ - Merge results         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────┐
│ Content Script  │
│ highlightResults│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Panel       │
│ Show results    │
└─────────────────┘
```

### 2. Entity Lookup Workflow

```
User clicks highlighted entity
         │
         ▼
┌─────────────────────────────┐
│ Content Script              │
│ - Prevent default           │
│ - Send SHOW_ENTITY to panel │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Panel                           │
│ - Check if entity has full data │
│ - If not, fetch from background │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Background: GET_ENTITY_DETAILS  │
│ - Query all configured platforms│
│ - Return merged results         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Panel                           │
│ - Display entity with all data  │
│ - Show multi-platform navigation│
│   if found in multiple platforms│
└─────────────────────────────────┘
```

### 3. Container Creation Workflow

```
User selects entities and clicks "Create Container"
         │
         ▼
┌─────────────────────────────┐
│ Panel: Preview View         │
│ - Show selected entities    │
│ - AI relationship resolution│
│ - Options (indicators, PDF) │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Panel: Platform Select      │
│ (if multiple platforms)     │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Panel: Check Existing       │
│ FIND_CONTAINERS_BY_URL      │
└────────┬────────────────────┘
         │
    ┌────┴────┐
    │ Exists? │
    └────┬────┘
         │
    ┌────┴────────────────┐
    │                     │
    ▼                     ▼
┌─────────────┐    ┌─────────────┐
│ Update      │    │ Container   │
│ Existing    │    │ Type Select │
└─────────────┘    └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ Container   │
                   │ Form        │
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────────────┐
                   │ Background:         │
                   │ CREATE_CONTAINER    │
                   │ - Create container  │
                   │ - Add entities      │
                   │ - Create indicators │
                   │ - Attach PDF        │
                   └──────┬──────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ Import      │
                   │ Results     │
                   └─────────────┘
```

### 4. AI Entity Discovery Workflow

```
User clicks "Discover more with AI"
         │
         ▼
┌─────────────────────────────┐
│ Panel: Get page content     │
│ - Request from content script│
│ - Extract clean text        │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Background: AI_DISCOVER_ENTITIES│
│ - Build prompt with:           │
│   - Page title                 │
│   - Page URL                   │
│   - Page content               │
│   - Existing entities          │
│ - Call AI provider             │
│ - Parse JSON response          │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Panel                       │
│ - Add AI-discovered entities│
│ - Mark as AI-discovered     │
│ - Update scan results       │
└─────────────────────────────┘
```

### 5. SDO Cache Refresh Workflow

```
┌─────────────────────────────────┐
│ Background: On startup or timer │
│ checkAndRefreshAllSDOCaches()   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ For each OpenCTI platform:      │
│ - Check cache age               │
│ - If stale, fetch bulk SDOs     │
│ - Store in chrome.storage.local │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ For each OpenAEV platform:      │
│ - Fetch attack patterns         │
│ - Fetch tags                    │
│ - Fetch kill chain phases       │
│ - Store in memory cache         │
└─────────────────────────────────┘
```

## Module Structure

### API Client Architecture

```typescript
// OpenCTI Client (GraphQL)
class OpenCTIClient {
  // Connection
  testConnection(): Promise<ConnectionInfo>
  
  // Queries
  searchEntities(query: string): Promise<Entity[]>
  searchObservables(query: string): Promise<Observable[]>
  fetchSDOsForCache(): Promise<SDO[]>
  
  // Mutations
  createObservable(input): Promise<Observable>
  createContainer(input): Promise<Container>
  addEntitiesToContainer(containerId, entityIds): Promise<void>
}

// OpenAEV Client (REST)
class OpenAEVClient {
  // Connection
  testConnection(): Promise<ConnectionInfo>
  
  // Queries
  searchAssets(query: string): Promise<Asset[]>
  searchAttackPatterns(query: string): Promise<AttackPattern[]>
  getAllAttackPatterns(): Promise<AttackPattern[]>
  
  // Mutations
  createScenario(input): Promise<Scenario>
  createAtomicTesting(input): Promise<AtomicTesting>
  createPayload(input): Promise<Payload>
}

// AI Client (Provider-agnostic)
class AIClient {
  generateDescription(context): Promise<string>
  generateScenario(context): Promise<Scenario>
  discoverEntities(context): Promise<Entity[]>
  resolveRelationships(entities, context): Promise<Relationship[]>
}
```

### Detection Engine

```typescript
// Detection flow
detectEntities(textNodes: Text[]): DetectedEntity[] {
  1. buildNodeMap(textNodes)     // Build searchable text index
  2. detectObservables(text)      // IPs, domains, hashes, etc.
  3. detectSDOs(text, sdoCache)   // Match against cached entities
  4. detectOAEVEntities(text)     // OpenAEV-specific entities
  5. mergeResults()               // Deduplicate and combine
}

// Pattern types
patterns = {
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
  ipv6: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/,
  domain: /\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b/,
  md5: /\b[a-fA-F0-9]{32}\b/,
  sha256: /\b[a-fA-F0-9]{64}\b/,
  cve: /\bCVE-\d{4}-\d{4,}\b/,
  mitre: /\bT\d{4}(?:\.\d{3})?\b/,
  // ... and more
}
```

## Performance Considerations

1. **SDO Caching**: Entities are cached locally to avoid API calls during scanning
2. **Lazy Loading**: Panel loads labels/markings on-demand
3. **Debounced Search**: Search inputs are debounced to reduce API calls
4. **Background Refresh**: Cache refresh happens in background without blocking UI
5. **Efficient Highlighting**: Text nodes are indexed once, patterns run in parallel

## Security

1. **API Tokens**: Stored in chrome.storage.local (encrypted by browser)
2. **Content Isolation**: Panel runs in isolated iframe
3. **CSP Compliance**: All scripts bundled, no eval or inline scripts
4. **Message Validation**: All messages validated before processing

---

For more information, see the [Development Guide](./development.md) and [Troubleshooting](./troubleshooting.md).

