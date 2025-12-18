/**
 * Entity type colors - ported from OpenCTI's Colors.js itemColor function
 * These match the exact colors used in the OpenCTI platform
 */

export const stringToColour = (str: string | null | undefined, reversed = false): string => {
  if (!str) {
    return '#5d4037';
  }
  if (str === 'true') {
    if (reversed) {
      return '#bf360c';
    }
    return '#2e7d32';
  }
  if (str === 'false') {
    if (reversed) {
      return '#2e7d32';
    }
    return '#bf360c';
  }
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let colour = '#';
  for (let i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    colour += `00${value.toString(16)}`.substr(-2);
  }
  return colour;
};
 

/**
 * Get color for entity type - matches OpenCTI's itemColor function exactly
 */
export const itemColor = (type: string | null | undefined, dark = true, reversed = false): string => {
  const normalizedType = type?.replace(/_/g, '-');
  
  switch (normalizedType) {
    case 'Restricted':
      return dark ? '#424242' : '#B0B0B0';
    case 'Attack-Pattern':
    case 'attack-pattern':
      return dark ? '#d4e157' : '#827717';
    case 'Case-Incident':
    case 'case-incident':
      return dark ? '#ad1457' : '#ec407a';
    case 'Case-Rfi':
    case 'case-rfi':
      return dark ? '#0c5c98' : '#3880b7';
    case 'Case-Rft':
    case 'case-rft':
      return dark ? '#ea80fc' : '#8e24aa';
    case 'Case-Feedback':
    case 'feedback':
      return dark ? '#00acc1' : '#006064';
    case 'Task':
    case 'task':
      return dark ? '#304ffe' : '#283593';
    case 'Campaign':
    case 'campaign':
      return dark ? '#8e24aa' : '#ea80fc';
    case 'Note':
    case 'note':
      return dark ? '#33691e' : '#689f38';
    case 'Observed-Data':
    case 'observed-data':
      return dark ? '#00acc1' : '#006064';
    case 'Opinion':
    case 'opinion':
      return dark ? '#1565c0' : '#1976d2';
    case 'Report':
    case 'report':
      return dark ? '#4a148c' : '#9c27b0';
    case 'Grouping':
    case 'grouping':
      return dark ? '#689f38' : '#8bc34a';
    case 'Course-Of-Action':
    case 'course-of-action':
      return dark ? '#8bc34a' : '#689f38';
    case 'Individual':
    case 'individual':
    case 'User':
    case 'user':
      return dark ? '#9c27b0' : '#4a148c';
    case 'Group':
    case 'group':
      return dark ? '#006064' : '#00bcd4';
    case 'Capability':
    case 'capability':
      return dark ? '#424242' : '#757575';
    case 'Organization':
    case 'organization':
      return dark ? '#3880b7' : '#0c5c98';
    case 'Sector':
    case 'sector':
      return dark ? '#0d47a1' : '#2196f3';
    case 'System':
    case 'system':
      return dark ? '#8bc34a' : '#689f38';
    case 'Event':
    case 'event':
      return dark ? '#00acc1' : '#006064';
    case 'Indicator':
    case 'indicator':
      return dark ? '#ffc107' : '#b69007';
    case 'Infrastructure':
    case 'infrastructure':
      return dark ? '#512da8' : '#651fff';
    case 'Intrusion-Set':
    case 'intrusion-set':
      return dark ? '#bf360c' : '#ff5622';
    case 'City':
    case 'city':
      return dark ? '#00acc1' : '#006064';
    case 'Country':
    case 'country':
      return dark ? '#304ffe' : '#283593';
    case 'Region':
    case 'region':
      return dark ? '#33691e' : '#689f38';
    case 'Administrative-Area':
    case 'administrative-area':
      return dark ? '#ffc107' : '#b69007';
    case 'Position':
    case 'position':
      return dark ? '#00acc1' : '#827717';
    case 'Malware':
    case 'malware':
      return dark ? '#ff9800' : '#d68100';
    case 'Malware-Analysis':
    case 'malware-analysis':
      return dark ? '#006064' : '#00acc1';
    case 'Threat-Actor':
    case 'threat-actor':
    case 'Threat-Actor-Group':
    case 'threat-actor-group':
      return dark ? '#880e4f' : '#e91e63';
    case 'Threat-Actor-Individual':
    case 'threat-actor-individual':
      return dark ? '#4a148c' : '#9c27b0';
    case 'SecurityPlatform':
    case 'security-platform':
      return dark ? '#4a148c' : '#baff7a';
    case 'Tool':
    case 'tool':
      return '#986937';
    case 'Channel':
    case 'channel':
      return dark ? '#ad1457' : '#ec407a';
    case 'Narrative':
    case 'narrative':
      return dark ? '#8bc34a' : '#689f38';
    case 'Language':
    case 'language':
      return dark ? '#afb42b' : '#d4e157';
    case 'Vulnerability':
    case 'vulnerability':
      return dark ? '#5d4037' : '#795548';
    case 'Incident':
    case 'incident':
      return '#f44336';
    case 'Dashboard':
    case 'dashboard':
    case 'Investigation':
    case 'investigation':
      return dark ? '#689f38' : '#33691e';
    case 'Session':
    case 'session':
      return dark ? '#5d4037' : '#795548';
    case 'Artifact':
    case 'artifact':
      return dark ? '#f2699c' : '#ff4081';
    // Cyber observables
    case 'Stix-Cyber-Observable':
    case 'stix-cyber-observable':
    case 'Autonomous-System':
    case 'autonomous-system':
    case 'Directory':
    case 'directory':
    case 'Domain-Name':
    case 'domain-name':
    case 'Email-Addr':
    case 'email-addr':
    case 'Email-Message':
    case 'email-message':
    case 'Email-Mime-Part-Type':
    case 'StixFile':
    case 'stixfile':
    case 'file':
    case 'X509-Certificate':
    case 'x509-certificate':
    case 'IPv4-Addr':
    case 'ipv4-addr':
    case 'IPv6-Addr':
    case 'ipv6-addr':
    case 'Mac-Addr':
    case 'mac-addr':
    case 'Mutex':
    case 'mutex':
    case 'Network-Traffic':
    case 'network-traffic':
    case 'Process':
    case 'process':
    case 'Software':
    case 'software':
    case 'Url':
    case 'url':
    case 'User-Account':
    case 'user-account':
    case 'Windows-Registry-Key':
    case 'windows-registry-key':
    case 'Windows-Registry-Value-Type':
    case 'Cryptographic-Key':
    case 'cryptographic-key':
    case 'Cryptocurrency-Wallet':
    case 'cryptocurrency-wallet':
    case 'Text':
    case 'text':
    case 'User-Agent':
    case 'user-agent':
    case 'Bank-Account':
    case 'bank-account':
    case 'Credential':
    case 'credential':
    case 'Tracking-Number':
    case 'tracking-number':
    case 'Phone-Number':
    case 'phone-number':
    case 'Payment-Card':
    case 'payment-card':
    case 'Media-Content':
    case 'media-content':
    case 'Persona':
    case 'persona':
    case 'Hostname':
    case 'hostname':
      return dark ? '#84ffff' : stringToColour(type);
    // Relationships
    case 'Stix-Core-Relationship':
    case 'stix-core-relationship':
    case 'Relationship':
    case 'relationship':
      return dark ? '#616161' : '#9e9e9e';
    
    // ============================================================================
    // OpenAEV Entity Colors
    // ============================================================================
    case 'Asset':
    case 'asset':
    case 'oaev-Asset':
    case 'oaev-asset':
      return dark ? '#009688' : '#00695c'; // Teal - for assets
    case 'AssetGroup':
    case 'assetgroup':
    case 'asset-group':
    case 'oaev-AssetGroup':
    case 'oaev-assetgroup':
      return dark ? '#26a69a' : '#00796b'; // Teal - for groups of assets
    case 'Player':
    case 'player':
    case 'oaev-Player':
    case 'oaev-player':
      return dark ? '#7e57c2' : '#512da8'; // Deep Purple - for people/players
    case 'Team':
    case 'team':
    case 'oaev-Team':
    case 'oaev-team':
      return dark ? '#5c6bc0' : '#3949ab'; // Indigo - for teams
    case 'Finding':
    case 'finding':
    case 'oaev-Finding':
    case 'oaev-finding':
      return dark ? '#ef5350' : '#c62828'; // Red - for findings/alerts
    case 'AttackPattern':
    case 'attackpattern':
    case 'oaev-AttackPattern':
    case 'oaev-attackpattern':
      return dark ? '#d4e157' : '#827717'; // Lime/Yellow-green - same as OpenCTI
    case 'Scenario':
    case 'scenario':
    case 'oaev-Scenario':
    case 'oaev-scenario':
      return dark ? '#ab47bc' : '#7b1fa2'; // Purple - for scenarios
    case 'Exercise':
    case 'exercise':
    case 'oaev-Exercise':
    case 'oaev-exercise':
      return dark ? '#42a5f5' : '#1565c0'; // Blue - for exercises
    case 'Inject':
    case 'inject':
    case 'oaev-Inject':
    case 'oaev-inject':
      return dark ? '#ff7043' : '#d84315'; // Deep Orange - for injects
    case 'Payload':
    case 'payload':
    case 'oaev-Payload':
    case 'oaev-payload':
      return dark ? '#ffa726' : '#ef6c00'; // Orange - for payloads
    case 'Injector':
    case 'injector':
    case 'oaev-Injector':
    case 'oaev-injector':
      return dark ? '#78909c' : '#455a64'; // Blue Grey - for injectors
    
    default:
      return stringToColour(type, reversed);
  }
};

/**
 * Convert hex color to RGB with transparency
 */
export const hexToRGB = (hex: string | null | undefined, transp = 0.1): string => {
  if (!hex) return `rgb(50, 50, 50, ${transp})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b}, ${transp})`;
};

/**
 * Map observable type from detection to STIX type for color lookup
 */
export const mapObservableTypeToSTIX = (detectedType: string): string => {
  const typeMap: Record<string, string> = {
    'ipv4': 'IPv4-Addr',
    'ipv6': 'IPv6-Addr',
    'domain': 'Domain-Name',
    'url': 'Url',
    'email': 'Email-Addr',
    'md5': 'StixFile',
    'sha1': 'StixFile',
    'sha256': 'StixFile',
    'sha512': 'StixFile',
    'ssdeep': 'StixFile',
    'mac': 'Mac-Addr',
    'hostname': 'Hostname',
    'cve': 'Vulnerability',
  };
  return typeMap[detectedType.toLowerCase()] || 'Stix-Cyber-Observable';
};

