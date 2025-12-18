# Architecture

This document describes the technical architecture of the Filigran XTM Browser Extension, including component structure, state management, message passing, and technical workflows.

## Table of Contents

- [Overview](#overview)
- [Component Architecture](#component-architecture)
- [State Management](#state-management)
- [Message Passing](#message-passing)
- [Panel State Machine](#panel-state-machine)
- [Technical Workflows](#technical-workflows)
- [Module Structure](#module-structure)
- [AI Integration](#ai-integration)

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
- Handles entity caching (OpenCTI/OpenAEV entity cache for fast lookups)
- Processes all inter-component messages
- Manages context menus

**Structure:**
```
src/background/
├── index.ts                 # Main entry point, client initialization
├── handlers/                # Message handlers split by domain
│   ├── index.ts            # Handler registry (createHandlerRegistry function)
│   ├── types.ts            # Handler type definitions
│   ├── ai-handlers.ts      # AI-related message handlers
│   ├── cache-handlers.ts   # Cache management handlers
│   ├── container-handlers.ts # Container creation handlers
│   ├── misc-handlers.ts    # Miscellaneous handlers
│   ├── openaev-handlers.ts # OpenAEV-specific handlers
│   ├── opencti-handlers.ts # OpenCTI-specific handlers
│   ├── scan-handlers.ts    # Page scanning handlers
│   ├── scenario-handlers.ts # Scenario generation handlers
│   └── settings-handlers.ts # Settings management handlers
└── services/
    ├── cache-manager.ts    # Entity cache management (OpenCTI & OpenAEV)
    ├── client-manager.ts   # API client lifecycle management
    └── message-dispatcher.ts # Centralized message routing
```

**Key State:**
- `platformClients` - Registry of OpenCTI and OpenAEV client instances
- `octiCache` - Cached OpenCTI entities per platform for fast detection
- `oaevCache` - Cached OpenAEV entities (attack patterns, assets, etc.)

### 2. Content Script (`src/content/`)

Injected into web pages to provide scanning, highlighting, and panel management.

**Structure:**
```
src/content/
├── index.ts              # Main entry point, event handlers, message handling
├── styles.ts             # CSS styles for highlights, tooltips, panel
├── highlighting.ts       # Entity highlighting logic
├── extraction.ts         # Content extraction for PDFs and descriptions
├── page-content.ts       # Page content utilities
├── panel.ts              # Side panel iframe management
└── toast.ts              # Toast notification system
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
├── components/           # Reusable UI components
│   ├── CommonEmptyView.tsx    # Empty state view
│   ├── CommonLoadingView.tsx  # Loading state view
│   └── CommonNotFoundView.tsx # Entity not found view
├── handlers/             # Message handlers
│   ├── message-handlers.ts      # Panel message handlers
│   └── scan-results-handler.ts  # Scan results handler
├── views/                # Panel mode views
│   ├── CommonScanResultsView.tsx     # Scan results display
│   ├── CommonUnifiedSearchView.tsx   # Multi-platform search
│   ├── CommonPreviewView.tsx         # Import preview
│   ├── CommonPlatformSelectView.tsx  # Platform selection
│   ├── OCTIContainerTypeView.tsx     # Container type selection
│   ├── OCTIContainerFormView.tsx     # Container form
│   ├── OCTIAddView.tsx               # Manual entity addition
│   ├── OCTIAddSelectionView.tsx      # Add from selection
│   ├── OCTIEntityView.tsx            # OpenCTI entity details
│   ├── OCTIExistingContainersView.tsx # Existing containers
│   ├── OCTIImportResultsView.tsx     # Import results
│   ├── OCTIInvestigationView.tsx     # Investigation view
│   ├── OAEVEntityView.tsx            # OpenAEV entity details
│   ├── OAEVScenarioView.tsx          # Scenario creation
│   ├── OAEVScenarioOverviewView.tsx  # Scenario overview
│   └── OAEVAtomicTestingView.tsx     # Atomic testing
├── hooks/                # Custom React hooks
│   ├── usePanelState.ts         # Centralized panel state management
│   ├── usePlatforms.ts          # Platform data hooks
│   ├── useToast.ts              # Toast notification hook
│   ├── useContainerState.ts     # Container state
│   ├── useContainerActions.ts   # Container actions
│   ├── useEntityState.ts        # Entity state
│   ├── useEntityDisplay.ts      # Entity display helpers
│   ├── useScenarioState.ts      # Scenario state
│   ├── useAtomicTestingState.ts # Atomic testing state
│   ├── useInvestigationState.ts # Investigation state
│   ├── useInvestigationActions.ts # Investigation actions
│   ├── useScanResultsState.ts   # Scan results state
│   ├── useSearchState.ts        # Search state
│   ├── useAddSelectionState.ts  # Add selection state
│   └── useAIState.ts            # AI state
├── utils/                # Panel utilities
│   ├── platform-helpers.tsx  # Platform icons, colors, AI theme
│   ├── cvss-helpers.ts       # CVSS score formatting
│   ├── description-helpers.ts # HTML content processing
│   └── marking-helpers.ts    # TLP/PAP marking colors
└── types/                # Type definitions
    ├── panel-types.ts    # Panel-specific types
    └── view-props.ts     # View component prop types
```

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
│   ├── ai-client.ts      # AI provider client (unified interface)
│   ├── opencti-client.ts # OpenCTI GraphQL client
│   ├── openaev-client.ts # OpenAEV REST client
│   ├── ai/               # AI provider modules
│   │   ├── types.ts      # AI request/response types
│   │   ├── prompts.ts    # AI prompt templates (system prompts, theme configs, builders)
│   │   └── json-parser.ts # AI response parsing utilities
│   ├── opencti/          # OpenCTI GraphQL modules
│   │   ├── types.ts      # OpenCTI-specific types (query responses)
│   │   ├── fragments.ts  # Reusable GraphQL fragments
│   │   ├── queries.ts    # GraphQL queries, mutations, and filter builders
│   │   └── observable-utils.ts # Observable type mapping and input builders
│   └── openaev/          # OpenAEV REST modules
│       └── filters.ts    # Filter builders, payload builders, and type utilities
├── detection/            # Detection engine
│   ├── detector.ts       # Main detection orchestrator
│   ├── patterns.ts       # Regex patterns for entity types
│   ├── matching.ts       # Entity matching logic
│   └── text-utils.ts     # Text processing utilities
├── extraction/           # Content extraction
│   ├── content-extractor.ts # Main extractor
│   ├── pdf-generator.ts     # PDF generation
│   └── native-pdf.ts        # Native PDF support
├── platform/             # Platform abstractions
│   └── registry.ts       # Platform type registry
├── types/                # TypeScript definitions
│   ├── settings.ts       # Platform config, extension settings
│   ├── ai.ts             # AI provider config, settings
│   ├── observables.ts    # Observable types (IPs, domains, hashes)
│   ├── platform.ts       # Multi-platform matching types
│   ├── api.ts            # GraphQL/API response types
│   ├── ui.ts             # UI state types (scan state, panel state)
│   ├── opencti.ts        # OpenCTI types (STIX, entities, containers)
│   ├── openaev.ts        # OpenAEV types (entities, scenarios)
│   └── messages.ts       # Message types for extension communication
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
    ├── entity.ts         # Entity helpers
    └── messaging.ts      # Message utilities
```

## API Client Architecture

### OpenCTI Client (`src/shared/api/opencti-client.ts`)

The OpenCTI client is a GraphQL client with modular query organization:

```
src/shared/api/opencti/
├── types.ts           # Query response types (SDOQueryResponse, etc.)
├── fragments.ts       # Reusable GraphQL fragments (OBSERVABLE_PROPERTIES, SDO_PROPERTIES)
├── queries.ts         # All GraphQL queries, mutations, and filter builders
└── observable-utils.ts # Observable type mapping (STIX ↔ GraphQL)
```

**Key modules:**
- **fragments.ts**: GraphQL fragments for consistent entity field selection
- **queries.ts**: All queries/mutations extracted (~350 lines) with filter builder functions
- **observable-utils.ts**: Maps observable types between STIX and GraphQL formats

**Design pattern:**
```typescript
// queries.ts exports query strings and builder functions
export const SEARCH_OBSERVABLE_QUERY = `...`;
export function buildValueFilter(value: string, type?: string): object;

// opencti-client.ts imports and uses them
import { SEARCH_OBSERVABLE_QUERY, buildValueFilter } from './opencti/queries';
const data = await this.query(SEARCH_OBSERVABLE_QUERY, { filters: buildValueFilter(value, type) });
```

### OpenAEV Client (`src/shared/api/openaev-client.ts`)

The OpenAEV client is a REST API client with modular filter organization:

```
src/shared/api/openaev/
└── filters.ts   # Filter builders, payload builders, and type utilities
```

**Key modules:**
- **filters.ts**: Filter group builders, payload builders, atomic testing utilities (~300 lines)

**Filter builder pattern:**
```typescript
// filters.ts exports builder functions
export function buildAssetSearchFilter(searchTerm: string): FilterGroup;
export function buildSearchBody(options: SearchOptions): SearchBody;
export function buildPayloadBody(input: PayloadInput): Record<string, unknown>;

// openaev-client.ts imports and uses them
import { buildAssetSearchFilter, buildSearchBody } from './openaev/filters';
const response = await this.request('/api/endpoints/search', {
  method: 'POST',
  body: JSON.stringify(buildSearchBody({ filterGroup: buildAssetSearchFilter(term) })),
});
```

## State Management

### Background Service State

```typescript
// Platform clients (API connections)
const platformClients: {
  opencti: Map<string, OpenCTIClient>,
  openaev: Map<string, OpenAEVClient>
}

// OpenCTI Entity Cache (for fast detection) - stored in chrome.storage.local per platform
interface OCTIEntityCache {
  [platformId: string]: {
    lastRefresh: number;
    entities: CachedOCTIEntity[];
  }
}

// OpenAEV Entity Cache (attack patterns, assets, tags, kill chain phases)
interface OAEVEntityCache {
  [platformId: string]: {
    attackPatterns: Map<string, AttackPattern>;
    assets: Map<string, Asset>;
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

### Panel State

The panel manages complex state for multiple workflows. Here's a comprehensive view:

```typescript
interface PanelState {
  // ═══════════════════════════════════════════════════════════════
  // UI State
  // ═══════════════════════════════════════════════════════════════
  mode: 'dark' | 'light';              // Theme mode
  panelMode: PanelMode;                // Current view mode
  
  // ═══════════════════════════════════════════════════════════════
  // Entity State
  // ═══════════════════════════════════════════════════════════════
  entity: EntityData | null;           // Current entity being viewed
  multiPlatformResults: MultiPlatformResult[];  // Results from all platforms
  currentPlatformIndex: number;        // Selected platform tab
  
  // ═══════════════════════════════════════════════════════════════
  // Search State
  // ═══════════════════════════════════════════════════════════════
  searchQuery: string;                 // Current search query
  searchResults: SearchResult[];       // Search results
  searching: boolean;                  // Search in progress
  
  // ═══════════════════════════════════════════════════════════════
  // Container Creation State
  // ═══════════════════════════════════════════════════════════════
  containerType: string;               // Report, Case-Incident, etc.
  containerForm: {
    name: string;
    description: string;
    labels: string[];
    markings: string[];
  };
  entitiesToAdd: EntityData[];         // Entities to include
  generatePdf: boolean;                // Attach PDF snapshot
  createIndicators: boolean;           // Create indicators from observables
  
  // ═══════════════════════════════════════════════════════════════
  // Scan Results State
  // ═══════════════════════════════════════════════════════════════
  scanResultsEntities: ScanResultEntity[];  // All scanned entities
  selectedScanItems: Set<string>;           // Selected for import
  
  // ═══════════════════════════════════════════════════════════════
  // AI State
  // ═══════════════════════════════════════════════════════════════
  aiSettings: AISettings;              // AI configuration
  aiGenerating: boolean;               // AI generation in progress
  aiDiscoveringEntities: boolean;      // AI entity discovery in progress
  resolvedRelationships: ResolvedRelationship[];  // AI-resolved relationships
  
  // ═══════════════════════════════════════════════════════════════
  // Scenario State (OpenAEV)
  // ═══════════════════════════════════════════════════════════════
  scenarioTypeAffinity: string;        // ENDPOINT, CLOUD, WEB, TABLE-TOP
  scenarioPlatformsAffinity: string[]; // windows, linux, macos
  scenarioAIMode: boolean;             // AI generation active
  scenarioAITheme: string;             // cybersecurity, physical-security, etc.
  scenarioAINumberOfInjects: number;   // 1-20
  scenarioAITableTopDuration: number;  // Minutes
  scenarioAIEmailLanguage: string;     // english, french, etc.
  scenarioAIGeneratedScenario: GeneratedScenario | null;
  
  // ═══════════════════════════════════════════════════════════════
  // Platform State
  // ═══════════════════════════════════════════════════════════════
  availablePlatforms: PlatformInfo[];  // Configured platforms
  selectedPlatformId: string;          // Current platform
}
```

## Panel State Machine

The panel operates as a state machine with the following modes and transitions:

```
                                    ┌─────────────────────────────────────────────┐
                                    │              PANEL MODES                     │
                                    └─────────────────────────────────────────────┘

┌─────────────┐                                                    ┌─────────────┐
│   empty     │◄───────────────── Initial State ──────────────────►│   loading   │
└──────┬──────┘                                                    └──────┬──────┘
       │                                                                  │
       │ Scan Page                                                        │ Entity Found
       ▼                                                                  ▼
┌─────────────┐     Select Entity      ┌─────────────┐     Not Found    ┌─────────────┐
│scan-results │────────────────────────►│   entity    │─────────────────►│  not-found  │
└──────┬──────┘                        └──────┬──────┘                   └─────────────┘
       │                                      │
       │ Create Container                     │ Back
       ▼                                      ▼
┌─────────────┐                        ┌─────────────┐
│   preview   │◄───────────────────────│    add      │
└──────┬──────┘                        └─────────────┘
       │
       │ Multiple Platforms?
       ▼
┌─────────────────┐    No     ┌─────────────────┐
│platform-select  │──────────►│ Check Existing  │
└────────┬────────┘           └────────┬────────┘
         │ Select                      │
         ▼                             ▼
┌─────────────────┐           ┌─────────────────────┐
│existing-containers│◄────────│ URL Found?          │
└────────┬────────┘   Yes     └────────┬────────────┘
         │                             │ No
         │ Create New                  ▼
         ▼                    ┌─────────────────┐
┌─────────────────┐           │ container-type  │
│  Update/Add     │           └────────┬────────┘
└─────────────────┘                    │
                                       ▼
                              ┌─────────────────┐
                              │ container-form  │
                              └────────┬────────┘
                                       │ Submit
                                       ▼
                              ┌─────────────────┐
                              │ import-results  │
                              └─────────────────┘


                    ═══════════════════════════════════════════════════
                              SEARCH & INVESTIGATION MODES
                    ═══════════════════════════════════════════════════

┌──────────────┐              ┌──────────────┐              ┌────────────────┐
│    search    │              │  oaev-search │              │ unified-search │
│  (OpenCTI)   │              │  (OpenAEV)   │              │ (All Platforms)│
└──────────────┘              └──────────────┘              └────────────────┘
       │                             │                             │
       └─────────────────────────────┼─────────────────────────────┘
                                     │
                                     ▼
                              Click Result
                                     │
                                     ▼
                              ┌─────────────┐
                              │   entity    │
                              └─────────────┘


                    ═══════════════════════════════════════════════════
                                  OPENAEV MODES
                    ═══════════════════════════════════════════════════

┌─────────────────┐           ┌─────────────────┐
│ atomic-testing  │           │ scenario-overview│
│                 │           │                  │
│ • Select ATT&CK │           │ • Attack patterns│
│ • Generate test │           │ • Type affinity  │
│ • AI payloads   │           │ • Platform       │
└─────────────────┘           └────────┬─────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  scenario-form  │
                              │                 │
                              │ • AI generation │
                              │ • Theme select  │
                              │ • Inject config │
                              └─────────────────┘
```

### Panel Mode Descriptions

| Mode | Description | Entry Points |
|------|-------------|--------------|
| `empty` | Initial state, no entity selected | Default, Clear, Close entity |
| `loading` | Loading entity data | Entity lookup started |
| `entity` | Displaying entity details | Entity found, Search result click |
| `not-found` | Entity not found in any platform | Lookup returned no results |
| `add` | Manual entity creation form | Add button, Context menu |
| `preview` | Import selection preview | Scan results → Create container |
| `platform-select` | Platform selection for multi-platform | Multiple platforms available |
| `container-type` | Container type selection | After platform or existing check |
| `container-form` | Container creation form | After type selection |
| `existing-containers` | Show containers for URL | URL found in platform |
| `investigation` | Investigation workbench creation | Investigate button |
| `search` | OpenCTI search | Search button (OpenCTI) |
| `oaev-search` | OpenAEV search | Search button (OpenAEV) |
| `unified-search` | Multi-platform search | Unified search button |
| `scan-results` | Scan results display | Page scan complete |
| `atomic-testing` | Atomic testing creation | Atomic test button |
| `scenario-overview` | Scenario overview | Scenario button |
| `scenario-form` | Scenario creation form | From overview |
| `import-results` | Import operation results | After import/create |
| `add-selection` | Add selected text from context menu | Context menu action |

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

### Message Categories

**Settings & Configuration:**
| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `GET_SETTINGS` | Any → BG | Get extension settings |
| `SAVE_SETTINGS` | Options → BG | Save settings |
| `TEST_CONNECTION` | Options → BG | Test platform connection |
| `TEST_PLATFORM_CONNECTION` | Options → BG | Test specific platform |

**Scanning & Detection:**
| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `SCAN_PAGE` | Content → BG | Request full page scan |
| `SCAN_OAEV` | Content → BG | Request OpenAEV scan |
| `SCAN_ALL` | Content → BG | Scan all platforms |
| `SCAN_RESULTS` | BG → Content | Return scan results |

**Entity Operations:**
| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `GET_ENTITY_DETAILS` | Panel → BG | Fetch entity details |
| `SEARCH_ENTITIES` | Panel → BG | Search entities |
| `CREATE_ENTITY` | Panel → BG | Create new entity |
| `CREATE_OBSERVABLES_BULK` | Panel → BG | Bulk create observables |

**Container Operations:**
| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `CREATE_CONTAINER` | Panel → BG | Create container |
| `FIND_CONTAINERS_BY_URL` | Panel → BG | Find existing containers |
| `FETCH_ENTITY_CONTAINERS` | Panel → BG | Get entity's containers |

**AI Operations:**
| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `AI_CHECK_STATUS` | Any → BG | Check AI availability |
| `AI_GENERATE_DESCRIPTION` | Panel → BG | Generate description |
| `AI_GENERATE_FULL_SCENARIO` | Panel → BG | Generate scenario |
| `AI_DISCOVER_ENTITIES` | Panel → BG | Discover entities |
| `AI_RESOLVE_RELATIONSHIPS` | Panel → BG | Resolve relationships |

**Cache Operations:**
| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `REFRESH_OCTI_CACHE` | Any → BG | Refresh OpenCTI entity cache |
| `REFRESH_OAEV_CACHE` | Any → BG | Refresh OpenAEV entity cache |
| `GET_CACHE_STATS` | Any → BG | Get cache statistics |
| `CLEAR_CACHE` | Options → BG | Clear platform cache |

**Panel Communication:**
| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `SHOW_ENTITY` | Content → Panel | Show entity details |
| `SCAN_RESULTS_UPDATE` | Content → Panel | Update scan results |
| `XTM_TOGGLE_SELECTION` | Panel → Content | Toggle entity selection |
| `XTM_SCROLL_TO_FIRST` | Panel → Content | Scroll to first highlight |

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

### 4. AI Scenario Generation Workflow

```
User clicks "Generate with AI" for scenario
         │
         ▼
┌─────────────────────────────────┐
│ Panel: Collect Parameters       │
│ - Type affinity (ENDPOINT, etc.)│
│ - Platform affinity             │
│ - Number of injects             │
│ - Theme (for table-top)         │
│ - Duration (for table-top)      │
│ - Email language                │
│ - Additional context            │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Panel: Get Page Content         │
│ - Request from content script   │
│ - Extract clean text            │
│ - Get detected attack patterns  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Background: AI_GENERATE_FULL_SCENARIO│
│                                     │
│ 1. Select theme-specific prompt:    │
│    ├─ cybersecurity                 │
│    ├─ physical-security             │
│    ├─ business-continuity           │
│    ├─ crisis-communication          │
│    ├─ health-safety                 │
│    └─ geopolitical                  │
│                                     │
│ 2. Build prompt with:               │
│    - Page title & URL               │
│    - Page content (truncated)       │
│    - Detected attack patterns       │
│    - Type & platform affinity       │
│    - Inject count & duration        │
│    - Additional context             │
│                                     │
│ 3. Call AI provider                 │
│                                     │
│ 4. Parse JSON response              │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Panel: Show Generated Scenario  │
│ - Scenario name & description   │
│ - List of injects with details  │
│ - Edit name if desired          │
│ - Create scenario button        │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Background: CREATE_SCENARIO     │
│ - Create scenario               │
│ - Add all injects sequentially  │
│ - Technical: Add payloads       │
│ - Table-top: Add email injects  │
└─────────────────────────────────┘
```

### 5. AI Entity Discovery Workflow

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

### 6. Entity Cache Refresh Workflow

```
┌─────────────────────────────────┐
│ Background: On startup or timer │
│ CacheManager.refreshAllCaches() │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ For each OpenCTI platform:      │
│ - Check cache age               │
│ - If stale, fetch bulk entities │
│ - Store in chrome.storage.local │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ For each OpenAEV platform:      │
│ - Fetch attack patterns         │
│ - Fetch assets & asset groups   │
│ - Fetch tags                    │
│ - Fetch kill chain phases       │
│ - Store in chrome.storage.local │
└─────────────────────────────────┘
```

## AI Integration

### Module Architecture

The AI client is modularized for maintainability:

```
src/shared/api/ai/
├── types.ts       # AI request/response type definitions
├── prompts.ts     # All prompt templates and builders (system prompts, themes, JSON schemas)
└── json-parser.ts # Robust AI response parsing (code blocks, malformed JSON)
```

**Key design decisions:**
- **Prompt separation**: All prompts extracted to `prompts.ts` (~560 lines) for easy maintenance
- **Unified interface**: Single `AIClient` class handles OpenAI, Anthropic, and Gemini
- **Type-safe builders**: Functions like `buildScenarioPrompt()` ensure consistent prompt structure

### Supported Providers

| Provider | Client Class | Models |
|----------|--------------|--------|
| OpenAI | `AIClient` | GPT-4o, GPT-4 Turbo, GPT-4 |
| Anthropic | `AIClient` | Claude 3.5 Sonnet, Claude 3 Opus |
| Google | `AIClient` | Gemini 1.5 Pro, Gemini 1.5 Flash |

### AI Features

| Feature | Message Type | Description |
|---------|--------------|-------------|
| Container Description | `AI_GENERATE_DESCRIPTION` | Generate intelligent descriptions from page context |
| Full Scenario Generation | `AI_GENERATE_FULL_SCENARIO` | Generate complete scenarios with injects |
| Atomic Test Generation | `AI_GENERATE_ATOMIC_TEST` | Generate test commands for attack patterns |
| Email Generation | `AI_GENERATE_EMAILS` | Generate email content for table-top exercises |
| Entity Discovery | `AI_DISCOVER_ENTITIES` | Discover entities pattern matching missed |
| Relationship Resolution | `AI_RESOLVE_RELATIONSHIPS` | Identify relationships between entities |

### Prompt Templates (in `ai/prompts.ts`)

All prompt templates are centralized for maintainability:

```typescript
// System prompts for different operations
export const SYSTEM_PROMPTS = {
  CONTAINER_DESCRIPTION: '...',
  SCENARIO_GENERATION: '...',
  ATOMIC_TEST: '...',
  EMAIL_GENERATION: '...',
  ENTITY_DISCOVERY: '...',
  RELATIONSHIP_RESOLUTION: '...',
};

// Theme-specific configurations for table-top scenarios
export const TABLE_TOP_THEMES = {
  'cybersecurity': { /* ... */ },
  'physical-security': { /* ... */ },
  // ... other themes
};

// Prompt builder functions
export function buildContainerDescriptionPrompt(request: ContainerDescriptionRequest): string;
export function buildScenarioPrompt(request: ScenarioGenerationRequest): string;
export function buildFullScenarioPrompt(request: FullScenarioGenerationRequest): string;
export function buildAtomicTestPrompt(request: AtomicTestRequest): string;
export function buildEmailGenerationPrompt(request: EmailGenerationRequest): string;
export function buildEntityDiscoveryPrompt(request: EntityDiscoveryRequest): string;
export function buildRelationshipResolutionPrompt(request: RelationshipResolutionRequest): string;
```

### Scenario Themes

For table-top scenario generation, themes customize the AI prompt. Defined in `ai/prompts.ts`:

```typescript
export const TABLE_TOP_THEMES = {
  'cybersecurity': {
    systemPromptSuffix: 'Focus on cyber attacks, data breaches, ransomware...',
    exampleTopics: 'cyber attacks, malware outbreaks, data breaches...',
  },
  'physical-security': {
    systemPromptSuffix: 'Focus on physical security threats...',
    exampleTopics: 'facility intrusions, access control breaches...',
  },
  'business-continuity': {
    systemPromptSuffix: 'Focus on business disruption scenarios...',
    exampleTopics: 'natural disasters, power outages, supply chain...',
  },
  'crisis-communication': {
    systemPromptSuffix: 'Focus on crisis communication scenarios...',
    exampleTopics: 'media leaks, social media crises, PR incidents...',
  },
  'health-safety': {
    systemPromptSuffix: 'Focus on health and safety incidents...',
    exampleTopics: 'workplace injuries, pandemic outbreaks...',
  },
  'geopolitical': {
    systemPromptSuffix: 'Focus on geopolitical and economic scenarios...',
    exampleTopics: 'sanctions compliance, trade restrictions...',
  },
};
```

## Panel Utilities

The panel utilities are consolidated in `src/panel/utils/` with a barrel export:

```typescript
// Import from utils index
import { 
  getAiColor, 
  getPlatformIcon,
  getPlatformColor,
  getCvssChipStyle, 
  getSeverityColor 
} from './utils';
```

### Available Utilities

| Module | Functions | Description |
|--------|-----------|-------------|
| `platform-helpers.tsx` | `getAiColor`, `getPlatformIcon`, `getPlatformColor`, `getPlatformTypeColor`, `sortPlatformResults`, `filterPlatformsByType`, `hasEnterprisePlatform` | Platform icons, colors, AI theme, filtering |
| `cvss-helpers.ts` | `getCvssColor`, `getCvssChipStyle`, `getSeverityColor`, `getSeverityFromScore`, `formatCvssScore`, `formatEpssScore` | CVSS/severity score formatting and styling |
| `description-helpers.ts` | `generateDescription`, `cleanHtmlContent`, `escapeHtml` | HTML content processing for descriptions |
| `marking-helpers.ts` | `getMarkingColor`, `getMarkingChipStyle` | TLP/PAP marking colors |

## Panel Positioning

The side panel iframe uses multiple defensive CSS strategies to prevent host page interference:

1. **Fixed Positioning**: `position: fixed` with explicit `top`, `right`, `left`, `bottom`
2. **Transform Reset**: `translate: none`, `rotate: none`, `scale: none` prevent centering transforms
3. **Inset Override**: Explicit `inset` property to prevent modal centering
4. **Inline Styles**: Critical positioning applied as inline styles as backup
5. **Animation Reset**: `animation: none` prevents host page animations
6. **Z-Index**: Maximum safe z-index (2147483646) ensures visibility

## Performance Considerations

1. **Entity Caching**: OpenCTI and OpenAEV entities are cached locally to avoid API calls during scanning
2. **Lazy Loading**: Panel loads labels/markings on-demand
3. **Debounced Search**: Search inputs are debounced to reduce API calls
4. **Background Refresh**: Cache refresh happens in background without blocking UI
5. **Efficient Highlighting**: Text nodes are indexed once, patterns run in parallel
6. **Always-Fresh Navigation**: Entity details are always fetched fresh when navigating between entities to ensure data consistency

## Security

1. **API Tokens**: Stored in chrome.storage.local (encrypted by browser)
2. **Content Isolation**: Panel runs in isolated iframe
3. **CSP Compliance**: All scripts bundled, no eval or inline scripts
4. **Message Validation**: All messages validated before processing

## Known Issues & Mitigations

### Panel Positioning on Complex Websites

Some websites with aggressive CSS (modal frameworks, centering utilities) may attempt to reposition the panel. Mitigations include:
- Multiple `!important` declarations on all positioning properties
- Inline styles on the iframe element as backup
- Explicit `inset` property to override CSS reset stylesheets
- Transform reset properties to prevent centering transforms

---

For more information, see the [Development Guide](./development.md) and [Troubleshooting](./troubleshooting.md).
