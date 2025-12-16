# Filigran XTM Browser Extension Documentation

Welcome to the documentation for the **Filigran XTM Browser Extension** — your browser-based threat intelligence workstation.

This extension integrates with [OpenCTI](https://filigran.io/solutions/open-cti/) and [OpenAEV](https://filigran.io/solutions/openaev/) platforms, enabling security analysts to detect threats, create reports, and operationalize intelligence directly from any web page.

## Table of Contents

| Document | Description |
|----------|-------------|
| [Overview](./overview.md) | Architecture, concepts, and supported platforms |
| [Architecture](./architecture.md) | Technical architecture, state management, and workflows |
| [Installation](./installation.md) | Browser-specific installation guides |
| [Configuration](./configuration.md) | Platform setup, API tokens, AI settings |
| [Features](./features.md) | Page scanning, highlighting, containers, AI, and scenario themes |
| [Detection Settings](./detection.md) | Observable, entity type, and defanged IOC configuration |
| [Development](./development.md) | Development guide, testing, and contributing |
| [Troubleshooting](./troubleshooting.md) | Common issues and solutions |

## Quick Start

1. **Install** the extension from your browser's extension store or load from source
2. **Click** the Filigran icon in your browser toolbar
3. **Configure** your OpenCTI and/or OpenAEV connection (URL and API token)
4. **Start scanning** pages for threats and security entities!

## Key Features

### 🔍 Threat Detection
- **Pattern-based detection** for observables (IPs, domains, hashes, CVEs)
- **Defanged IOC support** - automatically detects `example[.]com`, `hxxps://`, etc.
- **Entity matching** against cached platform data
- **MITRE ATT&CK** technique detection (T1566, T1059.001, etc.)
- **Multi-platform scanning** - search across all connected platforms

### 📋 Content Management
- **Container creation** - Reports, Cases, Groupings with detected entities
- **PDF generation** - Clean article snapshots using Mozilla Readability
- **Investigation workbench** - Start investigations with detected entities
- **Bulk import** - Add multiple observables at once

### 🧠 AI Features (Enterprise Edition)
- **Description generation** - AI-powered container descriptions
- **Full scenario generation** - Complete attack scenarios with injects
- **Themed table-top exercises** - 6 specialized scenario themes
- **Atomic testing** - Generate command lines for security testing
- **Entity discovery** - Find entities pattern matching might miss
- **Relationship resolution** - Identify connections between entities
- **Multiple LLM providers** - OpenAI, Anthropic, Google Gemini

### 🎭 Scenario Themes (Table-Top Exercises)

Generate diverse training scenarios with AI-powered themes:

| Theme | Focus |
|-------|-------|
| 🔐 Cybersecurity & Technology | Cyber attacks, data breaches, ransomware |
| 🏢 Physical Security & Safety | Facility security, access control |
| 🔄 Business Continuity | Disasters, supply chain, operations |
| 📢 Crisis Communication | Media, PR, reputation |
| ⚕️ Health & Safety | Occupational health, pandemic |
| 🌍 Geopolitical & Economic | Sanctions, trade, political |

## Supported Platforms

### OpenCTI
- Threat intelligence platform for STIX objects
- Detect: Threat Actors, Intrusion Sets, Malware, Campaigns, Attack Patterns, Vulnerabilities
- Create: Reports, Cases, Groupings, Investigations
- AI: Description generation, entity discovery (EE)
- Version 6.0+ recommended

### OpenAEV
- Attack and Exposure Validation platform
- Detect: Assets, Asset Groups, Players, Teams, Attack Patterns, Findings
- Create: Scenarios, Atomic Tests from page content
- AI: Full scenario generation with themes, atomic test generation (EE)
- Version 2.0+ recommended

## Technical Documentation

For developers and technical users:

- **[Architecture](./architecture.md)** - Component structure, state management, message passing
- **Panel State Machine** - Visual diagram of all panel modes and transitions
- **Technical Workflows** - Step-by-step flow diagrams for key operations
- **API Integration** - How the extension communicates with platforms

## Support

- [Filigran Community](https://community.filigran.io)
- [GitHub Issues](https://github.com/FiligranHQ/xtm-browser-extension/issues)
- [OpenCTI Documentation](https://docs.opencti.io)
- [OpenAEV Documentation](https://docs.filigran.io/openaev)

---
© 2025 Filigran
