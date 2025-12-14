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

### Asset Search
Search for assets (endpoints) and asset groups that match content from the current page:
1. Click **Assets** in the popup (requires OpenAEV connection)
2. View matching assets from your organization

### Scenario Generation
Create attack scenarios from web page content:
1. Click **Scenario** in the popup
2. A new scenario is created with page context

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
