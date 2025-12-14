# Configuration

## Initial Setup (Setup Wizard)

When you first open the extension with no platforms configured, a setup wizard guides you through the configuration:

### Step 1: OpenCTI Connection

1. Enter your OpenCTI Platform URL (e.g., `https://opencti.example.com`)
2. Enter your API Token
3. Click **Connect** to test the connection
4. On success, the platform name is automatically filled from the remote platform
5. Click **Skip** if you don't have an OpenCTI instance

### Step 2: OpenAEV Connection

1. Enter your OpenAEV Platform URL
2. Enter your API Token
3. Click **Connect** to test
4. Click **Skip** if you don't have an OpenAEV instance

## Settings Page

Access the full settings by clicking the gear icon in the popup.

### OpenCTI Platforms

Configure one or more OpenCTI platform connections:

| Field | Description | Required |
|-------|-------------|----------|
| Platform Name | Display name (auto-filled on successful connection) | Yes |
| URL | Your OpenCTI instance URL | Yes |
| API Token | Your personal API token from OpenCTI | Yes |

**Workflow:**
1. Click **Add OpenCTI Platform**
2. Enter the URL and API Token
3. Click **Test** to verify the connection
4. Platform name is auto-filled from the remote platform settings
5. Click **Save Settings** to persist the configuration

> **Note**: The Test button validates your credentials without saving. You must click Save Settings after a successful test.

### OpenAEV Platforms

Configure one or more OpenAEV platform connections with the same workflow as OpenCTI.

### Getting Your API Token

#### OpenCTI
1. Log into your OpenCTI platform
2. Navigate to **Settings → Profile**
3. Scroll to **API Access**
4. Copy your API token

#### OpenAEV
1. Log into your OpenAEV platform
2. Navigate to your profile settings
3. Generate or copy your API token

> ⚠️ **Security Note**: Your API tokens are stored locally in your browser's encrypted storage and are only sent to your configured platform instances.

## Detection Settings

Configure what the extension detects on web pages:

### Scan Behavior
- **Auto-scan on page load**: Automatically scan pages when they finish loading
- **Show notifications**: Display browser notifications for scan results

### Entity Cache
The extension maintains a local cache of OpenCTI entities for fast offline detection:
- **Cache Duration**: 1 hour by default
- **Refresh Interval**: 30 minutes
- Click **Refresh Cache** to manually update

### Observable Types
Enable/disable detection of specific observable types:
- IPv4/IPv6 addresses
- Domain names and hostnames
- URLs
- Email addresses
- File hashes (MD5, SHA-1, SHA-256, SHA-512)
- MAC addresses
- Cryptocurrency wallets (Bitcoin, Ethereum)
- Bank accounts (IBAN)
- Phone numbers
- User agents

### OpenCTI Entity Types
Enable/disable detection of STIX Domain Objects:
- Threat Actor Groups
- Intrusion Sets
- Campaigns
- Malware
- Vulnerabilities
- Incidents
- Organizations
- Individuals
- Sectors
- Countries, Regions, Cities
- Events

### OpenAEV Entity Types
Enable/disable detection of OpenAEV entities:
- Assets (Endpoints)
- Asset Groups
- Players (People)
- Teams

## Appearance Settings

### Theme
- **Auto**: Follow your system's color scheme preference
- **Dark**: Force dark mode
- **Light**: Force light mode

## Advanced Actions

### Remove Platforms
- **Remove All OpenCTI**: Remove all OpenCTI platform configurations and clear cached data
- **Remove All OpenAEV**: Remove all OpenAEV platform configurations and clear cached data
- **Remove All Platforms**: Remove all platform configurations (OpenCTI and OpenAEV) at once

### Reset Settings
- **Reset Detection to Default**: Restore default detection settings
- **Reset All Settings**: Clear all settings and start fresh

## Cache Management

The extension maintains local caches of entity names for fast offline detection.

### OpenCTI Cache
Stores STIX Domain Objects (threat actors, intrusion sets, malware, etc.) from your OpenCTI instance.

### OpenAEV Cache
Stores assets, teams, players, and attack patterns from your OpenAEV instance. Assets are cached with their:
- Name
- Hostname
- IP addresses
- MAC addresses

This enables detection of assets by any of these identifiers.

### Cache Actions
- **Refresh Cache**: Manually refresh entity cache from platforms
- **Clear Cache**: Remove all cached data (useful for troubleshooting)
