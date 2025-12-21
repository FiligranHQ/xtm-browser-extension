/**
 * Unit Tests for Refanging/Defanging Utilities
 * 
 * Tests the conversion of defanged indicators back to their original form.
 */

import { describe, it, expect } from 'vitest';
import {
  refangIndicator,
  isDefanged,
  detectObservableType,
} from '../../src/shared/detection/patterns';

// ============================================================================
// Refanging Tests
// ============================================================================

describe('refangIndicator', () => {
  describe('IP address defanging', () => {
    it('should refang IP addresses with [.]', () => {
      expect(refangIndicator('192[.]168[.]1[.]1')).toBe('192.168.1.1');
      expect(refangIndicator('10[.]0[.]0[.]1')).toBe('10.0.0.1');
    });

    it('should refang IP addresses with (.)', () => {
      expect(refangIndicator('192(.)168(.)1(.)1')).toBe('192.168.1.1');
    });

    it('should refang IP addresses with {.}', () => {
      expect(refangIndicator('192{.}168{.}1{.}1')).toBe('192.168.1.1');
    });

    it('should handle mixed defanging styles', () => {
      expect(refangIndicator('192[.]168(.)1{.}1')).toBe('192.168.1.1');
    });
  });

  describe('Domain defanging', () => {
    it('should refang domains with [.]', () => {
      expect(refangIndicator('example[.]com')).toBe('example.com');
      expect(refangIndicator('sub[.]domain[.]example[.]com')).toBe('sub.domain.example.com');
    });

    it('should refang domains with (.)', () => {
      expect(refangIndicator('evil(.)com')).toBe('evil.com');
    });

    it('should refang domains with {.}', () => {
      expect(refangIndicator('malware{.}net')).toBe('malware.net');
    });
  });

  describe('Email defanging', () => {
    it('should refang emails with [@]', () => {
      expect(refangIndicator('user[@]example[.]com')).toBe('user@example.com');
    });

    it('should refang emails with (@)', () => {
      expect(refangIndicator('admin(@)evil(.)com')).toBe('admin@evil.com');
    });

    it('should refang emails with {@}', () => {
      expect(refangIndicator('test{@}domain{.}org')).toBe('test@domain.org');
    });
  });

  describe('URL defanging', () => {
    it('should refang hxxp:// to http://', () => {
      expect(refangIndicator('hxxp://example.com')).toBe('http://example.com');
    });

    it('should refang hxxps:// to https://', () => {
      expect(refangIndicator('hxxps://example.com')).toBe('https://example.com');
    });

    it('should refang hXXp:// case-insensitively', () => {
      expect(refangIndicator('hXXp://example.com')).toBe('http://example.com');
      expect(refangIndicator('HXXPS://example.com')).toBe('https://example.com');
    });

    it('should refang h[xx]p:// variants', () => {
      expect(refangIndicator('h[xx]p://example.com')).toBe('http://example.com');
      expect(refangIndicator('h[xx]ps://example.com')).toBe('https://example.com');
    });

    it('should refang [://] in URLs', () => {
      expect(refangIndicator('http[://]example.com')).toBe('http://example.com');
    });

    it('should refang meow:// to http://', () => {
      expect(refangIndicator('meow://example.com')).toBe('http://example.com');
    });

    it('should handle complex defanged URLs', () => {
      expect(refangIndicator('hxxps://evil[.]com/path')).toBe('https://evil.com/path');
      expect(refangIndicator('hxxp://sub[.]domain[.]com/page')).toBe('http://sub.domain.com/page');
    });
  });

  describe('Path defanging', () => {
    it('should refang [/] to /', () => {
      expect(refangIndicator('example.com[/]path')).toBe('example.com/path');
    });

    it('should refang (/) to /', () => {
      expect(refangIndicator('example.com(/)path')).toBe('example.com/path');
    });
  });

  describe('Edge cases', () => {
    it('should handle already normal indicators', () => {
      expect(refangIndicator('192.168.1.1')).toBe('192.168.1.1');
      expect(refangIndicator('example.com')).toBe('example.com');
      expect(refangIndicator('https://example.com')).toBe('https://example.com');
    });

    it('should handle empty string', () => {
      expect(refangIndicator('')).toBe('');
    });

    it('should handle partial defanging', () => {
      expect(refangIndicator('example[.]com/normal/path')).toBe('example.com/normal/path');
    });
  });
});

// ============================================================================
// Defang Detection Tests
// ============================================================================

describe('isDefanged', () => {
  it('should detect [.] defanging', () => {
    expect(isDefanged('192[.]168[.]1[.]1')).toBe(true);
    expect(isDefanged('example[.]com')).toBe(true);
  });

  it('should detect (.) defanging', () => {
    expect(isDefanged('192(.)168(.)1(.)1')).toBe(true);
  });

  it('should detect {.} defanging', () => {
    expect(isDefanged('192{.}168{.}1{.}1')).toBe(true);
  });

  it('should detect [@] defanging', () => {
    expect(isDefanged('user[@]example.com')).toBe(true);
    expect(isDefanged('user(@)example.com')).toBe(true);
  });

  it('should detect hxxp defanging', () => {
    expect(isDefanged('hxxp://example.com')).toBe(true);
    expect(isDefanged('hxxps://example.com')).toBe(true);
  });

  it('should detect h[xx]p defanging', () => {
    expect(isDefanged('h[xx]p://example.com')).toBe(true);
  });

  it('should detect [://] defanging', () => {
    expect(isDefanged('http[://]example.com')).toBe(true);
  });

  it('should return false for normal indicators', () => {
    expect(isDefanged('192.168.1.1')).toBe(false);
    expect(isDefanged('example.com')).toBe(false);
    expect(isDefanged('https://example.com')).toBe(false);
    expect(isDefanged('user@example.com')).toBe(false);
  });
});

// ============================================================================
// Observable Type Detection Tests
// ============================================================================

describe('detectObservableType', () => {
  describe('URL detection', () => {
    it('should detect standard URLs', () => {
      expect(detectObservableType('https://example.com')).toBe('Url');
      expect(detectObservableType('http://example.com/path')).toBe('Url');
    });

    it('should detect defanged URLs', () => {
      expect(detectObservableType('hxxps://example.com')).toBe('Url');
      expect(detectObservableType('hxxp://evil.com')).toBe('Url');
    });
  });

  describe('Email detection', () => {
    it('should detect standard emails', () => {
      expect(detectObservableType('user@example.com')).toBe('Email-Addr');
      expect(detectObservableType('admin@sub.domain.com')).toBe('Email-Addr');
    });

    it('should detect defanged emails', () => {
      expect(detectObservableType('user[@]example[.]com')).toBe('Email-Addr');
    });
  });

  describe('CVE detection', () => {
    it('should detect CVE identifiers', () => {
      expect(detectObservableType('CVE-2021-44228')).toBe('Vulnerability');
      expect(detectObservableType('CVE-2024-12345')).toBe('Vulnerability');
    });

    it('should be case-insensitive', () => {
      expect(detectObservableType('cve-2021-44228')).toBe('Vulnerability');
    });
  });

  describe('MITRE ATT&CK detection', () => {
    it('should detect MITRE technique IDs', () => {
      expect(detectObservableType('T1566')).toBe('Attack-Pattern');
      expect(detectObservableType('T1059.001')).toBe('Attack-Pattern');
    });
  });

  describe('Hash detection', () => {
    it('should detect MD5 hashes', () => {
      expect(detectObservableType('d41d8cd98f00b204e9800998ecf8427e')).toBe('StixFile');
    });

    it('should detect SHA-1 hashes', () => {
      expect(detectObservableType('da39a3ee5e6b4b0d3255bfef95601890afd80709')).toBe('StixFile');
    });

    it('should detect SHA-256 hashes', () => {
      expect(detectObservableType('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')).toBe('StixFile');
    });

    it('should detect SHA-512 hashes', () => {
      const sha512 = 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
      expect(detectObservableType(sha512)).toBe('StixFile');
    });
  });

  describe('File name detection', () => {
    it('should detect executable file names', () => {
      expect(detectObservableType('malware.exe')).toBe('StixFile');
      expect(detectObservableType('trojan.dll')).toBe('StixFile');
    });

    it('should detect document file names', () => {
      expect(detectObservableType('document.pdf')).toBe('StixFile');
      expect(detectObservableType('invoice.docx')).toBe('StixFile');
    });

    it('should detect script file names', () => {
      expect(detectObservableType('script.ps1')).toBe('StixFile');
      expect(detectObservableType('exploit.py')).toBe('StixFile');
    });

    it('should NOT detect domain-like extensions as files', () => {
      // .com, .net, .org are TLDs, not file extensions
      expect(detectObservableType('example.com')).toBe('Domain-Name');
      expect(detectObservableType('test.org')).toBe('Domain-Name');
    });
  });

  describe('IP address detection', () => {
    it('should detect IPv4 addresses', () => {
      expect(detectObservableType('192.168.1.1')).toBe('IPv4-Addr');
      expect(detectObservableType('10.0.0.1')).toBe('IPv4-Addr');
    });

    it('should detect defanged IPv4 addresses', () => {
      expect(detectObservableType('192[.]168[.]1[.]1')).toBe('IPv4-Addr');
    });
  });

  describe('MAC address detection', () => {
    it('should detect MAC addresses with colons', () => {
      expect(detectObservableType('00:1A:2B:3C:4D:5E')).toBe('Mac-Addr');
    });

    it('should detect MAC addresses with dashes', () => {
      expect(detectObservableType('00-1A-2B-3C-4D-5E')).toBe('Mac-Addr');
    });

    it('should detect MAC addresses with dots (Cisco format)', () => {
      expect(detectObservableType('001A.2B3C.4D5E')).toBe('Mac-Addr');
    });
  });

  describe('Cryptocurrency detection', () => {
    it('should detect Bitcoin addresses', () => {
      expect(detectObservableType('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe('Cryptocurrency-Wallet');
      expect(detectObservableType('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe('Cryptocurrency-Wallet');
    });

    it('should detect Ethereum addresses', () => {
      expect(detectObservableType('0x742d35Cc6634C0532925a3b844Bc9e7595f3fEeA')).toBe('Cryptocurrency-Wallet');
    });
  });

  describe('ASN detection', () => {
    it('should detect ASN identifiers', () => {
      expect(detectObservableType('AS12345')).toBe('Autonomous-System');
      expect(detectObservableType('ASN65000')).toBe('Autonomous-System');
    });
  });

  describe('Domain detection', () => {
    it('should detect standard domains', () => {
      expect(detectObservableType('example.com')).toBe('Domain-Name');
      expect(detectObservableType('sub.domain.co.uk')).toBe('Domain-Name');
    });

    it('should detect defanged domains', () => {
      expect(detectObservableType('example[.]com')).toBe('Domain-Name');
      expect(detectObservableType('evil(.)net')).toBe('Domain-Name');
    });
  });

  describe('Unknown types', () => {
    it('should return empty string for unknown types', () => {
      expect(detectObservableType('random text')).toBe('');
      expect(detectObservableType('12345')).toBe('');
    });

    it('should return empty string for empty input', () => {
      expect(detectObservableType('')).toBe('');
      expect(detectObservableType('   ')).toBe('');
    });
  });

  describe('Input trimming', () => {
    it('should trim whitespace from input', () => {
      expect(detectObservableType('  192.168.1.1  ')).toBe('IPv4-Addr');
      expect(detectObservableType('\n\texample.com\n\t')).toBe('Domain-Name');
    });
  });
});

