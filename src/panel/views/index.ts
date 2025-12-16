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

// Note: Additional views like EntityView, SearchView, ContainerFormView, etc.
// can be extracted from App.tsx as separate components when needed.
// The refactoring pattern is:
// 1. Create a new component file (e.g., views/EntityView.tsx)
// 2. Extract the render function and its dependencies
// 3. Pass necessary state and callbacks as props
// 4. Import and use the component in App.tsx

