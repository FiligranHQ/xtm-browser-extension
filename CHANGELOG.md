# Changelog

All notable changes to the Filigran XTM Browser Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.8] - 2024-12-18

### Added
- **Empty panel action buttons**: The empty/home panel view now displays the same action buttons as the popup (Scan, Search, Container, Investigate, Atomic Test, Scenario) organized by platform sections, providing a consistent experience and quick access to all features directly from the side panel
- Clear highlights button in empty panel view for easy reset
- **Scanning spinner**: The panel now shows a loading spinner with "Scanning page..." message while a scan is in progress, instead of the empty/home view
- **Back to actions navigation**: All top-level entry point views (Search, Container, Investigation, Atomic Testing, Scenario) now have a "Back to actions" button at the top to return to the action buttons home view
- **Unlimited storage**: Added `unlimitedStorage` permission to remove the 10MB storage limit. Entity cache limits increased from 5,000 to 50,000 per type for OpenCTI and from 2,000 to 20,000 for OpenAEV to support large platforms with thousands of entities
- **Consistent button icon placement**: All action buttons (Add to OpenCTI, Create Container, Create Scenario, Next) now have icons on the left side for visual consistency
- **Search entity type filter**: Federated search now includes a "Type" filter dropdown alongside the platform filter. Both filters are displayed side-by-side (50/50) when results exist, allowing users to narrow results by entity type (e.g., Malware, Threat-Actor, Asset). Types are sorted by result count.

### Changed
- **Context menu rename**: "Search in OpenCTI" context menu item renamed to "Search across platforms" to accurately reflect its federated search functionality across all configured platforms
- **Shared ActionButton component**: Extracted `ActionButton` and `ActionButtonsGrid` components to `src/shared/components/` for reuse between popup and panel, eliminating code duplication
- **Centralized version constant**: `EXTENSION_VERSION` in `src/shared/constants.ts` is now the single source of truth for version numbers used in User-Agent headers, popup, options page, and popover

### Fixed
- **Clear highlights now clears scan results**: Clicking "Clear highlights" now also resets the panel's scan results view, returning it to the empty state instead of showing stale data
- **Entity containers refresh on navigation**: Fixed issue where navigating between entity overviews would show stale "Latest Containers" data - containers are now refetched for each entity
- **Unified search entity overview**: Fixed partial/empty entity overview when clicking on search results - now properly fetches full entity details and containers
- **Context menu panel opening**: Fixed context menu actions (Search across platforms, Add to OpenCTI) not opening the panel reliably in both floating iframe and split screen modes
- **Highlight click re-opens panel in split mode**: Fixed clicking on highlights not re-opening the native side panel if it was previously closed in split screen mode
- **Critical: Storage quota crash loop**: Fixed extension crashing in a loop when OpenCTI/OpenAEV cache exceeds Chrome's storage quota (~10MB). The extension now gracefully handles quota errors by: trimming cache to fit limits (max 5000 entities per type), falling back to minimal cache (1000 entities with essential data only), disabling cache refresh after 3 consecutive failures. The extension continues to work without full cache - scanning and detection will still function, just without cached entity matching.
- **Platform isolation**: One platform's failure during cache refresh no longer affects other platforms. Previously, a single platform error could prevent cache refresh for all configured platforms. Now each platform is handled independently - if Platform A fails, Platform B/C still get their caches refreshed successfully.

### Removed
- Deleted unused `src/popup/components/ActionButton.tsx` re-export file (components now import directly from shared)
- Deleted unused `src/shared/types/ui.ts` type definitions file (interfaces were never imported)

## [0.0.7] - 2024-12-18

### Added
- **Split screen mode**: Optional browser native side panel mode for Chrome, Edge, and Firefox. When enabled in Settings > Appearance, the extension panel uses the browser's built-in side panel instead of a floating iframe. The close button is automatically hidden as the browser controls the panel. Works across all three browsers (Chrome/Edge use `sidePanel` API, Firefox uses `sidebar_action`)
- **Scroll-to-highlight button**: Each entity in scan results now has a dedicated scroll icon (in addition to the expand arrow) that scrolls to and highlights the entity on the page with an enhanced glow effect
- Loading spinner in entity overview while fetching full entity details from OpenCTI/OpenAEV (spinner replaces platform logo during load)
- Multi-entity type support in scan results: entities like "Phishing" matching multiple types (Malware, Attack Pattern) now show combined counts with visual indicators (stacked icon, "N types" chip)
- Compact multi-type entity display with tooltips showing all matched types
- **Cross-platform type mapping**: New `CROSS_PLATFORM_TYPE_MAPPINGS` in registry for declaring equivalent types across platforms (e.g., OpenCTI `Attack-Pattern` ↔ OpenAEV `AttackPattern`). Multi-type displays now deduplicate equivalent types instead of showing duplicates like "Attack Pattern, Malware, Attack Pattern"
- **CVE/Vulnerability support for OpenAEV**: CVEs are now searched in both OpenCTI and OpenAEV platforms. When a CVE is found in both platforms, it shows as a multi-platform match (e.g., "OCTI (1), OAEV (1)"). Added `OAEVVulnerability` type and `getVulnerabilityByExternalId()` API method
- **Per-platform Vulnerability detection settings**: Added `Vulnerability` type to both OpenCTI and OpenAEV detection settings, allowing independent control of CVE detection per platform. If disabled on all platforms, CVE regex detection is skipped entirely for performance
- **AI highlight click re-opens panel**: Clicking on AI-discovered (purple) highlights now re-opens the panel if hidden and automatically applies the "AI Discovered" filter
- **AI results persistence**: AI-discovered entities are now persisted across panel open/close cycles until the next scan or explicit clear
- **Empty scan results with AI access**: When a page scan returns no results, the panel now shows the full layout with search filters and AI discovery button, allowing users to immediately trigger AI-based entity discovery

### Changed
- Extracted cache management to dedicated service (`services/cache-manager.ts`) for better code organization
- Reorganized panel types: consolidated `types.ts` and `types/` directory structure
- OpenCTI STIX types now have both `OCTI*` prefixed names and GraphQL API-matching aliases
- Reduced `background/index.ts` from 3238 lines to ~2850 lines through service extraction
- **Type organization**: Complete reorganization of type files:
  - Created dedicated `types/openaev.ts` for OpenAEV types (entities, scenarios, atomic testing)
  - Created dedicated `types/opencti.ts` for OpenCTI types (STIX, entities, containers)
  - Created `types/messages.ts` for extension communication types
  - Consolidated common types (config, AI, observables) in `types/index.ts`
  - Removed redundant type files (`config.ts`, `ai.ts`, `platform.ts`)
  - Removed all barrel `index.ts` re-export files for direct imports
  - Created `api/openaev/types.ts` for REST API types (Filter, FilterGroup, SearchBody, builder params)
  - Created `api/opencti/types.ts` for GraphQL query result types
  - `PayloadCreateInput` now imports shared `PayloadType` from API types for consistency
- **Naming convention standardization**: Replaced generic terms with platform-specific naming throughout codebase:
  - `CachedEntity` → `CachedOCTIEntity`
  - `DetectedSDO` → `DetectedOCTIEntity` (removed alias)
  - `DetectedPlatformEntity` → `DetectedOAEVEntity`
  - `detectSDOsFromCache` → `detectOCTIEntitiesFromCache`
  - `detectPlatformEntitiesFromCache` → `detectOAEVEntitiesFromCache`
  - `getAllCachedEntityNamesForMatching` → `getAllCachedOCTIEntityNamesForMatching`
  - Removed `_` prefix from platform properties: `_platformId` → `platformId`, `_platformType` → `platformType`, `_isNonDefaultPlatform` → `isNonDefaultPlatform`
- **Platform color standardization**: Updated platform colors to avoid confusion with status indicators:
  - OCTI (OpenCTI): Changed from orange (#ff9800) to indigo (#5c6bc0) - distinct from green (found) and amber (new)
  - OAEV (OpenAEV): Changed from cyan (#00bcd4) to pink (#e91e63) - distinct from primary blue
  - Multi-type indicator: Now uses primary theme color (adapts to light/dark theme) instead of purple
- **Entity overview containers limited to 5**: "Latest Containers" section now fetches only 5 containers via GraphQL query for efficiency
- **Description truncation**: Entity descriptions in both OpenCTI and OpenAEV overviews are now truncated to 500 characters for better readability

### Improved
- Enhanced PDF extraction for Shadow DOM-heavy sites like Notion
- Content extractor now traverses Shadow DOM for better article content extraction
- Code structure: cleaner separation between services and handlers in background script
- Entity state management: added `entityDetailsLoading` state for better UX feedback
- Entity navigation now always fetches fresh data to prevent stale/empty overviews
- **AI relationship resolution accuracy**: Completely rewritten prompts with exhaustive list of valid STIX 2.1 and OpenCTI relationship types with entity compatibility rules to prevent hallucination. Consolidated duplicate relationship definitions into single authoritative source.
- **AI observable relationship rules**: AI now correctly handles observable relationships (Observable → related-to → Threat only, with specific exceptions for C2 communication, DNS resolution, etc.)
- **AI entity discovery filtering**: AI-discovered entities are now post-filtered to only include those that can actually be highlighted on the page (filters out entities from inaccessible DOM like shadow roots)
- **OpenAEV Vulnerability overview**: Complete vulnerability details display including CVE ID, CVSS score, status, published date, remediation, and reference URLs
- **Scroll-to-highlight glow effect**: Enhanced visual feedback with longer duration (3s) and brighter, more visible glow animation
- **Shadow DOM content extraction**: More conservative approach prioritizing `innerText` over Shadow DOM traversal to avoid false positives (e.g., detecting hidden script content like "javascript"). Shadow DOM extraction only triggers when visible text is extremely short (<50 chars)
- **CVE pattern detection**: Extended Unicode dash support for better CVE detection on international sites. Now handles fullwidth hyphen-minus (U+FF0D), horizontal bar (U+2015), small hyphen-minus (U+FE63), and other variants

### Fixed
- PDF generation now properly extracts content from Shadow DOM components
- Content visibility checks now work correctly inside Shadow DOM
- Navigation arrows in entity view now disabled during loading to prevent race conditions
- Scan results now properly merge entities with same name but different types on the same platform
- **Entity overview empty after navigation**: Fixed issue where navigating back and forth between entity overviews would result in empty data - now always fetches fresh details
- **Side panel width on certain websites**: Fixed issue where panel would open full-screen on sites with aggressive CSS (e.g., Malwarebytes) - panel now always respects its intended width using CSS isolation
- **AI results lost on panel close**: Fixed issue where AI-discovered entities would disappear when closing and reopening the panel - results now persist until next scan or clear
- **OpenAEV CVE overview empty**: Fixed issue where navigating to OpenAEV vulnerability overview showed incomplete/empty data
- **Entity overview empty from unified search**: Fixed issue where clicking a search result showed incomplete/empty entity overview - unified search now fetches full entity details (same as scan results flow)
- **Split screen mode toggle**: Disabling split screen mode now properly closes the native side panel and allows the floating iframe to work again without requiring a page reload
- **Default theme selection**: Dark theme is now visually selected by default in Settings > Appearance when it's the active theme
- **Shadow DOM false positives**: Fixed detection of non-visible content (like "javascript" strings from script elements) when extracting text from Shadow DOM
- **CVE detection on CERT-FR pages**: Fixed detection of CVEs using non-standard Unicode dash characters (e.g., CVE-2025-66478 with special dashes)
- **CVE highlighting with mixed dash characters**: Fixed highlighting of CVEs that appear multiple times on a page with different dash characters. CVE detection and highlighting now uses flexible regex matching that accepts any dash variant (hyphen-minus U+002D, non-breaking hyphen U+2011, en dash U+2013, etc.), optional whitespace around dashes, and zero-width characters (U+200B zero-width space, U+200C/U+200D non-joiner/joiner, U+2060 word joiner, U+FEFF BOM) that web rendering may insert.
- **CVE highlighting in same paragraph as other entities**: Fixed issue where CVEs appearing in the same text node as previously highlighted entities (e.g., CVE-2025-66478 in same paragraph as CVE-2025-55182) would fail to highlight. The nodeMap is now rebuilt before processing each entity category (CVEs, OpenAEV entities) to account for DOM modifications from prior highlighting.
- **Multiple occurrence highlighting**: Fixed critical bug where only the first occurrence of an entity was highlighted on a page. Now ALL occurrences of observables, CVEs, cached entities, AI-discovered entities, attack patterns (atomic testing and scenario modes), and investigation entities are properly highlighted. The fix uses reverse-order DOM modification to prevent node position invalidation.
- **Investigation mode CVE support**: Fixed CVE highlighting in investigation mode. CVEs detected via regex are now properly included in investigation results and highlighted with flexible dash matching (same as regular scan mode). Investigation mode now correctly shows and highlights found CVEs from OpenCTI only (OpenAEV entities are excluded as investigation is OpenCTI-specific).
- **Investigation mode multi-platform filtering**: Investigation mode now strictly filters entities to the targeted OpenCTI platform. All entities (observables, cached entities, and CVEs) must have `platformType === 'opencti'` and must match the specified `platformId`. Entities from other platforms (including other OpenCTI instances in multi-platform setups) are excluded.

## [0.0.6] - 2024-12-17

### Added
- Shadow DOM support for content extraction on sites like VirusTotal that use Web Components
- Shadow DOM support for highlighting - styles are now injected into shadow roots
- Recursive shadow root traversal for deeply nested Web Components

### Changed
- AI client refactored: extracted prompts to separate module (`ai/prompts.ts`) for better maintainability
- Consolidated duplicate AI handler files into single `message-ai-handlers.ts`
- Harmonized all back navigation buttons across the app with consistent "Back to X" design pattern
- Back buttons now use text buttons with descriptive labels instead of icon-only buttons
- Removed legacy "Extracted from App.tsx" comments from all refactored hooks and handlers
- Detection settings now use "disabled types" approach instead of "enabled types" - all entity types are enabled by default
- Detection settings refactored with clearer naming: `disabledObservableTypes`, `disabledOpenCTITypes`, `disabledOpenAEVTypes`
- Content extraction now only falls back to Shadow DOM when innerText is insufficient (<500 chars)
- Aggressive URL filtering to reduce noise from CDN, social media, and framework URLs

### Fixed
- **Critical**: Detection filtering was excluding all entities on fresh installs or when settings were not configured (empty enabled array filtered everything)
- **Critical**: Scanning and highlighting not working on Shadow DOM-heavy sites like VirusTotal
- Email pattern detection now validates TLDs to reduce false positives (e.g., `example@domain.svg` no longer detected as email)
- Fixed undefined `log.error` reference in investigation actions hook
- Container form, container type, platform selection, and add selection views now have properly aligned back buttons
- Firefox: Removed unused sidebar panel that was showing empty "No entity selected" content

### Removed
- Deleted unused `handlers/types.ts` duplicate type definitions file
- Removed Firefox `sidebar_action` from manifest (extension uses injected floating panel instead)

## [0.0.5] - 2024-12-17

### Added
- Search field in scan results to quickly filter findings by name, value, or type
- AI-discovered entities are now highlighted on the page with distinct purple styling
- Setup wizard state persistence - URL and token fields are preserved when popup closes during setup
- Changelog-based release notes generation in GitHub workflow
- Entity overview now always fetches full details from OpenCTI/OpenAEV when clicking on scan results
- Scenario form fields (mainFocus, severity, category) now consistent with OpenAEV platform
- Inject selection dropdown now displays injector name and supported platforms with colored chips

### Fixed
- AI entity discovery error "Cannot read properties of undefined (reading 'length')"
- AI "Discover more" creating duplicates of already detected entities (e.g., APT29 as both Intrusion Set and Threat Actor Group)
- Vertical alignment of search and filter fields in scan results view
- Entity overview empty when clicking on scan results after using AI discovery or filter changes
- Scenario form now properly sends mainFocus and severity fields to OpenAEV API
- OpenCTI and OpenAEV entity overviews now have consistent styling (spacing, fonts, margins)
- Scenario and Atomic Testing not finding attack patterns from OpenAEV cache (missing SCAN_OAEV handler)
- Highlighting now shows all occurrences of detected values on the page, not just the first one

### Changed
- Version updated to 0.0.5 across all manifests and user-agent strings
- Consolidated `autoScan` and `scanOnLoad` settings into single `autoScan` setting
- Removed unused `isAIGenerated` field from scenario payload interfaces
- Removed deprecated OpenGRC placeholder code
- Code cleanup: removed legacy comments and unused code
- OpenAEV entity view now uses Markdown rendering for descriptions (consistent with OpenCTI)

## [0.0.4] - 2024-12-15

### Added
- OpenAEV scenario generation with AI assistance
- Atomic testing integration for OpenAEV platform
- PDF generation for threat reports
- Multi-platform support (OpenCTI, OpenAEV, OpenGRC)
- Enterprise Edition features for AI-powered analysis

### Fixed
- Duplicate scan results handling
- Defanged indicator detection for OpenAEV
- SDO naming and comments consistency

### Changed
- Improved entity type icons in scenario configuration
- Enhanced AI prompts for better scenario generation

## [0.0.3] - 2024-12-10

### Added
- Investigation mode for OpenCTI
- Container creation workflow (Reports, Groupings, Cases)
- Entity preview panel with platform lookup
- Selection management for bulk operations

### Fixed
- Highlight interaction issues on certain websites
- Platform connection status display

### Changed
- Improved UI/UX for entity cards
- Better error handling for API calls

## [0.0.2] - 2024-12-05

### Added
- OpenCTI platform integration
- Observable detection (IPs, domains, hashes, emails, URLs)
- SDO detection (Threat Actors, Malware, Attack Patterns)
- CVE detection and lookup
- Visual highlighting on web pages

### Fixed
- Initial setup wizard flow
- Token validation errors

## [0.0.1] - 2024-12-01

### Added
- Initial release
- Basic extension structure for Chrome, Firefox, and Edge
- Popup interface for configuration
- Side panel for scan results
- Options page for advanced settings

[Unreleased]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.8...HEAD
[0.0.8]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/FiligranHQ/xtm-browser-extension/releases/tag/v0.0.1
