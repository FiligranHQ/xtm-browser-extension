/**
 * Container State Hook
 * 
 * Manages all container-related state for the panel.
 */

import { useState } from 'react';
import type {
  ContainerData,
  EntityData,
  ImportResults,
  ContainerFormState,
  ContainerSpecificFields,
  LabelOption,
  MarkingOption,
  VocabularyOption,
  AuthorOption,
} from '../types/panel-types';

export interface ContainerStateReturn {
  // Container type and form
  containerType: string;
  setOCTIContainerType: (type: string) => void;
  containerForm: ContainerFormState;
  setContainerForm: React.Dispatch<React.SetStateAction<ContainerFormState>>;
  
  // Entity containers
  entityContainers: ContainerData[];
  setEntityContainers: (containers: ContainerData[]) => void;
  loadingContainers: boolean;
  setLoadingContainers: (loading: boolean) => void;
  
  // Labels and markings
  selectedLabels: LabelOption[];
  setSelectedLabels: (labels: LabelOption[]) => void;
  selectedMarkings: MarkingOption[];
  setSelectedMarkings: (markings: MarkingOption[]) => void;
  availableLabels: LabelOption[];
  setAvailableLabels: (labels: LabelOption[]) => void;
  availableMarkings: MarkingOption[];
  setAvailableMarkings: (markings: MarkingOption[]) => void;
  
  // Entities to add
  entitiesToAdd: EntityData[];
  setEntitiesToAdd: React.Dispatch<React.SetStateAction<EntityData[]>>;
  
  // Track if add was triggered from not-found view (for back navigation)
  addFromNotFound: boolean;
  setAddFromNotFound: (fromNotFound: boolean) => void;
  
  // Form submission
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
  
  // Container-specific fields
  containerSpecificFields: ContainerSpecificFields;
  setContainerSpecificFields: React.Dispatch<React.SetStateAction<ContainerSpecificFields>>;
  
  // Available vocabulary options
  availableReportTypes: VocabularyOption[];
  setAvailableReportTypes: (types: VocabularyOption[]) => void;
  availableContexts: VocabularyOption[];
  setAvailableContexts: (contexts: VocabularyOption[]) => void;
  availableSeverities: VocabularyOption[];
  setAvailableSeverities: (severities: VocabularyOption[]) => void;
  availablePriorities: VocabularyOption[];
  setAvailablePriorities: (priorities: VocabularyOption[]) => void;
  availableResponseTypes: VocabularyOption[];
  setAvailableResponseTypes: (types: VocabularyOption[]) => void;
  availableAuthors: AuthorOption[];
  setAvailableAuthors: (authors: AuthorOption[]) => void;
  
  // Existing containers (for upsert)
  existingContainers: ContainerData[];
  setExistingContainers: (containers: ContainerData[]) => void;
  checkingExisting: boolean;
  setCheckingExisting: (checking: boolean) => void;
  updatingContainerId: string | null;
  setUpdatingContainerId: (id: string | null) => void;
  updatingContainerDates: { published?: string; created?: string } | null;
  setUpdatingContainerDates: (dates: { published?: string; created?: string } | null) => void;
  
  // Import results
  importResults: ImportResults | null;
  setImportResults: (results: ImportResults | null) => void;
  
  // Container workflow
  containerWorkflowOrigin: 'preview' | 'direct' | 'import' | null;
  setContainerWorkflowOrigin: (origin: 'preview' | 'direct' | 'import' | null) => void;
  
  // PDF and indicators options
  createIndicators: boolean;
  setCreateIndicators: (create: boolean) => void;
  attachPdf: boolean;
  setAttachPdf: (attach: boolean) => void;
  generatingPdf: boolean;
  setGeneratingPdf: (generating: boolean) => void;
  createAsDraft: boolean;
  setCreateAsDraft: (draft: boolean) => void;
  
  // Labels/markings loaded state
  labelsLoaded: boolean;
  setLabelsLoaded: (loaded: boolean) => void;
  markingsLoaded: boolean;
  setMarkingsLoaded: (loaded: boolean) => void;
}

/**
 * Hook for managing container-related state
 */
export function useContainerState(): ContainerStateReturn {
  // Container type and form
  const [containerType, setOCTIContainerType] = useState<string>('');
  const [containerForm, setContainerForm] = useState<ContainerFormState>({
    name: '',
    description: '',
    content: '',
  });
  
  // Entity containers
  const [entityContainers, setEntityContainers] = useState<ContainerData[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  
  // Labels and markings
  const [selectedLabels, setSelectedLabels] = useState<LabelOption[]>([]);
  const [selectedMarkings, setSelectedMarkings] = useState<MarkingOption[]>([]);
  const [availableLabels, setAvailableLabels] = useState<LabelOption[]>([]);
  const [availableMarkings, setAvailableMarkings] = useState<MarkingOption[]>([]);
  
  // Entities to add
  const [entitiesToAdd, setEntitiesToAdd] = useState<EntityData[]>([]);
  
  // Track if add was triggered from not-found view
  const [addFromNotFound, setAddFromNotFound] = useState(false);
  
  // Form submission
  const [submitting, setSubmitting] = useState(false);
  
  // Container-specific fields
  const [containerSpecificFields, setContainerSpecificFields] = useState<ContainerSpecificFields>({
    report_types: [],
    context: '',
    severity: '',
    priority: '',
    response_types: [],
    createdBy: '',
  });
  
  // Available vocabulary options
  const [availableReportTypes, setAvailableReportTypes] = useState<VocabularyOption[]>([]);
  const [availableContexts, setAvailableContexts] = useState<VocabularyOption[]>([]);
  const [availableSeverities, setAvailableSeverities] = useState<VocabularyOption[]>([]);
  const [availablePriorities, setAvailablePriorities] = useState<VocabularyOption[]>([]);
  const [availableResponseTypes, setAvailableResponseTypes] = useState<VocabularyOption[]>([]);
  const [availableAuthors, setAvailableAuthors] = useState<AuthorOption[]>([]);
  
  // Existing containers (for upsert)
  const [existingContainers, setExistingContainers] = useState<ContainerData[]>([]);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [updatingContainerId, setUpdatingContainerId] = useState<string | null>(null);
  const [updatingContainerDates, setUpdatingContainerDates] = useState<{
    published?: string;
    created?: string;
  } | null>(null);
  
  // Import results
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  
  // Container workflow
  const [containerWorkflowOrigin, setContainerWorkflowOrigin] = useState<'preview' | 'direct' | 'import' | null>(null);
  
  // PDF and indicators options
  const [createIndicators, setCreateIndicators] = useState(true);
  const [attachPdf, setAttachPdf] = useState(true);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [createAsDraft, setCreateAsDraft] = useState(false);
  
  // Labels/markings loaded state
  const [labelsLoaded, setLabelsLoaded] = useState(false);
  const [markingsLoaded, setMarkingsLoaded] = useState(false);
  
  return {
    containerType,
    setOCTIContainerType,
    containerForm,
    setContainerForm,
    entityContainers,
    setEntityContainers,
    loadingContainers,
    setLoadingContainers,
    selectedLabels,
    setSelectedLabels,
    selectedMarkings,
    setSelectedMarkings,
    availableLabels,
    setAvailableLabels,
    availableMarkings,
    setAvailableMarkings,
    entitiesToAdd,
    setEntitiesToAdd,
    addFromNotFound,
    setAddFromNotFound,
    submitting,
    setSubmitting,
    containerSpecificFields,
    setContainerSpecificFields,
    availableReportTypes,
    setAvailableReportTypes,
    availableContexts,
    setAvailableContexts,
    availableSeverities,
    setAvailableSeverities,
    availablePriorities,
    setAvailablePriorities,
    availableResponseTypes,
    setAvailableResponseTypes,
    availableAuthors,
    setAvailableAuthors,
    existingContainers,
    setExistingContainers,
    checkingExisting,
    setCheckingExisting,
    updatingContainerId,
    setUpdatingContainerId,
    updatingContainerDates,
    setUpdatingContainerDates,
    importResults,
    setImportResults,
    containerWorkflowOrigin,
    setContainerWorkflowOrigin,
    createIndicators,
    setCreateIndicators,
    attachPdf,
    setAttachPdf,
    generatingPdf,
    setGeneratingPdf,
    createAsDraft,
    setCreateAsDraft,
    labelsLoaded,
    setLabelsLoaded,
    markingsLoaded,
    setMarkingsLoaded,
  };
}

