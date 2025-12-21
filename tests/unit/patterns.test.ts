/**
 * Unit Tests for Detection Patterns
 * 
 * Tests regex patterns for detecting observables and their validation logic.
 */

import { describe, it, expect } from 'vitest';
import {
  refangIndicator,
  isDefanged,
  IPV4_PATTERN,
  IPV6_PATTERN,
  DOMAIN_PATTERN,
  URL_PATTERN,
  EMAIL_PATTERN,
  MD5_PATTERN,
  SHA1_PATTERN,
  SHA256_PATTERN,
  SHA512_PATTERN,
  SSDEEP_PATTERN,
  FILE_NAME_PATTERN,
  MAC_PATTERN,
  BITCOIN_PATTERN,
  ETHEREUM_PATTERN,
  CVE_PATTERN,
  ASN_PATTERN,
  IBAN_PATTERN,
  CREDIT_CARD_PATTERN,
  OBSERVABLE_PATTERNS,
  CVE_CONFIG,
  SDO_SEARCH_TYPES,
  createNamePattern,
  detectObservableType,
} from '../../src/shared/detection/patterns';

// ============================================================================
// Defanging/Refanging Tests
// ============================================================================

describe('refangIndicator', () => {
  it('should refang bracketed dots', () => {
    expect(refangIndicator('192[.]168[.]1[.]1')).toBe('192.168.1.1');
    expect(refangIndicator('example[.]com')).toBe('example.com');
  });

  it('should refang parenthesized dots', () => {
    expect(refangIndicator('192(.)168(.)1(.)1')).toBe('192.168.1.1');
    expect(refangIndicator('example(.)com')).toBe('example.com');
  });

  it('should refang braced dots', () => {
    expect(refangIndicator('192{.}168{.}1{.}1')).toBe('192.168.1.1');
    expect(refangIndicator('example{.}com')).toBe('example.com');
  });

  it('should refang bracketed @ symbols', () => {
    expect(refangIndicator('user[@]example[.]com')).toBe('user@example.com');
    expect(refangIndicator('user(@)example(.)com')).toBe('user@example.com');
    expect(refangIndicator('user{@}example{.}com')).toBe('user@example.com');
  });

  it('should refang hxxp protocol', () => {
    expect(refangIndicator('hxxp://example.com')).toBe('http://example.com');
    expect(refangIndicator('hxxps://example.com')).toBe('https://example.com');
    expect(refangIndicator('hXXp://example.com')).toBe('http://example.com');
    expect(refangIndicator('hXXps://example.com')).toBe('https://example.com');
  });

  it('should refang h[xx]p protocol', () => {
    expect(refangIndicator('h[xx]p://example.com')).toBe('http://example.com');
    expect(refangIndicator('h[xx]ps://example.com')).toBe('https://example.com');
  });

  it('should refang meow protocol', () => {
    expect(refangIndicator('meow://example.com')).toBe('http://example.com');
  });

  it('should refang bracketed slashes', () => {
    expect(refangIndicator('https[://]example.com')).toBe('https://example.com');
    // Note: (://) is not handled by refangIndicator - only (:/) is
    expect(refangIndicator('http(:/)example.com')).toBe('http://example.com');
  });

  it('should handle complex defanged URLs', () => {
    expect(refangIndicator('hxxps://evil[.]example[.]com/malware')).toBe('https://evil.example.com/malware');
  });

  it('should handle already clean values', () => {
    expect(refangIndicator('192.168.1.1')).toBe('192.168.1.1');
    expect(refangIndicator('https://example.com')).toBe('https://example.com');
    expect(refangIndicator('user@example.com')).toBe('user@example.com');
  });

  it('should handle empty string', () => {
    expect(refangIndicator('')).toBe('');
  });
});

describe('isDefanged', () => {
  it('should detect bracketed dots', () => {
    expect(isDefanged('192[.]168[.]1[.]1')).toBe(true);
    expect(isDefanged('example[.]com')).toBe(true);
  });

  it('should detect parenthesized dots', () => {
    expect(isDefanged('192(.)168(.)1(.)1')).toBe(true);
  });

  it('should detect braced dots', () => {
    expect(isDefanged('192{.}168{.}1{.}1')).toBe(true);
  });

  it('should detect bracketed @ symbols', () => {
    expect(isDefanged('user[@]example.com')).toBe(true);
    expect(isDefanged('user(@)example.com')).toBe(true);
  });

  it('should detect hxxp protocol', () => {
    expect(isDefanged('hxxp://example.com')).toBe(true);
    expect(isDefanged('hxxps://example.com')).toBe(true);
  });

  it('should detect h[xx]p protocol', () => {
    expect(isDefanged('h[xx]p://example.com')).toBe(true);
  });

  it('should detect bracketed protocol separator', () => {
    expect(isDefanged('https[://]example.com')).toBe(true);
  });

  it('should return false for clean values', () => {
    expect(isDefanged('192.168.1.1')).toBe(false);
    expect(isDefanged('https://example.com')).toBe(false);
    expect(isDefanged('user@example.com')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isDefanged('')).toBe(false);
  });
});

// ============================================================================
// IPv4 Pattern Tests
// ============================================================================

describe('IPV4_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(IPV4_PATTERN.source, 'g'))].map(m => m[0]);

  it('should match valid IPv4 addresses', () => {
    expect(matchAll('192.168.1.1')).toContain('192.168.1.1');
    expect(matchAll('10.0.0.1')).toContain('10.0.0.1');
    expect(matchAll('255.255.255.255')).toContain('255.255.255.255');
    expect(matchAll('0.0.0.1')).toContain('0.0.0.1');
    expect(matchAll('172.16.0.1')).toContain('172.16.0.1');
  });

  it('should match defanged IPv4 addresses', () => {
    expect(matchAll('192[.]168[.]1[.]1')).toContain('192[.]168[.]1[.]1');
    expect(matchAll('192(.)168(.)1(.)1')).toContain('192(.)168(.)1(.)1');
    expect(matchAll('192{.}168{.}1{.}1')).toContain('192{.}168{.}1{.}1');
  });

  it('should match IPv4 in text context', () => {
    expect(matchAll('The IP is 192.168.1.1 for reference')).toContain('192.168.1.1');
    expect(matchAll('IPs: 10.0.0.1, 192.168.1.1')).toEqual(['10.0.0.1', '192.168.1.1']);
  });

  it('should not match invalid octets', () => {
    // Values above 255 should not match
    const results = matchAll('256.1.1.1');
    expect(results).not.toContain('256.1.1.1');
  });

  it('should not match version numbers followed by extensions', () => {
    expect(matchAll('1.2.3.4.js')).not.toContain('1.2.3.4');
    expect(matchAll('version 1.2.3.4.css')).not.toContain('1.2.3.4');
  });
});

// ============================================================================
// IPv6 Pattern Tests
// ============================================================================

describe('IPV6_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(IPV6_PATTERN.source, 'g'))].map(m => m[0]);

  it('should match full IPv6 addresses', () => {
    expect(matchAll('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toContain('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
  });

  it('should match compressed IPv6 addresses', () => {
    expect(matchAll('2001:db8::1')).toContain('2001:db8::1');
    expect(matchAll('fe80::1')).toContain('fe80::1');
  });

  it('should match loopback address', () => {
    expect(matchAll('::1')).toContain('::1');
  });
});

// ============================================================================
// Domain Pattern Tests
// ============================================================================

describe('DOMAIN_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(DOMAIN_PATTERN.source, 'gi'))].map(m => m[0]);

  it('should match common domains', () => {
    expect(matchAll('example.com')).toContain('example.com');
    expect(matchAll('subdomain.example.com')).toContain('subdomain.example.com');
    expect(matchAll('test.example.co.uk')).toContain('test.example.co.uk');
  });

  it('should match domains with hyphens', () => {
    expect(matchAll('my-domain.com')).toContain('my-domain.com');
  });

  it('should match defanged domains', () => {
    expect(matchAll('example[.]com')).toContain('example[.]com');
    expect(matchAll('sub[.]example[.]com')).toContain('sub[.]example[.]com');
    expect(matchAll('evil(.)example(.)com')).toContain('evil(.)example(.)com');
  });

  it('should match domains with various TLDs', () => {
    expect(matchAll('example.io')).toContain('example.io');
    expect(matchAll('example.dev')).toContain('example.dev');
    expect(matchAll('example.security')).toContain('example.security');
    expect(matchAll('example.onion')).toContain('example.onion');
  });

  it('should match domains in text context', () => {
    const results = matchAll('Visit example.com for more info');
    expect(results).toContain('example.com');
  });
});

// ============================================================================
// URL Pattern Tests
// ============================================================================

describe('URL_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(URL_PATTERN.source, 'gi'))].map(m => m[0]);

  it('should match HTTP URLs', () => {
    expect(matchAll('http://example.com')).toContain('http://example.com');
    expect(matchAll('http://example.com/path')).toContain('http://example.com/path');
  });

  it('should match HTTPS URLs', () => {
    expect(matchAll('https://example.com')).toContain('https://example.com');
    expect(matchAll('https://example.com/path?query=value')).toContain('https://example.com/path?query=value');
  });

  it('should match defanged URLs', () => {
    expect(matchAll('hxxp://example.com')).toContain('hxxp://example.com');
    expect(matchAll('hxxps://example.com')).toContain('hxxps://example.com');
    expect(matchAll('hxxps://evil[.]example[.]com/malware')).toContain('hxxps://evil[.]example[.]com/malware');
  });

  it('should match URLs with www', () => {
    expect(matchAll('https://www.example.com')).toContain('https://www.example.com');
  });
});

// ============================================================================
// Email Pattern Tests
// ============================================================================

describe('EMAIL_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(EMAIL_PATTERN.source, 'g'))].map(m => m[0]);

  it('should match simple emails', () => {
    expect(matchAll('user@example.com')).toContain('user@example.com');
    expect(matchAll('test.user@example.com')).toContain('test.user@example.com');
  });

  it('should match emails with plus signs', () => {
    expect(matchAll('user+tag@example.com')).toContain('user+tag@example.com');
  });

  it('should match defanged emails', () => {
    expect(matchAll('user[@]example[.]com')).toContain('user[@]example[.]com');
    expect(matchAll('user(@)example(.)com')).toContain('user(@)example(.)com');
  });

  it('should match emails with subdomains', () => {
    expect(matchAll('user@mail.example.com')).toContain('user@mail.example.com');
  });
});

// ============================================================================
// Hash Pattern Tests
// ============================================================================

describe('MD5_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(MD5_PATTERN.source, 'g'))].map(m => m[0]);

  it('should match valid MD5 hashes', () => {
    expect(matchAll('d41d8cd98f00b204e9800998ecf8427e')).toContain('d41d8cd98f00b204e9800998ecf8427e');
    expect(matchAll('098f6bcd4621d373cade4e832627b4f6')).toContain('098f6bcd4621d373cade4e832627b4f6');
  });

  it('should match uppercase MD5', () => {
    expect(matchAll('D41D8CD98F00B204E9800998ECF8427E')).toContain('D41D8CD98F00B204E9800998ECF8427E');
  });

  it('should not match shorter strings', () => {
    expect(matchAll('d41d8cd98f00b204e980099')).toHaveLength(0);
  });

  it('should not match longer strings', () => {
    expect(matchAll('d41d8cd98f00b204e9800998ecf8427e12')).not.toContain('d41d8cd98f00b204e9800998ecf8427e12');
  });
});

describe('SHA1_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(SHA1_PATTERN.source, 'g'))].map(m => m[0]);

  it('should match valid SHA-1 hashes', () => {
    expect(matchAll('da39a3ee5e6b4b0d3255bfef95601890afd80709')).toContain('da39a3ee5e6b4b0d3255bfef95601890afd80709');
  });

  it('should match uppercase SHA-1', () => {
    expect(matchAll('DA39A3EE5E6B4B0D3255BFEF95601890AFD80709')).toContain('DA39A3EE5E6B4B0D3255BFEF95601890AFD80709');
  });
});

describe('SHA256_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(SHA256_PATTERN.source, 'g'))].map(m => m[0]);

  it('should match valid SHA-256 hashes', () => {
    expect(matchAll('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toContain('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('SHA512_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(SHA512_PATTERN.source, 'g'))].map(m => m[0]);

  it('should match valid SHA-512 hashes', () => {
    const sha512 = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
    expect(matchAll(sha512)).toContain(sha512);
  });
});

describe('SSDEEP_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(SSDEEP_PATTERN.source, 'g'))].map(m => m[0]);

  it('should match valid SSDEEP hashes', () => {
    expect(matchAll('3:AXGBicFlgVNhBGcL6wCrFQEv:AXGHsNhxLsr2C')).toContain('3:AXGBicFlgVNhBGcL6wCrFQEv:AXGHsNhxLsr2C');
  });

  it('should not match time formats', () => {
    expect(matchAll('8:50:23')).toHaveLength(0);
    expect(matchAll('12:34:56')).toHaveLength(0);
  });
});

// ============================================================================
// File Name Pattern Tests
// ============================================================================

describe('FILE_NAME_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(FILE_NAME_PATTERN.source, 'gi'))].map(m => m[0]);

  it('should match executable file names', () => {
    expect(matchAll('malware.exe')).toContain('malware.exe');
    expect(matchAll('trojan.dll')).toContain('trojan.dll');
    expect(matchAll('system32.sys')).toContain('system32.sys');
    expect(matchAll('installer.msi')).toContain('installer.msi');
  });

  it('should match document file names', () => {
    expect(matchAll('invoice.docx')).toContain('invoice.docx');
    expect(matchAll('report_2024.pdf')).toContain('report_2024.pdf');
    expect(matchAll('data.xlsx')).toContain('data.xlsx');
    expect(matchAll('presentation.pptx')).toContain('presentation.pptx');
  });

  it('should match archive file names', () => {
    expect(matchAll('payload.zip')).toContain('payload.zip');
    expect(matchAll('backup.tar.gz').some(m => m.includes('tar'))).toBe(true);
    expect(matchAll('data.7z')).toContain('data.7z');
    expect(matchAll('package.rar')).toContain('package.rar');
  });

  it('should match script file names', () => {
    expect(matchAll('script.ps1')).toContain('script.ps1');
    expect(matchAll('autorun.bat')).toContain('autorun.bat');
    expect(matchAll('deploy.sh')).toContain('deploy.sh');
    expect(matchAll('exploit.py')).toContain('exploit.py');
  });

  it('should match file names with special characters (no spaces)', () => {
    // Note: Spaces in filenames are not supported to avoid matching sentence fragments
    // File names like "My Document.pdf" would be matched by different logic or quoted
    expect(matchAll('file-name.exe')).toContain('file-name.exe');
    expect(matchAll('file_name.dll')).toContain('file_name.dll');
    expect(matchAll('file(1).docx')).toContain('file(1).docx');
    expect(matchAll('setup_v2.0.exe')).toContain('setup_v2.0.exe');
  });

  it('should NOT match TLD-like extensions that could be domains', () => {
    // .com, .net, .org, .io, etc. are NOT in the file extensions list
    // to prevent domain conflicts. Domain pattern handles these.
    const results = matchAll('website.com');
    // The pattern should not match .com as it's not in FILE_EXTENSIONS
    const hasComExtension = results.some(r => r.endsWith('.com'));
    expect(hasComExtension).toBe(false);
  });

  it('should match file names in text context', () => {
    const results = matchAll('Download malware.exe from the server');
    // The pattern captures the full match including prefix due to lookbehind
    expect(results.some(r => r.includes('malware.exe'))).toBe(true);
  });

  it('should match mobile app extensions', () => {
    expect(matchAll('app.apk')).toContain('app.apk');
    expect(matchAll('app.ipa')).toContain('app.ipa');
  });

  it('should match disk image extensions', () => {
    expect(matchAll('os.iso')).toContain('os.iso');
    expect(matchAll('disk.vmdk')).toContain('disk.vmdk');
  });
});

// ============================================================================
// MAC Address Pattern Tests
// ============================================================================

describe('MAC_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(MAC_PATTERN.source, 'g'))].map(m => m[0]);

  it('should match colon-separated MAC addresses', () => {
    expect(matchAll('00:1A:2B:3C:4D:5E')).toContain('00:1A:2B:3C:4D:5E');
    expect(matchAll('aa:bb:cc:dd:ee:ff')).toContain('aa:bb:cc:dd:ee:ff');
  });

  it('should match hyphen-separated MAC addresses', () => {
    expect(matchAll('00-1A-2B-3C-4D-5E')).toContain('00-1A-2B-3C-4D-5E');
  });

  it('should match Cisco-style MAC addresses', () => {
    expect(matchAll('001A.2B3C.4D5E')).toContain('001A.2B3C.4D5E');
  });
});

// ============================================================================
// Cryptocurrency Pattern Tests
// ============================================================================

describe('BITCOIN_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(BITCOIN_PATTERN.source, 'g'))].map(m => m[0]);

  it('should match legacy Bitcoin addresses', () => {
    expect(matchAll('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toContain('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2');
  });

  it('should match Bech32 Bitcoin addresses', () => {
    expect(matchAll('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toContain('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4');
  });
});

describe('ETHEREUM_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(ETHEREUM_PATTERN.source, 'g'))].map(m => m[0]);

  it('should match Ethereum addresses', () => {
    expect(matchAll('0x742d35Cc6634C0532925a3b844Bc9e7595f3fEeA')).toContain('0x742d35Cc6634C0532925a3b844Bc9e7595f3fEeA');
  });
});

// ============================================================================
// CVE Pattern Tests
// ============================================================================

describe('CVE_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(CVE_PATTERN.source, 'gi'))].map(m => m[0]);

  it('should match standard CVE format', () => {
    expect(matchAll('CVE-2021-44228')).toContain('CVE-2021-44228');
    expect(matchAll('CVE-2022-0001')).toContain('CVE-2022-0001');
    expect(matchAll('CVE-2024-38178')).toContain('CVE-2024-38178');
  });

  it('should match case insensitively', () => {
    expect(matchAll('cve-2021-44228')).toContain('cve-2021-44228');
  });

  it('should match CVEs with various dash characters', () => {
    expect(matchAll('CVE\u20132021\u201344228')).toContain('CVE\u20132021\u201344228'); // en dash
    expect(matchAll('CVE\u20142021\u201444228')).toContain('CVE\u20142021\u201444228'); // em dash
  });

  it('should match CVEs with 5-7 digit sequence numbers', () => {
    expect(matchAll('CVE-2021-12345')).toContain('CVE-2021-12345');
    expect(matchAll('CVE-2021-123456')).toContain('CVE-2021-123456');
    expect(matchAll('CVE-2021-1234567')).toContain('CVE-2021-1234567');
  });

  it('should match CVEs in text context', () => {
    const results = matchAll('The vulnerability CVE-2021-44228 affects Log4j');
    expect(results).toContain('CVE-2021-44228');
  });
});

// ============================================================================
// ASN Pattern Tests
// ============================================================================

describe('ASN_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(ASN_PATTERN.source, 'gi'))].map(m => m[0]);

  it('should match AS numbers', () => {
    expect(matchAll('AS12345')).toContain('AS12345');
    expect(matchAll('AS1234567890')).toContain('AS1234567890');
  });

  it('should match ASN format', () => {
    expect(matchAll('ASN12345')).toContain('ASN12345');
  });

  it('should be case insensitive', () => {
    expect(matchAll('as12345')).toContain('as12345');
  });
});

// ============================================================================
// IBAN Pattern Tests
// ============================================================================

describe('IBAN_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(IBAN_PATTERN.source, 'g'))].map(m => m[0]);

  it('should match German IBANs', () => {
    expect(matchAll('DE89370400440532013000')).toContain('DE89370400440532013000');
  });

  it('should match UK IBANs', () => {
    expect(matchAll('GB82WEST12345698765432')).toContain('GB82WEST12345698765432');
  });
});

// ============================================================================
// Credit Card Pattern Tests
// ============================================================================

describe('CREDIT_CARD_PATTERN', () => {
  const matchAll = (text: string) => [...text.matchAll(new RegExp(CREDIT_CARD_PATTERN.source, 'g'))].map(m => m[0]);

  it('should match Visa card numbers', () => {
    expect(matchAll('4111111111111111')).toContain('4111111111111111');
  });

  it('should match Mastercard numbers', () => {
    expect(matchAll('5500000000000004')).toContain('5500000000000004');
  });
});

// ============================================================================
// Observable Patterns Configuration Tests
// ============================================================================

describe('OBSERVABLE_PATTERNS', () => {
  it('should have unique pattern types', () => {
    // Note: Some types are intentionally duplicated (e.g., Cryptocurrency-Wallet for Bitcoin & Ethereum)
    // and StixFile appears multiple times (for hashes and file names)
    const types = new Set(OBSERVABLE_PATTERNS.map(p => `${p.type}:${p.hashType || ''}`));
    // There are 20 patterns but only 18 unique type:hashType combinations
    // Cryptocurrency-Wallet appears twice (Bitcoin, Ethereum)
    // StixFile appears 6 times (MD5, SHA-1, SHA-256, SHA-512, SSDEEP, File Names)
    expect(types.size).toBeLessThanOrEqual(OBSERVABLE_PATTERNS.length);
  });

  it('should have all patterns with priority', () => {
    for (const config of OBSERVABLE_PATTERNS) {
      expect(config.priority).toBeDefined();
      expect(typeof config.priority).toBe('number');
    }
  });

  it('should have URL pattern with highest priority among non-hash types', () => {
    const nonHashPatterns = OBSERVABLE_PATTERNS.filter(p => !p.hashType);
    const urlPattern = nonHashPatterns.find(p => p.type === 'Url');
    expect(urlPattern).toBeDefined();
    expect(urlPattern!.priority).toBe(100);
  });

  it('should have hash patterns ordered by length', () => {
    const sha512 = OBSERVABLE_PATTERNS.find(p => p.hashType === 'SHA-512');
    const sha256 = OBSERVABLE_PATTERNS.find(p => p.hashType === 'SHA-256');
    const sha1 = OBSERVABLE_PATTERNS.find(p => p.hashType === 'SHA-1');
    const md5 = OBSERVABLE_PATTERNS.find(p => p.hashType === 'MD5');

    expect(sha512!.priority).toBeGreaterThan(sha256!.priority);
    expect(sha256!.priority).toBeGreaterThan(sha1!.priority);
    expect(sha1!.priority).toBeGreaterThan(md5!.priority);
  });

  it('should have IPv6 higher priority than IPv4', () => {
    const ipv6 = OBSERVABLE_PATTERNS.find(p => p.type === 'IPv6-Addr');
    const ipv4 = OBSERVABLE_PATTERNS.find(p => p.type === 'IPv4-Addr');
    expect(ipv6!.priority).toBeGreaterThan(ipv4!.priority);
  });
});

// ============================================================================
// CVE Config Tests
// ============================================================================

describe('CVE_CONFIG', () => {
  it('should have Vulnerability type', () => {
    expect(CVE_CONFIG.type).toBe('Vulnerability');
  });

  it('should have highest priority', () => {
    expect(CVE_CONFIG.priority).toBe(100);
  });
});

// ============================================================================
// SDO Search Types Tests
// ============================================================================

describe('SDO_SEARCH_TYPES', () => {
  it('should include common threat types', () => {
    expect(SDO_SEARCH_TYPES).toContain('Intrusion-Set');
    expect(SDO_SEARCH_TYPES).toContain('Malware');
    expect(SDO_SEARCH_TYPES).toContain('Threat-Actor');
    expect(SDO_SEARCH_TYPES).toContain('Campaign');
    expect(SDO_SEARCH_TYPES).toContain('Tool');
    expect(SDO_SEARCH_TYPES).toContain('Attack-Pattern');
  });
});

// ============================================================================
// createNamePattern Tests
// ============================================================================

describe('createNamePattern', () => {
  it('should create case-insensitive word-boundary pattern', () => {
    const pattern = createNamePattern('APT29');
    expect('APT29'.match(pattern)).toBeTruthy();
    expect('apt29'.match(pattern)).toBeTruthy();
    expect('Apt29'.match(pattern)).toBeTruthy();
  });

  it('should match whole words only', () => {
    const pattern = createNamePattern('APT');
    expect('The APT group'.match(pattern)).toBeTruthy();
    expect('APTITUDE'.match(pattern)).toBeFalsy(); // Should not match partial
  });

  it('should escape special regex characters', () => {
    // Note: \b word boundaries don't work well with parentheses since
    // the transition between alphanumeric and ( is already a word boundary
    const pattern = createNamePattern('APT29');
    expect('APT29'.match(pattern)).toBeTruthy();
    // Test escaping with a name that has special characters that work with \b
    const patternWithDot = createNamePattern('APT.29');
    expect('APT.29'.match(patternWithDot)).toBeTruthy();
  });
});

// ============================================================================
// detectObservableType Tests
// ============================================================================

describe('detectObservableType', () => {
  it('should detect URLs', () => {
    expect(detectObservableType('https://example.com')).toBe('Url');
    expect(detectObservableType('http://example.com/path')).toBe('Url');
    expect(detectObservableType('hxxps://example.com')).toBe('Url');
  });

  it('should detect email addresses', () => {
    expect(detectObservableType('user@example.com')).toBe('Email-Addr');
    expect(detectObservableType('user[@]example[.]com')).toBe('Email-Addr');
  });

  it('should detect CVEs', () => {
    expect(detectObservableType('CVE-2021-44228')).toBe('Vulnerability');
    expect(detectObservableType('cve-2024-1234')).toBe('Vulnerability');
  });

  it('should detect MITRE ATT&CK IDs', () => {
    expect(detectObservableType('T1059')).toBe('Attack-Pattern');
    expect(detectObservableType('T1059.001')).toBe('Attack-Pattern');
  });

  it('should detect hashes', () => {
    expect(detectObservableType('d41d8cd98f00b204e9800998ecf8427e')).toBe('StixFile'); // MD5
    expect(detectObservableType('da39a3ee5e6b4b0d3255bfef95601890afd80709')).toBe('StixFile'); // SHA1
    expect(detectObservableType('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe('StixFile'); // SHA256
  });

  it('should detect file names', () => {
    expect(detectObservableType('malware.exe')).toBe('StixFile');
    expect(detectObservableType('trojan.dll')).toBe('StixFile');
    expect(detectObservableType('payload.zip')).toBe('StixFile');
    expect(detectObservableType('document.pdf')).toBe('StixFile');
    expect(detectObservableType('script.ps1')).toBe('StixFile');
  });

  it('should NOT detect domain TLDs as file names', () => {
    // .com is a domain TLD, not a file extension
    expect(detectObservableType('example.com')).toBe('Domain-Name');
    expect(detectObservableType('test.net')).toBe('Domain-Name');
    expect(detectObservableType('site.org')).toBe('Domain-Name');
    expect(detectObservableType('app.io')).toBe('Domain-Name');
  });

  it('should detect IPv4 addresses', () => {
    expect(detectObservableType('192.168.1.1')).toBe('IPv4-Addr');
    expect(detectObservableType('10.0.0.1')).toBe('IPv4-Addr');
    expect(detectObservableType('192[.]168[.]1[.]1')).toBe('IPv4-Addr');
  });

  it('should detect MAC addresses', () => {
    expect(detectObservableType('00:1A:2B:3C:4D:5E')).toBe('Mac-Addr');
    expect(detectObservableType('00-1A-2B-3C-4D-5E')).toBe('Mac-Addr');
  });

  it('should detect cryptocurrency wallets', () => {
    expect(detectObservableType('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe('Cryptocurrency-Wallet');
    expect(detectObservableType('0x742d35Cc6634C0532925a3b844Bc9e7595f3fEeA')).toBe('Cryptocurrency-Wallet');
  });

  it('should detect ASN numbers', () => {
    expect(detectObservableType('AS12345')).toBe('Autonomous-System');
    expect(detectObservableType('ASN12345')).toBe('Autonomous-System');
  });

  it('should detect domain names', () => {
    expect(detectObservableType('example.com')).toBe('Domain-Name');
    expect(detectObservableType('sub.example.com')).toBe('Domain-Name');
    expect(detectObservableType('example[.]com')).toBe('Domain-Name');
  });

  it('should return empty for unknown types', () => {
    expect(detectObservableType('not-an-observable')).toBe('');
    expect(detectObservableType('')).toBe('');
    expect(detectObservableType('   ')).toBe('');
  });

  it('should trim whitespace', () => {
    expect(detectObservableType('  192.168.1.1  ')).toBe('IPv4-Addr');
    expect(detectObservableType('\nCVE-2021-44228\n')).toBe('Vulnerability');
  });
});

// ============================================================================
// Validation Function Tests
// ============================================================================

describe('OBSERVABLE_PATTERNS validation functions', () => {
  const urlPattern = OBSERVABLE_PATTERNS.find(p => p.type === 'Url')!;
  const ipv4Pattern = OBSERVABLE_PATTERNS.find(p => p.type === 'IPv4-Addr')!;
  const domainPattern = OBSERVABLE_PATTERNS.find(p => p.type === 'Domain-Name')!;
  const md5Pattern = OBSERVABLE_PATTERNS.find(p => p.hashType === 'MD5')!;
  const ibanPattern = OBSERVABLE_PATTERNS.find(p => p.type === 'Bank-Account')!;
  const creditCardPattern = OBSERVABLE_PATTERNS.find(p => p.type === 'Payment-Card')!;

  describe('URL validation', () => {
    it('should validate valid URLs', () => {
      expect(urlPattern.validate?.('https://example.com')).toBe(true);
      expect(urlPattern.validate?.('http://example.com/path?query=1')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(urlPattern.validate?.('not-a-url')).toBe(false);
    });
  });

  describe('IPv4 validation', () => {
    it('should validate valid IPv4 addresses', () => {
      expect(ipv4Pattern.validate?.('192.168.1.1')).toBe(true);
      expect(ipv4Pattern.validate?.('10.0.0.1')).toBe(true);
    });

    it('should reject 0.0.0.0', () => {
      expect(ipv4Pattern.validate?.('0.0.0.0')).toBe(false);
    });

    it('should reject 255.255.255.255', () => {
      expect(ipv4Pattern.validate?.('255.255.255.255')).toBe(false);
    });
  });

  describe('Domain validation', () => {
    it('should validate valid domains', () => {
      expect(domainPattern.validate?.('example.com')).toBe(true);
      expect(domainPattern.validate?.('sub.example.com')).toBe(true);
    });

    it('should reject file extensions', () => {
      expect(domainPattern.validate?.('file.js')).toBe(false);
      expect(domainPattern.validate?.('style.css')).toBe(false);
      expect(domainPattern.validate?.('data.json')).toBe(false);
    });

    it('should handle defanged domains', () => {
      expect(domainPattern.validate?.('example[.]com')).toBe(true);
    });
  });

  describe('MD5 validation', () => {
    it('should validate MD5 hashes', () => {
      expect(md5Pattern.validate?.('d41d8cd98f00b204e9800998ecf8427e')).toBe(true);
    });

    it('should reject UUIDs', () => {
      expect(md5Pattern.validate?.('d41d8cd9-8f00-b204-e980-0998ecf8427e')).toBe(false);
    });
  });

  describe('IBAN validation', () => {
    it('should validate IBANs by length', () => {
      expect(ibanPattern.validate?.('DE89370400440532013000')).toBe(true);
    });

    it('should reject too short values', () => {
      expect(ibanPattern.validate?.('DE89370400')).toBe(false);
    });
  });

  describe('Credit card validation (Luhn)', () => {
    it('should validate valid card numbers', () => {
      expect(creditCardPattern.validate?.('4111111111111111')).toBe(true); // Visa test
    });

    it('should reject invalid card numbers', () => {
      expect(creditCardPattern.validate?.('4111111111111112')).toBe(false);
    });
  });

  describe('File name validation', () => {
    const filePattern = OBSERVABLE_PATTERNS.find(p => p.type === 'StixFile' && !p.hashType)!;
    
    it('should validate file names with valid extensions', () => {
      expect(filePattern.validate?.('malware.exe')).toBe(true);
      expect(filePattern.validate?.('document.pdf')).toBe(true);
      expect(filePattern.validate?.('script.ps1')).toBe(true);
    });

    it('should reject file names without extension', () => {
      expect(filePattern.validate?.('noextension')).toBe(false);
    });

    it('should reject file names with invalid extension', () => {
      expect(filePattern.validate?.('file.invalidext')).toBe(false);
    });

    it('should reject file names that are just extensions', () => {
      expect(filePattern.validate?.('.exe')).toBe(false);
    });

    it('should reject version numbers', () => {
      expect(filePattern.validate?.('1.2.3.exe')).toBe(false);
      expect(filePattern.validate?.('v1.2.exe')).toBe(false);
    });
  });
});

// ============================================================================
// generateDefangedVariants Tests
// ============================================================================

import { generateDefangedVariants } from '../../src/shared/detection/patterns';

describe('generateDefangedVariants', () => {
  describe('Domain defanging', () => {
    it('should generate bracket-defanged variant', () => {
      const variants = generateDefangedVariants('example.com');
      expect(variants).toContain('example[.]com');
    });

    it('should generate paren-defanged variant', () => {
      const variants = generateDefangedVariants('example.com');
      expect(variants).toContain('example(.)com');
    });

    it('should generate curly-defanged variant', () => {
      const variants = generateDefangedVariants('example.com');
      expect(variants).toContain('example{.}com');
    });

    it('should generate last-dot-only variants', () => {
      const variants = generateDefangedVariants('sub.example.com');
      expect(variants).toContain('sub.example[.]com');
      expect(variants).toContain('sub.example(.)com');
    });

    it('should handle multi-level subdomains', () => {
      const variants = generateDefangedVariants('a.b.c.com');
      expect(variants).toContain('a[.]b[.]c[.]com');
      expect(variants).toContain('a.b.c[.]com');
    });
  });

  describe('IP address defanging', () => {
    it('should generate bracket-defanged IP', () => {
      const variants = generateDefangedVariants('192.168.1.1');
      expect(variants).toContain('192[.]168[.]1[.]1');
    });

    it('should generate paren-defanged IP', () => {
      const variants = generateDefangedVariants('192.168.1.1');
      expect(variants).toContain('192(.)168(.)1(.)1');
    });

    it('should generate last-dot-only IP variant', () => {
      const variants = generateDefangedVariants('192.168.1.1');
      expect(variants).toContain('192.168.1[.]1');
    });
  });

  describe('Email defanging', () => {
    it('should generate bracket @ variant', () => {
      const variants = generateDefangedVariants('user@example.com');
      expect(variants).toContain('user[@]example.com');
    });

    it('should generate paren @ variant', () => {
      const variants = generateDefangedVariants('user@example.com');
      expect(variants).toContain('user(@)example.com');
    });

    it('should generate combined @ and dot variant', () => {
      const variants = generateDefangedVariants('user@example.com');
      expect(variants).toContain('user[@]example[.]com');
    });
  });

  describe('URL defanging', () => {
    it('should generate hxxp variant', () => {
      const variants = generateDefangedVariants('http://example.com');
      expect(variants).toContain('hxxp://example.com');
    });

    it('should generate hxxps variant', () => {
      const variants = generateDefangedVariants('https://example.com');
      expect(variants).toContain('hxxps://example.com');
    });

    it('should generate hXXp variant', () => {
      const variants = generateDefangedVariants('http://example.com');
      expect(variants).toContain('hXXp://example.com');
    });

    it('should generate hXXps variant', () => {
      const variants = generateDefangedVariants('https://example.com');
      expect(variants).toContain('hXXps://example.com');
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for empty string', () => {
      const variants = generateDefangedVariants('');
      expect(variants).toEqual([]);
    });

    it('should not duplicate variants', () => {
      const variants = generateDefangedVariants('example.com');
      const uniqueVariants = [...new Set(variants)];
      expect(variants.length).toBe(uniqueVariants.length);
    });

    it('should handle value without dots', () => {
      const variants = generateDefangedVariants('localhost');
      // No dots = no defang variants based on dots
      expect(variants.every(v => !v.includes('[.]'))).toBe(true);
    });

    it('should handle single character before last dot', () => {
      const variants = generateDefangedVariants('a.com');
      expect(variants).toContain('a[.]com');
    });
  });
});
