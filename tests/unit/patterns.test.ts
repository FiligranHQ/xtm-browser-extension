/**
 * Unit Tests for Detection Patterns
 * 
 * Tests the regex patterns used for detecting observables.
 */

import { describe, it, expect } from 'vitest';
import { 
  OBSERVABLE_PATTERNS, 
  IPV4_PATTERN,
  IPV6_PATTERN,
  DOMAIN_PATTERN,
  URL_PATTERN,
  EMAIL_PATTERN,
  MD5_PATTERN,
  SHA1_PATTERN,
  SHA256_PATTERN,
  CVE_PATTERN,
  createNamePattern,
} from '../../src/shared/detection/patterns';

describe('Observable Patterns', () => {
  describe('IPv4 Pattern', () => {
    it('should match valid IPv4 addresses', () => {
      const validIPs = [
        '192.168.1.1',
        '10.0.0.1',
        '172.16.0.1',
        '8.8.8.8',
        '1.1.1.1',
      ];
      
      validIPs.forEach(ip => {
        const pattern = new RegExp(IPV4_PATTERN.source, IPV4_PATTERN.flags);
        const match = pattern.exec(ip);
        expect(match, `Should match ${ip}`).not.toBeNull();
        expect(match?.[0]).toBe(ip);
      });
    });
    
    it('should not match invalid IPv4 addresses', () => {
      const invalidIPs = [
        '256.1.1.1',
        '1.256.1.1',
        '1.1.256.1',
        '1.1.1.256',
      ];
      
      invalidIPs.forEach(ip => {
        const pattern = new RegExp(IPV4_PATTERN.source, IPV4_PATTERN.flags);
        const match = pattern.exec(ip);
        if (match) {
          // If there's a match, it shouldn't be the full invalid IP
          expect(match[0]).not.toBe(ip);
        }
      });
    });
  });

  describe('IPv6 Pattern', () => {
    it('should match valid IPv6 addresses', () => {
      const validIPs = [
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
        '2001:db8:85a3::8a2e:370:7334',
        'fe80::1',
        '::1',
      ];
      
      validIPs.forEach(ip => {
        const pattern = new RegExp(IPV6_PATTERN.source, IPV6_PATTERN.flags);
        const match = pattern.exec(ip);
        expect(match, `Should match ${ip}`).not.toBeNull();
      });
    });
  });

  describe('Domain Pattern', () => {
    it('should match valid domains', () => {
      const validDomains = [
        'example.com',
        'sub.example.com',
        'test.co.uk',
        'my-domain.org',
        'api.github.io',
      ];
      
      validDomains.forEach(domain => {
        const pattern = new RegExp(DOMAIN_PATTERN.source, DOMAIN_PATTERN.flags);
        const match = pattern.exec(domain);
        expect(match, `Should match ${domain}`).not.toBeNull();
      });
    });
  });

  describe('URL Pattern', () => {
    it('should match valid URLs', () => {
      const validURLs = [
        'http://example.com',
        'https://example.com/path',
        'https://sub.example.com/path?query=value',
        'http://example.com:8080/path',
      ];
      
      validURLs.forEach(url => {
        const pattern = new RegExp(URL_PATTERN.source, URL_PATTERN.flags);
        const match = pattern.exec(url);
        expect(match, `Should match ${url}`).not.toBeNull();
      });
    });
  });

  describe('Email Pattern', () => {
    it('should match valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user@sub.example.com',
      ];
      
      validEmails.forEach(email => {
        const pattern = new RegExp(EMAIL_PATTERN.source, EMAIL_PATTERN.flags);
        const match = pattern.exec(email);
        expect(match, `Should match ${email}`).not.toBeNull();
      });
    });
  });

  describe('MD5 Hash Pattern', () => {
    it('should match valid MD5 hashes', () => {
      const validHashes = [
        'd41d8cd98f00b204e9800998ecf8427e',
        '098f6bcd4621d373cade4e832627b4f6',
        'e99a18c428cb38d5f260853678922e03',
      ];
      
      validHashes.forEach(hash => {
        const pattern = new RegExp(MD5_PATTERN.source, MD5_PATTERN.flags);
        const match = pattern.exec(hash);
        expect(match, `Should match ${hash}`).not.toBeNull();
      });
    });
    
    it('should not match invalid MD5 hashes', () => {
      const invalidHashes = [
        'd41d8cd98f00b204e9800998ecf8427', // too short
        'd41d8cd98f00b204e9800998ecf8427eg', // invalid char
        'd41d8cd98f00b204e9800998ecf8427eab', // too long
      ];
      
      invalidHashes.forEach(hash => {
        const pattern = new RegExp(MD5_PATTERN.source, MD5_PATTERN.flags);
        const match = pattern.exec(hash);
        if (match) {
          expect(match[0]).not.toBe(hash);
        }
      });
    });
  });

  describe('SHA1 Hash Pattern', () => {
    it('should match valid SHA1 hashes', () => {
      const validHashes = [
        'da39a3ee5e6b4b0d3255bfef95601890afd80709',
        '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12',
      ];
      
      validHashes.forEach(hash => {
        const pattern = new RegExp(SHA1_PATTERN.source, SHA1_PATTERN.flags);
        const match = pattern.exec(hash);
        expect(match, `Should match ${hash}`).not.toBeNull();
      });
    });
  });

  describe('SHA256 Hash Pattern', () => {
    it('should match valid SHA256 hashes', () => {
      const validHashes = [
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      ];
      
      validHashes.forEach(hash => {
        const pattern = new RegExp(SHA256_PATTERN.source, SHA256_PATTERN.flags);
        const match = pattern.exec(hash);
        expect(match, `Should match ${hash}`).not.toBeNull();
      });
    });
  });

  describe('CVE Pattern', () => {
    it('should match valid CVE identifiers', () => {
      const validCVEs = [
        'CVE-2021-44228',
        'CVE-2023-12345',
        'CVE-1999-0001',
        'cve-2024-1234',
      ];
      
      validCVEs.forEach(cve => {
        const pattern = new RegExp(CVE_PATTERN.source, CVE_PATTERN.flags);
        const match = pattern.exec(cve);
        expect(match, `Should match ${cve}`).not.toBeNull();
      });
    });
    
    it('should not match invalid CVE identifiers', () => {
      const invalidCVEs = [
        'CVE-21-44228', // year too short
        'CVE2021-44228', // missing hyphen
      ];
      
      invalidCVEs.forEach(cve => {
        const pattern = new RegExp(CVE_PATTERN.source, CVE_PATTERN.flags);
        const match = pattern.exec(cve);
        if (match) {
          expect(match[0]).not.toBe(cve);
        }
      });
    });
  });
});

describe('OBSERVABLE_PATTERNS Configuration', () => {
  it('should have patterns with required properties', () => {
    OBSERVABLE_PATTERNS.forEach(config => {
      expect(config.pattern).toBeDefined();
      expect(config.type).toBeDefined();
      expect(config.priority).toBeDefined();
      expect(typeof config.priority).toBe('number');
    });
  });

  it('should be sorted by priority (highest first)', () => {
    for (let i = 0; i < OBSERVABLE_PATTERNS.length - 1; i++) {
      expect(OBSERVABLE_PATTERNS[i].priority).toBeGreaterThanOrEqual(
        OBSERVABLE_PATTERNS[i + 1].priority
      );
    }
  });
});

describe('createNamePattern', () => {
  it('should create a pattern that matches whole words', () => {
    // Create new pattern for each test since global regex has state
    expect(createNamePattern('APT29').test('APT29')).toBe(true);
    expect(createNamePattern('APT29').test('The APT29 group')).toBe(true);
    expect(createNamePattern('APT29').test('APT29 is dangerous')).toBe(true);
  });

  it('should not match partial words', () => {
    expect(createNamePattern('APT29').test('APT291')).toBe(false);
    expect(createNamePattern('APT29').test('XAPT29')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(createNamePattern('CozyBear').test('cozybear')).toBe(true);
    expect(createNamePattern('CozyBear').test('COZYBEAR')).toBe(true);
    expect(createNamePattern('CozyBear').test('CozyBear')).toBe(true);
  });

  it('should escape special regex characters', () => {
    expect(createNamePattern('C++ Code').test('C++ Code')).toBe(true);
    expect(createNamePattern('C++ Code').test('The C++ Code project')).toBe(true);
  });
});
