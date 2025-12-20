/**
 * Container Actions Hook
 * 
 * Handles container creation, entity addition, and related API calls.
 */

import { useCallback } from 'react';
import type { EntityData, PlatformInfo, ImportResults, ContainerFormState, ContainerSpecificFields, ResolvedRelationship, PanelAIState, PanelMode } from '../types/panel-types';

export interface ContainerActionsProps {
  // Platform state
  openctiPlatforms: PlatformInfo[];
  availablePlatforms: PlatformInfo[];
  selectedPlatformId: string;
  setPlatformUrl: (url: string) => void;
  setSelectedPlatformId: (id: string) => void;
  
  // Container state
  entitiesToAdd: EntityData[];
  setEntitiesToAdd: React.Dispatch<React.SetStateAction<EntityData[]>>;
  containerType: string;
  containerForm: ContainerFormState;
  setContainerForm: React.Dispatch<React.SetStateAction<ContainerFormState>>;
  containerSpecificFields: ContainerSpecificFields;
  selectedLabels: Array<{ id: string; value: string; color: string }>;
  selectedMarkings: Array<{ id: string; definition: string }>;
  createIndicators: boolean;
  attachPdf: boolean;
  setGeneratingPdf: (generating: boolean) => void;
  createAsDraft: boolean;
  updatingContainerId: string | null;
  setUpdatingContainerId: (id: string | null) => void;
  updatingContainerDates: { published?: string; created?: string } | null;
  setUpdatingContainerDates: (dates: { published?: string; created?: string } | null) => void;
  setContainerWorkflowOrigin: (origin: 'preview' | 'direct' | 'import' | null) => void;
  setAttachPdf: (attach: boolean) => void;
  setCreateAsDraft: (draft: boolean) => void;
  
  // Import results
  setImportResults: (results: ImportResults | null) => void;
  
  // AI state
  aiSettings: PanelAIState;
  resolvedRelationships: ResolvedRelationship[];
  setAiGeneratingDescription: (generating: boolean) => void;
  
  // Entity state
  setEntity: React.Dispatch<React.SetStateAction<EntityData | null>>;
  setEntityContainers: (containers: any[]) => void;
  
  // Page info
  currentPageUrl: string;
  currentPageTitle: string;
  
  // UI
  setSubmitting: (submitting: boolean) => void;
  setPanelMode: React.Dispatch<React.SetStateAction<PanelMode>>;
  showToast: (options: { type: 'success' | 'info' | 'warning' | 'error'; message: string }) => void;
}

export interface ContainerActionsReturn {
  handleAddEntities: () => Promise<void>;
  handleCreateContainer: () => Promise<void>;
  handleGenerateAIDescription: () => Promise<void>;
}

export function useContainerActions(props: ContainerActionsProps): ContainerActionsReturn {
  const {
    openctiPlatforms,
    availablePlatforms,
    selectedPlatformId,
    setPlatformUrl,
    setSelectedPlatformId,
    entitiesToAdd,
    setEntitiesToAdd,
    containerType,
    containerForm,
    setContainerForm,
    containerSpecificFields,
    selectedLabels,
    selectedMarkings,
    createIndicators,
    attachPdf,
    setGeneratingPdf,
    createAsDraft,
    updatingContainerId,
    setUpdatingContainerId,
    updatingContainerDates,
    setUpdatingContainerDates,
    setContainerWorkflowOrigin,
    setAttachPdf,
    setCreateAsDraft,
    setImportResults,
    aiSettings,
    resolvedRelationships,
    setAiGeneratingDescription,
    setEntity,
    setEntityContainers,
    currentPageUrl,
    currentPageTitle,
    setSubmitting,
    setPanelMode,
    showToast,
  } = props;

  const handleAddEntities = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    setSubmitting(true);
    
    const selectedIsOpenCTI = openctiPlatforms.some(p => p.id === selectedPlatformId);
    const targetPlatformId = selectedIsOpenCTI ? selectedPlatformId : openctiPlatforms[0]?.id;
    const targetPlatform = availablePlatforms.find(p => p.id === targetPlatformId);
    
    if (!targetPlatform) {
      showToast({ type: 'error', message: 'No OpenCTI platform available' });
      setSubmitting(false);
      return;
    }
    
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_OBSERVABLES_BULK',
      payload: { entities: entitiesToAdd, platformId: targetPlatformId, createIndicator: createIndicators },
    });

    if (response?.success && response.data) {
      const createdEntities = response.data as Array<{ id: string; entity_type?: string; observable_value?: string; value?: string; type?: string }>;
      setImportResults({
        success: true, 
        total: entitiesToAdd.length,
        created: createdEntities.map((e, i) => ({ 
          id: e.id, 
          type: e.entity_type || e.type || entitiesToAdd[i]?.type || 'unknown', 
          value: e.observable_value || e.value || entitiesToAdd[i]?.value || entitiesToAdd[i]?.name || 'unknown' 
        })),
        failed: [], 
        platformName: targetPlatform.name,
      });
      setPanelMode('import-results');
      setEntitiesToAdd([]);
    } else {
      setImportResults({ 
        success: false, 
        total: entitiesToAdd.length, 
        created: [], 
        failed: entitiesToAdd.map(e => ({ 
          type: e.type || 'unknown', 
          value: e.value || e.name || 'unknown', 
          error: response?.error || 'Failed to create entity' 
        })), 
        platformName: targetPlatform.name 
      });
      setPanelMode('import-results');
    }
    setSubmitting(false);
  }, [openctiPlatforms, selectedPlatformId, availablePlatforms, entitiesToAdd, createIndicators, setImportResults, setPanelMode, setEntitiesToAdd, setSubmitting, showToast]);

  const handleGenerateAIDescription = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    const selectedIsOpenCTI = openctiPlatforms.some(p => p.id === selectedPlatformId);
    const targetPlatformId = selectedIsOpenCTI ? selectedPlatformId : openctiPlatforms[0]?.id;
    const targetPlatform = availablePlatforms.find(p => p.id === targetPlatformId);
    
    if (!aiSettings.available || !targetPlatform?.isEnterprise) return;
    
    setAiGeneratingDescription(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AI_GENERATE_DESCRIPTION',
        payload: { 
          pageTitle: currentPageTitle, 
          pageUrl: currentPageUrl, 
          pageContent: containerForm.content || '', 
          containerType, 
          containerName: containerForm.name, 
          detectedEntities: entitiesToAdd.map(e => e.name || e.value).filter(Boolean) 
        },
      });
      if (response?.success && response.data) {
        setContainerForm(prev => ({ ...prev, description: response.data }));
        showToast({ type: 'success', message: 'AI generated description' });
      } else {
        showToast({ type: 'error', message: 'AI description generation failed' });
      }
    } catch {
      showToast({ type: 'error', message: 'AI description generation error' });
    } finally {
      setAiGeneratingDescription(false);
    }
  }, [openctiPlatforms, selectedPlatformId, availablePlatforms, aiSettings.available, currentPageTitle, currentPageUrl, containerForm.content, containerForm.name, containerType, entitiesToAdd, setAiGeneratingDescription, setContainerForm, showToast]);

  const handleCreateContainer = useCallback(async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    setSubmitting(true);
    
    let pdfData: { data: string; filename: string } | null = null;
    if (attachPdf) {
      setGeneratingPdf(true);
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
          const pdfResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GENERATE_PDF' });
          if (pdfResponse?.success && pdfResponse.data) pdfData = pdfResponse.data;
        }
      } catch { /* PDF generation failed */ }
      setGeneratingPdf(false);
    }
    
    const existingEntitiesWithIndex = entitiesToAdd.map((e, i) => ({ entity: e, originalIndex: i })).filter(({ entity }) => entity.id);
    const entitiesToCreateWithIndex = entitiesToAdd.map((e, i) => ({ entity: e, originalIndex: i })).filter(({ entity }) => !entity.id && (entity.value || entity.observable_value));
    const existingEntityIds = existingEntitiesWithIndex.map(({ entity }) => entity.id as string);
    const entitiesToCreate = entitiesToCreateWithIndex.map(({ entity }) => ({
      type: entity.type || entity.entity_type || 'Unknown',
      value: entity.value || entity.observable_value || entity.name || '',
    }));
    
    const indexMapping: Record<number, number> = {};
    existingEntitiesWithIndex.forEach(({ originalIndex }, idx) => { indexMapping[originalIndex] = idx; });
    entitiesToCreateWithIndex.forEach(({ originalIndex }, idx) => { indexMapping[originalIndex] = existingEntityIds.length + idx; });
    
    const relationshipsToCreate = resolvedRelationships.map(rel => ({
      fromEntityIndex: indexMapping[rel.fromIndex] ?? -1,
      toEntityIndex: indexMapping[rel.toIndex] ?? -1,
      relationship_type: rel.relationshipType,
      description: rel.reason,
    })).filter(rel => rel.fromEntityIndex >= 0 && rel.toEntityIndex >= 0);
    
    const response = await chrome.runtime.sendMessage({
      type: 'CREATE_CONTAINER',
      payload: {
        type: containerType,
        name: containerForm.name,
        description: containerForm.description,
        content: containerForm.content,
        labels: selectedLabels.map(l => l.id),
        markings: selectedMarkings.map(m => m.id),
        entities: existingEntityIds,
        entitiesToCreate,
        platformId: selectedPlatformId || undefined,
        pdfAttachment: pdfData,
        pageUrl: currentPageUrl,
        pageTitle: currentPageTitle,
        report_types: containerSpecificFields.report_types.length > 0 ? containerSpecificFields.report_types : undefined,
        context: containerSpecificFields.context || undefined,
        severity: containerSpecificFields.severity || undefined,
        priority: containerSpecificFields.priority || undefined,
        response_types: containerSpecificFields.response_types.length > 0 ? containerSpecificFields.response_types : undefined,
        createdBy: containerSpecificFields.createdBy || undefined,
        createAsDraft,
        relationshipsToCreate: relationshipsToCreate.length > 0 ? relationshipsToCreate : undefined,
        updateContainerId: updatingContainerId || undefined,
        published: updatingContainerId && containerType === 'Report' ? updatingContainerDates?.published : undefined,
        created: updatingContainerId && containerType !== 'Report' ? updatingContainerDates?.created : undefined,
      },
    });

    if (response?.success && response.data) {
      const createdContainer = response.data;
      const createdPlatformId = createdContainer.platformId || selectedPlatformId;
      if (createdPlatformId) {
        const platform = availablePlatforms.find(p => p.id === createdPlatformId);
        if (platform) {
          setPlatformUrl(platform.url);
          setSelectedPlatformId(platform.id);
        }
      }
      setEntity({
        id: createdContainer.id,
        entity_type: createdContainer.entity_type || containerType,
        type: createdContainer.entity_type || containerType,
        name: createdContainer.name || containerForm.name,
        description: createdContainer.description || containerForm.description,
        created: createdContainer.created,
        modified: createdContainer.modified,
        createdBy: createdContainer.createdBy,
        objectLabel: createdContainer.objectLabel,
        objectMarking: createdContainer.objectMarking,
        existsInPlatform: true,
        platformId: createdPlatformId,
        platformType: 'opencti',
        isNonDefaultPlatform: false,
        _draftId: createdContainer.draftId,
      });
      setEntityContainers([]);
      setPanelMode('entity');
      showToast({ type: 'success', message: `${containerType} ${updatingContainerId ? 'updated' : 'created'} successfully` });
      setContainerForm({ name: '', description: '', content: '' });
      setEntitiesToAdd([]);
      setContainerWorkflowOrigin(null);
      setAttachPdf(true);
      setCreateAsDraft(false);
      setUpdatingContainerId(null);
      setUpdatingContainerDates(null);
    } else {
      showToast({ type: 'error', message: response?.error || 'Container creation failed' });
    }
    setSubmitting(false);
  }, [
    attachPdf, setGeneratingPdf, entitiesToAdd, resolvedRelationships, containerType, containerForm,
    selectedLabels, selectedMarkings, selectedPlatformId, currentPageUrl, currentPageTitle,
    containerSpecificFields, createAsDraft, updatingContainerId, updatingContainerDates,
    availablePlatforms, setPlatformUrl, setSelectedPlatformId, setEntity, setEntityContainers,
    setPanelMode, showToast, setContainerForm, setEntitiesToAdd, setContainerWorkflowOrigin,
    setAttachPdf, setCreateAsDraft, setUpdatingContainerId, setUpdatingContainerDates, setSubmitting
  ]);

  return {
    handleAddEntities,
    handleCreateContainer,
    handleGenerateAIDescription,
  };
}

