/**
 * Observable Input Builder
 * 
 * Builds the correct GraphQL input structure for creating observables in OpenCTI.
 * Different observable types require different input structures per OpenCTI GraphQL schema.
 */

import type { HashType } from '../../types/observables';

/**
 * Detect hash type from value based on length and format
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
 * Convert observable type to GraphQL input type name (removes hyphens)
 * OpenCTI GraphQL uses camelCase without hyphens for input types
 */
export function toGraphQLInputType(type: string): string {
  return type.replace(/-/g, '');
}

/**
 * Build observable input based on observable type.
 * Different observable types require different input structures per OpenCTI GraphQL schema.
 * 
 * Only includes types that are actually detected by the extension's patterns.
 */
export function buildObservableInput(
  type: string,
  value: string,
  hashType?: HashType
): Record<string, unknown> {
  const normalizedType = type.replace(/-/g, '').toLowerCase();
  
  // Hash-based observables: StixFile, Artifact, X509Certificate
  if (normalizedType === 'stixfile' || normalizedType === 'artifact') {
    const detectedHash = hashType || detectHashType(value);
    if (detectedHash) {
      return { hashes: [{ algorithm: detectedHash, hash: value }] };
    }
    // Fallback for files without detected hash
    return { name: value };
  }
  
  if (normalizedType === 'x509certificate') {
    const detectedHash = hashType || detectHashType(value);
    if (detectedHash) {
      return { hashes: [{ algorithm: detectedHash, hash: value }] };
    }
    return { serial_number: value };
  }
  
  // Autonomous System: requires number field
  if (normalizedType === 'autonomoussystem') {
    const asnMatch = value.match(/(?:AS[N]?)?(\d+)/i);
    const asnNumber = asnMatch ? parseInt(asnMatch[1], 10) : parseInt(value, 10);
    return { number: asnNumber, name: value };
  }
  
  // Bank Account: detect IBAN vs BIC vs account number
  if (normalizedType === 'bankaccount') {
    const cleanValue = value.replace(/\s/g, '');
    if (/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/i.test(cleanValue)) {
      return { iban: cleanValue.toUpperCase() };
    }
    if (/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/i.test(cleanValue)) {
      return { bic: cleanValue.toUpperCase() };
    }
    return { account_number: value };
  }
  
  // Payment Card: strip formatting
  if (normalizedType === 'paymentcard') {
    return { card_number: value.replace(/[\s-]/g, '') };
  }
  
  // Windows Registry Key
  if (normalizedType === 'windowsregistrykey') {
    return { attribute_key: value };
  }
  
  // Default: most observable types use the 'value' field
  // This covers: IPv4-Addr, IPv6-Addr, Domain-Name, Url, Email-Addr, 
  // Mac-Addr, Cryptocurrency-Wallet, User-Agent, Hostname
  return { value };
}
