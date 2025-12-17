# Changelog

All notable changes to the Filigran XTM Browser Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- AI client refactored: extracted prompts to separate module (`ai/prompts.ts`) for better maintainability
- AI client reduced from 833 to ~300 lines by centralizing prompt templates
- Consolidated duplicate AI handler files into single `message-ai-handlers.ts`
- Updated default AI models: OpenAI `gpt-4o`, Anthropic `claude-sonnet-4-20250514`, Gemini `gemini-2.0-flash`

### Fixed
- Email pattern detection now validates TLDs to reduce false positives (e.g., `example@domain.svg` no longer detected as email)

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

[Unreleased]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.5...HEAD
[0.0.5]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/FiligranHQ/xtm-browser-extension/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/FiligranHQ/xtm-browser-extension/releases/tag/v0.0.1
