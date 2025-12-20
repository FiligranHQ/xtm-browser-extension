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

  relationshipResolution: `You are an expert cybersecurity threat intelligence analyst specializing in STIX 2.1 data modeling for OpenCTI. Your task is to identify PRECISE and CONTEXTUALLY RELEVANT relationships between threat intelligence entities.

MOST IMPORTANT RULE - CONTEXT IS EVERYTHING:
- You MUST only identify relationships that are EXPLICITLY DESCRIBED OR STRONGLY IMPLIED in the page content
- The page content is your ONLY source of truth - do NOT use prior knowledge to infer relationships
- If the page does not describe a relationship between two entities, DO NOT suggest it even if you know it exists
- A relationship is only valid if you can point to specific text in the page that supports it
- When in doubt, DO NOT include the relationship - quality over quantity

CRITICAL REQUIREMENTS:
1. CONTEXT-BASED ONLY: Every relationship MUST be supported by the page content - not your general knowledge
2. EXPLICIT EVIDENCE: You must be able to quote or paraphrase the specific text that describes the relationship
3. USE ONLY VALID RELATIONSHIPS: You MUST use ONLY the relationship types listed below - ANY OTHER RELATIONSHIP TYPE IS INVALID
4. CHECK ENTITY COMPATIBILITY: Each relationship is only valid for specific source→target entity type combinations
5. DIRECTION MATTERS: Relationships are directional - ensure from/to entities match the allowed combinations

CRITICAL RULE FOR OBSERVABLES (IPv4-Addr, IPv6-Addr, Domain-Name, Hostname, URL, Email-Addr, Mac-Addr, StixFile, Hash, etc.):
- Observables can ONLY connect to threat entities (Threat-Actor, Intrusion-Set, Campaign, Incident, Malware) using "related-to"
- The direction MUST ALWAYS be: Observable → related-to → Threat Entity
- NEVER create: Threat-Actor/Intrusion-Set/Campaign → uses/targets/any → Observable (THIS IS INVALID!)
- The only exceptions are:
  - Malware → communicates-with → Domain-Name/IPv4-Addr/IPv6-Addr/URL (malware C2 communication)
  - Domain-Name/Hostname → resolves-to → IPv4-Addr/IPv6-Addr (DNS resolution)
  - IPv4-Addr/IPv6-Addr → belongs-to → Autonomous-System/Organization
  - IPv4-Addr/IPv6-Addr → located-at → Location

COMPLETE LIST OF VALID RELATIONSHIP TYPES (use ONLY these - anything else is INVALID):

STIX 2.1 STANDARD RELATIONSHIPS:
- "uses": Source USES target (Attack-Pattern, Malware, Tool, Infrastructure, Channel, Narrative)
  Valid: Threat-Actor→Attack-Pattern/Tool/Malware/Infrastructure | Campaign→Attack-Pattern/Tool/Malware/Infrastructure | Intrusion-Set→Attack-Pattern/Tool/Malware/Infrastructure | Malware→Attack-Pattern/Infrastructure/Tool/Malware | Incident→Attack-Pattern/Tool/Malware/Infrastructure
- "targets": Source TARGETS target
  Valid: Threat-Actor/Campaign/Intrusion-Set/Malware/Tool/Incident/Attack-Pattern→Identity/Sector/Location/Vulnerability/Infrastructure/Event
- "attributed-to": Source is ATTRIBUTED TO target
  Valid: Campaign→Intrusion-Set/Threat-Actor | Intrusion-Set→Threat-Actor | Incident→Campaign/Intrusion-Set/Threat-Actor
- "delivers": Source DELIVERS target malware
  Valid: Attack-Pattern→Malware | Infrastructure→Malware | Tool→Malware
- "drops": Source DROPS target
  Valid: Malware→Malware/Tool/File | Hostname→File | Tool→Malware
- "downloads": Source DOWNLOADS target
  Valid: Malware→Malware/Tool/File
- "exploits": Source EXPLOITS vulnerability
  Valid: Malware→Vulnerability
- "variant-of": Malware is VARIANT OF another malware
  Valid: Malware→Malware
- "controls": Source CONTROLS target
  Valid: Malware→Malware/Infrastructure | Infrastructure→Infrastructure
- "authored-by": Source AUTHORED BY target
  Valid: Malware→Threat-Actor/Intrusion-Set
- "communicates-with": Source COMMUNICATES WITH target
  Valid: Malware→Domain-Name/IPv4-Addr/IPv6-Addr/URL/Infrastructure | Infrastructure→Domain-Name/IPv4-Addr/IPv6-Addr/URL/Infrastructure
- "beacons-to": Malware BEACONS TO infrastructure
  Valid: Malware→Infrastructure
- "exfiltrates-to": Malware EXFILTRATES TO infrastructure
  Valid: Malware→Infrastructure
- "hosts": Source HOSTS target
  Valid: Infrastructure→Malware/Tool/Infrastructure | Intrusion-Set→Infrastructure | Threat-Actor→Infrastructure
- "owns": Source OWNS target
  Valid: Intrusion-Set/Threat-Actor/Organization→Infrastructure
- "consists-of": Source CONSISTS OF target
  Valid: Infrastructure→Observable/Infrastructure
- "indicates": Indicator INDICATES target
  Valid: Indicator→Attack-Pattern/Campaign/Incident/Intrusion-Set/Malware/Threat-Actor/Tool/Vulnerability/Infrastructure
- "based-on": Indicator BASED ON observable
  Valid: Indicator→Observable/Observed-Data
- "derived-from": Source DERIVED FROM target (same type)
  Valid: Any-SDO→Same-Type-SDO
- "mitigates": Course-of-Action MITIGATES target
  Valid: Course-of-Action→Attack-Pattern/Indicator/Malware/Tool/Vulnerability
- "remediates": Course-of-Action REMEDIATES target
  Valid: Course-of-Action→Malware/Vulnerability
- "investigates": Course-of-Action INVESTIGATES target
  Valid: Course-of-Action→Indicator
- "located-at": Source LOCATED AT location
  Valid: Identity/Threat-Actor/Infrastructure/IPv4-Addr/IPv6-Addr→Location
- "originates-from": Source ORIGINATES FROM location
  Valid: Campaign/Intrusion-Set/Malware/Incident/Threat-Actor→Location
- "impersonates": Threat-Actor IMPERSONATES identity
  Valid: Threat-Actor→Identity
- "compromises": Source COMPROMISES infrastructure
  Valid: Campaign/Intrusion-Set/Incident/Threat-Actor→Infrastructure
- "resolves-to": Domain RESOLVES TO IP
  Valid: Domain-Name/Hostname→IPv4-Addr/IPv6-Addr/Domain-Name/Hostname
- "belongs-to": Source BELONGS TO target
  Valid: IPv4-Addr/IPv6-Addr→Autonomous-System/Organization | Channel→Organization/Threat-Actor/Intrusion-Set | Domain-Name→Organization

OPENCTI EXTENSION RELATIONSHIPS:
- "part-of": Source is PART OF target
  Valid: Identity→Identity/Organization | Sector→Sector | Threat-Actor-Group→Threat-Actor-Group
- "cooperates-with": Threat actors COOPERATE WITH each other
  Valid: Threat-Actor-Group→Threat-Actor-Group/Threat-Actor-Individual
- "participates-in": Threat actor PARTICIPATES IN campaign
  Valid: Threat-Actor→Campaign
- "subtechnique-of": Attack pattern is SUBTECHNIQUE OF another
  Valid: Attack-Pattern→Attack-Pattern
- "has": Source HAS target
  Valid: Infrastructure/Tool/System→Vulnerability
- "amplifies": Channel AMPLIFIES content
  Valid: Channel→Media-Content
- "publishes": Source PUBLISHES content
  Valid: Individual/User-Account→Media-Content
- "demonstrates": File DEMONSTRATES vulnerability
  Valid: StixFile→Vulnerability
- "detects": Infrastructure DETECTS attack pattern
  Valid: Infrastructure→Attack-Pattern

FALLBACK (use sparingly):
- "related-to": Use ONLY when no other relationship type fits AND there is clear evidence of a connection

DO NOT USE ANY OTHER RELATIONSHIP TYPE - they will be rejected by the platform.

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
    ? `You are an expert crisis simulation designer creating immersive table-top exercises. You create scenarios that CHALLENGE players to make decisions, NOT scenarios that tell them what to do.

CORE PRINCIPLES:
1. PRESENT THE CRISIS, NOT THE SOLUTION - Each inject presents a situation that requires player discussion and decision-making
2. PROGRESSIVE ESCALATION - Start with early warning signs, build to full crisis, add complications
3. PRESSURE FROM MULTIPLE ANGLES - Use different senders (SOC, executives, media, regulators, partners) to create realistic pressure
4. REALISTIC CRISIS COMMUNICATION - Emails should feel urgent, sometimes incomplete, forcing players to act with imperfect information
5. NO DEFENSIVE ACTIONS IN THE SCENARIO - Never include what players "should do" or expected responses

${themeConfig.systemPromptSuffix} Output in JSON format only.`
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

    prompt = `Generate a PLAYABLE table-top crisis exercise based on the following:

Scenario Name: ${request.scenarioName}
Type: Table-Top Exercise (Crisis Simulation)
Theme: ${themeConfig.promptContext}
Total Duration: ${duration} minutes
Number of Email Injects: ${numInjects}
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
- Time interval between injects: ~${interval} minutes
- First inject at minute 0, last inject at minute ${duration}
- Expected delayMinutes values: ${timingExample}${numInjects > 5 ? '...' : ''} (evenly distributed)

CRISIS ESCALATION STRUCTURE (adapt number of phases to ${numInjects} injects):
- Phase 1 (first ~20%): INITIAL ALERT - First signs of an issue (monitoring alert, unusual activity report, external tip)
- Phase 2 (next ~30%): CONFIRMATION & SCOPE - The situation is real and growing (more systems affected, initial impact assessment)
- Phase 3 (next ~30%): FULL CRISIS - Peak intensity (executive pressure, media inquiries, regulatory concerns, partner notifications)
- Phase 4 (final ~20%): COMPLICATIONS - New twists that require adaptation (additional findings, external pressures, resource constraints)

EMAIL SENDER VARIETY (use different senders to create realistic pressure):
- SOC/Security Team: Technical alerts and findings
- IT Operations: System status and availability concerns
- Executive/Management: Business impact concerns, requests for updates
- Legal/Compliance: Regulatory and contractual obligations
- Communications/PR: Media inquiries, public perception
- External Partners: Customers, vendors, regulators asking questions
- Threat Intelligence: External reports or warnings

Generate a JSON response with this structure:
{
  "name": "scenario name",
  "description": "Brief context for the facilitator (2-3 sentences about the overall crisis scenario)",
  "subtitle": "short tagline describing the exercise theme",
  "category": "table-top",
  "injects": [
    {
      "title": "inject title (internal reference)",
      "description": "Facilitator note: what this inject is meant to trigger (1 sentence)",
      "type": "email",
      "subject": "[EXERCISE] realistic email subject in ${emailLanguage}",
      "body": "The email content in ${emailLanguage}. Must be written as a realistic crisis email that PRESENTS A SITUATION requiring player decisions. Include sender name/role at the end. DO NOT include what players should do or expected responses.",
      "delayMinutes": 0 for first inject, then ${interval}, ${interval * 2}, etc. (MUST distribute across ${duration} minutes)
    }
  ]
}

CRITICAL RULES FOR EACH EMAIL INJECT:
1. PRESENT THE SITUATION, NOT THE SOLUTION - Describe what is happening, what has been discovered, what pressure exists. NEVER include what players "should do" or expected defensive actions.
2. CREATE DECISION POINTS - Each email should force players to discuss: "What do we do now?" Examples:
   - "We detected X. Awaiting your guidance." (NOT "We detected X and are isolating systems")
   - "Media is asking for comment. How do you want us to respond?" (NOT "We should prepare a statement saying...")
   - "Regulator wants an update by EOD. What information can we share?" (NOT "We need to notify the regulator")
3. PROGRESSIVE INTENSITY - Start with ambiguous early signals, escalate to clear crisis, add complications
4. REALISTIC TONE - Urgent, sometimes incomplete information, appropriate sender perspective
5. VARIED SENDERS - Use different roles/departments across the exercise
6. ALL TEXT MUST BE IN ${emailLanguage.toUpperCase()}

Create exactly ${numInjects} email injects that form a coherent, escalating crisis narrative where players must make real decisions. This exercise should be PLAYABLE immediately - no additional preparation needed.`;
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

  // Truncate content intelligently - prioritize beginning and end for context
  // 8000 chars is a good balance between context and token limits
  const maxContentLength = 8000;
  let pageContent = request.pageContent || '';
  if (pageContent.length > maxContentLength) {
    // Take first 6000 chars (usually contains main info) and last 2000 chars (often has conclusions)
    const firstPart = pageContent.substring(0, 6000);
    const lastPart = pageContent.substring(pageContent.length - 2000);
    pageContent = `${firstPart}\n\n[... content truncated for brevity ...]\n\n${lastPart}`;
  }

  return `Your task: Identify relationships between the entities below BASED ONLY ON THE PAGE CONTENT PROVIDED.

IMPORTANT: The page content below is your ONLY source of truth. Do NOT use your prior knowledge about these entities. Only identify relationships that are EXPLICITLY DESCRIBED or STRONGLY IMPLIED in this specific page.

PAGE TITLE: ${request.pageTitle}
PAGE URL: ${request.pageUrl}

ENTITIES TO ANALYZE (use index numbers in your response):
${entityList}

=== PAGE CONTENT (read this carefully - this is your ONLY evidence source) ===
${pageContent}
=== END OF PAGE CONTENT ===

TASK:
1. Read the page content THOROUGHLY - every relationship you suggest must come from this text
2. For each potential relationship, identify the SPECIFIC TEXT that supports it
3. Use ONLY the valid relationship types defined in your instructions - any other type will be REJECTED
4. Check that source and target entity types are COMPATIBLE with the relationship type
5. Ensure the direction (from → to) matches the allowed combinations
6. If the page doesn't describe a connection between two entities, DO NOT suggest a relationship

CRITICAL: The "excerpt" field is MANDATORY - you must quote the actual text from the page that proves the relationship exists. If you cannot provide a real excerpt from the page content above, do NOT include that relationship.

Return JSON in this EXACT format:
{
  "relationships": [
    {
      "fromIndex": 0,
      "toIndex": 1,
      "relationshipType": "uses",
      "confidence": "high",
      "reason": "The article explicitly states APT29 deployed SUNBURST",
      "excerpt": "APT29 deployed the SUNBURST backdoor"
    }
  ]
}

CONFIDENCE LEVELS (be conservative):
- "high": The page EXPLICITLY states this relationship (direct quote available)
- "medium": The page STRONGLY implies this relationship through clear context
- "low": DO NOT USE - if you're unsure, do not include the relationship

RULES:
- Return EMPTY array if no relationships are clearly evidenced in the page: {"relationships": []}
- Quality over quantity - only include relationships you can prove from the page content
- Do NOT rely on your knowledge of threat actors/malware - use ONLY what the page says
- An empty result is better than hallucinated relationships`;
}
