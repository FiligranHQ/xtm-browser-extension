# Filigran XTM Browser Extension Documentation

Welcome to the documentation for the Filigran XTM (Threat Management) Browser Extension.

## Table of Contents

- [Overview](./overview.md) - Architecture, concepts, and supported platforms
- [Installation](./installation.md) - Browser-specific installation guides
- [Configuration](./configuration.md) - Platform setup, API tokens, AI settings
- [Features](./features.md) - Page scanning, highlighting, containers, PDF generation, and AI
- [Detection Settings](./detection.md) - Observable, entity type, and defanged IOC configuration
- [Development](./development.md) - Development guide, testing, and contributing
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

## Quick Start

1. **Install** the extension from your browser's extension store or load from source
2. **Click** the Filigran icon in your browser toolbar
3. **Configure** your OpenCTI and/or OpenAEV connection (URL and API token)
4. **Start scanning** pages for threats and security entities!

## Key Features

### Threat Detection
- **Pattern-based detection** for observables (IPs, domains, hashes, CVEs)
- **Defanged IOC support** - automatically detects `example[.]com`, `hxxps://`, etc.
- **Entity matching** against cached platform data
- **MITRE ATT&CK** technique detection (T1566, T1059.001, etc.)

### Content Management
- **Container creation** - Reports, Cases, Groupings with detected entities
- **PDF generation** - Clean article snapshots using Mozilla Readability
- **Investigation workbench** - Start investigations with detected entities

### AI Features (Enterprise Edition)
- **Description generation** - AI-powered container descriptions
- **Scenario generation** - Create attack scenarios from page content
- **Atomic testing** - Generate command lines for security testing
- **Multiple LLM providers** - OpenAI, Anthropic, Google Gemini

## Supported Platforms

### OpenCTI
- Threat intelligence platform for STIX objects
- Detect: Threat Actors, Intrusion Sets, Malware, Campaigns, Attack Patterns, Vulnerabilities
- Create: Reports, Cases, Groupings, Investigations
- Version 6.0+ recommended

### OpenAEV
- Attack and Exposure Validation platform
- Detect: Assets, Asset Groups, Players, Teams, Attack Patterns, Findings
- Create: Scenarios, Atomic Tests from page content
- Version 2.0+ recommended

## Support

- [Filigran Community](https://community.filigran.io)
- [GitHub Issues](https://github.com/FiligranHQ/xtm-browser-extension/issues)
- [OpenCTI Documentation](https://docs.opencti.io)
- [OpenAEV Documentation](https://docs.filigran.io/openaev)
