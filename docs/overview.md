# Overview

## What is Filigran XTM?

The Filigran XTM (Threat Management) Browser Extension is a powerful tool that connects your web browser directly to OpenCTI and OpenAEV platforms, enabling real-time threat intelligence lookup and security entity detection from any web page.

## Supported Platforms

### OpenCTI (Cyber Threat Intelligence)
OpenCTI is an open-source platform for managing cyber threat intelligence (CTI). The extension integrates with OpenCTI to:
- Detect STIX Domain Objects (threat actors, malware, campaigns, etc.)
- Detect cyber observables (IPs, domains, hashes, CVEs, etc.)
- Create reports, cases, and investigations
- Enrich threat intelligence workflows
- Generate AI-powered descriptions and entity discovery (Enterprise Edition)

### OpenAEV (Adversarial Exposure Validation)
OpenAEV is a platform for attack simulation and exposure validation. The extension integrates with OpenAEV to:
- Detect assets by name, hostname, IP addresses, and MAC addresses
- Detect teams and players
- Match MITRE ATT&CK patterns
- Create scenarios from web page content
- Generate AI-powered attack scenarios and atomic tests (Enterprise Edition)

## Key Capabilities

### 🔍 Page Scanning
Automatically detect and highlight security-relevant content on any web page.

**OpenCTI - Observables (Pattern-based detection):**
- IP addresses (IPv4, IPv6) - including defanged formats
- Domain names and hostnames - including defanged formats
- URLs - including `hxxp://` and `hxxps://` defanged formats
- Email addresses - including `[@]` defanged formats
- File hashes (MD5, SHA-1, SHA-256, SHA-512)
- CVE identifiers
- Cryptocurrency wallets (Bitcoin, Ethereum)
- MAC addresses
- Phone numbers
- And more...

> **Defanged IOC Support**: The extension automatically detects common defanged formats used in threat reports (e.g., `example[.]com`, `hxxps://`) and refangs them for platform lookups.

**OpenCTI - STIX Domain Objects (Exact match detection):**
- **Threat Actors**: Groups (GRU, Lazarus Group) and Individuals
- **Intrusion Sets**: APT campaigns (APT29/Cozy Bear, APT28/Fancy Bear)
- **Malware**: Malware families (Emotet, Ryuk)
- **Tools**: Offensive tools (Cobalt Strike, Mimikatz)
- **Campaigns**: Named attack campaigns
- **Vulnerabilities**: CVEs with CVSS, EPSS, CISA KEV data
- **Attack Patterns**: MITRE ATT&CK techniques (T1566, T1059.001)
- **Locations**: Countries, Regions, Cities
- **Identities**: Organizations, Sectors

**OpenAEV - Security Entities (Exact match detection):**
- **Assets**: Endpoints by name, hostname, IP, or MAC address
- **Asset Groups**: Groups of related assets
- **Players**: People in the organization
- **Teams**: Security teams (Red Team, Blue Team)
- **Attack Patterns**: MITRE ATT&CK patterns (T1566, T1059)
- **Findings**: Security findings by value

### 🎯 Visual Highlighting
- **Green highlight**: Found in platform (OpenCTI or OpenAEV)
- **Amber highlight**: Detected but not found in any platform
- **Purple highlight**: AI-discovered entity
- Click to select items for bulk operations

### 📋 Quick Actions
- **Scan Page**: Detect all threats and observables
- **Investigate**: Start an investigation (OpenCTI)
- **Create Container**: Create Reports, Cases, or Groupings (OpenCTI)
- **Bulk Import**: Add multiple observables at once
- **Search Assets**: Find matching assets (OpenAEV)
- **Create Scenario**: Generate attack scenarios (OpenAEV)
- **Atomic Testing**: Create atomic tests (OpenAEV)

### 🧠 AI Features (Enterprise Edition)
- **Container Descriptions**: AI-generated summaries for OpenCTI containers
- **Scenario Generation**: Complete attack scenarios with AI-generated payloads or emails
- **Themed Table-Top Exercises**: 6 scenario themes for diverse training exercises
- **Atomic Test Generation**: Custom command lines tailored to page context
- **Entity Discovery**: Find entities that pattern matching might miss
- **Relationship Resolution**: Identify connections between detected entities

### 🎨 Theme Integration
The extension automatically adapts to your preferred theme settings (auto/dark/light).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Browser Extension                           │
├───────────┬───────────┬───────────┬───────────┬────────────────┤
│   Popup   │  Options  │   Panel   │  Content  │   Background   │
│ (Actions) │ (Config)  │ (Details) │ (Scanner) │ (Service Work) │
├───────────┴───────────┴───────────┴───────────┴────────────────┤
│                    Shared Components                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ API Clients │  │  Detection  │  │   Cache & Storage       │ │
│  │ (GraphQL/   │  │  Engine     │  │   (Chrome Storage)      │ │
│  │  REST/AI)   │  │  (Patterns) │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  Content Extraction                          ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ││
│  │  │ Readability  │  │    PDF       │  │   Image CORS     │  ││
│  │  │ (Mozilla)    │  │  Generator   │  │   Bypass         │  ││
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│                    External Platforms                            │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │      OpenCTI         │  │      OpenAEV         │            │
│  │  (GraphQL API)       │  │   (REST API)         │            │
│  │  - Threat Intel      │  │  - Assets            │            │
│  │  - Observables       │  │  - Teams/Players     │            │
│  │  - Containers        │  │  - Attack Patterns   │            │
│  │  - AI (EE)           │  │  - Scenarios (EE)    │            │
│  └──────────────────────┘  └──────────────────────┘            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    LLM Providers (AI)                     │  │
│  │  OpenAI  │  Anthropic  │  Google Gemini  │  XTM One      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **Popup** | Quick actions, scan trigger, platform selection |
| **Options** | Platform configuration, detection settings, AI setup, cache management |
| **Panel** | Entity details, container creation, scenario generation, search |
| **Content** | Page scanning, DOM manipulation, highlighting, panel management |
| **Background** | API clients, cache management, message routing, AI coordination |

### Data Flow

1. User triggers scan from **Popup**
2. **Background** receives message, fetches page content from **Content** script
3. **Detection Engine** analyzes content:
   - Regex patterns for observables
   - Cache lookup for named entities
4. Results sent back through **Background** to **Content**
5. **Content** script highlights matches on page
6. User clicks highlight → **Panel** shows entity details

### AI Data Flow (Enterprise Edition)

1. User triggers AI action (description, scenario, etc.)
2. **Panel** collects context (page content, detected entities)
3. **Background** builds prompt with context and theme-specific instructions
4. Request sent to configured LLM provider
5. Response parsed and validated
6. Result displayed in **Panel** for review and action

## Multi-Platform Support

The extension supports connecting to multiple instances of each platform type:

| Feature | Description |
|---------|-------------|
| **Parallel Scanning** | All platforms are scanned simultaneously |
| **Platform Tabs** | Entity details show which platforms contain the entity |
| **Platform Selection** | Choose target platform for new containers/scenarios |
| **Independent Caches** | Each platform maintains its own entity cache |
| **Enterprise Detection** | EE status is detected per-platform for AI features |

## Browser Support

| Browser | Manifest Version | Status |
|---------|------------------|--------|
| Chrome  | V3 | ✅ Full Support |
| Edge    | V3 | ✅ Full Support |
| Firefox | V3 | ✅ Full Support |
| Safari  | V3 | ⚠️ Requires wrapper app |

## Scenario Themes (Table-Top Exercises)

For AI-generated table-top scenarios, choose from 6 specialized themes:

| Theme | Focus |
|-------|-------|
| 🔐 **Cybersecurity & Technology** | Cyber attacks, data breaches, ransomware, IT incidents |
| 🏢 **Physical Security & Safety** | Facility security, access control, workplace safety |
| 🔄 **Business Continuity** | Disasters, supply chain, operational resilience |
| 📢 **Crisis Communication** | Media, PR, reputation management |
| ⚕️ **Health & Safety** | Occupational health, pandemic, environmental hazards |
| 🌍 **Geopolitical & Economic** | Sanctions, trade, political instability |

## Entity Type Clarifications

### STIX Terminology (OpenCTI)

| Entity Type | Description | Examples |
|-------------|-------------|----------|
| **Threat Actor Group** | Organization or group conducting attacks | GRU, FSB, Lazarus Group |
| **Intrusion Set** | Cluster of adversary behaviors | APT29 (Cozy Bear), APT28 (Fancy Bear) |
| **Malware** | Malicious software family | Emotet, Ryuk, TrickBot |
| **Tool** | Software used by adversaries | Cobalt Strike, Mimikatz |
| **Campaign** | Named attack operation | SolarWinds (SUNBURST) |
| **Attack Pattern** | MITRE ATT&CK technique | T1566 (Phishing), T1059 (Command Interpreter) |
| **Vulnerability** | Security weakness | CVE-2021-44228 (Log4Shell) |

> **Important**: APT names like "APT29" are typically **Intrusion Sets** (representing adversary behavior), not Threat Actor Groups. The actual organization (like GRU or SVR) is the Threat Actor Group.

## Next Steps

- [Installation Guide](./installation.md) - Get started with installation
- [Configuration](./configuration.md) - Set up your platforms
- [Features](./features.md) - Detailed feature documentation
- [Architecture](./architecture.md) - Technical architecture and workflows
