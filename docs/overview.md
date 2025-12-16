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

### OpenAEV (Attack & Exposure Validation)
OpenAEV is a platform for attack simulation and exposure validation. The extension integrates with OpenAEV to:
- Detect assets by name, hostname, IP addresses, and MAC addresses
- Detect teams and players
- Match MITRE ATT&CK patterns
- Create scenarios from web page content

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

### 🎯 Visual Highlighting
- **Green highlight** with ✓ icon: Found in platform
- **Amber highlight** with ⚠ icon: Detected but not in platform
- **Red highlight**: Known threat (Malware, Threat Actor)
- **Brown highlight** with 🔓 icon: Vulnerability (CVE)
- Click to select items for bulk operations

### 📋 Quick Actions
- **Scan Page**: Detect all threats and observables
- **Investigate**: Start an investigation (OpenCTI)
- **Create Container**: Create Reports, Cases, or Groupings (OpenCTI)
- **Bulk Import**: Add multiple observables at once
- **Search Assets**: Find matching assets (OpenAEV)
- **Create Scenario**: Generate attack scenarios (OpenAEV)

### 🎨 Theme Integration
The extension automatically adapts to your preferred theme settings (dark/light mode).

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
| **Options** | Platform configuration, detection settings, cache management |
| **Panel** | Entity details, metadata, labels, markings, containers |
| **Content** | Page scanning, DOM manipulation, highlighting |
| **Background** | API clients, cache management, message routing |

### Data Flow

1. User triggers scan from **Popup**
2. **Background** receives message, fetches page content from **Content** script
3. **Detection Engine** analyzes content:
   - Regex patterns for observables
   - Cache lookup for named entities
4. Results sent back through **Background** to **Content**
5. **Content** script highlights matches on page
6. User clicks highlight → **Panel** shows entity details

## Browser Support

| Browser | Manifest Version | Status |
|---------|------------------|--------|
| Chrome  | V3 | ✅ Full Support |
| Edge    | V3 | ✅ Full Support |
| Firefox | V3 | ✅ Full Support |
| Safari  | V3 | ⚠️ Requires wrapper app |

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
