/**
 * Unit Tests for Detection Module
 * 
 * Tests observable matching, text extraction, and detection patterns.
 */

import { describe, it, expect } from 'vitest';
import {
  extractTextFromHTML,
  getTextNodes,
  normalizeText,
} from '../../src/shared/detection/text-extraction';
import {
  normalizeToStixType,
  stixToGraphQLType,
  detectHashType,
  buildObservableInput,
} from '../../src/shared/api/opencti/observable-mapping';

// ============================================================================
// Text Extraction Tests
// ============================================================================

describe('Text Extraction', () => {
  // Note: extractTextFromHTML uses DOMParser which is not available in Node.js
  // These tests are skipped in Node environment but would pass in browser
  describe.skip('extractTextFromHTML (requires browser environment)', () => {
    it('should extract text from simple HTML', () => {
      const html = '<p>Hello World</p>';
      const text = extractTextFromHTML(html);
      expect(text).toContain('Hello World');
    });

    it('should remove script tags', () => {
      const html = '<p>Text</p><script>alert("evil")</script>';
      const text = extractTextFromHTML(html);
      expect(text).not.toContain('alert');
      expect(text).not.toContain('evil');
    });

    it('should remove style tags', () => {
      const html = '<p>Text</p><style>.class { color: red; }</style>';
      const text = extractTextFromHTML(html);
      expect(text).not.toContain('color');
      expect(text).not.toContain('red');
    });

    it('should handle nested HTML', () => {
      const html = '<div><p><span>Nested</span> Text</p></div>';
      const text = extractTextFromHTML(html);
      expect(text).toContain('Nested');
      expect(text).toContain('Text');
    });

    it('should handle empty input', () => {
      const text = extractTextFromHTML('');
      expect(text).toBe('');
    });
  });

  describe('normalizeText', () => {
    it('should collapse whitespace', () => {
      expect(normalizeText('hello   world')).toBe('hello world');
      expect(normalizeText('hello\n\nworld')).toBe('hello world');
      expect(normalizeText('hello\t\tworld')).toBe('hello world');
    });

    it('should trim leading/trailing whitespace', () => {
      expect(normalizeText('  hello  ')).toBe('hello');
      expect(normalizeText('\nhello\n')).toBe('hello');
    });

    it('should handle empty string', () => {
      expect(normalizeText('')).toBe('');
    });

    it('should handle already normalized text', () => {
      expect(normalizeText('already normalized')).toBe('already normalized');
    });
  });
});

// ============================================================================
// Observable Mapping Tests
// ============================================================================

describe('Observable Mapping', () => {
  describe('normalizeToStixType', () => {
    it('should normalize common types', () => {
      expect(normalizeToStixType('ipv4addr')).toBe('IPv4-Addr');
      expect(normalizeToStixType('ipv4-addr')).toBe('IPv4-Addr');
      expect(normalizeToStixType('IPv4Addr')).toBe('IPv4-Addr');
    });

    it('should normalize domain types', () => {
      expect(normalizeToStixType('domainname')).toBe('Domain-Name');
      expect(normalizeToStixType('domain-name')).toBe('Domain-Name');
    });

    it('should normalize hash types', () => {
      expect(normalizeToStixType('stixfile')).toBe('StixFile');
      expect(normalizeToStixType('file')).toBe('StixFile');
    });

    it('should be case insensitive', () => {
      expect(normalizeToStixType('IPV4ADDR')).toBe('IPv4-Addr');
      expect(normalizeToStixType('Ipv4Addr')).toBe('IPv4-Addr');
    });

    it('should return original type if not found', () => {
      expect(normalizeToStixType('UnknownType')).toBe('UnknownType');
    });
  });

  describe('stixToGraphQLType', () => {
    it('should convert STIX types to GraphQL types', () => {
      expect(stixToGraphQLType('IPv4-Addr')).toBe('IPv4Addr');
      expect(stixToGraphQLType('Domain-Name')).toBe('DomainName');
      expect(stixToGraphQLType('Email-Addr')).toBe('EmailAddr');
    });

    it('should handle types without hyphens', () => {
      expect(stixToGraphQLType('Url')).toBe('Url');
      expect(stixToGraphQLType('Hostname')).toBe('Hostname');
    });

    it('should remove hyphens from unknown types', () => {
      expect(stixToGraphQLType('Custom-Type')).toBe('CustomType');
    });
  });

  describe('detectHashType', () => {
    it('should detect MD5 hashes', () => {
      expect(detectHashType('d41d8cd98f00b204e9800998ecf8427e')).toBe('MD5');
      expect(detectHashType('098f6bcd4621d373cade4e832627b4f6')).toBe('MD5');
    });

    it('should detect SHA-1 hashes', () => {
      expect(detectHashType('da39a3ee5e6b4b0d3255bfef95601890afd80709')).toBe('SHA-1');
    });

    it('should detect SHA-256 hashes', () => {
      expect(detectHashType('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe('SHA-256');
    });

    it('should detect SHA-512 hashes', () => {
      const sha512 = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
      expect(detectHashType(sha512)).toBe('SHA-512');
    });

    it('should detect SSDEEP hashes', () => {
      expect(detectHashType('3:abc+def:ghi+jkl')).toBe('SSDEEP');
    });

    it('should return null for non-hash values', () => {
      expect(detectHashType('not a hash')).toBeNull();
      expect(detectHashType('12345')).toBeNull();
      expect(detectHashType('')).toBeNull();
    });

    it('should be case insensitive', () => {
      expect(detectHashType('D41D8CD98F00B204E9800998ECF8427E')).toBe('MD5');
    });
  });

  describe('buildObservableInput', () => {
    it('should build value-based input for simple types', () => {
      const input = buildObservableInput('IPv4-Addr', 'IPv4Addr', '192.168.1.1');
      expect(input).toEqual({ value: '192.168.1.1' });
    });

    it('should build hash-based input for StixFile', () => {
      const md5 = 'd41d8cd98f00b204e9800998ecf8427e';
      const input = buildObservableInput('StixFile', 'StixFile', md5);
      expect(input).toHaveProperty('hashes');
      expect(input.hashes).toEqual([{ algorithm: 'MD5', hash: md5 }]);
    });

    it('should build name-based input for files without hash', () => {
      const input = buildObservableInput('StixFile', 'StixFile', 'malware.exe');
      expect(input).toEqual({ name: 'malware.exe' });
    });

    it('should build ASN input with number', () => {
      const input = buildObservableInput('Autonomous-System', 'AutonomousSystem', 'AS12345');
      expect(input).toHaveProperty('number');
      expect(input.number).toBe(12345);
    });

    it('should build bank account input for IBAN', () => {
      const iban = 'DE89370400440532013000';
      const input = buildObservableInput('Bank-Account', 'BankAccount', iban);
      expect(input).toHaveProperty('iban');
    });

    it('should build directory input with path', () => {
      const input = buildObservableInput('Directory', 'Directory', '/var/log');
      expect(input).toEqual({ path: '/var/log' });
    });

    it('should build process input with command line', () => {
      const input = buildObservableInput('Process', 'Process', 'cmd.exe /c whoami');
      expect(input).toEqual({ command_line: 'cmd.exe /c whoami' });
    });
  });
});

// ============================================================================
// Observable Type Coverage Tests
// ============================================================================

describe('Observable Type Coverage', () => {
  const allObservableTypes = [
    ['IPv4-Addr', 'IPv4Addr'],
    ['IPv6-Addr', 'IPv6Addr'],
    ['Domain-Name', 'DomainName'],
    ['Hostname', 'Hostname'],
    ['Email-Addr', 'EmailAddr'],
    ['Url', 'Url'],
    ['Mac-Addr', 'MacAddr'],
    ['StixFile', 'StixFile'],
    ['Autonomous-System', 'AutonomousSystem'],
    ['Cryptocurrency-Wallet', 'CryptocurrencyWallet'],
    ['User-Agent', 'UserAgent'],
    ['Phone-Number', 'PhoneNumber'],
    ['Bank-Account', 'BankAccount'],
    ['Directory', 'Directory'],
    ['Process', 'Process'],
    ['Software', 'Software'],
    ['Mutex', 'Mutex'],
    ['Windows-Registry-Key', 'WindowsRegistryKey'],
    ['X509-Certificate', 'X509Certificate'],
    ['Payment-Card', 'PaymentCard'],
    ['Credential', 'Credential'],
  ];

  it('should support all standard observable types', () => {
    for (const [stixType, gqlType] of allObservableTypes) {
      // Verify STIX -> GraphQL conversion works
      expect(stixToGraphQLType(stixType), `Should convert ${stixType}`).toBe(gqlType);
      
      // Verify buildObservableInput doesn't throw
      expect(() => buildObservableInput(stixType, gqlType, 'test-value')).not.toThrow();
    }
  });

  it('should normalize all lowercase variants', () => {
    // Types that should have hyphens when normalized
    const typesWithHyphens = [
      'ipv4addr',
      'ipv6addr',
      'domainname',
      'emailaddr',
      'macaddr',
      'autonomoussystem',
      'cryptocurrencywallet',
    ];

    for (const variant of typesWithHyphens) {
      const normalized = normalizeToStixType(variant);
      expect(normalized, `Should normalize ${variant}`).not.toBe(variant);
      expect(normalized, `${variant} should have hyphen`).toContain('-');
    }
    
    // StixFile is special - no hyphen
    expect(normalizeToStixType('stixfile')).toBe('StixFile');
    expect(normalizeToStixType('file')).toBe('StixFile');
  });
});

