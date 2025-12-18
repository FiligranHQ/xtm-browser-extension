# Changelog

All notable changes to the Filigran XTM Browser Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.7] - 2024-12-18

### Added
- Loading spinner in entity overview while fetching full entity details from OpenCTI/OpenAEV (spinner replaces platform logo during load)
- Multi-entity type support in scan results: entities like "Phishing" matching multiple types (Malware, Attack Pattern) now show combined counts with visual indicators (stacked icon, "N types" chip)
- Compact multi-type entity display with tooltips showing all matched types
- **Cross-platform type mapping**: New `CROSS_PLATFORM_TYPE_MAPPINGS` in registry for declaring equivalent types across platforms (e.g., OpenCTI `Attack-Pattern` ↔ OpenAEV `AttackPattern`). Multi-type displays now deduplicate equivalent types instead of showing duplicates like "Attack Pattern, Malware, Attack Pattern"
- **CVE/Vulnerability support for OpenAEV**: CVEs are now searched in both OpenCTI and OpenAEV platforms. When a CVE is found in both platforms, it shows as a multi-platform match (e.g., "OCTI (1), OAEV (1)"). Added `OAEVVulnerability` type and `getVulnerabilityByExternalId()` API method
- **Per-platform Vulnerability detection settings**: Added `Vulnerability` type to both OpenCTI and OpenAEV detection settings, allowing independent control of CVE detection per platform. If disabled on all platforms, CVE regex detection is skipped entirely for performance
- **AI highlight click re-opens panel**: Clicking on AI-discovered (purple) highlights now re-opens the panel if hidden and automatically applies the "AI Discovered" filter
- **AI results persistence**: AI-discovered entities are now persisted across panel open/close cycles until the next scan or explicit clear

### Changed
- Extracted cache management to dedicated service (`services/cache-manager.ts`) for better code organization
- Reorganized panel types: consolidated `types.ts` and `types/` directory structure
- OpenCTI STIX types now have both `OCTI*` prefixed names and GraphQL API-matching aliases
- Reduced `background/index.ts` from 3238 lines to ~2850 lines through service extraction
- **Type organization**: Created dedicated `types/openaev.ts` for OpenAEV types (matching `types/opencti.ts` structure for consistency)
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

### Fixed
- PDF generation now properly extracts content from Shadow DOM components
- Content visibility checks now work correctly inside Shadow DOM
- Navigation arrows in entity view now disabled during loading to prevent race conditions
- Scan results now properly merge entities with same name but different types on the same platform
- **Entity overview empty after navigation**: Fixed issue where navigating back and forth between entity overviews would result in empty data - now always fetches fresh details
- **Side panel width on certain websites**: Fixed issue where panel would open full-screen on sites with aggressive CSS (e.g., Malwarebytes) - panel now always respects its intended width using CSS isolation
- **AI results lost on panel close**: Fixed issue where AI-discovered entities would disappear when closing and reopening the panel - results now persist until next scan or clear
- **OpenAEV CVE overview empty**: Fixed issue where navigating to OpenAEV vulnerability overview showed incomplete/empty data

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

[Unreleased]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.7...HEAD
[0.0.7]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/FiligranHQ/xtm-browser-extension/releases/tag/v0.0.1
