/**
 * Scenario Message Handlers - Extracted from background/index.ts
 * 
 * These handlers process scenario-related messages for OpenAEV.
 * They are called directly from the main message handler switch statement.
 */

import { OpenAEVClient } from '../../shared/api/openaev-client';
import { successResponse, errorResponse } from '../../shared/utils/messaging';
import { loggers } from '../../shared/utils/logger';

const log = loggers.background;

type SendResponse = (response: unknown) => void;
type ClientGetter = (platformId?: string) => OpenAEVClient | undefined;

// Email injector contract ID (hardcoded in OpenAEV platform)
const EMAIL_INJECTOR_CONTRACT_ID = '138ad8f8-32f8-4a22-8114-aaa12322bd09';

/**
 * CREATE_SCENARIO handler
 */
export interface CreateScenarioPayload {
  name: string;
  description?: string;
  subtitle?: string;
  category?: string;
  mainFocus?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  platformId?: string;
}

export async function handleCreateScenario(
  payload: CreateScenarioPayload,
  sendResponse: SendResponse,
  getClient: ClientGetter
): Promise<void> {
  const { name, description, subtitle, category, mainFocus, severity, platformId } = payload;
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    const scenario = await client.createScenario({
      scenario_name: name,
      scenario_description: description,
      scenario_subtitle: subtitle,
      scenario_category: category,
      scenario_main_focus: mainFocus,
      scenario_severity: severity,
    });
    
    // Return with URL
    const url = client.getScenarioUrl(scenario.scenario_id);
    sendResponse({ success: true, data: { ...scenario, url } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create scenario',
    });
  }
}

/**
 * ADD_INJECT_TO_SCENARIO handler
 */
export interface AddInjectPayload {
  scenarioId: string;
  inject: {
    inject_title: string;
    inject_description?: string;
    inject_injector_contract: string;
    inject_content?: Record<string, unknown>;
    inject_depends_duration?: number;
    inject_teams?: string[];
    inject_assets?: string[];
    inject_asset_groups?: string[];
  };
  platformId?: string;
}

export async function handleAddInjectToScenario(
  payload: AddInjectPayload,
  sendResponse: SendResponse,
  getClient: ClientGetter
): Promise<void> {
  const { scenarioId, inject, platformId } = payload;
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    log.debug(` Adding inject to scenario ${scenarioId}:`, inject);
    const result = await client.addInjectToScenario(scenarioId, inject);
    log.debug(` Inject added result:`, result);
    sendResponse(successResponse(result));
  } catch (error) {
    log.error(` Failed to add inject to scenario:`, error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add inject to scenario',
    });
  }
}

/**
 * ADD_EMAIL_INJECT_TO_SCENARIO handler
 */
export interface AddEmailInjectPayload {
  platformId: string;
  scenarioId: string;
  title: string;
  description: string;
  subject: string;
  body: string;
  delayMinutes: number;
  teamId?: string;
}

export async function handleAddEmailInjectToScenario(
  payload: AddEmailInjectPayload,
  sendResponse: SendResponse,
  getClient: ClientGetter
): Promise<void> {
  const { platformId, scenarioId, title, description, subject, body, delayMinutes, teamId } = payload;
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    const injectPayload = {
      inject_title: title,
      inject_description: description,
      inject_injector_contract: EMAIL_INJECTOR_CONTRACT_ID,
      inject_depends_duration: delayMinutes * 60, // Convert to seconds
      inject_content: {
        subject: subject,
        body: body.includes('<') ? body : `<p>${body.replace(/\n/g, '</p><p>')}</p>`,
      },
      inject_teams: teamId ? [teamId] : undefined,
    };
    
    log.debug(` Adding email inject to scenario ${scenarioId}:`, injectPayload);
    const result = await client.addInjectToScenario(scenarioId, injectPayload);
    log.debug(` Email inject added:`, result);
    sendResponse(successResponse(result));
  } catch (error) {
    log.error(` Failed to add email inject to scenario:`, error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add email inject to scenario',
    });
  }
}

/**
 * ADD_TECHNICAL_INJECT_TO_SCENARIO handler
 */
export interface AddTechnicalInjectPayload {
  platformId: string;
  scenarioId: string;
  title: string;
  description: string;
  command: string;
  executor: string;
  platforms: string[];
  delayMinutes: number;
  assetId?: string;
  assetGroupId?: string;
}

export async function handleAddTechnicalInjectToScenario(
  payload: AddTechnicalInjectPayload,
  sendResponse: SendResponse,
  getClient: ClientGetter
): Promise<void> {
  const { platformId, scenarioId, title, description, command, executor, platforms, delayMinutes, assetId, assetGroupId } = payload;
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    // Map executor names to OpenAEV API values
    const executorMap: Record<string, string> = {
      'powershell': 'psh',
      'psh': 'psh',
      'cmd': 'cmd',
      'bash': 'bash',
      'sh': 'sh',
    };
    
    // Map platform names to OpenAEV API values (case-sensitive)
    const platformMap: Record<string, string> = {
      'windows': 'Windows',
      'linux': 'Linux',
      'macos': 'MacOS',
    };
    
    // First, create a payload for this inject
    const payloadData = {
      payload_type: 'Command' as const,
      payload_name: `AI Payload - ${title}`,
      payload_description: description,
      payload_platforms: platforms.map(p => platformMap[p.toLowerCase()] || p),
      payload_source: 'MANUAL' as const,
      payload_status: 'VERIFIED' as const,
      payload_execution_arch: 'ALL_ARCHITECTURES' as const,
      payload_expectations: ['PREVENTION', 'DETECTION'],
      payload_attack_patterns: [] as string[],
      command_executor: executorMap[executor.toLowerCase()] || executor,
      command_content: command,
    };
    
    log.debug(` Creating payload for technical inject:`, payloadData);
    const createdPayload = await client.createPayload(payloadData);
    
    if (!createdPayload?.payload_id) {
      log.error(` Failed to create payload, no payload_id returned`);
      sendResponse(errorResponse('Failed to create payload'));
      return;
    }
    
    log.debug(` Payload created:`, createdPayload.payload_id);
    
    // Find the injector contract for this payload
    const contractRes = await client.findInjectorContractByPayloadId(createdPayload.payload_id);
    
    if (!contractRes?.injector_contract_id) {
      log.warn(` No injector contract found for payload ${createdPayload.payload_id}, skipping inject`);
      sendResponse({ 
        success: true, 
        data: { 
          warning: 'Payload created but no matching injector contract found',
          payload_id: createdPayload.payload_id 
        } 
      });
      return;
    }
    
    // Create inject with the contract
    const injectPayload = {
      inject_title: title,
      inject_description: description,
      inject_injector_contract: contractRes.injector_contract_id,
      inject_depends_duration: delayMinutes * 60,
      inject_assets: assetId ? [assetId] : undefined,
      inject_asset_groups: assetGroupId ? [assetGroupId] : undefined,
    };
    
    log.debug(` Adding technical inject to scenario ${scenarioId}:`, injectPayload);
    const result = await client.addInjectToScenario(scenarioId, injectPayload);
    log.debug(` Technical inject added:`, result);
    sendResponse(successResponse(result));
  } catch (error) {
    log.error(` Failed to add technical inject to scenario:`, error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add technical inject to scenario',
    });
  }
}
