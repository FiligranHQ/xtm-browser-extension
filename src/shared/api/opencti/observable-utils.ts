/**
 * OpenCTI Observable Utility Functions
 * Type normalization and input building for observables
 */

import type { HashType } from '../../types';

// ============================================================================
// Type Normalization Maps
// ============================================================================

/**
 * Map for normalizing observable types to STIX format
 * Handles: IPv4Addr -> IPv4-Addr, ipv4-addr -> IPv4-Addr, ipv4addr -> IPv4-Addr
 */
const TYPE_NORMALIZATION_MAP: Record<string, string> = {
  'ipv4addr': 'IPv4-Addr',
  'ipv4-addr': 'IPv4-Addr',
  'ipv6addr': 'IPv6-Addr',
  'ipv6-addr': 'IPv6-Addr',
  'domainname': 'Domain-Name',
  'domain-name': 'Domain-Name',
  'hostname': 'Hostname',
  'emailaddr': 'Email-Addr',
  'email-addr': 'Email-Addr',
  'url': 'Url',
  'macaddr': 'Mac-Addr',
  'mac-addr': 'Mac-Addr',
  'stixfile': 'StixFile',
  'file': 'StixFile',
  'autonomoussystem': 'Autonomous-System',
  'autonomous-system': 'Autonomous-System',
  'cryptocurrencywallet': 'Cryptocurrency-Wallet',
  'cryptocurrency-wallet': 'Cryptocurrency-Wallet',
  'useragent': 'User-Agent',
  'user-agent': 'User-Agent',
  'phonenumber': 'Phone-Number',
  'phone-number': 'Phone-Number',
  'bankaccount': 'Bank-Account',
  'bank-account': 'Bank-Account',
  'artifact': 'Artifact',
  'directory': 'Directory',
  'emailmessage': 'Email-Message',
  'email-message': 'Email-Message',
  'mutex': 'Mutex',
  'networktraffic': 'Network-Traffic',
  'network-traffic': 'Network-Traffic',
  'process': 'Process',
  'software': 'Software',
  'windowsregistrykey': 'Windows-Registry-Key',
  'windows-registry-key': 'Windows-Registry-Key',
  'windowsregistryvaluetype': 'Windows-Registry-Value-Type',
  'windows-registry-value-type': 'Windows-Registry-Value-Type',
  'x509certificate': 'X509-Certificate',
  'x509-certificate': 'X509-Certificate',
  'paymentcard': 'Payment-Card',
  'payment-card': 'Payment-Card',
  'credential': 'Credential',
  'trackingnumber': 'Tracking-Number',
  'tracking-number': 'Tracking-Number',
  'mediacontent': 'Media-Content',
  'media-content': 'Media-Content',
  'text': 'Text',
};

/**
 * Map STIX type to GraphQL input type (remove hyphens)
 */
const STIX_TO_GQL_TYPE: Record<string, string> = {
  'IPv4-Addr': 'IPv4Addr',
  'IPv6-Addr': 'IPv6Addr',
  'Domain-Name': 'DomainName',
  'Hostname': 'Hostname',
  'Email-Addr': 'EmailAddr',
  'Url': 'Url',
  'Mac-Addr': 'MacAddr',
  'StixFile': 'StixFile',
  'Autonomous-System': 'AutonomousSystem',
  'Cryptocurrency-Wallet': 'CryptocurrencyWallet',
  'User-Agent': 'UserAgent',
  'Phone-Number': 'PhoneNumber',
  'Bank-Account': 'BankAccount',
  'Artifact': 'Artifact',
  'Directory': 'Directory',
  'Email-Message': 'EmailMessage',
  'Mutex': 'Mutex',
  'Network-Traffic': 'NetworkTraffic',
  'Process': 'Process',
  'Software': 'Software',
  'Windows-Registry-Key': 'WindowsRegistryKey',
  'Windows-Registry-Value-Type': 'WindowsRegistryValueType',
  'X509-Certificate': 'X509Certificate',
  'Payment-Card': 'PaymentCard',
  'Credential': 'Credential',
  'Tracking-Number': 'TrackingNumber',
  'Media-Content': 'MediaContent',
  'Text': 'Text',
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize the input type to STIX format (with hyphens)
 */
export function normalizeToStixType(type: string): string {
  return TYPE_NORMALIZATION_MAP[type.toLowerCase()] || type;
}

/**
 * Convert STIX type to GraphQL input type
 */
export function stixToGraphQLType(stixType: string): string {
  return STIX_TO_GQL_TYPE[stixType] || stixType.replace(/-/g, '');
}

/**
 * Detect hash type from value
 */
export function detectHashType(value: string): HashType | null {
  const cleanValue = value.trim().toLowerCase();
  if (/^[a-f0-9]{32}$/i.test(cleanValue)) return 'MD5';
  if (/^[a-f0-9]{40}$/i.test(cleanValue)) return 'SHA-1';
  if (/^[a-f0-9]{64}$/i.test(cleanValue)) return 'SHA-256';
  if (/^[a-f0-9]{128}$/i.test(cleanValue)) return 'SHA-512';
  // SSDEEP format: blocksize:hash1:hash2
  if (/^\d+:[a-z0-9+/]+:[a-z0-9+/]+$/i.test(cleanValue)) return 'SSDEEP';
  return null;
}

/**
 * Build observable input based on observable type
 * Different observable types require different input structures per OpenCTI GraphQL schema
 */
export function buildObservableInput(
  stixType: string,
  gqlType: string,
  value: string,
  hashType?: HashType
): Record<string, unknown> {
  const isFileType = stixType === 'StixFile' || gqlType === 'StixFile';
  const isArtifact = stixType === 'Artifact' || gqlType === 'Artifact';
  const isX509 = stixType === 'X509-Certificate' || gqlType === 'X509Certificate';
  
  if (isFileType || isArtifact || isX509) {
    // Hash-based observables: StixFile, Artifact, X509Certificate
    const detectedHashType = hashType || detectHashType(value);
    if (detectedHashType) {
      return { hashes: [{ algorithm: detectedHashType, hash: value }] };
    } else if (isFileType) {
      return { name: value };
    } else if (isArtifact) {
      return value.startsWith('http') ? { url: value } : { payload_bin: value };
    } else if (isX509) {
      return { serial_number: value };
    }
  }
  
  if (stixType === 'Autonomous-System' || gqlType === 'AutonomousSystem') {
    const asnMatch = value.match(/(?:AS[N]?)?(\d+)/i);
    const asnNumber = asnMatch ? parseInt(asnMatch[1], 10) : parseInt(value, 10);
    return { number: asnNumber, name: value };
  }
  
  if (stixType === 'Bank-Account' || gqlType === 'BankAccount') {
    if (/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/i.test(value.replace(/\s/g, ''))) {
      return { iban: value.replace(/\s/g, '').toUpperCase() };
    } else if (/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/i.test(value.replace(/\s/g, ''))) {
      return { bic: value.replace(/\s/g, '').toUpperCase() };
    } else {
      return { account_number: value };
    }
  }
  
  if (stixType === 'Payment-Card' || gqlType === 'PaymentCard') {
    return { card_number: value.replace(/[\s-]/g, '') };
  }
  
  if (stixType === 'Media-Content' || gqlType === 'MediaContent') {
    return { url: value, title: value };
  }
  
  if (stixType === 'Directory' || gqlType === 'Directory') {
    return { path: value };
  }
  
  if (stixType === 'Process' || gqlType === 'Process') {
    return { command_line: value };
  }
  
  if (stixType === 'Software' || gqlType === 'Software') {
    return { name: value };
  }
  
  if (stixType === 'Mutex' || gqlType === 'Mutex') {
    return { name: value };
  }
  
  if (stixType === 'Windows-Registry-Key' || gqlType === 'WindowsRegistryKey') {
    return { attribute_key: value };
  }
  
  if (stixType === 'Windows-Registry-Value-Type' || gqlType === 'WindowsRegistryValueType') {
    return { name: value, data: value };
  }
  
  if (stixType === 'Network-Traffic' || gqlType === 'NetworkTraffic') {
    return { protocols: ['tcp'] };
  }
  
  if (stixType === 'Email-Message' || gqlType === 'EmailMessage') {
    return { subject: value };
  }
  
  if (stixType === 'User-Account' || gqlType === 'UserAccount') {
    return { account_login: value };
  }
  
  // Default: types that use 'value' field
  return { value };
}

