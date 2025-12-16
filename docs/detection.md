# Detection Settings

## Observable Detection

Observables are detected using regular expression patterns. Each type can be enabled or disabled individually. The extension also supports **defanged IOC detection** for threat intelligence reports.

### Network Observables

| Type | Pattern Example | Defanged Support | Default |
|------|-----------------|------------------|---------|
| IPv4-Addr | `192.168.1.1` | `192[.]168[.]1[.]1` | ✅ Enabled |
| IPv6-Addr | `2001:db8::1` | - | ✅ Enabled |
| Domain-Name | `example.com` | `example[.]com` | ✅ Enabled |
| Hostname | `server.example.com` | `server[.]example[.]com` | ✅ Enabled |
| Url | `https://example.com/path` | `hxxps://example[.]com/path` | ✅ Enabled |
| Email-Addr | `user@example.com` | `user[@]example.com` | ✅ Enabled |
| Mac-Addr | `00:1A:2B:3C:4D:5E` | - | ✅ Enabled |

### Defanged IOC Detection

The extension automatically detects common defanging patterns used in threat intelligence reports:

| Defanged Format | Original Format | Notes |
|-----------------|-----------------|-------|
| `example[.]com` | `example.com` | Square bracket dot |
| `example(.)com` | `example.com` | Parenthesis dot |
| `hxxp://` | `http://` | Protocol defanging |
| `hxxps://` | `https://` | Secure protocol defanging |
| `user[@]example.com` | `user@example.com` | At-sign defanging |
| `192[.]168[.]1[.]1` | `192.168.1.1` | IP address defanging |

When a defanged value is detected:
1. The original defanged text is highlighted
2. The refanged value is used for platform lookups
3. A visual indicator shows the value was defanged

### File Observables

| Type | Pattern Example | Default |
|------|-----------------|---------|
| MD5 | `d41d8cd98f00b204e9800998ecf8427e` | ✅ Enabled |
| SHA-1 | `da39a3ee5e6b4b0d3255bfef95601890afd80709` | ✅ Enabled |
| SHA-256 | `e3b0c44298fc1c149afbf4c8996fb924...` | ✅ Enabled |
| SHA-512 | Full 128-character hash | ✅ Enabled |

### Other Observables

| Type | Pattern Example | Default |
|------|-----------------|---------|
| CVE | `CVE-2024-1234` | ✅ Enabled |
| Bitcoin Wallet | `1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2` | ✅ Enabled |
| Ethereum Wallet | `0x742d35Cc6634C0532925a3b844Bc9e7595f...` | ✅ Enabled |
| Phone Number | `+1-555-123-4567` | ⬜ Disabled |

## OpenCTI Entity Detection

STIX Domain Objects are detected through exact name/alias matching against a cached list from your OpenCTI instance.

### Threat Entities

| Type | Description | Default |
|------|-------------|---------|
| Threat-Actor-Group | Organized threat groups | ✅ Enabled |
| Threat-Actor-Individual | Individual threat actors | ✅ Enabled |
| Intrusion-Set | Named intrusion campaigns | ✅ Enabled |
| Malware | Malware families | ✅ Enabled |
| Campaign | Attack campaigns | ✅ Enabled |
| Incident | Security incidents | ✅ Enabled |
| Attack-Pattern | Attack patterns/techniques (name & aliases) | ✅ Enabled |

### Location Entities

| Type | Description | Default |
|------|-------------|---------|
| Country | Country names | ✅ Enabled |
| Region | Geographic regions | ✅ Enabled |
| City | City names | ✅ Enabled |
| Administrative-Area | States, provinces, etc. | ✅ Enabled |
| Position | Specific positions/coordinates | ✅ Enabled |

### Identity Entities

| Type | Description | Default |
|------|-------------|---------|
| Sector | Industry sectors | ✅ Enabled |
| Organization | Named organizations | ✅ Enabled |
| Individual | Named individuals | ✅ Enabled |
| Event | Named events | ✅ Enabled |

## OpenAEV Entity Detection

OpenAEV entities are detected through exact name/alias matching against a cached list from your OpenAEV instance.

### Asset Entities

| Type | Description | Matching Fields | Default |
|------|-------------|-----------------|---------|
| Asset | Endpoints | Name, Hostname, IP addresses, MAC addresses | ✅ Enabled |
| AssetGroup | Asset groups | Name | ✅ Enabled |
| Player | People | Name, Email | ✅ Enabled |
| Team | Teams | Name | ✅ Enabled |

### Attack Patterns

| Type | Description | Matching | Default |
|------|-------------|----------|---------|
| AttackPattern | MITRE ATT&CK techniques | External ID (T1566, T1059.001) | ✅ Enabled |

Attack patterns are matched by their MITRE ATT&CK external ID using exact word-boundary matching:
- ✅ `T1566` matches "The attack used T1566"
- ✅ `T1059.001` matches "PowerShell (T1059.001) was used"
- ❌ `T1566` does NOT match "T156612345" (partial match prevented)

### Findings

| Type | Description | Matching | Default |
|------|-------------|----------|---------|
| Finding | Security findings from scans | Exact value match | ✅ Enabled |

Findings are matched by their exact `finding_value` field. Supported finding types include:
- **text**: Generic text findings
- **number**: Numeric findings
- **port**: Port numbers
- **portscan**: Port scan results
- **ipv4/ipv6**: IP address findings
- **credentials**: Credential findings
- **cve**: CVE-related findings

### Matching Behavior

**Asset Matching:**
Assets can be detected by any of their cached attributes:
- **Name**: "Production Web Server" matches "The Production Web Server was compromised"
- **Hostname**: "db-server-01" matches "Connection from db-server-01"
- **IP Address**: "192.168.1.100" matches "Traffic from 192.168.1.100"
- **MAC Address**: "00:1A:2B:3C:4D:5E" matches "Device MAC 00:1A:2B:3C:4D:5E"

**Exact Matching:**
To prevent false positives, matching uses word boundaries:
- IP addresses: Matched with negative lookarounds to avoid partial matches
- MAC addresses: Matched with word boundaries
- MITRE IDs: Matched with strict word boundaries (`\bT\d{4}(?:\.\d{3})?\b`)

## Cache Management

### How Caching Works

To enable fast detection without making API calls for every page, the extension maintains a local cache of entity names and aliases from your OpenCTI instance.

### Cache Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Cache Duration | How long before cache expires | 1 hour |
| Auto Refresh | Background cache refresh | ✅ Enabled |
| Max Entities | Maximum entities to cache per type | 10,000 |

### Manual Cache Actions

- **Refresh Now**: Force immediate cache refresh
- **Clear Cache**: Remove all cached data
- **View Cache Stats**: See cache size and age

### Cache Storage

Cache is stored in the browser's local storage and is specific to each OpenCTI instance you configure.

