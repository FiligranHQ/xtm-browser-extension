/**
 * Existing Containers View Component
 *
 * Shows found containers for the current URL, allowing user to view, update, or create new.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Divider,
} from '@mui/material';
import {
  DescriptionOutlined,
  OpenInNewOutlined,
  RefreshOutlined,
  AddOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { itemColor } from '../../shared/theme/colors';
import type {
  PanelMode,
  ContainerData,
  PlatformInfo,
  EntityData,
  MultiPlatformResult,
  ContainerFormState,
  ContainerSpecificFields,
  LabelOption,
  MarkingOption,
} from '../types';
import { loggers } from '../../shared/utils/logger';

const log = loggers.panel;

export interface ExistingContainersViewProps {
  mode: 'dark' | 'light';
  existingContainers: ContainerData[];
  selectedPlatformId: string;
  setSelectedPlatformId: (id: string) => void;
  availablePlatforms: PlatformInfo[];
  openctiPlatforms: PlatformInfo[];
  setPlatformUrl: (url: string) => void;
  setPanelMode: (mode: PanelMode) => void;
  setEntity: (entity: EntityData | null) => void;
  setMultiPlatformResults: (results: MultiPlatformResult[]) => void;
  setCurrentPlatformIndex: (index: number) => void;
  setEntityContainers: (containers: ContainerData[]) => void;
  fetchEntityContainers: (entityId: string, platformId: string) => void;
  setUpdatingContainerId: (id: string | null) => void;
  setOCTIContainerType: (type: string) => void;
  setContainerForm: (form: ContainerFormState | ((prev: ContainerFormState) => ContainerFormState)) => void;
  setSelectedLabels: (labels: LabelOption[]) => void;
  setSelectedMarkings: (markings: MarkingOption[]) => void;
  containerSpecificFields: ContainerSpecificFields;
  setContainerSpecificFields: (fields: ContainerSpecificFields) => void;
  setUpdatingContainerDates: (dates: { published?: string; created?: string }) => void;
  loadLabelsAndMarkings: (platformId: string) => void;
  formatDate: (dateStr?: string) => string;
}

export const OCTIExistingContainersView: React.FC<ExistingContainersViewProps> = ({
  mode,
  existingContainers,
  selectedPlatformId,
  setSelectedPlatformId,
  availablePlatforms,
  openctiPlatforms,
  setPlatformUrl,
  setPanelMode,
  setEntity,
  setMultiPlatformResults,
  setCurrentPlatformIndex,
  setEntityContainers,
  fetchEntityContainers,
  setUpdatingContainerId,
  setOCTIContainerType,
  setContainerForm,
  setSelectedLabels,
  setSelectedMarkings,
  containerSpecificFields,
  setContainerSpecificFields,
  setUpdatingContainerDates,
  loadLabelsAndMarkings,
  formatDate,
}) => {
  const handleOpenExistingContainer = async (container: ContainerData) => {
    // Show this container in entity view - fetch full details
    const containerPlatformId = (container as any).platformId || selectedPlatformId;
    if (containerPlatformId) {
      const platform = availablePlatforms.find(p => p.id === containerPlatformId);
      if (platform) {
        setPlatformUrl(platform.url);
        setSelectedPlatformId(platform.id);
      }
    }

    // Set loading state first
    setPanelMode('loading');

    // Fetch full entity details from API
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && container.id) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_ENTITY_DETAILS',
          payload: {
            id: container.id,
            entityType: container.entity_type,
            platformId: containerPlatformId,
          },
        });

        if (response?.success && response.data) {
          setEntity({
            ...response.data,
            type: response.data.entity_type || container.entity_type,
            existsInPlatform: true,
            platformId: containerPlatformId,
            platformType: 'opencti',
            isNonDefaultPlatform: false,
          });
          setMultiPlatformResults([{
            platformId: containerPlatformId,
            platformName: availablePlatforms.find(p => p.id === containerPlatformId)?.name || 'OpenCTI',
            entity: { ...response.data, existsInPlatform: true, platformType: 'opencti', isNonDefaultPlatform: false },
          }]);
          setCurrentPlatformIndex(0);
          setEntityContainers([]);
          setPanelMode('entity');

          // Also fetch containers for this entity
          fetchEntityContainers(container.id, containerPlatformId);
          return;
        }
      } catch (error) {
        log.error(' Failed to fetch container details:', error);
      }
    }

    // Fallback to basic data
    setEntity({
      id: container.id,
      entity_type: container.entity_type,
      type: container.entity_type,
      name: container.name,
      description: (container as any).description,
      existsInPlatform: true,
      platformId: containerPlatformId,
      platformType: 'opencti',
      isNonDefaultPlatform: false,
    });
    setMultiPlatformResults([{
      platformId: containerPlatformId,
      platformName: availablePlatforms.find(p => p.id === containerPlatformId)?.name || 'OpenCTI',
      entity: { id: container.id, entity_type: container.entity_type, type: container.entity_type, name: container.name, existsInPlatform: true, platformType: 'opencti', isNonDefaultPlatform: false },
    }]);
    setCurrentPlatformIndex(0);
    setEntityContainers([]);
    setPanelMode('entity');
  };

  const handleRefreshContainer = async (container: ContainerData) => {
    // Set the container ID for upsert mode
    setUpdatingContainerId(container.id);

    // Set container type first
    setOCTIContainerType(container.entity_type);

    // Get platform info
    const containerPlatformId = (container as any).platformId || selectedPlatformId;
    if (containerPlatformId) {
      const platform = availablePlatforms.find(p => p.id === containerPlatformId);
      if (platform) {
        setPlatformUrl(platform.url);
        setSelectedPlatformId(platform.id);
      }
    }

    // Show loading while fetching full container details
    setPanelMode('loading');

    // Fetch full container details from OpenCTI
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && container.id) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_ENTITY_DETAILS',
          payload: {
            id: container.id,
            entityType: container.entity_type,
            platformId: containerPlatformId,
          },
        });

        if (response?.success && response.data) {
          const fullContainer = response.data;

          // Pre-fill the form with the container's existing data (but keep new content from page)
          // Use callback form to ensure we get the latest content value
          const containerName = fullContainer.name || container.name;
          setContainerForm(prev => ({
            ...prev,
            name: containerName, // Always use existing container's name, never page title
            description: fullContainer.description || '',
          }));

          // Pre-fill labels if available
          if (fullContainer.objectLabel && fullContainer.objectLabel.length > 0) {
            setSelectedLabels(fullContainer.objectLabel.map((l: any) => ({
              id: l.id || l.value,
              value: l.value,
              color: l.color,
            })));
          }

          // Pre-fill markings if available
          if (fullContainer.objectMarking && fullContainer.objectMarking.length > 0) {
            setSelectedMarkings(fullContainer.objectMarking.map((m: any) => ({
              id: m.id || m.definition,
              definition: m.definition,
            })));
          }

          // Pre-fill container-specific fields based on type
          const newSpecificFields = { ...containerSpecificFields };

          // Report types
          if (fullContainer.report_types) {
            newSpecificFields.report_types = fullContainer.report_types;
          }

          // Grouping context
          if (fullContainer.context) {
            newSpecificFields.context = fullContainer.context;
          }

          // Case fields
          if (fullContainer.severity) {
            newSpecificFields.severity = fullContainer.severity;
          }
          if (fullContainer.priority) {
            newSpecificFields.priority = fullContainer.priority;
          }
          if (fullContainer.response_types) {
            newSpecificFields.response_types = fullContainer.response_types;
          }

          // Author (createdBy)
          if (fullContainer.createdBy?.id) {
            newSpecificFields.createdBy = fullContainer.createdBy.id;
          }

          setContainerSpecificFields(newSpecificFields);

          // Store original dates to avoid creating duplicates during update
          // Reports use 'published', other containers use 'created'
          setUpdatingContainerDates({
            published: fullContainer.published,
            created: fullContainer.created,
          });

          // Load labels and markings for the platform (if not already loaded)
          loadLabelsAndMarkings(containerPlatformId);

          setPanelMode('container-form');
          return;
        }
      } catch (error) {
        log.error(' handleRefreshContainer: Failed to fetch container details:', error);
      }
    }

    // Fallback: Use basic container data
    // Use callback form to ensure we get the latest content value
    setContainerForm(prev => ({
      ...prev,
      name: container.name, // Always use existing container's name
      description: (container as any).description || '',
    }));

    // Load labels and markings for the platform
    loadLabelsAndMarkings(containerPlatformId);

    setPanelMode('container-form');
  };

  const handleCreateNew = () => {
    // Clear existing container selection and proceed to create new
    // If multiple OpenCTI platforms, go to platform select first (containers are OpenCTI-only)
    if (openctiPlatforms.length > 1) {
      setPanelMode('platform-select');
    } else {
      // Auto-select the single OpenCTI platform
      if (openctiPlatforms.length === 1) {
        setSelectedPlatformId(openctiPlatforms[0].id);
        setPlatformUrl(openctiPlatforms[0].url);
      }
      setPanelMode('container-type');
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <DescriptionOutlined sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontSize: 16 }}>Existing Container Found</Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2, borderRadius: 1 }}>
        A container already exists for this article. You can view it, update it with new content, or create a new one.
      </Alert>

      {/* List existing containers */}
      <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
        Found {existingContainers.length} container{existingContainers.length > 1 ? 's' : ''}
      </Typography>

      <Box sx={{ mb: 2 }}>
        {existingContainers.map((container, idx) => {
          const containerColor = itemColor(container.entity_type, mode === 'dark');
          const containerPlatform = availablePlatforms.find(p => p.id === (container as any).platformId);

          return (
            <Paper
              key={container.id || idx}
              elevation={0}
              sx={{
                p: 1.5,
                mb: 1,
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
                <ItemIcon type={container.entity_type} size="small" color={containerColor} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                    {container.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <span style={{ textTransform: 'capitalize' }}>{container.entity_type.replace(/-/g, ' ')}</span>
                    {containerPlatform && <span>• {containerPlatform.name}</span>}
                    {container.createdBy?.name && <span>• {container.createdBy.name}</span>}
                    {container.modified && <span>• {formatDate(container.modified)}</span>}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<OpenInNewOutlined sx={{ fontSize: 16 }} />}
                  onClick={() => handleOpenExistingContainer(container)}
                  sx={{ flex: 1 }}
                >
                  View
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<RefreshOutlined sx={{ fontSize: 16 }} />}
                  onClick={() => handleRefreshContainer(container)}
                  sx={{ flex: 1 }}
                >
                  Update
                </Button>
              </Box>
            </Paper>
          );
        })}
      </Box>

      <Divider sx={{ my: 2 }} />

      <Button
        variant="outlined"
        onClick={handleCreateNew}
        startIcon={<AddOutlined />}
        fullWidth
      >
        Create New Container
      </Button>
    </Box>
  );
};

export default OCTIExistingContainersView;

