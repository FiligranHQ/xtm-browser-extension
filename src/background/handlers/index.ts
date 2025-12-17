/**
 * Background Message Handlers
 * 
 * Central export for all message handler modules
 */

export * from './types';
export { openctiHandlers } from './opencti-handlers';
export { openaevHandlers } from './openaev-handlers';
export { aiHandlers } from './message-ai-handlers';
export { cacheHandlers } from './cache-handlers';
export { scanHandlers, scanForOAEVEntities, mergeScanResults } from './scan-handlers';
export { settingsHandlers, type SettingsHandlerDependencies } from './settings-handlers';
export { miscHandlers } from './misc-handlers';

// Re-export individual handlers for direct use
export { 
  handleGetEntityDetails,
  handleSearchEntities,
  handleCreateEntity,
  handleCreateObservablesBulk,
  handleFetchLabels,
  handleFetchMarkings,
  handleFetchVocabulary,
  handleFetchIdentities,
  handleFetchEntityContainers,
  handleFindContainersByUrl,
  handleCreateWorkbench,
  handleGetLabelsAndMarkings,
} from './opencti-handlers';

export {
  handleFetchAttackPatterns,
  handleSearchAttackPatterns,
  handleFetchKillChainPhases,
  handleFetchInjectorContracts,
  handleFetchOAEVAssets,
  handleFetchOAEVAssetGroups,
  handleFetchOAEVTeams,
  handleCreateOAEVPayload,
  handleFetchOAEVPayload,
  handleFindDnsResolutionPayload,
  handleFindInjectorContractByPayload,
  handleCreateAtomicTesting,
  handleCreateScenario,
  handleAddInjectToScenario,
  handleAddEmailInjectToScenario,
  handleSearchOAEV,
  handleGetOAEVEntityDetails,
  handleSearchAssets,
  handleFetchScenarioOverview,
  handleFetchInjectorContractsForAttackPatterns,
} from './openaev-handlers';

export {
  handleAICheckStatus,
  handleAITestAndFetchModels,
  handleAIGenerateDescription,
  handleAIGenerateScenario,
  handleAIGenerateFullScenario,
  handleAIGenerateAtomicTest,
  handleAIGenerateEmails,
  handleAIDiscoverEntities,
  handleAIResolveRelationships,
} from './message-ai-handlers';

export {
  handleClearOCTICache,
  handleClearOAEVCache,
} from './cache-handlers';

/**
 * Create a combined handler registry from all handler modules
 */
import { openctiHandlers } from './opencti-handlers';
import { openaevHandlers } from './openaev-handlers';
import { aiHandlers } from './message-ai-handlers';
import { cacheHandlers } from './cache-handlers';
import { miscHandlers } from './misc-handlers';
import type { MessageHandler } from './types';

export function createHandlerRegistry(): Map<string, MessageHandler> {
  const registry = new Map<string, MessageHandler>();
  
  // Add all handlers to registry
  for (const [type, handler] of Object.entries(openctiHandlers)) {
    registry.set(type, handler);
  }
  for (const [type, handler] of Object.entries(openaevHandlers)) {
    registry.set(type, handler);
  }
  for (const [type, handler] of Object.entries(aiHandlers)) {
    registry.set(type, handler);
  }
  for (const [type, handler] of Object.entries(cacheHandlers)) {
    registry.set(type, handler);
  }
  for (const [type, handler] of Object.entries(miscHandlers)) {
    registry.set(type, handler);
  }
  
  return registry;
}

