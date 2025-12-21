/**
 * Unit Tests for AI Prompt Templates
 * 
 * Tests prompt building functions for AI generation tasks.
 */

import { describe, it, expect } from 'vitest';
import {
  SYSTEM_PROMPTS,
  TABLE_TOP_THEMES,
  buildContainerDescriptionPrompt,
  buildScenarioPrompt,
  buildFullScenarioPrompt,
  buildAtomicTestPrompt,
  buildEmailGenerationPrompt,
  buildEmailGenerationSystemPrompt,
  buildEntityDiscoveryPrompt,
  buildRelationshipResolutionPrompt,
} from '../../src/shared/api/ai/prompts';

// ============================================================================
// System Prompts Tests
// ============================================================================

describe('System Prompts', () => {
  it('should have container description prompt', () => {
    expect(SYSTEM_PROMPTS.containerDescription).toBeDefined();
    expect(SYSTEM_PROMPTS.containerDescription).toContain('cybersecurity');
    expect(SYSTEM_PROMPTS.containerDescription).toContain('threat intelligence');
  });

  it('should have scenario generation prompt', () => {
    expect(SYSTEM_PROMPTS.scenarioGeneration).toBeDefined();
    expect(SYSTEM_PROMPTS.scenarioGeneration).toContain('adversary simulation');
  });

  it('should have atomic test prompt', () => {
    expect(SYSTEM_PROMPTS.atomicTest).toBeDefined();
    expect(SYSTEM_PROMPTS.atomicTest).toContain('atomic testing');
    expect(SYSTEM_PROMPTS.atomicTest).toContain('JSON');
  });

  it('should have entity discovery prompt', () => {
    expect(SYSTEM_PROMPTS.entityDiscovery).toBeDefined();
    expect(SYSTEM_PROMPTS.entityDiscovery).toContain('threat intelligence');
  });

  it('should have relationship resolution prompt', () => {
    expect(SYSTEM_PROMPTS.relationshipResolution).toBeDefined();
    expect(SYSTEM_PROMPTS.relationshipResolution).toContain('STIX');
  });
});

// ============================================================================
// Table-Top Themes Tests
// ============================================================================

describe('Table-Top Themes', () => {
  it('should have cybersecurity theme', () => {
    expect(TABLE_TOP_THEMES['cybersecurity']).toBeDefined();
    expect(TABLE_TOP_THEMES['cybersecurity'].promptContext).toBe('Cybersecurity & Technology');
  });

  it('should have physical-security theme', () => {
    expect(TABLE_TOP_THEMES['physical-security']).toBeDefined();
    expect(TABLE_TOP_THEMES['physical-security'].promptContext).toBe('Physical Security & Safety');
  });

  it('should have business-continuity theme', () => {
    expect(TABLE_TOP_THEMES['business-continuity']).toBeDefined();
    expect(TABLE_TOP_THEMES['business-continuity'].promptContext).toBe('Business Continuity');
  });

  it('should have crisis-communication theme', () => {
    expect(TABLE_TOP_THEMES['crisis-communication']).toBeDefined();
    expect(TABLE_TOP_THEMES['crisis-communication'].promptContext).toBe('Crisis Communication');
  });

  it('should have health-safety theme', () => {
    expect(TABLE_TOP_THEMES['health-safety']).toBeDefined();
    expect(TABLE_TOP_THEMES['health-safety'].promptContext).toBe('Health & Safety');
  });

  it('should have geopolitical theme', () => {
    expect(TABLE_TOP_THEMES['geopolitical']).toBeDefined();
    expect(TABLE_TOP_THEMES['geopolitical'].promptContext).toBe('Geopolitical & Economic');
  });

  it('should have required properties for each theme', () => {
    for (const [key, theme] of Object.entries(TABLE_TOP_THEMES)) {
      expect(theme.systemPromptSuffix).toBeDefined();
      expect(theme.promptContext).toBeDefined();
      expect(theme.exampleTopics).toBeDefined();
      expect(typeof theme.systemPromptSuffix).toBe('string');
      expect(typeof theme.promptContext).toBe('string');
      expect(typeof theme.exampleTopics).toBe('string');
    }
  });
});

// ============================================================================
// Prompt Builder Tests
// ============================================================================

describe('Prompt Builders', () => {
  describe('buildContainerDescriptionPrompt', () => {
    it('should include container name and type', () => {
      const prompt = buildContainerDescriptionPrompt({
        containerType: 'Report',
        containerName: 'Test Report',
        pageTitle: 'Test Page',
        pageUrl: 'https://example.com',
        pageContent: 'Test content',
      });

      expect(prompt).toContain('Report');
      expect(prompt).toContain('Test Report');
      expect(prompt).toContain('Test Page');
      expect(prompt).toContain('https://example.com');
    });

    it('should include detected entities', () => {
      const prompt = buildContainerDescriptionPrompt({
        containerType: 'Grouping',
        containerName: 'Test',
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
        detectedEntities: ['APT29', 'Cobalt Strike'],
      });

      expect(prompt).toContain('APT29');
      expect(prompt).toContain('Cobalt Strike');
    });

    it('should include detected observables', () => {
      const prompt = buildContainerDescriptionPrompt({
        containerType: 'Note',
        containerName: 'Test',
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
        detectedObservables: ['192.168.1.1', 'evil.com'],
      });

      expect(prompt).toContain('192.168.1.1');
      expect(prompt).toContain('evil.com');
    });

    it('should truncate long content', () => {
      const longContent = 'x'.repeat(5000);
      const prompt = buildContainerDescriptionPrompt({
        containerType: 'Report',
        containerName: 'Test',
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: longContent,
      });

      expect(prompt.length).toBeLessThan(longContent.length);
    });
  });

  describe('buildScenarioPrompt', () => {
    it('should include scenario name and type', () => {
      const prompt = buildScenarioPrompt({
        scenarioName: 'Test Scenario',
        pageTitle: 'Test Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
        typeAffinity: 'attack-scenario',
        platformAffinity: ['Windows', 'Linux'],
      });

      expect(prompt).toContain('Test Scenario');
      expect(prompt).toContain('attack-scenario');
      expect(prompt).toContain('Windows');
      expect(prompt).toContain('Linux');
    });

    it('should include attack patterns', () => {
      const prompt = buildScenarioPrompt({
        scenarioName: 'Test',
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
        detectedAttackPatterns: [
          { name: 'Phishing', id: 'T1566', description: 'Phishing attack' },
        ],
      });

      expect(prompt).toContain('Phishing');
      expect(prompt).toContain('T1566');
    });

    it('should include JSON structure', () => {
      const prompt = buildScenarioPrompt({
        scenarioName: 'Test',
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
      });

      expect(prompt).toContain('JSON');
      expect(prompt).toContain('injects');
    });
  });

  describe('buildFullScenarioPrompt', () => {
    it('should return system prompt and prompt for tech scenario', () => {
      const result = buildFullScenarioPrompt({
        scenarioName: 'Tech Scenario',
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
        typeAffinity: 'ATTACK',
        platformAffinity: ['Windows'],
        payloadAffinity: 'powershell',
        numberOfInjects: 5,
      });

      expect(result.systemPrompt).toBeDefined();
      expect(result.prompt).toBeDefined();
      expect(result.prompt).toContain('Tech Scenario');
      expect(result.prompt).toContain('powershell');
    });

    it('should generate table-top prompt when typeAffinity is TABLE-TOP', () => {
      const result = buildFullScenarioPrompt({
        scenarioName: 'Crisis Exercise',
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
        typeAffinity: 'TABLE-TOP',
        numberOfInjects: 6,
        tableTopDuration: 90,
      });

      expect(result.systemPrompt).toContain('crisis simulation');
      expect(result.prompt).toContain('table-top');
      expect(result.prompt).toContain('90 minutes');
    });

    it('should use scenario theme for table-top', () => {
      const result = buildFullScenarioPrompt({
        scenarioName: 'Physical Security',
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
        typeAffinity: 'TABLE-TOP',
        numberOfInjects: 4,
        scenarioTheme: 'physical-security',
      });

      expect(result.prompt).toContain('Physical Security');
    });

    it('should respect email language', () => {
      const result = buildFullScenarioPrompt({
        scenarioName: 'French Exercise',
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
        typeAffinity: 'TABLE-TOP',
        numberOfInjects: 4,
        emailLanguage: 'french',
      });

      expect(result.prompt).toContain('FRENCH');
      expect(result.prompt).toContain('french');
    });
  });

  describe('buildAtomicTestPrompt', () => {
    it('should include attack pattern info', () => {
      const prompt = buildAtomicTestPrompt({
        attackPattern: {
          name: 'Process Injection',
          id: 'T1055',
          description: 'Inject code into processes',
        },
        targetPlatform: 'windows',
      });

      expect(prompt).toContain('Process Injection');
      expect(prompt).toContain('T1055');
      expect(prompt).toContain('powershell');
    });

    it('should use bash for linux target', () => {
      const prompt = buildAtomicTestPrompt({
        attackPattern: { name: 'Test' },
        targetPlatform: 'linux',
      });

      expect(prompt).toContain('bash');
    });

    it('should include context if provided', () => {
      const prompt = buildAtomicTestPrompt({
        attackPattern: { name: 'Test' },
        targetPlatform: 'windows',
        context: 'Additional context info',
      });

      expect(prompt).toContain('Additional context info');
    });

    it('should truncate long context', () => {
      const longContext = 'x'.repeat(5000);
      const prompt = buildAtomicTestPrompt({
        attackPattern: { name: 'Test' },
        targetPlatform: 'windows',
        context: longContext,
      });

      expect(prompt).toContain('[truncated]');
    });
  });

  describe('buildEmailGenerationPrompt', () => {
    it('should include attack patterns', () => {
      const prompt = buildEmailGenerationPrompt({
        scenarioName: 'Test Scenario',
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
        attackPatterns: [
          { name: 'Phishing', externalId: 'T1566', killChainPhases: ['initial-access'] },
        ],
      });

      expect(prompt).toContain('Phishing');
      expect(prompt).toContain('T1566');
      expect(prompt).toContain('initial-access');
    });

    it('should respect language setting', () => {
      const prompt = buildEmailGenerationPrompt({
        scenarioName: 'Test',
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
        attackPatterns: [],
        language: 'german',
      });

      expect(prompt).toContain('GERMAN');
    });
  });

  describe('buildEmailGenerationSystemPrompt', () => {
    it('should include default language', () => {
      const prompt = buildEmailGenerationSystemPrompt();
      expect(prompt).toContain('english');
    });

    it('should include specified language', () => {
      const prompt = buildEmailGenerationSystemPrompt('spanish');
      expect(prompt).toContain('spanish');
    });
  });

  describe('buildEntityDiscoveryPrompt', () => {
    it('should include page info', () => {
      const prompt = buildEntityDiscoveryPrompt({
        pageTitle: 'Threat Report',
        pageUrl: 'https://example.com/report',
        pageContent: 'Content about APT29',
      });

      expect(prompt).toContain('Threat Report');
      expect(prompt).toContain('https://example.com/report');
    });

    it('should include already detected entities', () => {
      const prompt = buildEntityDiscoveryPrompt({
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
        alreadyDetected: [
          { type: 'Malware', name: 'Emotet', value: 'Emotet' },
          { type: 'IPv4-Addr', value: '192.168.1.1' },
        ],
      });

      expect(prompt).toContain('Emotet');
      expect(prompt).toContain('192.168.1.1');
    });

    it('should include entity type descriptions', () => {
      const prompt = buildEntityDiscoveryPrompt({
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
      });

      expect(prompt).toContain('Intrusion-Set');
      expect(prompt).toContain('Threat-Actor-Group');
      expect(prompt).toContain('Malware');
      expect(prompt).toContain('Tool');
    });
  });

  describe('buildRelationshipResolutionPrompt', () => {
    it('should include entity list', () => {
      const prompt = buildRelationshipResolutionPrompt({
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content about APT29 using Cobalt Strike',
        entities: [
          { type: 'Intrusion-Set', name: 'APT29', existsInPlatform: true },
          { type: 'Tool', name: 'Cobalt Strike', existsInPlatform: false },
        ],
      });

      expect(prompt).toContain('APT29');
      expect(prompt).toContain('Cobalt Strike');
      expect(prompt).toContain('exists in OpenCTI');
      expect(prompt).toContain('new');
    });

    it('should include relationship types', () => {
      const prompt = buildRelationshipResolutionPrompt({
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: 'Content',
        entities: [],
      });

      expect(prompt).toContain('targets');
      expect(prompt).toContain('uses');
      expect(prompt).toContain('attributed-to');
      expect(prompt).toContain('related-to');
    });

    it('should truncate long page content', () => {
      const longContent = 'x'.repeat(10000);
      const prompt = buildRelationshipResolutionPrompt({
        pageTitle: 'Page',
        pageUrl: 'https://example.com',
        pageContent: longContent,
        entities: [],
      });

      expect(prompt).toContain('truncated');
    });
  });
});

