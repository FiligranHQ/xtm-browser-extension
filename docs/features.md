# Features

## Page Scanning

### How It Works

1. Click **Scan** from the popup or use the context menu
2. The extension analyzes the page content
3. Observables are detected using regex patterns (including defanged IOCs)
4. Entities are matched against the cached OpenCTI/OpenAEV data
5. Results are highlighted directly on the page

### Multi-Type Entity Support

When an entity like "Phishing" is found matching multiple types (e.g., both Malware and Attack Pattern) in the same platform, the scan results show:
- **Stacked icon** with a layers indicator
- **Combined counts**: "OCTI ×2" instead of separate entries
- **Tooltip** showing all matched types
- **Single result** instead of duplicate entries per type

This makes it easy to see entities that exist in multiple forms without cluttering the results.

### Highlight Indicators

| Color | Icon | Meaning |
|-------|------|---------|
| Green | ✓ | Found in OpenCTI |
| Amber | ⚠ | Detected but not in OpenCTI |
| Red | ⚠ | Known threat (Malware, Threat Actor) |
| Brown | 🔓 | Vulnerability (CVE) |

### Defanged IOC Detection

The extension automatically detects and refangs defanged indicators of compromise:

| Defanged Format | Detected As |
|-----------------|-------------|
| `example[.]com` | `example.com` (Domain) |
| `hxxp://` or `hxxps://` | `http://` or `https://` (URL) |
| `192[.]168[.]1[.]1` | `192.168.1.1` (IPv4) |
| `user[@]example.com` | `user@example.com` (Email) |

Defanged values are shown with an indicator badge, and the refanged value is used for platform lookups.

### Interacting with Highlights

- **Click**: Open the side panel with entity details
- **Right-click**: Open context menu for quick actions
- **Hover**: View tooltip with basic information

## Entity Details Panel

When you click on a highlighted entity, a side panel opens with comprehensive information.

### Loading State

While fetching entity details from OpenCTI/OpenAEV, a loading spinner replaces the platform logo in the navigation bar. This provides visual feedback during data loading, especially useful for:
- Initial entity lookup after clicking scan results
- Navigating between multi-platform or multi-type entities
- Fetching detailed metadata from platforms

### Entity Information
- **Type Badge**: Entity type with icon and color coding
- **Name**: Entity name or observable value
- **Description**: Truncated to 500 characters for readability (full description available in platform)
- **Aliases**: Alternative names for the entity

### Metadata
- **Author**: The organization/identity that created the intelligence (createdBy)
- **Creator(s)**: OpenCTI user(s) who created the entity in the platform
- **Confidence Level**: For SDOs (STIX Domain Objects) - 0-100 scale
- **Score**: For observables and indicators - 0-100 scale (higher = more malicious)

### For Vulnerabilities (CVEs)
- **CVSS Score**: Base score with severity color coding
- **CVSS Severity**: Low/Medium/High/Critical badge
- **CISA KEV**: Badge if in CISA Known Exploited Vulnerabilities
- **EPSS Score**: Exploit Prediction Scoring System probability
- **Attack Vector**: Network, Adjacent, Local, Physical

### Labels and Markings
- **Labels**: Colored tags from OpenCTI
- **Marking Definitions**: TLP, PAP, and custom markings

### Dates
- Created/Modified (STIX dates)
- Created/Updated (Platform dates)
- First Seen/Last Seen (for applicable entities)

### Related Containers
A list of the 5 most recent containers (Reports, Cases, Groupings) that include this entity:
- Container type with icon
- Container name
- Last modified date
- Click to open in OpenCTI
- Shows count indicator (e.g., "5 of 12") if more containers exist

### Actions
- **Open in OpenCTI**: Direct link to the entity in your platform
- **Copy**: Copy the entity value to clipboard

## Creating Containers

Create OpenCTI containers (Reports, Cases, Groupings) from web pages.

### Steps

1. Click **Container** in the popup
2. Optionally scan and select entities first
3. Select container type:
   - **Report**: For threat intelligence reports
   - **Grouping**: For grouping related objects
   - **Case-Incident**: For security incidents
   - **Case-RFI**: For request for information
4. Fill in metadata:
   - Name (pre-filled from page title)
   - Description (pre-filled from page summary)
   - Labels (from OpenCTI)
   - Marking definitions
5. Optionally enable **Generate PDF** to attach a snapshot
6. Review and submit

### What Gets Included

- Page URL as external reference
- Clean HTML content (saved to content field for indexing)
- All selected/detected entities
- Selected labels and markings
- PDF attachment (optional) with the article content

## PDF Generation

Generate professional PDF snapshots of web pages for archiving or attaching to containers.

### How It Works

The extension uses a multi-step process to generate high-quality PDFs:

1. **Content Extraction**: Mozilla Readability extracts the main article content
2. **Image Processing**: Content images are preserved and embedded
3. **Reader View**: Clean, formatted HTML is generated
4. **PDF Rendering**: jsPDF renders the final document with proper formatting

### PDF Features

- **Clean Article Extraction**: Removes ads, navigation, and clutter
- **Image Preservation**: Content images are embedded (not icons or trackers)
- **Hero Image Detection**: Featured images are automatically included
- **Lazy-Load Handling**: Images with lazy loading are properly resolved
- **Professional Layout**: Headers, footers, page numbers, and branding
- **Metadata**: Title, byline, publication date, source URL, and reading time
- **Table Support**: Data tables are formatted cleanly
- **Code Blocks**: Syntax-highlighted code is preserved

### Paper Sizes

| Size | Dimensions |
|------|------------|
| A4 | 210 × 297 mm |
| Letter | 215.9 × 279.4 mm |
| Legal | 215.9 × 355.6 mm |

### Content Extraction

The content extractor uses Mozilla Readability with enhancements:

| Feature | Description |
|---------|-------------|
| **Smart Selection** | Automatically finds the main article content |
| **Hero Images** | Detects featured images even outside article containers |
| **Lazy Loading** | Resolves `data-src`, `data-lazy-src`, and similar attributes |
| **Srcset Support** | Selects highest quality image from srcset |
| **Caption Extraction** | Preserves figure captions |
| **CORS Bypass** | Uses background script to fetch cross-origin images |

### Extracted Metadata

The extractor captures rich metadata from pages:

- **Title**: From article title, `<h1>`, or meta tags
- **Byline**: Author information
- **Publication Date**: From `<time>` elements or meta tags
- **Site Name**: From `og:site_name` or hostname
- **Reading Time**: Estimated minutes based on word count
- **Excerpt**: Summary from meta description or first paragraphs

## Investigations (Workbench)

Start an investigation workspace directly from a web page.

### Steps

1. Scan the page first
2. Select entities to include (or use all detected)
3. Click **Investigate**
4. The investigation is created and opens in OpenCTI with all entities

## Bulk Import

Add multiple observables to OpenCTI at once.

### Steps

1. Scan the page
2. Click on amber-highlighted items to select them
3. Use the preview panel to review selected items
4. Choose to:
   - **Create Container with Entities**: Wrap imports in a container
   - **Import Raw**: Add entities without a container

## OpenAEV Features

### Asset & Findings Search
Search for assets (endpoints), asset groups, and security findings that match content from the current page:
1. Click **Scan** in the OpenAEV section of the popup
2. The extension detects assets by name, hostname, IP, and MAC address
3. Findings are matched by their exact value
4. View matching entities from your organization

### Scenario Generation
Create attack scenarios from web page content:
1. Click **Scenario** in the popup
2. Configure type affinity and platform affinity
3. Without AI: A basic scenario is generated with related injects
4. With AI (EE): A comprehensive scenario is generated using AI

### Atomic Testing
Create on-the-fly atomic tests:
1. Click **Atomic Test** in the popup
2. Select attack patterns from the page
3. Without AI: View available atomic tests for the pattern
4. With AI (EE): Generate custom command lines for testing

## AI Features (Enterprise Edition)

AI-powered features require at least one Enterprise Edition platform. If not configured, AI buttons will guide you to either:
- Configure AI in Settings (if you have EE)
- Start a free 30-day trial (if you don't have EE)

### Supported LLM Providers

| Provider | Description | Model Selection |
|----------|-------------|-----------------|
| **OpenAI** | GPT-4, GPT-4 Turbo, GPT-4o models | ✅ Dynamic model list |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus | ✅ Dynamic model list |
| **Google Gemini** | Gemini 1.5 Pro and Flash | ✅ Dynamic model list |
| **XTM One** | Filigran Agentic AI Platform (coming soon) | - |

### Model Selection

After configuring your API key, you can:
1. Click **Test Connection** to validate the API key
2. The extension fetches available models from the provider
3. Select your preferred model from the dropdown
4. Models are cached for future sessions

### AI Container Description (OpenCTI)
When creating containers in OpenCTI, you can use AI to generate intelligent descriptions:
1. Start creating a container (Report, Case, etc.)
2. Click the AI generation button next to the description field
3. AI analyzes the page content and generates a relevant description
4. The generated description summarizes key threats, observables, and context

### Full AI Scenario Generation (OpenAEV)
Generate complete attack scenarios using AI directly from page content:
1. Click **Scenario** in the popup
2. Select your affinities:
   - **Type Affinity**: Endpoint, Cloud, Web, or Table-top
   - **Platform Affinity**: Windows, Linux, macOS, Android (for technical scenarios)
3. Click **Generate Scenario with AI** button
4. Configure generation parameters:
   - **Number of Injects**: How many injects to generate (1-20, default 5)
   - **For Technical Scenarios**: Choose payload executor (PowerShell, CMD, Bash, Sh)
   - **For Table-top Scenarios**: 
     - Set exercise duration in minutes
     - Select scenario theme
     - Choose email language
   - **Additional Context**: Provide any extra context for the AI
5. AI generates a complete scenario with:
   - **Technical Scenarios**: Executable command payloads that are safe and non-destructive
   - **Table-top Scenarios**: Realistic email notifications with subjects and bodies in the selected language
   - Proper sequencing based on attack phases
   - Context derived from page content (works even without detected attack patterns)

### Scenario Themes (Table-Top Exercises)

When generating table-top scenarios, you can select a theme that customizes the AI-generated content. Each theme focuses on domain-specific incidents:

| Theme | Focus Areas | Example Topics |
|-------|-------------|----------------|
| 🔐 **Cybersecurity & Technology** | Cyber attacks, IT security incidents | Data breaches, ransomware, phishing campaigns, malware outbreaks, insider threats, vulnerability exploitation |
| 🏢 **Physical Security & Safety** | Physical threats and facility security | Facility intrusions, access control breaches, theft incidents, workplace violence, surveillance failures |
| 🔄 **Business Continuity** | Business disruption and operational resilience | Natural disasters, power outages, supply chain disruptions, system failures, vendor failures |
| 📢 **Crisis Communication** | Media and reputation management | Media leaks, social media crises, negative press, stakeholder concerns, brand reputation threats |
| ⚕️ **Health & Safety** | Occupational health and safety | Workplace injuries, pandemic outbreaks, environmental contamination, safety equipment failures |
| 🌍 **Geopolitical & Economic** | International and economic scenarios | Sanctions compliance, trade restrictions, political instability, currency crises, regulatory changes |

**How Themes Work:**
- Each theme modifies the AI system prompt with domain-specific instructions
- The AI generates scenarios relevant to the selected theme's focus areas
- Email content (subjects and bodies) reflects realistic situations for that domain
- Proper escalation patterns and response procedures are included

### AI Email Content Generation (OpenAEV)
For table-top scenarios, AI can generate realistic email content:
1. Create a table-top scenario and select attack patterns
2. Select the desired email language from the dropdown (13 languages supported)
3. Click the AI generate button for emails
4. AI creates contextual email subjects and bodies for each attack pattern in the selected language
5. Emails are marked as [SIMULATION] for training purposes

**Supported Email Languages:**
English, French, German, Spanish, Italian, Portuguese, Dutch, Polish, Russian, Chinese, Japanese, Korean, Arabic

### AI Atomic Testing (OpenAEV)
Generate on-the-fly atomic tests with AI:
1. Click **Atomic Test** in the popup
2. Select target attack pattern or click **Generate Payload with AI**
3. Choose target platform and execution preferences
4. AI generates:
   - Custom command lines (PowerShell, Bash, etc.)
   - Test procedures tailored to the page context
   - Cleanup commands
   - Safe, non-destructive simulation commands

### AI Entity Discovery
AI can help identify entities that pattern matching might miss:
1. During container creation, click **AI Discover Entities**
2. AI analyzes the full page context
3. Additional threat actors, campaigns, and techniques are suggested
4. **Visibility filtering**: Only entities that can be highlighted on the visible page are included (filters out entities from inaccessible content like shadow DOM)
5. Review and select entities to include
6. Click on AI-discovered (purple) highlights to re-open the panel with AI filter applied

### AI Relationship Resolution
AI can identify relationships between detected entities:
1. Select entities for import
2. Click **Resolve Relationships with AI**
3. AI analyzes page context to find relationships using **valid STIX 2.1 and OpenCTI relationship types only**
4. Relationships are displayed with confidence levels and explanations
5. Select which relationships to include in import

**Supported Relationship Types:**
The AI only suggests relationships that are valid in OpenCTI. This includes:
- **STIX 2.1 Standard**: `uses`, `targets`, `attributed-to`, `delivers`, `drops`, `downloads`, `exploits`, `variant-of`, `controls`, `authored-by`, `communicates-with`, `beacons-to`, `exfiltrates-to`, `hosts`, `owns`, `consists-of`, `indicates`, `based-on`, `derived-from`, `mitigates`, `remediates`, `located-at`, `originates-from`, `impersonates`, `compromises`, `resolves-to`, `belongs-to`
- **OpenCTI Extensions**: `part-of`, `cooperates-with`, `participates-in`, `subtechnique-of`, `has`, `amplifies`, `publishes`, `demonstrates`, `detects`
- **Fallback**: `related-to` (used only when no specific relationship applies)

## Context Menu

Right-click on any page to access:

- **Scan page for threats**: Full page scan
- **Search in OpenCTI**: Search selected text
- **Add to OpenCTI**: Add selected text as observable
- **Create container from page**: Quick container creation
- **Start investigation from page**: Quick investigation creation

## Search

### OpenCTI Search
Use the search feature to query your OpenCTI instance:
1. Click **Search** in the popup
2. Enter your search term
3. Results show entities matching your query
4. Click a result to view full details in the side panel

### OpenAEV Search
Search for OpenAEV entities:
1. Click **Search OpenAEV** in the popup
2. Enter your search term
3. Results show assets, attack patterns, and other entities
4. Click a result to view details

### Unified Search
Search across all connected platforms simultaneously:
1. Click **Unified Search** in the popup
2. Enter your search term
3. Results are grouped by platform
4. Platform tabs show the source of each result

## Multi-Platform Support

The extension supports multiple instances of each platform type:

### Configuration
1. Go to Settings → OpenCTI or OpenAEV tab
2. Click **Add Platform** to add additional instances
3. Each platform has its own URL, API token, and name
4. Enterprise Edition status is automatically detected

### How It Works
- **Scanning**: All platforms are scanned in parallel
- **Entity Details**: Results show which platforms contain the entity
- **Container Creation**: Select target platform for new containers
- **Cache**: Each platform maintains its own entity cache

### Multi-Platform Navigation
When an entity exists in multiple platforms, navigation arrows appear in the entity overview:
- Use **← →** arrows to switch between platforms
- Each platform view fetches fresh data to ensure accuracy
- A loading spinner shows while fetching data
- Navigation arrows are disabled during loading to prevent race conditions

### Multi-Type Navigation
When an entity exists as multiple types within a single platform (e.g., "Phishing" as both Malware and Attack Pattern in OpenCTI):
- Results are grouped under a single entry with a "N types" indicator
- Navigate through all matching types using the same arrow navigation
- Each type view shows the specific entity details for that type

### CVE/Vulnerability Detection
CVEs are detected via regex patterns and can be searched in both OpenCTI and OpenAEV:
- **Cross-platform detection**: When a CVE like `CVE-2024-1234` is found on a page, it's searched in both platforms
- **Per-platform settings**: Enable/disable vulnerability detection independently for each platform in Settings → Detection
- **Performance optimization**: If vulnerability detection is disabled for all platforms, the CVE regex is skipped entirely
- **Multi-platform results**: CVEs found in both platforms show combined results (e.g., "OCTI (1), OAEV (1)")

## Clear Highlights

To remove all highlights from the current page:
- Click **Clear highlights** in the popup
- Or refresh the page
