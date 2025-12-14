/**
 * Unit Tests for Indicator Defanging/Refanging
 * 
 * Tests the regex patterns and functions for handling defanged indicators:
 * - IP addresses with brackets: 192.168.1[.]1
 * - Domains with brackets: evil[.]com
 * - URLs with hxxp: hxxps://evil[.]com
 */

import { describe, it, expect } from 'vitest';

// Refang patterns - convert defanged indicators back to normal form
const DEFANG_PATTERNS = [
  // IP addresses with brackets around dots: 192[.]168[.]1[.]1
  { pattern: /\[\.]/g, replacement: '.' },
  // IP addresses with parentheses: 192(.)168(.)1(.)1
  { pattern: /\(\.?\)/g, replacement: '.' },
  // Domains with brackets: evil[.]com
  { pattern: /\[\.\]/g, replacement: '.' },
  // HTTP with xx: hxxp:// or hxxps://
  { pattern: /hxxp/gi, replacement: 'http' },
  // At sign replacement: user[@]domain.com
  { pattern: /\[@]/g, replacement: '@' },
  // Colon replacement for ports: domain.com[:]8080
  { pattern: /\[:\]/g, replacement: ':' },
];

/**
 * Refang an indicator - convert defanged format back to normal
 */
function refangIndicator(indicator: string): string {
  let result = indicator;
  for (const { pattern, replacement } of DEFANG_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Check if an indicator is defanged
 */
function isDefanged(indicator: string): boolean {
  return DEFANG_PATTERNS.some(({ pattern }) => pattern.test(indicator));
}

describe('Indicator Defanging', () => {
  describe('refangIndicator', () => {
    describe('IP Addresses', () => {
      it('should refang IP with bracket dots', () => {
        expect(refangIndicator('192[.]168[.]1[.]1')).toBe('192.168.1.1');
        expect(refangIndicator('10[.]0[.]0[.]1')).toBe('10.0.0.1');
        expect(refangIndicator('8[.]8[.]8[.]8')).toBe('8.8.8.8');
      });

      it('should refang IP with parenthesis dots', () => {
        expect(refangIndicator('192(.)168(.)1(.)1')).toBe('192.168.1.1');
        expect(refangIndicator('10(.)0(.)0(.)1')).toBe('10.0.0.1');
      });

      it('should refang IP with empty parentheses', () => {
        expect(refangIndicator('192()168()1()1')).toBe('192.168.1.1');
      });

      it('should handle partially defanged IPs', () => {
        expect(refangIndicator('192.168[.]1.1')).toBe('192.168.1.1');
        expect(refangIndicator('192[.]168.1[.]1')).toBe('192.168.1.1');
      });
    });

    describe('Domains', () => {
      it('should refang domains with bracket dots', () => {
        expect(refangIndicator('evil[.]com')).toBe('evil.com');
        expect(refangIndicator('malware[.]example[.]com')).toBe('malware.example.com');
        expect(refangIndicator('c2[.]attacker[.]org')).toBe('c2.attacker.org');
      });

      it('should handle subdomains', () => {
        expect(refangIndicator('api[.]evil[.]com')).toBe('api.evil.com');
        expect(refangIndicator('cdn[.]malicious[.]io')).toBe('cdn.malicious.io');
      });
    });

    describe('URLs', () => {
      it('should refang hxxp protocol', () => {
        expect(refangIndicator('hxxp://evil.com')).toBe('http://evil.com');
        expect(refangIndicator('hxxps://evil.com')).toBe('https://evil.com');
      });

      it('should refang hxxp with case variations', () => {
        // Note: the replacement is case-insensitive but always outputs lowercase 'http'
        expect(refangIndicator('HXXP://evil.com')).toBe('http://evil.com');
        expect(refangIndicator('HxxPs://evil.com')).toBe('https://evil.com');
      });

      it('should refang full defanged URL', () => {
        expect(refangIndicator('hxxps://malware[.]evil[.]com/path')).toBe('https://malware.evil.com/path');
        expect(refangIndicator('hxxp://192[.]168[.]1[.]1/payload')).toBe('http://192.168.1.1/payload');
      });

      it('should handle port notation', () => {
        expect(refangIndicator('evil[.]com[:]8080')).toBe('evil.com:8080');
        expect(refangIndicator('hxxp://evil[.]com[:]443/path')).toBe('http://evil.com:443/path');
      });
    });

    describe('Email Addresses', () => {
      it('should refang email with @ bracket', () => {
        expect(refangIndicator('attacker[@]evil.com')).toBe('attacker@evil.com');
        expect(refangIndicator('user[@]malware[.]org')).toBe('user@malware.org');
      });
    });

    describe('Non-defanged Indicators', () => {
      it('should leave normal indicators unchanged', () => {
        expect(refangIndicator('192.168.1.1')).toBe('192.168.1.1');
        expect(refangIndicator('evil.com')).toBe('evil.com');
        expect(refangIndicator('https://example.com')).toBe('https://example.com');
        expect(refangIndicator('user@example.com')).toBe('user@example.com');
      });

      it('should leave normal hashes unchanged', () => {
        expect(refangIndicator('d41d8cd98f00b204e9800998ecf8427e')).toBe('d41d8cd98f00b204e9800998ecf8427e');
        expect(refangIndicator('da39a3ee5e6b4b0d3255bfef95601890afd80709')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
      });
    });
  });

  describe('isDefanged', () => {
    it('should detect defanged IPs', () => {
      expect(isDefanged('192[.]168[.]1[.]1')).toBe(true);
      expect(isDefanged('10(.)0(.)0(.)1')).toBe(true);
    });

    it('should detect defanged domains', () => {
      expect(isDefanged('evil[.]com')).toBe(true);
      expect(isDefanged('malware[.]example[.]org')).toBe(true);
    });

    it('should detect defanged URLs', () => {
      expect(isDefanged('hxxp://evil.com')).toBe(true);
      expect(isDefanged('hxxps://malware[.]com')).toBe(true);
    });

    it('should detect defanged emails', () => {
      expect(isDefanged('attacker[@]evil.com')).toBe(true);
    });

    it('should return false for normal indicators', () => {
      expect(isDefanged('192.168.1.1')).toBe(false);
      expect(isDefanged('evil.com')).toBe(false);
      expect(isDefanged('https://example.com')).toBe(false);
      expect(isDefanged('user@example.com')).toBe(false);
    });
  });
});

describe('Indicator Extraction with Defanging Support', () => {
  /**
   * Extract and refang all IPv4 addresses from text
   */
  function extractIPv4(text: string): string[] {
    // First refang the text
    const refangedText = refangIndicator(text);
    
    // Then extract IPs
    const ipPattern = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
    return refangedText.match(ipPattern) || [];
  }

  /**
   * Extract and refang all domains from text
   */
  function extractDomains(text: string): string[] {
    // First refang the text
    const refangedText = refangIndicator(text);
    
    // Then extract domains
    const domainPattern = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|org|net|io|edu|gov)\b/gi;
    return refangedText.match(domainPattern) || [];
  }

  it('should extract IPs from mixed defanged text', () => {
    const text = 'The attacker used 192[.]168[.]1[.]1 and 10.0.0.1 as C2 servers';
    const ips = extractIPv4(text);
    
    expect(ips).toContain('192.168.1.1');
    expect(ips).toContain('10.0.0.1');
  });

  it('should extract domains from defanged text', () => {
    const text = 'Malware connects to evil[.]com and also c2[.]malicious[.]org';
    const domains = extractDomains(text);
    
    expect(domains).toContain('evil.com');
    expect(domains).toContain('c2.malicious.org');
  });

  it('should handle complex defanged IoCs', () => {
    const text = `
      Indicators:
      - hxxps://malware[.]evil[.]com/payload
      - 192[.]168[.]1[.]100
      - attacker[@]phishing[.]org
    `;
    
    const ips = extractIPv4(text);
    const domains = extractDomains(text);
    
    expect(ips).toContain('192.168.1.100');
    expect(domains).toContain('malware.evil.com');
    expect(domains).toContain('phishing.org');
  });
});

describe('Indicator Comparison', () => {
  /**
   * Compare two indicators after normalizing (refanging)
   */
  function indicatorsMatch(a: string, b: string): boolean {
    return refangIndicator(a.toLowerCase()) === refangIndicator(b.toLowerCase());
  }

  it('should match defanged and normal IPs', () => {
    expect(indicatorsMatch('192[.]168[.]1[.]1', '192.168.1.1')).toBe(true);
    expect(indicatorsMatch('10(.)0(.)0(.)1', '10.0.0.1')).toBe(true);
  });

  it('should match defanged and normal domains', () => {
    expect(indicatorsMatch('evil[.]com', 'evil.com')).toBe(true);
    expect(indicatorsMatch('c2[.]attacker[.]org', 'c2.attacker.org')).toBe(true);
  });

  it('should match defanged and normal URLs', () => {
    expect(indicatorsMatch('hxxp://evil[.]com', 'http://evil.com')).toBe(true);
    expect(indicatorsMatch('hxxps://malware[.]org/path', 'https://malware.org/path')).toBe(true);
  });

  it('should be case insensitive', () => {
    expect(indicatorsMatch('Evil[.]Com', 'evil.com')).toBe(true);
    expect(indicatorsMatch('HXXPS://EVIL.COM', 'https://evil.com')).toBe(true);
  });

  it('should not match different indicators', () => {
    expect(indicatorsMatch('192[.]168[.]1[.]1', '192.168.1.2')).toBe(false);
    expect(indicatorsMatch('evil[.]com', 'good.com')).toBe(false);
  });
});
