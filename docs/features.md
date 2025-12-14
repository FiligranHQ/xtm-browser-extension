# Features

## Page Scanning

### How It Works

1. Click **Scan** from the popup or use the context menu
2. The extension analyzes the page content
3. Observables are detected using regex patterns
4. Entities are matched against the cached OpenCTI data
5. Results are highlighted directly on the page

### Highlight Indicators

| Color | Icon | Meaning |
|-------|------|---------|
| Green | ✓ | Found in OpenCTI |
| Amber | ⚠ | Detected but not in OpenCTI |
| Red | ⚠ | Known threat (Malware, Threat Actor) |
| Brown | 🔓 | Vulnerability (CVE) |

### Interacting with Highlights

- **Click**: Open the side panel with entity details
- **Right-click**: Open context menu for quick actions
- **Hover**: View tooltip with basic information

## Entity Details Panel

When you click on a highlighted entity, a side panel opens with comprehensive information:

### Entity Information
- **Type Badge**: Entity type with icon and color coding
- **Name**: Entity name or observable value
- **Description**: Truncated description (if available)
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
A list of the most recent containers (Reports, Cases, Groupings) that include this entity:
- Container type with icon
- Container name
- Last modified date
- Click to open in OpenCTI

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
5. Review and submit

### What Gets Included

- Page URL as external reference
- Clean HTML content (saved to content field for indexing)
- All selected/detected entities
- Selected labels and markings

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

| Provider | Description |
|----------|-------------|
| **OpenAI** | GPT-4 and GPT-4 Turbo models |
| **Anthropic** | Claude 3.5 Sonnet and Claude 3 Opus |
| **Google Gemini** | Gemini 1.5 Pro and Flash |
| **XTM One** | Filigran Agentic AI Platform (coming soon) |

### AI Container Description (OpenCTI)
When creating containers in OpenCTI, you can use AI to generate intelligent descriptions:
1. Start creating a container (Report, Case, etc.)
2. Click the AI generation button next to the description field
3. AI analyzes the page content and generates a relevant description

### AI Scenario Generation (OpenAEV)
Generate comprehensive attack scenarios using AI:
1. Click **Scenario** in the popup
2. Configure affinities (type and platform)
3. AI generates a full scenario with:
   - Contextual injects based on page content
   - Attack patterns matched from the page
   - Proper sequencing and dependencies

### AI Atomic Testing (OpenAEV)
Generate on-the-fly atomic tests with AI:
1. Click **Atomic Test** in the popup
2. Select target attack pattern
3. AI generates:
   - Custom command lines (PowerShell, Bash, etc.)
   - Test procedures tailored to your environment
   - Cleanup commands

## Context Menu

Right-click on any page to access:

- **Scan page for threats**: Full page scan
- **Search in OpenCTI**: Search selected text
- **Add to OpenCTI**: Add selected text as observable
- **Create container from page**: Quick container creation
- **Start investigation from page**: Quick investigation creation

## Search

Use the search feature to query your OpenCTI instance:

1. Click **Search** in the popup
2. Enter your search term
3. Results show entities matching your query
4. Click a result to view full details in the side panel

## Clear Highlights

To remove all highlights from the current page:
- Click **Clear highlights** in the popup
- Or refresh the page
