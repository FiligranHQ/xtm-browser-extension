/**
 * Panel Views Index
 * 
 * Central export for all panel view components.
 * Views are larger components that render specific panel modes.
 */

// Re-export existing components
export { EmptyView } from '../components/EmptyView';
export { LoadingView } from '../components/LoadingView';
export { NotFoundView } from '../components/NotFoundView';
export { PanelHeader } from '../components/PanelHeader';
export { PlatformNavigation } from '../components/PlatformNavigation';

// Extracted view components
export { ScanResultsView } from './ScanResultsView';
export { UnifiedSearchView } from './UnifiedSearchView';
export { PreviewView } from './PreviewView';
export { ImportResultsView } from './ImportResultsView';
export { ContainerTypeView } from './ContainerTypeView';
export { PlatformSelectView } from './PlatformSelectView';
export { AddView } from './AddView';
export { ScenarioOverviewView } from './ScenarioOverviewView';
export { ExistingContainersView } from './ExistingContainersView';
export { InvestigationView } from './InvestigationView';
export { ContainerFormView } from './ContainerFormView';
export { AddSelectionView } from './AddSelectionView';

// Entity views
export { EntityView } from './EntityView';
export { OAEVEntityView } from './OAEVEntityView';
