/**
 * Panel Views Index
 * 
 * Central export for all panel view components.
 * Views are larger components that render specific panel modes.
 * 
 * Naming convention:
 * - Common* = Common/cross-platform views
 * - OCTI* = OpenCTI-specific views
 * - OAEV* = OpenAEV-specific views
 * - OGRC* = OpenGRC-specific views (future)
 */

// Re-export shared components
export { CommonEmptyView } from '../components/CommonEmptyView';
export { CommonLoadingView } from '../components/CommonLoadingView';
export { CommonNotFoundView } from '../components/CommonNotFoundView';
export { CommonPanelHeader } from '../components/CommonPanelHeader';
export { CommonPlatformNavigation } from '../components/CommonPlatformNavigation';

// Common views (cross-platform)
export { CommonScanResultsView } from './CommonScanResultsView';
export { CommonUnifiedSearchView } from './CommonUnifiedSearchView';
export { CommonPreviewView } from './CommonPreviewView';
export { CommonPlatformSelectView } from './CommonPlatformSelectView';

// OpenCTI-specific views (OCTI prefix)
export { OCTIEntityView } from './OCTIEntityView';
export { OCTIImportResultsView } from './OCTIImportResultsView';
export { OCTIContainerTypeView } from './OCTIContainerTypeView';
export { OCTIContainerFormView } from './OCTIContainerFormView';
export { OCTIExistingContainersView } from './OCTIExistingContainersView';
export { OCTIInvestigationView } from './OCTIInvestigationView';
export { OCTIAddView } from './OCTIAddView';
export { OCTIAddSelectionView } from './OCTIAddSelectionView';

// OpenAEV-specific views (OAEV prefix)
export { OAEVEntityView } from './OAEVEntityView';
export { OAEVScenarioOverviewView } from './OAEVScenarioOverviewView';
