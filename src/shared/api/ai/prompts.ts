/**
 * AI Prompt Templates
 *
 * Centralized prompt templates for all AI generation tasks.
 * Separating prompts from the client logic improves maintainability.
 */

import type {
  ContainerDescriptionRequest,
  ScenarioGenerationRequest,
  FullScenarioGenerationRequest,
  AtomicTestRequest,
  EmailGenerationRequest,
  EntityDiscoveryRequest,
  RelationshipResolutionRequest,
} from './types';

// ============================================================================
// System Prompts
// ============================================================================

export const SYSTEM_PROMPTS = {
  containerDescription: `You are a cybersecurity analyst assistant. Generate concise, professional descriptions for threat intelligence containers (reports, groupings, notes). Focus on the key findings, threats, and relevance. Keep the description between 2-4 paragraphs.`,

  scenarioGeneration: `You are a cybersecurity simulation expert. Generate realistic adversary simulation scenarios with specific injects (actions/steps) for security testing. Each inject should be actionable and time-sequenced. Output in JSON format.`,

  atomicTest: `You are an expert in adversary simulation and atomic testing (like Atomic Red Team). Generate safe, reversible test commands that simulate specific attack techniques. Always include cleanup commands. Output in JSON format only - no markdown, no explanations, just valid JSON.`,

  entityDiscovery: `You are an expert cybersecurity threat intelligence analyst. Your task is to identify ONLY HIGH-VALUE, ACTIONABLE threat intelligence entities that regex patterns missed.

CRITICAL RULES - READ CAREFULLY:
1. BE HIGHLY CONSERVATIVE - It is MUCH better to return an empty list than to include questionable entities
2. EXPLICIT MENTIONS ONLY - The entity must be EXPLICITLY and UNAMBIGUOUSLY mentioned in the text
3. EXACT VALUES - The entity value must match EXACTLY what appears in the text
4. CYBERSECURITY CONTEXT REQUIRED - The entity must be discussed in a threat/security context, not just mentioned casually
5. NO DUPLICATES - Never return entities already in the "already detected" list
6. HIGH CONFIDENCE ONLY - Only return entities you are 90%+ confident about
7. QUALITY OVER QUANTITY - Return 0-5 entities maximum. If unsure, return none.

WHAT TO EXTRACT (only these specific types):
- Malware: ONLY well-known malware families/names (e.g., "Emotet", "Cobalt Strike", "TrickBot") - NOT generic terms
- Threat-Actor-Group: ONLY named APT groups or cybercrime groups (e.g., "APT29", "Lazarus Group", "FIN7") - must be a KNOWN threat actor
- Intrusion-Set: ONLY named intrusion sets explicitly identified as such
- Campaign: ONLY named campaigns explicitly identified as campaigns
- Tool: ONLY known offensive security/hacking tools (e.g., "Mimikatz", "BloodHound", "Metasploit") - NOT common software

WHAT TO AVOID (DO NOT EXTRACT):
- Generic software names (Windows, Chrome, Office, etc.)
- Common company names unless they are explicitly threat actors
- Country names (too generic, high false positive rate)
- Industry sector names (too generic)
- Generic technical terms (authentication, encryption, etc.)
- Author names, researcher names, or security vendor names
- Conference names, report titles
- Version numbers or build identifiers
- Common words that happen to match entity patterns
- Anything you are less than 90% confident about

Output ONLY valid JSON, no additional text.`,

  relationshipResolution: `You are an expert cybersecurity threat intelligence analyst specializing in STIX 2.1 data modeling. Your task is to identify PRECISE and RELEVANT relationships between threat intelligence entities based on contextual evidence from the page content.

CRITICAL REQUIREMENTS:
1. PRECISION: Only suggest relationships with clear evidence in the text - NEVER hallucinate or assume
2. RELEVANCE: Choose the most semantically accurate relationship type for each connection
3. SPECIFICITY: Prefer specific relationship types over generic ones (avoid "related-to" unless no other type fits)
4. EVIDENCE-BASED: Every relationship must be supported by explicit or strongly implied textual evidence
5. DIRECTION MATTERS: Relationships are directional - ensure from/to entities are correct

COMPLETE STIX 2.1 RELATIONSHIP TYPES (use the most precise type):

ATTACK & THREAT RELATIONSHIPS:
- "uses": Threat actors, intrusion sets, campaigns, or malware USE attack patterns, tools, malware, or infrastructure
- "targets": Threat actors, intrusion sets, campaigns, or malware TARGET identity (organizations, sectors, individuals), locations, or vulnerabilities
- "attributed-to": Intrusion sets or campaigns are ATTRIBUTED TO threat actors; threat actors ATTRIBUTED TO locations/countries
- "impersonates": Threat actors or campaigns IMPERSONATE identities (organizations, individuals)

MALWARE & TOOL RELATIONSHIPS:
- "delivers": Malware DELIVERS other malware (e.g., dropper delivers payload)
- "drops": Malware DROPS other malware or tools
- "downloads": Malware or tools DOWNLOAD files, other malware, or tools
- "exploits": Malware or tools EXPLOIT vulnerabilities
- "variant-of": Malware is a VARIANT OF another malware family
- "controls": Malware CONTROLS infrastructure
- "authored-by": Malware or tools AUTHORED BY threat actors or identities

INFRASTRUCTURE & OBSERVABLE RELATIONSHIPS:
- "communicates-with": Malware or tools COMMUNICATE WITH infrastructure (IPs, domains, URLs)
- "beacons-to": Malware BEACONS TO C2 infrastructure (specific periodic communication)
- "exfiltrates-to": Malware EXFILTRATES data TO infrastructure
- "hosts": Infrastructure HOSTS malware, tools, or other infrastructure
- "owns": Identity OWNS infrastructure
- "consists-of": Infrastructure CONSISTS OF other infrastructure components
- "resolves-to": Domain RESOLVES TO IP addresses

INDICATOR & DETECTION RELATIONSHIPS:
- "indicates": Indicators INDICATE malware, attack patterns, threat actors, campaigns, or intrusion sets
- "based-on": Indicators BASED ON observables (the observable evidence for the indicator)
- "derived-from": Objects DERIVED FROM other objects (analysis products)

DEFENSE & MITIGATION RELATIONSHIPS:
- "mitigates": Courses of action MITIGATE attack patterns, malware, vulnerabilities, or tools
- "remediates": Courses of action REMEDIATE vulnerabilities or malware
- "investigates": Identities (analysts) INVESTIGATE incidents, campaigns, or intrusion sets

LOCATION & IDENTITY RELATIONSHIPS:
- "located-at": Identities, threat actors, or infrastructure LOCATED AT locations
- "originates-from": Threat actors or malware ORIGINATE FROM locations/countries

GENERAL RELATIONSHIPS:
- "related-to": Use ONLY when no other relationship type accurately describes the connection
- "duplicate-of": Object is a DUPLICATE OF another object
- "part-of": Entity is PART OF another entity (e.g., sub-campaign)

Output ONLY valid JSON, no markdown, no explanation.`,
} as const;

// ============================================================================
// Table-Top Theme Configurations
// ============================================================================

export interface ThemeConfig {
  systemPromptSuffix: string;
  promptContext: string;
  exampleTopics: string;
}

export const TABLE_TOP_THEMES: Record<string, ThemeConfig> = {
  'cybersecurity': {
    systemPromptSuffix: 'Focus on cyber attacks, data breaches, ransomware, phishing, and IT security incidents.',
    promptContext: 'Cybersecurity & Technology',
    exampleTopics: 'cyber attacks, malware outbreaks, data breaches, phishing campaigns, ransomware incidents, system compromises, insider threats, vulnerability exploitation',
  },
  'physical-security': {
    systemPromptSuffix: 'Focus on physical security threats including facility breaches, unauthorized access, workplace violence, theft, and physical infrastructure incidents.',
    promptContext: 'Physical Security & Safety',
    exampleTopics: 'facility intrusions, access control breaches, theft incidents, workplace violence, surveillance failures, perimeter security, visitor management issues, physical asset protection',
  },
  'business-continuity': {
    systemPromptSuffix: 'Focus on business disruption scenarios including natural disasters, supply chain failures, key personnel loss, system outages, and operational resilience.',
    promptContext: 'Business Continuity',
    exampleTopics: 'natural disasters, power outages, supply chain disruptions, key personnel unavailability, facility damage, system failures, vendor failures, operational disruptions',
  },
  'crisis-communication': {
    systemPromptSuffix: 'Focus on crisis communication scenarios including media incidents, reputation management, public relations crises, stakeholder communication, and brand impact events.',
    promptContext: 'Crisis Communication',
    exampleTopics: 'media leaks, social media crises, negative press coverage, stakeholder concerns, public relations incidents, brand reputation threats, executive communications, customer notification requirements',
  },
  'health-safety': {
    systemPromptSuffix: 'Focus on health and safety incidents including workplace accidents, pandemic response, environmental hazards, employee safety, and regulatory compliance.',
    promptContext: 'Health & Safety',
    exampleTopics: 'workplace injuries, pandemic outbreaks, environmental contamination, occupational hazards, emergency evacuations, regulatory violations, employee wellness incidents, safety equipment failures',
  },
  'geopolitical': {
    systemPromptSuffix: 'Focus on geopolitical and economic scenarios including sanctions, trade restrictions, political instability, economic crises, regulatory changes, and international incidents.',
    promptContext: 'Geopolitical & Economic',
    exampleTopics: 'sanctions compliance, trade restrictions, political instability, economic downturns, currency crises, regulatory changes, international incidents, cross-border issues, export control violations',
  },
};

// ============================================================================
// Prompt Builders
// ============================================================================

export function buildContainerDescriptionPrompt(request: ContainerDescriptionRequest): string {
  return `Generate a description for a ${request.containerType} container in a threat intelligence platform.

Container Name: ${request.containerName}
Source Page: ${request.pageTitle}
URL: ${request.pageUrl}

${request.detectedEntities?.length ? `Detected Threat Entities: ${request.detectedEntities.join(', ')}` : ''}
${request.detectedObservables?.length ? `Detected Indicators: ${request.detectedObservables.join(', ')}` : ''}

Page Content Summary:
${request.pageContent.substring(0, 3000)}

Please generate a professional description that:
1. Summarizes the main topic/threat covered
2. Highlights key entities and indicators found
3. Provides context on the relevance and potential impact
4. Uses appropriate threat intelligence terminology`;
}

export function buildScenarioPrompt(request: ScenarioGenerationRequest): string {
  const attackPatternsInfo = request.detectedAttackPatterns?.map(ap =>
    `- ${ap.name}${ap.id ? ` (${ap.id})` : ''}${ap.description ? `: ${ap.description.substring(0, 200)}` : ''}`
  ).join('\n') || 'None detected';

  return `Generate a security simulation scenario based on the following information:

Scenario Name: ${request.scenarioName}
Type: ${request.typeAffinity || 'attack-scenario'}
Target Platforms: ${request.platformAffinity?.join(', ') || 'Windows, Linux'}

Source Intelligence:
- Page: ${request.pageTitle}
- URL: ${request.pageUrl}

Detected Attack Patterns/TTPs:
${attackPatternsInfo}

${request.detectedDomains?.length ? `Detected Domains: ${request.detectedDomains.join(', ')}` : ''}
${request.detectedHostnames?.length ? `Detected Hostnames: ${request.detectedHostnames.join(', ')}` : ''}
${request.detectedEmails?.length ? `Detected Emails: ${request.detectedEmails.join(', ')}` : ''}

Page Content:
${request.pageContent.substring(0, 2500)}

Generate a JSON response with this structure:
{
  "name": "scenario name",
  "description": "detailed scenario description",
  "subtitle": "short tagline",
  "category": "attack-scenario|incident-response|detection-validation|red-team|purple-team",
  "injects": [
    {
      "title": "inject title",
      "description": "what this step does",
      "type": "email|manual|command",
      "content": "for command type: the actual command to execute",
      "delayMinutes": 0,
      "dependsOn": null or index of previous inject
    }
  ]
}

Create 5-10 realistic injects that simulate the attack chain described, with appropriate timing and dependencies.`;
}

export function buildFullScenarioPrompt(request: FullScenarioGenerationRequest): {
  systemPrompt: string;
  prompt: string;
} {
  const isTableTop = request.typeAffinity === 'TABLE-TOP';
  const selectedTheme = request.scenarioTheme || 'cybersecurity';
  const themeConfig = TABLE_TOP_THEMES[selectedTheme] || TABLE_TOP_THEMES['cybersecurity'];

  const hasAttackPatterns = request.detectedAttackPatterns && request.detectedAttackPatterns.length > 0;
  const attackPatternsInfo = hasAttackPatterns
    ? request.detectedAttackPatterns!.map(ap => `- ${ap.name}${ap.id ? ` (${ap.id})` : ''}${ap.description ? `: ${ap.description.substring(0, 150)}` : ''}`).join('\n')
    : 'None detected - analyze the page content to identify relevant threats and techniques';

  const truncatedContent = request.pageContent.substring(0, 3000);
  const truncatedContext = request.additionalContext?.substring(0, 1000) || '';
  const emailLanguage = request.emailLanguage || 'english';

  const systemPrompt = isTableTop
    ? `You are a simulation expert creating table-top exercises. Generate realistic incident simulation scenarios with email notifications that simulate real-world scenarios for training purposes. ${themeConfig.systemPromptSuffix} Each inject should be an email notification that advances the scenario narrative. Output in JSON format only.`
    : `You are a cybersecurity adversary simulation expert. Generate realistic attack scenarios with executable payloads that simulate specific attack techniques. Commands must be SAFE, NON-DESTRUCTIVE, and reversible. Output in JSON format only.`;

  let prompt: string;

  if (isTableTop) {
    const themeInstruction = selectedTheme !== 'cybersecurity'
      ? `\nSCENARIO THEME: ${themeConfig.promptContext}
The scenario MUST focus on ${themeConfig.promptContext.toLowerCase()} themes. Examples include: ${themeConfig.exampleTopics}.
Even if the page content mentions cyber-related topics, reframe the scenario to fit the ${themeConfig.promptContext.toLowerCase()} theme.\n`
      : '';

    const duration = request.tableTopDuration || 60;
    const numInjects = request.numberOfInjects;
    const interval = numInjects > 1 ? Math.round(duration / (numInjects - 1)) : 0;
    const timingExample = Array.from({ length: Math.min(numInjects, 5) }, (_, i) =>
      i === 0 ? 0 : Math.round(i * interval)
    ).join(', ');

    prompt = `Generate a table-top exercise scenario based on the following:

Scenario Name: ${request.scenarioName}
Type: Table-Top Exercise
Theme: ${themeConfig.promptContext}
Total Duration: ${duration} minutes
Number of Email Notifications: ${numInjects}
EMAIL LANGUAGE: ${emailLanguage.toUpperCase()} - All email subjects and bodies MUST be written in ${emailLanguage}.
${themeInstruction}
Source Intelligence:
- Page: ${request.pageTitle}
- URL: ${request.pageUrl}

${hasAttackPatterns ? `Detected Topics/Patterns:\n${attackPatternsInfo}` : `No specific patterns were detected on the page. Analyze the page content below to identify relevant ${themeConfig.promptContext.toLowerCase()} topics, and create a realistic scenario based on that content.`}

${truncatedContext ? `Additional Context:\n${truncatedContext}\n` : ''}
Page Content:
${truncatedContent}

CRITICAL TIMING REQUIREMENT:
- Total exercise duration: ${duration} minutes
- Number of injects: ${numInjects}
- Time interval between injects: ${interval} minutes
- First inject at minute 0, last inject at minute ${duration}
- Expected delayMinutes values: ${timingExample}${numInjects > 5 ? '...' : ''} (evenly distributed)

Generate a JSON response with this structure:
{
  "name": "scenario name",
  "description": "detailed scenario description for the exercise",
  "subtitle": "short tagline describing the exercise theme",
  "category": "table-top",
  "injects": [
    {
      "title": "inject/email notification title",
      "description": "brief description of this notification",
      "type": "email",
      "subject": "[SIMULATION] realistic email subject line in ${emailLanguage}",
      "body": "Professional email body in ${emailLanguage} describing the simulated ${themeConfig.promptContext.toLowerCase()} event (2-4 sentences)",
      "delayMinutes": 0 for first inject, then ${interval}, ${interval * 2}, etc. (MUST distribute across ${duration} minutes)
    }
  ]
}

Create exactly ${numInjects} email notification injects that:
1. Build a coherent ${themeConfig.promptContext.toLowerCase()} narrative progressing through the incident
2. MUST be evenly distributed across the ${duration} minute duration with ~${interval} minute intervals
3. ${hasAttackPatterns ? 'Reference the detected topics where relevant, adapting them to the ' + themeConfig.promptContext + ' theme' : 'Create realistic scenarios based on ' + themeConfig.promptContext.toLowerCase() + ' topics derived from the page content'}
4. Include realistic subject lines marked as [SIMULATION]
5. Have professional, contextual email bodies suitable for training
6. ALL EMAIL SUBJECTS AND BODIES MUST BE IN ${emailLanguage.toUpperCase()}
7. Focus specifically on ${themeConfig.promptContext.toLowerCase()} scenarios (${themeConfig.exampleTopics})`;
  } else {
    prompt = `Generate a technical adversary simulation scenario based on the following:

Scenario Name: ${request.scenarioName}
Type: ${request.typeAffinity}
Target Platforms: ${request.platformAffinity?.join(', ') || 'Windows, Linux'}
Payload Executor: ${request.payloadAffinity || 'powershell'}
Number of Injects: ${request.numberOfInjects}

Source Intelligence:
- Page: ${request.pageTitle}
- URL: ${request.pageUrl}

${hasAttackPatterns ? `Detected Attack Patterns/TTPs:\n${attackPatternsInfo}` : `No specific attack patterns were detected on the page. Analyze the page content below to identify relevant attack techniques, malware behaviors, threat actor TTPs, or security topics mentioned, and create a realistic simulation scenario based on that content.`}

${truncatedContext ? `Additional Context:\n${truncatedContext}\n` : ''}
Page Content:
${truncatedContent}

Generate a JSON response with this structure:
{
  "name": "scenario name",
  "description": "detailed scenario description",
  "subtitle": "short tagline",
  "category": "attack-scenario",
  "injects": [
    {
      "title": "inject title",
      "description": "what this step does and what it simulates",
      "type": "command",
      "executor": "${request.payloadAffinity || 'powershell'}",
      "content": "the actual command to execute (MUST be safe and non-destructive)",
      "delayMinutes": 0 for first inject, then 1 for each subsequent inject (1 minute spacing)
    }
  ]
}

Create exactly ${request.numberOfInjects} command injects that:
1. ${hasAttackPatterns ? 'Form a coherent attack chain based on the detected patterns' : 'Form a coherent attack chain based on threats or techniques identified from the page content'}
2. Are SAFE and NON-DESTRUCTIVE (simulation only)
3. Use ${request.payloadAffinity || 'powershell'} executor syntax
4. Produce observable artifacts for detection testing
5. Progress logically through attack phases (recon → access → persistence → etc.)
6. Each inject should have delayMinutes of 0 for the first, then 1 for each subsequent (1 minute apart)

IMPORTANT:
- Commands must be SAFE for testing environments
- Do NOT include actual malicious payloads
- Focus on simulation techniques that create detectable artifacts
- Use appropriate syntax for ${request.payloadAffinity || 'powershell'}`;
  }

  return { systemPrompt, prompt };
}

export function buildAtomicTestPrompt(request: AtomicTestRequest): string {
  const MAX_CONTEXT_LENGTH = 4000;
  const truncatedContext = request.context
    ? (request.context.length > MAX_CONTEXT_LENGTH ? request.context.substring(0, MAX_CONTEXT_LENGTH) + '...[truncated]' : request.context)
    : '';

  const truncatedDescription = request.attackPattern.description
    ? (request.attackPattern.description.length > 1000 ? request.attackPattern.description.substring(0, 1000) + '...[truncated]' : request.attackPattern.description)
    : '';

  return `Generate an atomic test for the following attack technique:

Attack Pattern: ${request.attackPattern.name}
${request.attackPattern.id ? `MITRE ID: ${request.attackPattern.id}` : ''}
${truncatedDescription ? `Description: ${truncatedDescription}` : ''}
Target Platform: ${request.targetPlatform}
${request.attackPattern.mitrePlatforms?.length ? `Supported Platforms: ${request.attackPattern.mitrePlatforms.join(', ')}` : ''}

${truncatedContext ? `Additional Context:\n${truncatedContext}` : ''}

Generate a JSON response with this structure:
{
  "name": "test name",
  "description": "what this test does and what it validates",
  "executor": "${request.targetPlatform === 'windows' ? 'powershell' : 'bash'}",
  "command": "the command to execute (must be safe for testing)",
  "cleanupCommand": "command to reverse any changes",
  "prerequisites": ["any required tools or conditions"]
}

Important:
- Commands must be SAFE and NON-DESTRUCTIVE
- Must be reversible with cleanup
- Should produce observable artifacts for detection testing
- Use appropriate executor for ${request.targetPlatform}
- Return ONLY valid JSON, no markdown code blocks or additional text`;
}

export function buildEmailGenerationPrompt(request: EmailGenerationRequest): string {
  const language = request.language || 'english';
  const attackPatternsInfo = request.attackPatterns.map(ap =>
    `- ${ap.name}${ap.externalId ? ` (${ap.externalId})` : ''}${ap.killChainPhases?.length ? ` [${ap.killChainPhases.join(', ')}]` : ''}`
  ).join('\n');

  return `Generate realistic simulation email content for a table-top security exercise based on the following:

Scenario: ${request.scenarioName}
Source Intelligence:
- Page: ${request.pageTitle}
- URL: ${request.pageUrl}

LANGUAGE: Generate all email subjects and bodies in ${language.toUpperCase()}.

Attack Patterns to simulate:
${attackPatternsInfo}

Context from page:
${request.pageContent.substring(0, 2000)}

For EACH attack pattern listed above, generate an email that:
1. Has a realistic subject line that would be used in a real attack scenario (in ${language})
2. Has a body that describes the simulated threat/action in a professional security briefing format (in ${language})
3. Is appropriate for training/awareness purposes (marked as [SIMULATION])

IMPORTANT: You must generate exactly one email object for each attack pattern provided.
The attackPatternId in your response must be the EXACT "id" value I provided for each attack pattern (the UUID string, NOT the external ID like T1222).

Generate a JSON response with this structure:
{
  "emails": [
    {
      "attackPatternId": "copy the exact id value provided for each attack pattern",
      "subject": "[SIMULATION] Realistic email subject in ${language}",
      "body": "Professional email body in ${language} describing the simulated security event..."
    }
  ]
}

Keep email bodies concise (2-4 sentences) but informative. ALL CONTENT MUST BE IN ${language.toUpperCase()}.`;
}

export function buildEmailGenerationSystemPrompt(language: string = 'english'): string {
  return `You are a cybersecurity simulation expert creating realistic phishing awareness and incident simulation emails. Generate professional, contextually appropriate email content that simulates real-world security scenarios for training purposes. Output in JSON format. Generate all email content in ${language}.`;
}

export function buildEntityDiscoveryPrompt(request: EntityDiscoveryRequest): string {
  const alreadyDetectedList = request.alreadyDetected || [];
  const alreadyDetectedSummary = alreadyDetectedList.length > 0
    ? alreadyDetectedList.map(e => {
        const parts = [`- ${e.type}: ${e.value || e.name}`];
        if (e.externalId && e.externalId !== e.value && e.externalId !== e.name) {
          parts.push(` (ID: ${e.externalId})`);
        }
        if (e.aliases && Array.isArray(e.aliases) && e.aliases.length > 0) {
          const aliasesStr = e.aliases.slice(0, 3).join(', ');
          parts.push(` (aliases: ${aliasesStr}${e.aliases.length > 3 ? '...' : ''})`);
        }
        return parts.join('');
      }).join('\n')
    : 'None detected yet';

  return `Analyze this cybersecurity article and extract ONLY high-confidence, actionable threat intelligence entities that the regex detection missed.

PAGE: ${request.pageTitle}
URL: ${request.pageUrl}

ALREADY DETECTED (DO NOT INCLUDE THESE OR VARIATIONS):
${alreadyDetectedSummary}

CONTENT:
${request.pageContent.substring(0, 6000)}

STRICT EXTRACTION RULES:
1. Return ONLY entities that are NAMED THREAT ACTORS, NAMED MALWARE FAMILIES, or NAMED CAMPAIGNS
2. The entity must be discussed as a THREAT in the text - not just mentioned
3. Must be a KNOWN, DOCUMENTED threat (not a generic term)
4. Return MAXIMUM 5 entities - prefer quality over quantity
5. If uncertain about ANY entity, DO NOT include it

Return JSON in this EXACT format:
{
  "entities": [
    {
      "type": "Malware|Threat-Actor-Group|Intrusion-Set|Campaign|Tool",
      "name": "Official name of the threat",
      "value": "exact text match from content",
      "reason": "Why this is a genuine threat entity (1 sentence)",
      "confidence": "high",
      "excerpt": "Quote from text proving this entity"
    }
  ]
}

If you cannot find HIGH-CONFIDENCE threat entities, return: {"entities": []}

IMPORTANT: An empty result is preferred over false positives. Only return entities you are CERTAIN about.`;
}

export function buildRelationshipResolutionPrompt(request: RelationshipResolutionRequest): string {
  const entityList = request.entities.map((e, index) =>
    `[${index}] ${e.type}: "${e.value || e.name}"${e.existsInPlatform ? ' (exists in OpenCTI)' : ' (new)'}`
  ).join('\n');

  return `Analyze the page content and identify PRECISE STIX 2.1 relationships between the entities listed below.

PAGE TITLE: ${request.pageTitle}
PAGE URL: ${request.pageUrl}

ENTITIES (use index numbers in your response):
${entityList}

PAGE CONTENT:
${request.pageContent.substring(0, 10000)}

INSTRUCTIONS:
1. Carefully read the page content for evidence of relationships between the listed entities
2. For each relationship found, select the MOST PRECISE relationship type from STIX 2.1
3. Ensure the direction (from → to) is semantically correct
4. Only include relationships with clear textual evidence
5. Provide a specific reason citing the evidence
6. Include the exact text excerpt that supports the relationship

Return JSON in this EXACT format:
{
  "relationships": [
    {
      "fromIndex": 0,
      "toIndex": 1,
      "relationshipType": "uses",
      "confidence": "high",
      "reason": "The article explicitly states APT29 deployed SUNBURST in the SolarWinds attack",
      "excerpt": "APT29 deployed the SUNBURST backdoor through compromised SolarWinds updates"
    }
  ]
}

CONFIDENCE LEVELS:
- "high": Explicit statement in text (e.g., "APT29 uses Cobalt Strike")
- "medium": Strongly implied by context (e.g., malware and C2 IP mentioned together in attack description)
- "low": Reasonable inference from overall context (use sparingly)

CRITICAL: 
- Prefer specific relationship types over "related-to"
- Verify entity type compatibility before suggesting a relationship
- Direction matters: "Malware uses Attack-Pattern" NOT "Attack-Pattern uses Malware"
- If no confident relationships exist, return: {"relationships": []}

Quality over quantity - only include relationships you are confident about.`;
}
