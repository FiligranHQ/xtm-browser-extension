/**
 * OpenAEV Message Handlers
 * 
 * Handles messages related to OpenAEV operations:
 * - Attack patterns and kill chain phases
 * - Assets, asset groups, and teams
 * - Payloads and injector contracts
 * - Scenarios and injects
 * - Atomic testing
 */

import { type MessageHandler, successResponse, errorResponse } from './types';
import {
  getOpenAEVClients,
  getFirstOpenAEVClient,
  hasOpenAEVClients,
} from '../services/client-manager';
import { loggers } from '../../shared/utils/logger';

const log = loggers.background;

// Timeout constants
const ENTITY_FETCH_TIMEOUT_MS = 15000;
const SEARCH_TIMEOUT_MS = 10000;

/**
 * Helper to get OpenAEV client for a platform
 */
function getClient(platformId?: string) {
  const clients = getOpenAEVClients();
  return platformId ? clients.get(platformId) : getFirstOpenAEVClient();
}

/**
 * Fetch attack patterns handler
 */
export const handleFetchAttackPatterns: MessageHandler = async (payload, sendResponse) => {
  const { platformId } = (payload || {}) as { platformId?: string };
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    const attackPatterns = await client.getAllAttackPatterns();
    sendResponse(successResponse(attackPatterns));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch attack patterns',
    });
  }
};

/**
 * Search attack patterns handler
 */
export const handleSearchAttackPatterns: MessageHandler = async (payload, sendResponse) => {
  const { searchTerm, platformId } = payload as {
    searchTerm: string;
    platformId?: string;
  };
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    // Get all attack patterns and filter by search term
    const allAttackPatterns = await client.getAllAttackPatterns();
    const searchLower = searchTerm.toLowerCase();
    const attackPatterns = allAttackPatterns.filter((ap: { attack_pattern_name?: string; attack_pattern_external_id?: string }) => 
      ap.attack_pattern_name?.toLowerCase().includes(searchLower) ||
      ap.attack_pattern_external_id?.toLowerCase().includes(searchLower)
    );
    sendResponse(successResponse(attackPatterns));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search attack patterns',
    });
  }
};

/**
 * Fetch kill chain phases handler
 */
export const handleFetchKillChainPhases: MessageHandler = async (payload, sendResponse) => {
  const { platformId } = (payload || {}) as { platformId?: string };
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    const phases = await client.getKillChainPhases();
    sendResponse(successResponse(phases));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch kill chain phases',
    });
  }
};

/**
 * Fetch injector contracts handler
 */
export const handleFetchInjectorContracts: MessageHandler = async (payload, sendResponse) => {
  const { platformId, attackPatternId } = (payload || {}) as {
    platformId?: string;
    attackPatternId?: string;
  };
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    log.debug('[FETCH_INJECTOR_CONTRACTS] Fetching contracts...');
    const contracts = await client.searchInjectorContracts(attackPatternId);
    log.debug('[FETCH_INJECTOR_CONTRACTS] Contracts found:', contracts.length);
    log.debug('[FETCH_INJECTOR_CONTRACTS] Sample:', contracts.slice(0, 3));
    
    sendResponse(successResponse(contracts));
  } catch (error) {
    log.error('[FETCH_INJECTOR_CONTRACTS] Failed:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch injector contracts',
    });
  }
};

/**
 * Fetch assets handler
 */
export const handleFetchOAEVAssets: MessageHandler = async (payload, sendResponse) => {
  const { platformId } = (payload || {}) as { platformId?: string };
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    const assets = await client.getAllAssets();
    sendResponse(successResponse(assets));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch assets',
    });
  }
};

/**
 * Fetch asset groups handler
 */
export const handleFetchOAEVAssetGroups: MessageHandler = async (payload, sendResponse) => {
  const { platformId } = (payload || {}) as { platformId?: string };
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    const groups = await client.getAllAssetGroups();
    sendResponse(successResponse(groups));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch asset groups',
    });
  }
};

/**
 * Fetch teams handler
 */
export const handleFetchOAEVTeams: MessageHandler = async (payload, sendResponse) => {
  const { platformId } = (payload || {}) as { platformId?: string };
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    const teams = await client.getAllTeams();
    sendResponse(successResponse(teams));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch teams',
    });
  }
};

/**
 * Create payload handler
 */
export const handleCreateOAEVPayload: MessageHandler = async (payload, sendResponse) => {
  const { hostname, name, platforms, attackPatternIds, platformId, payload: payloadData } = payload as {
    hostname?: string;
    name?: string;
    platforms?: string[];
    attackPatternIds?: string[];
    platformId?: string;
    payload?: {
      payload_type: 'Command' | 'Executable' | 'FileDrop' | 'DnsResolution' | 'NetworkTraffic';
      payload_name: string;
      payload_description?: string;
      payload_platforms: string[];
      payload_source?: string;
      payload_status?: string;
      payload_execution_arch?: string;
      payload_expectations?: string[];
      payload_attack_patterns?: string[];
      command_executor?: string;
      command_content?: string;
      payload_cleanup_executor?: string | null;
      payload_cleanup_command?: string | null;
      dns_resolution_hostname?: string;
    };
  };
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    let createdPayload;
    
    if (payloadData) {
      createdPayload = await client.createPayload(payloadData);
    } else if (hostname && name && platforms) {
      createdPayload = await client.createDnsResolutionPayload({
        hostname,
        name,
        platforms,
        attackPatternIds,
      });
    } else {
      sendResponse(errorResponse('Invalid payload data: missing required fields'));
      return;
    }
    
    sendResponse(successResponse(createdPayload));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create payload',
    });
  }
};

/**
 * Fetch payload handler
 */
export const handleFetchOAEVPayload: MessageHandler = async (payload, sendResponse) => {
  const { payloadId, platformId } = payload as {
    payloadId: string;
    platformId?: string;
  };
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    const payloadResult = await client.getPayload(payloadId);
    sendResponse(successResponse(payloadResult));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch payload',
    });
  }
};

/**
 * Find DNS resolution payload handler
 */
export const handleFindDnsResolutionPayload: MessageHandler = async (payload, sendResponse) => {
  const { hostname, platformId } = payload as {
    hostname: string;
    platformId?: string;
  };
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    const existingPayload = await client.findDnsResolutionPayloadByHostname(hostname);
    sendResponse(existingPayload ? successResponse(existingPayload) : { success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search for DNS resolution payload',
    });
  }
};

/**
 * Find injector contract by payload handler
 */
export const handleFindInjectorContractByPayload: MessageHandler = async (payload, sendResponse) => {
  const { payloadId, platformId } = payload as {
    payloadId: string;
    platformId?: string;
  };
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    const contract = await client.findInjectorContractByPayloadId(payloadId);
    if (contract) {
      sendResponse(successResponse(contract));
    } else {
      sendResponse({
        success: false,
        error: 'No injector contract found for this payload',
      });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to find injector contract',
    });
  }
};

/**
 * Create atomic testing handler
 */
export const handleCreateAtomicTesting: MessageHandler = async (payload, sendResponse) => {
  const { title, description, injectorContractId, content, assetIds, assetGroupIds, platformId } = payload as {
    title: string;
    description?: string;
    injectorContractId: string;
    content?: Record<string, unknown>;
    assetIds?: string[];
    assetGroupIds?: string[];
    platformId?: string;
  };
  
  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }
    
    const atomicTesting = await client.createAtomicTesting({
      title,
      description,
      injectorContractId,
      content,
      assetIds,
      assetGroupIds,
    });
    
    const url = client.getAtomicTestingUrl(atomicTesting.inject_id);
    sendResponse({ success: true, data: { ...atomicTesting, url } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create atomic testing',
    });
  }
};

/**
 * Create scenario handler
 */
export const handleCreateScenario: MessageHandler = async (payload, sendResponse) => {
  const { name, description, subtitle, category, platformId } = payload as {
    name: string;
    description?: string;
    subtitle?: string;
    category?: string;
    platformId?: string;
  };
  
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
    });
    
    const url = client.getScenarioUrl(scenario.scenario_id);
    sendResponse({ success: true, data: { ...scenario, url } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create scenario',
    });
  }
};

/**
 * Add inject to scenario handler
 */
export const handleAddInjectToScenario: MessageHandler = async (payload, sendResponse) => {
  const { scenarioId, inject, platformId } = payload as {
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
  };
  
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
};

/**
 * Add email inject to scenario handler
 */
export const handleAddEmailInjectToScenario: MessageHandler = async (payload, sendResponse) => {
  const EMAIL_INJECTOR_CONTRACT_ID = '138ad8f8-32f8-4a22-8114-aaa12322bd09';
  
  const { platformId, scenarioId, title, description, subject, body, delayMinutes, teamId } = payload as {
    platformId: string;
    scenarioId: string;
    title: string;
    description: string;
    subject: string;
    body: string;
    delayMinutes: number;
    teamId?: string;
  };
  
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
      inject_depends_duration: delayMinutes * 60,
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
};

/**
 * Search OpenAEV handler
 */
export const handleSearchOAEV: MessageHandler = async (payload, sendResponse) => {
  if (!hasOpenAEVClients()) {
    sendResponse(errorResponse('Not configured'));
    return;
  }

  const { searchTerm, platformId } = payload as {
    searchTerm: string;
    platformId?: string;
  };

  const openAEVClients = getOpenAEVClients();

  try {
    const clientsToSearch = platformId
      ? [[platformId, openAEVClients.get(platformId)] as const].filter(([_, c]) => c)
      : Array.from(openAEVClients.entries());

    const searchPromises = clientsToSearch.map(async ([pId, client]) => {
      if (!client) return { platformId: pId, results: [] };

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), SEARCH_TIMEOUT_MS)
        );
        const searchResult = await Promise.race([
          client.fullTextSearch(searchTerm),
          timeoutPromise
        ]);

        const results: unknown[] = [];
        const platformInfo = client.getPlatformInfo();

        for (const [className, data] of Object.entries(searchResult)) {
          if (data && (data as { count: number }).count > 0) {
            const classResults = await client.fullTextSearchByClass(className, {
              textSearch: searchTerm,
              page: 0,
              size: 20,
            });

            results.push(...classResults.content.map((r: unknown) => ({
              ...(r as object),
              _platformId: pId,
              _platform: platformInfo,
              _entityClass: className,
            })));
          }
        }

        return { platformId: pId, results };
      } catch (e) {
        log.warn(`OAEV Search timeout/error for platform ${pId}:`, e);
        return { platformId: pId, results: [] };
      }
    });

    const searchResults = await Promise.all(searchPromises);
    const allResults = searchResults.flatMap(r => r.results);

    sendResponse(successResponse(allResults));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'OAEV Search failed',
    });
  }
};

/**
 * Get OpenAEV entity details handler
 */
export const handleGetOAEVEntityDetails: MessageHandler = async (payload, sendResponse) => {
  const { entityId, entityType, platformId: requestedPlatformId } = payload as {
    entityId: string;
    entityType: string;
    platformId: string;
  };

  const openAEVClients = getOpenAEVClients();
  const client = openAEVClients.get(requestedPlatformId);
  
  if (!client) {
    sendResponse(errorResponse('OpenAEV platform not found'));
    return;
  }

  try {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ENTITY_FETCH_TIMEOUT_MS)
    );

    await client.ensureTagsCached();

    const normalizedEntityType = entityType.replace(/^oaev-/, '');
    if (normalizedEntityType === 'AttackPattern') {
      await Promise.all([
        client.ensureKillChainPhasesCached(),
        client.ensureAttackPatternsCached(),
      ]);
    }

    const entity = await Promise.race([
      client.getEntityById(entityId, entityType),
      timeoutPromise
    ]) as Record<string, unknown> | null;

    if (entity) {
      // Resolve tags if present
      const tagFields = ['asset_tags', 'endpoint_tags', 'team_tags', 'asset_group_tags', 'scenario_tags', 'exercise_tags'];
      for (const field of tagFields) {
        if (entity[field] && Array.isArray(entity[field])) {
          entity[`${field}_resolved`] = client.resolveTagIds(entity[field] as string[]);
        }
      }

      // For AttackPattern: resolve kill chain phase IDs and parent technique ID
      if (normalizedEntityType === 'AttackPattern') {
        if (entity.attack_pattern_kill_chain_phases && Array.isArray(entity.attack_pattern_kill_chain_phases)) {
          entity.attack_pattern_kill_chain_phases_resolved = client.resolveKillChainPhaseIds(entity.attack_pattern_kill_chain_phases as string[]);
        }
        if (entity.attack_pattern_parent) {
          entity.attack_pattern_parent_resolved = client.resolveAttackPatternId(entity.attack_pattern_parent as string);
        }
      }

      sendResponse({
        success: true,
        data: {
          ...entity,
          _platformId: requestedPlatformId,
          _platformType: 'openaev',
          _entityType: entityType,
        }
      });
    } else {
      sendResponse(errorResponse('Entity not found'));
    }
  } catch (error) {
    log.error(`Failed to fetch OpenAEV entity ${entityId}:`, error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch entity',
    });
  }
};

/**
 * Search assets handler
 */
export const handleSearchAssets: MessageHandler = async (payload, sendResponse) => {
  const { searchTerm, platformId } = payload as {
    searchTerm: string;
    platformId?: string;
  };

  const openAEVClients = getOpenAEVClients();

  try {
    const results: unknown[] = [];

    const clientsToSearch = platformId
      ? [openAEVClients.get(platformId)].filter(Boolean)
      : Array.from(openAEVClients.values());

    for (const client of clientsToSearch) {
      if (client) {
        const [assets, groups] = await Promise.all([
          client.searchAssets(searchTerm),
          client.searchAssetGroups(searchTerm),
        ]);

        const platformInfo = client.getPlatformInfo();

        results.push(
          ...assets.map(a => ({ ...a, _platform: platformInfo, _type: 'Asset' })),
          ...groups.map(g => ({ ...g, _platform: platformInfo, _type: 'AssetGroup' }))
        );
      }
    }

    sendResponse(successResponse(results));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Asset search failed',
    });
  }
};

/**
 * Fetch scenario overview handler
 */
export const handleFetchScenarioOverview: MessageHandler = async (payload, sendResponse) => {
  const { attackPatternIds, platformId } = payload as {
    attackPatternIds: string[];
    platformId?: string;
  };

  log.debug('[FETCH_SCENARIO_OVERVIEW] Attack pattern IDs:', attackPatternIds);

  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }

    // Fetch all contracts once
    const allContracts = await client.searchInjectorContracts();
    log.debug('[FETCH_SCENARIO_OVERVIEW] Total contracts fetched:', allContracts.length);

    // Get all kill chain phases for reference
    const killChainPhases = await client.getKillChainPhases();

    // Create a map of phase ID to phase info
    const phaseIdToInfo = new Map<string, { name: string; killChainName: string; order: number }>();
    killChainPhases.forEach((phase: { phase_id?: string; phase_name?: string; phase_kill_chain_name?: string; phase_order?: number }) => {
      if (phase.phase_id) {
        phaseIdToInfo.set(phase.phase_id, {
          name: phase.phase_name || '',
          killChainName: phase.phase_kill_chain_name || '',
          order: phase.phase_order || 0,
        });
      }
    });

    // Fetch attack patterns with full details
    const attackPatterns = await Promise.all(
      attackPatternIds.map(async (id) => {
        log.debug('[FETCH_SCENARIO_OVERVIEW] Fetching attack pattern:', id);
        const ap = await client.getAttackPattern(id);
        log.debug('[FETCH_SCENARIO_OVERVIEW] Attack pattern data:', ap);

        const attackPatternUuid = ap?.attack_pattern_id || id;

        // Filter contracts that have this attack pattern
        const contracts = allContracts.filter((contract: { injector_contract_attack_patterns?: string[] }) => {
          const contractApIds: string[] = contract.injector_contract_attack_patterns || [];
          return contractApIds.includes(attackPatternUuid) || contractApIds.includes(id);
        });

        log.debug('[FETCH_SCENARIO_OVERVIEW] Contracts for', ap?.attack_pattern_name || id,
          '(uuid:', attackPatternUuid, '):', contracts.length);

        // Resolve kill chain phase IDs to phase names
        const rawKillChainPhases: string[] = ap?.attack_pattern_kill_chain_phases || [];
        const resolvedKillChainPhases = rawKillChainPhases.map(phaseId => {
          const phaseInfo = phaseIdToInfo.get(phaseId);
          return phaseInfo?.name || phaseId;
        }).filter(name => name && name.length > 0);

        return {
          id: attackPatternUuid,
          name: ap?.attack_pattern_name || 'Unknown',
          externalId: ap?.attack_pattern_external_id || '',
          description: ap?.attack_pattern_description || '',
          killChainPhases: resolvedKillChainPhases,
          contracts,
        };
      })
    );

    log.debug('[FETCH_SCENARIO_OVERVIEW] Final attack patterns with contracts:',
      attackPatterns.map(ap => ({ name: ap.name, contractCount: ap.contracts.length })));

    sendResponse(successResponse({
      attackPatterns,
      killChainPhases,
    }));
  } catch (error) {
    log.error('[FETCH_SCENARIO_OVERVIEW] Error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch scenario overview',
    });
  }
};

/**
 * Fetch injector contracts for attack patterns handler
 */
export const handleFetchInjectorContractsForAttackPatterns: MessageHandler = async (payload, sendResponse) => {
  const { attackPatternIds, platformId } = payload as {
    attackPatternIds: string[];
    platformId?: string;
  };

  try {
    const client = getClient(platformId);
    if (!client) {
      sendResponse(errorResponse('OpenAEV not configured'));
      return;
    }

    const contractsMap = await client.getInjectorContractsForAttackPatterns(attackPatternIds);
    // Convert Map to plain object for serialization
    const contractsObj: Record<string, unknown[]> = {};
    contractsMap.forEach((contracts, apId) => {
      contractsObj[apId] = contracts;
    });
    sendResponse(successResponse(contractsObj));
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch injector contracts',
    });
  }
};

/**
 * Export all OpenAEV handlers
 */
export const openaevHandlers: Record<string, MessageHandler> = {
  FETCH_ATTACK_PATTERNS: handleFetchAttackPatterns,
  SEARCH_ATTACK_PATTERNS: handleSearchAttackPatterns,
  FETCH_KILL_CHAIN_PHASES: handleFetchKillChainPhases,
  FETCH_INJECTOR_CONTRACTS: handleFetchInjectorContracts,
  FETCH_OAEV_ASSETS: handleFetchOAEVAssets,
  FETCH_OAEV_ASSET_GROUPS: handleFetchOAEVAssetGroups,
  FETCH_OAEV_TEAMS: handleFetchOAEVTeams,
  CREATE_OAEV_PAYLOAD: handleCreateOAEVPayload,
  FETCH_OAEV_PAYLOAD: handleFetchOAEVPayload,
  FIND_DNS_RESOLUTION_PAYLOAD: handleFindDnsResolutionPayload,
  FIND_INJECTOR_CONTRACT_BY_PAYLOAD: handleFindInjectorContractByPayload,
  CREATE_ATOMIC_TESTING: handleCreateAtomicTesting,
  CREATE_SCENARIO: handleCreateScenario,
  ADD_INJECT_TO_SCENARIO: handleAddInjectToScenario,
  ADD_EMAIL_INJECT_TO_SCENARIO: handleAddEmailInjectToScenario,
  SEARCH_OAEV: handleSearchOAEV,
  GET_OAEV_ENTITY_DETAILS: handleGetOAEVEntityDetails,
  SEARCH_ASSETS: handleSearchAssets,
  FETCH_SCENARIO_OVERVIEW: handleFetchScenarioOverview,
  FETCH_INJECTOR_CONTRACTS_FOR_ATTACK_PATTERNS: handleFetchInjectorContractsForAttackPatterns,
};

