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
  toGraphQLInputType,
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
  describe('toGraphQLInputType', () => {
    it('should remove hyphens from types', () => {
      expect(toGraphQLInputType('IPv4-Addr')).toBe('IPv4Addr');
      expect(toGraphQLInputType('Domain-Name')).toBe('DomainName');
      expect(toGraphQLInputType('Email-Addr')).toBe('EmailAddr');
    });

    it('should handle types without hyphens', () => {
      expect(toGraphQLInputType('Url')).toBe('Url');
      expect(toGraphQLInputType('Hostname')).toBe('Hostname');
      expect(toGraphQLInputType('StixFile')).toBe('StixFile');
    });

    it('should handle multiple hyphens', () => {
      expect(toGraphQLInputType('Autonomous-System')).toBe('AutonomousSystem');
      expect(toGraphQLInputType('Windows-Registry-Key')).toBe('WindowsRegistryKey');
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
      const input = buildObservableInput('IPv4-Addr', '192.168.1.1');
      expect(input).toEqual({ value: '192.168.1.1' });
    });

    it('should build value-based input for domain names', () => {
      const input = buildObservableInput('Domain-Name', 'example.com');
      expect(input).toEqual({ value: 'example.com' });
    });

    it('should build value-based input for URLs', () => {
      const input = buildObservableInput('Url', 'https://example.com');
      expect(input).toEqual({ value: 'https://example.com' });
    });

    it('should build hash-based input for StixFile', () => {
      const md5 = 'd41d8cd98f00b204e9800998ecf8427e';
      const input = buildObservableInput('StixFile', md5);
      expect(input).toHaveProperty('hashes');
      expect(input.hashes).toEqual([{ algorithm: 'MD5', hash: md5 }]);
    });

    it('should build hash-based input for SHA-256 files', () => {
      const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const input = buildObservableInput('StixFile', sha256);
      expect(input).toHaveProperty('hashes');
      expect(input.hashes).toEqual([{ algorithm: 'SHA-256', hash: sha256 }]);
    });

    it('should build name-based input for files without hash', () => {
      const input = buildObservableInput('StixFile', 'malware.exe');
      expect(input).toEqual({ name: 'malware.exe' });
    });

    it('should use provided hash type if specified', () => {
      const input = buildObservableInput('StixFile', 'somehash', 'SHA-256');
      expect(input).toHaveProperty('hashes');
      expect(input.hashes).toEqual([{ algorithm: 'SHA-256', hash: 'somehash' }]);
    });

    it('should build ASN input with number', () => {
      const input = buildObservableInput('Autonomous-System', 'AS12345');
      expect(input).toHaveProperty('number');
      expect(input.number).toBe(12345);
    });

    it('should handle ASN without AS prefix', () => {
      const input = buildObservableInput('Autonomous-System', '12345');
      expect(input).toHaveProperty('number');
      expect(input.number).toBe(12345);
    });

    it('should build bank account input for IBAN', () => {
      const iban = 'DE89370400440532013000';
      const input = buildObservableInput('Bank-Account', iban);
      expect(input).toHaveProperty('iban');
      expect(input.iban).toBe('DE89370400440532013000');
    });

    it('should build bank account input for BIC', () => {
      const bic = 'DEUTDEFF';
      const input = buildObservableInput('Bank-Account', bic);
      expect(input).toHaveProperty('bic');
      expect(input.bic).toBe('DEUTDEFF');
    });

    it('should build payment card input', () => {
      const input = buildObservableInput('Payment-Card', '4111-1111-1111-1111');
      expect(input).toHaveProperty('card_number');
      expect(input.card_number).toBe('4111111111111111');
    });

    it('should build Windows registry key input', () => {
      const input = buildObservableInput('Windows-Registry-Key', 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Test');
      expect(input).toHaveProperty('attribute_key');
    });

    it('should build X509 certificate input for hash', () => {
      const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const input = buildObservableInput('X509-Certificate', sha256);
      expect(input).toHaveProperty('hashes');
    });

    it('should build X509 certificate input for serial number', () => {
      const input = buildObservableInput('X509-Certificate', '123456789');
      expect(input).toHaveProperty('serial_number');
    });
  });
});

// ============================================================================
// Observable Type Coverage Tests
// ============================================================================

describe('Observable Type Coverage', () => {
  const commonObservableTypes = [
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
    ['Bank-Account', 'BankAccount'],
    ['Windows-Registry-Key', 'WindowsRegistryKey'],
    ['X509-Certificate', 'X509Certificate'],
    ['Payment-Card', 'PaymentCard'],
  ];

  it('should convert all standard observable types to GraphQL format', () => {
    for (const [stixType, gqlType] of commonObservableTypes) {
      expect(toGraphQLInputType(stixType), `Should convert ${stixType}`).toBe(gqlType);
    }
  });

  it('should build input for all observable types without throwing', () => {
    for (const [stixType] of commonObservableTypes) {
      expect(() => buildObservableInput(stixType, 'test-value')).not.toThrow();
    }
  });
});
