/**
 * Panel hooks
 */

export {
  useEntityDisplay,
  useEntityBackground,
  useContentTextStyle,
  useLogoSuffix,
  sectionTitleStyle,
} from './useEntityDisplay';

export { usePanelState, type PanelStateReturn } from './usePanelState';
export { useToast, type ToastOptions } from './useToast';
export { usePlatforms, type PlatformInfo } from './usePlatforms';
export { useScenarioState, type ScenarioStateReturn } from './useScenarioState';
export { useAIState, type AIStateReturn, type AISettings, type ResolvedRelationship } from './useAIState';
export { useContainerState, type ContainerStateReturn } from './useContainerState';
export { useAtomicTestingState, type AtomicTestingStateReturn, type AtomicTestingTarget, type AIGeneratedPayload } from './useAtomicTestingState';
export { useInvestigationState, type InvestigationStateReturn, type InvestigationEntity } from './useInvestigationState';
export { useScanResultsState, type ScanResultsStateReturn } from './useScanResultsState';
export { useSearchState, type SearchStateReturn } from './useSearchState';
export { useEntityState, type EntityStateReturn, type MultiPlatformResult } from './useEntityState';
export { useAddSelectionState, type AddSelectionStateReturn, detectEntityType } from './useAddSelectionState';
export { useContainerActions, type ContainerActionsReturn } from './useContainerActions';
export { useInvestigationActions, type InvestigationActionsReturn } from './useInvestigationActions';
