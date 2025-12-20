# Changelog

All notable changes to the Filigran XTM Browser Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **AI Relationship Discovery**: New AI-powered relationship discovery directly from scan results with visual relationship lines on pages and PDFs
- **Relationship Graph Mini-Map**: Interactive graph visualization showing entities and their relationships with force-directed layout
- **Clear All Button**: Button to clear all highlights, results, and selections while staying on scan results view
- **New OpenCTI Entity Types**: Added support for Narrative, Channel, System, and Tool entity types

### Changed
- **AI Buttons Styling**: Redesigned AI buttons with consistent styling and magic sparkle icons
- **Relationship Display**: Unified relationship display format with entity type icons and proper colors

### Fixed
- **PDF Viewer**: Fixed iframe panel not closing and AI scanning not working in PDF viewer mode
- **Relationship Persistence**: Resolved relationships now preserved when navigating back from import screen
- **Select All Behavior**: Fixed "Select all" sometimes visually selecting non-importable entities
- **AI JSON Parsing**: Enhanced parsing with more robust strategies for handling truncated AI responses
- **Threat Actor Types**: Properly distinguish between `Threat-Actor-Group` and `Threat-Actor-Individual`

### Improved
- Unified visual styling between web page and PDF viewer for relationship graph, minimap, and lines
- Shared visualization constants ensure consistent appearance across all scan modes

## [0.0.12] - 2024-12-20

### Added
- **PDF Scanning**: Full PDF document scanning with integrated viewer. When clicking "Scan" on a PDF page, the extension opens a dedicated PDF viewer with:
  - Vertical scrolling through all pages (no page-by-page navigation)
  - Real-time entity highlighting directly on PDF content with color-coded overlays (green for found, amber for new, purple for AI-discovered)
  - Interactive highlights with selection checkboxes matching web page behavior
  - Clickable highlights that open entity overview in side panel
  - Tooltips on hover showing entity details, AI confidence, and reasons
  - Native side panel integration for scan results (same behavior as regular page scanning)
  - Toolbar with rescan, clear highlights, zoom controls, and panel toggle
  - Original PDF link to open in browser's native viewer
- **PDF Worker Embedding**: PDF.js worker is now fully embedded in the extension bundle for Chrome Web Store compliance (no external resource loading)
- **Clear Highlights for PDFs**: The "Clear highlights" action from popup, panel, and PDF viewer toolbar now properly clears PDF canvas highlights
- **AI Discovery in PDF Viewer**: AI entity discovery now works in the PDF viewer, with proper text extraction and AI highlight colors
- **OpenAEV-Only Entity Display**: Entities found only in OpenAEV (not importable to OpenCTI) now display correctly without selection checkboxes

### Changed
- **PDF Viewer Styling**: Clean, minimal interface matching the extension's theme (dark/light mode support)
- **PDF Entity Detection**: Uses same detection engine as page scanning for consistent results across formats
- **PDF Highlight Sizing**: Highlights are now more precise, sticking closely to text boundaries to reduce overlaps
- **Disabled Actions on PDF View**: Container, Investigate, Atomic Test, and Scenario buttons are disabled on both native PDF pages and PDF scanner view

### Fixed
- **PDF Scanner Panel Communication**: PDF scanner now properly communicates with side panel for scan results display
- **PDF Rescan from Popup**: Clicking scan while on PDF scanner page now triggers rescan instead of opening new tab
- **PDF Rescan from Side Panel**: Clicking "Scan" in side panel while on PDF scanner now properly rescans the PDF
- **PDF Highlight Click to Entity Overview**: Clicking a highlight in the PDF scanner now correctly opens the entity overview with full data
- **Firefox PDF Scanner Detection**: Popup now correctly detects PDF scanner pages in Firefox (`moz-extension://` URLs)
- **AI Discovery Content Retrieval**: AI discovery now properly retrieves PDF content when triggered from the side panel

## [0.0.11] - 2024-12-19

### Added
- **Labels field improvements**: Labels autocomplete in container form now fetches only initial 10 labels, searches on the fly with 1.2-second debounce, and includes a "+" button to create new labels directly within the field
- **Author field improvements**: Author (createdBy) autocomplete now fetches only initial 50 authors, searches on the fly with debounce, includes a "+" button to create new Organization or Individual directly within the field
- **Hidden content filtering**: Scan results now exclude text from tooltips, popovers, and screen-reader-only elements (e.g., "Skip to content" links) that are not visually displayed but picked up by DOM extraction
- **React/SPA content extraction**: Added fallback extraction methods for React, Next.js, Nuxt.js, and other SPA frameworks that render content dynamically via JavaScript
- **Visible content extraction**: Last-resort extraction method that walks through all visible DOM elements when other methods fail
- **App page content extraction**: Added specialized extraction for complex app pages (like OpenCTI dashboards) that captures visible text with basic structure preservation
- **Firefox sidebar support**: Firefox now fully supports split screen mode using the native sidebar. Enable in Settings > Appearance. The sidebar opens automatically when you scan or perform actions, just like Chrome/Edge. It integrates with Firefox's native panel system and persists across page navigation
- **Selection checkboxes on highlights**: Restored selection checkboxes on the left side of highlights for "Found", "Not Found", "Mixed State", and "AI Discovered" entities. Checkboxes show border when unchecked and filled with checkmark when selected

### Changed
- **Highlight styling refined**: Highlights are now less aggressive and no longer cause layout shifts or distortions on complex pages. Uses `display: inline` instead of `inline-block`, reduced padding, and proper z-index layering
- **Glowing effect improved**: The locate/scroll-to-highlight glow animation now has a gentler 3-pulse pattern over 3 seconds with `ease-in-out` timing for a smoother visual effect
- **Number of injects limit increased**: Maximum number of injects for AI scenario generation increased from 20 to 50
- **Table-top scenario AI prompts improved**: AI-generated table-top exercises now focus on presenting crisis situations without prescribing defensive actions, feature progressive intensity escalation, use varied email senders (SOC, executives, legal, etc.), and create immediately playable exercises
- **Consistent multi-select chip styling**: All multi-select autocomplete fields (Report Types, Labels, Marking Definitions, etc.) now use consistent chip styling with light grey background and 4px border radius
- **Color picker dark mode support**: Label creation color picker now properly respects dark/light theme mode
- **Compact selection indicator**: Selection text in scan results now more compact - shows "X sel." with "(Y new)" only when there are new items, and "X available" instead of verbose text

### Fixed
- **Critical: OpenAEV atomic testing and scenarios not finding attack patterns**: Fixed condition that checked for `platformEntities` instead of `openaevEntities`, causing attack pattern detection to always fail for OpenAEV-only scans
- **Highlight hover conflicts**: Mouse events on highlights now properly block native page hover behaviors using event capture and propagation stopping. Native title-attribute tooltips are temporarily suppressed when hovering on extension highlights
- **Side panel user gesture errors**: Console errors about `sidePanel.open()` requiring user gesture are now suppressed (logged as debug) when the panel is already open or being managed by the popup
- **Number of injects field behavior**: Input field now allows clearing and typing any value (like the duration field) with proper validation and error feedback
- **Exercise duration field behavior**: Input field now allows clearing, accepts values 1-2880 minutes (48 hours max), shows validation errors, and disables Generate button when invalid
- **PDF images at wrong location**: Fixed images being placed at the end of generated PDFs instead of their original position in the content. Images are now rendered inline where they appear in the document
- **Empty PDF/HTML on React websites**: Fixed content extraction returning empty results on React/SPA websites by adding multiple fallback extraction methods
- **Labels loading error**: Fixed "Unknown message type" error when loading labels in container form by adding missing `SEARCH_LABELS` handler in background script
- **Back to actions link consistency**: Entity overview screens now always show a "Back to actions" link for consistent navigation
- **Label creation not adding to selection**: Fixed label creation not properly adding newly created labels to the selected list
- **XTM highlights in extracted content**: Content extraction for PDF/HTML now removes XTM extension highlights before processing, ensuring clean output without colored spans
- **Toast not showing in Edge**: Rewrote toast notification system using Shadow DOM for complete isolation from page styles, ensuring consistent display across all browsers (Chrome, Firefox, Edge)
- **Scan error infinite spinner**: When scanning fails (e.g., connection error), the panel now properly shows "no results" instead of spinning forever
- **Small screen selection bar layout**: Selection indicator and buttons in scan results now properly maintain shape on small screens - text can wrap while buttons stay vertically centered with `flexShrink: 0` and `whiteSpace: nowrap`

### Removed
- **Debug logging**: Removed all debug console.log statements from content script for cleaner production builds

## [0.0.10] - 2024-12-19

### Fixed
- **Split screen mode on MacOS**: Fixed native side panel not opening reliably on Chrome and Edge on MacOS. The popup now opens the side panel immediately in user gesture context before sending scan messages, which is required by the Chrome sidePanel API
- **Dual panel opening**: Fixed both native side panel and floating iframe opening simultaneously in split screen mode. The content script now correctly skips iframe creation when split screen mode is enabled

## [0.0.9] - 2024-12-18

### Added
- **Cross-browser iframe compatibility**: Floating panel now works correctly on Chrome, Firefox, and Edge with unified iframe loading approach using `requestAnimationFrame` for Edge compatibility

### Changed
- **Extension renamed**: Extension name changed from "Filigran Threat Management" to "Filigran XTM" across all browsers for consistency
- **Firefox split screen disabled**: Split screen mode toggle is now visible but disabled on Firefox with explanation that it requires Chrome or Edge. Firefox uses the floating iframe panel exclusively
- **Panel display mode always visible**: The "Panel Display Mode" setting section is now shown on all browsers (previously hidden on Firefox), with clear indication when not supported
- **Unified panel messaging**: Consolidated panel message handling to use `FORWARD_TO_PANEL` exclusively in split screen mode, eliminating redundant message paths that caused state conflicts

### Fixed
- **Edge floating panel not loading**: Fixed iframe content not loading on Edge browser due to timing issues with iframe src and DOM attachment
- **Firefox floating panel**: Removed Firefox sidebar action dependency - Firefox now uses the same floating iframe approach as Chrome/Edge for consistent cross-browser experience
- **Edge scan never completing**: Fixed race condition where panel messages were sent before iframe contentWindow was available
- **Split screen mode highlight click**: Fixed clicking on highlights in native side panel mode not showing entity overview - the `SCAN_RESULTS` message was overwriting the `SHOW_ENTITY` message due to a timing issue
- **Split screen mode panel not opening**: Fixed native side panel not opening when clicking on highlights with panel closed - panel functions now explicitly open the native side panel in split screen mode
- **Split screen "Back to scan results" link**: Fixed "Back to scan results" link not appearing when clicking highlights after closing the native side panel. The issue was caused by duplicate message paths (`SHOW_ENTITY` via `FORWARD_TO_PANEL` and `SHOW_ENTITY_PANEL` directly) where the second message overwrote the `fromScanResults` flag. Now only `FORWARD_TO_PANEL` is used for consistent state management
- **Scan results restoration**: When reopening the native side panel via highlight click, scan results are now properly restored from the message payload, allowing navigation back to results even after the panel was closed
- **Edge tooltip rendering**: Fixed highlight tooltips showing as empty black squares on Edge by using Shadow DOM for proper style isolation

### Removed
- Removed verbose debug logging from panel.ts that was added during Edge troubleshooting
- Removed `visibility: hidden` from hidden panel CSS (was preventing Edge from loading iframe content)
- Removed redundant `SHOW_ENTITY_PANEL` message sends from highlight click handlers (now handled by `showPanel()` function)

## [0.0.8] - 2024-12-18

### Added
- **Empty panel action buttons**: The empty/home panel view now displays the same action buttons as the popup (Scan, Search, Container, Investigate, Atomic Test, Scenario) organized by platform sections, providing a consistent experience and quick access to all features directly from the side panel
- Clear highlights button in empty panel view for easy reset
- **Scanning spinner**: The panel now shows a loading spinner with "Scanning page..." message while a scan is in progress, instead of the empty/home view
- **Back to actions navigation**: All top-level entry point views (Search, Container, Investigation, Atomic Testing, Scenario, Scan Results) now have a "Back to actions" button at the top to return to the action buttons home view
- **Unlimited storage**: Added `unlimitedStorage` permission to remove the 10MB storage limit. Entity cache limits increased from 5,000 to 50,000 per type for OpenCTI and from 2,000 to 20,000 for OpenAEV to support large platforms with thousands of entities
- **Consistent button icon placement**: All action buttons (Add to OpenCTI, Create Container, Create Scenario, Next) now have icons on the left side for visual consistency
- **Search entity type filter**: Federated search now includes a "Type" filter dropdown alongside the platform filter. Both filters are displayed side-by-side (50/50) when results exist, allowing users to narrow results by entity type (e.g., Malware, Threat-Actor, Asset). Types are sorted by result count with cross-platform type deduplication (e.g., OCTI Attack-Pattern and OAEV AttackPattern show as single "Attack Pattern" entry)
- **Cache failure notifications**: After 10 consecutive failed attempts to refresh a platform's cache, a browser notification is shown to warn the user. This helps identify misconfigured or inaccessible platforms so users can take corrective action (e.g., check connectivity or remove the configuration)
- **Matched strings tooltip**: The "Found"/"New" chip in scan results now shows an info icon when multiple strings matched. Hovering displays a tooltip listing all text matches from the page (e.g., entity name, aliases) that resolved to this entity. This helps understand why an entity was detected, especially when matched via aliases

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
- **Critical: Storage quota crash loop**: Fixed extension crashing in a loop when OpenCTI/OpenAEV cache exceeds storage quota. The extension now gracefully handles quota errors by trimming oldest cache entries and falling back to a minimal cache with essential data only. Cache refresh continues to retry silently in the background - errors are logged but never crash the extension. Combined with the new `unlimitedStorage` permission, the extension can now handle platforms with tens of thousands of entities.
- **Platform isolation**: One platform's failure during cache refresh no longer affects other platforms. Previously, a single platform error could prevent cache refresh for all configured platforms. Now each platform is handled independently - if Platform A fails, Platform B/C still get their caches refreshed successfully
- **Scroll-to-highlight with alias matching**: Fixed "Scroll to highlight" not working when the entity's display name differs from the text on the page. For example, MITRE technique "TA0007" might be highlighted as "discovery" on the page - scroll now tries both the entity name AND all matched strings to locate the highlight

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

[Unreleased]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.12...HEAD
[0.0.12]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.11...v0.0.12
[0.0.11]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.10...v0.0.11
[0.0.10]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.9...v0.0.10
[0.0.9]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/FiligranHQ/xtm-browser-extension/releases/tag/v0.0.1
