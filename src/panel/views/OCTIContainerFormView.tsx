/**
 * Container Form View Component
 *
 * Form for creating or updating containers (Reports, Groupings, Cases).
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Autocomplete,
  Alert,
  FormControlLabel,
  Switch,
  Tooltip,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  AddOutlined,
  AutoAwesomeOutlined,
  PictureAsPdfOutlined,
  Add as AddIcon,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { hexToRGB } from '../../shared/theme/colors';
import { getAiColor } from '../utils/platform-helpers';
import type { PanelMode, EntityData, PlatformInfo, ContainerFormState, ContainerSpecificFields, PanelAIState, LabelOption, MarkingOption, AuthorOption } from '../types/panel-types';

// Debounce delay for search (1.2s is optimal for reducing API calls while remaining responsive)
const SEARCH_DEBOUNCE_MS = 1200;

// Generate a random color for new labels
const generateRandomColor = () => {
  const colors = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
    '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
    '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800',
    '#ff5722', '#795548', '#607d8b'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export interface ContainerFormViewProps {
  mode: 'dark' | 'light';
  setPanelMode: (mode: PanelMode) => void;
  containerType: string;
  containerSteps: string[];
  containerForm: ContainerFormState;
  setContainerForm: (form: ContainerFormState | ((prev: ContainerFormState) => ContainerFormState)) => void;
  containerSpecificFields: ContainerSpecificFields;
  setContainerSpecificFields: (fields: ContainerSpecificFields | ((prev: ContainerSpecificFields) => ContainerSpecificFields)) => void;
  updatingContainerId: string | null;
  availablePlatforms: PlatformInfo[];
  openctiPlatforms: PlatformInfo[];
  selectedPlatformId: string;
  aiSettings: PanelAIState;
  aiGeneratingDescription: boolean;
  handleGenerateAIDescription: () => void;
  availableLabels: LabelOption[]; // Initial labels (may be empty, we load on demand)
  selectedLabels: LabelOption[];
  setSelectedLabels: (labels: LabelOption[]) => void;
  availableMarkings: MarkingOption[];
  selectedMarkings: MarkingOption[];
  setSelectedMarkings: (markings: MarkingOption[]) => void;
  availableReportTypes: { id: string; name: string }[];
  availableContexts: { id: string; name: string }[];
  availableSeverities: { id: string; name: string }[];
  availablePriorities: { id: string; name: string }[];
  availableResponseTypes: { id: string; name: string }[];
  availableAuthors: { id: string; name: string; entity_type: string }[];
  attachPdf: boolean;
  setAttachPdf: (attach: boolean) => void;
  createAsDraft: boolean;
  setCreateAsDraft: (draft: boolean) => void;
  entitiesToAdd: EntityData[];
  handleCreateContainer: () => void;
  submitting: boolean;
  generatingPdf: boolean;
  /** Whether source is PDF scanner (changes attachment label) */
  isPdfSource?: boolean;
}

export const OCTIContainerFormView: React.FC<ContainerFormViewProps> = ({
  mode,
  setPanelMode,
  containerType,
  containerSteps,
  containerForm,
  setContainerForm,
  containerSpecificFields,
  setContainerSpecificFields,
  updatingContainerId,
  availablePlatforms,
  openctiPlatforms,
  selectedPlatformId,
  aiSettings,
  aiGeneratingDescription,
  handleGenerateAIDescription,
  availableLabels,
  selectedLabels,
  setSelectedLabels,
  availableMarkings,
  selectedMarkings,
  setSelectedMarkings,
  availableReportTypes,
  availableContexts,
  availableSeverities,
  availablePriorities,
  availableResponseTypes,
  availableAuthors,
  attachPdf,
  setAttachPdf,
  createAsDraft,
  setCreateAsDraft,
  entitiesToAdd,
  handleCreateContainer,
  submitting,
  generatingPdf,
  isPdfSource = false,
}) => {
  // Label search state
  const [labelOptions, setLabelOptions] = useState<LabelOption[]>(availableLabels);
  const [labelInputValue, setLabelInputValue] = useState('');
  const [labelsLoading, setLabelsLoading] = useState(false);
  const [labelsInitialized, setLabelsInitialized] = useState(false);
  const labelSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create label dialog state
  const [createLabelDialogOpen, setCreateLabelDialogOpen] = useState(false);
  const [newLabelValue, setNewLabelValue] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(generateRandomColor());
  const [creatingLabel, setCreatingLabel] = useState(false);

  // Author search state
  const [authorOptions, setAuthorOptions] = useState<AuthorOption[]>(availableAuthors);
  const [authorInputValue, setAuthorInputValue] = useState('');
  const [authorsLoading, setAuthorsLoading] = useState(false);
  const [authorsInitialized, setAuthorsInitialized] = useState(false);
  const [selectedAuthor, setSelectedAuthor] = useState<AuthorOption | null>(
    availableAuthors.find(a => a.id === containerSpecificFields.createdBy) || null
  );
  const authorSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create author dialog state
  const [createAuthorDialogOpen, setCreateAuthorDialogOpen] = useState(false);
  const [newAuthorName, setNewAuthorName] = useState('');
  const [newAuthorType, setNewAuthorType] = useState<'Organization' | 'Individual'>('Organization');
  const [creatingAuthor, setCreatingAuthor] = useState(false);

  // Get target platform
  const selectedIsOpenCTI = openctiPlatforms.some(p => p.id === selectedPlatformId);
  const targetPlatformId = selectedIsOpenCTI ? selectedPlatformId : openctiPlatforms[0]?.id;

  // Load initial labels on mount or when availableLabels changes
  useEffect(() => {
    if (availableLabels.length > 0) {
      setLabelOptions(availableLabels);
      setLabelsInitialized(true);
    } else if (!labelsInitialized && targetPlatformId) {
      // If no labels were passed and not initialized, fetch them directly
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        setLabelsLoading(true);
        chrome.runtime.sendMessage(
          { 
            type: 'SEARCH_LABELS', 
            payload: { 
              search: '', 
              first: 10,
              platformId: targetPlatformId 
            } 
          }, 
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Initial labels load error:', chrome.runtime.lastError);
              setLabelsLoading(false);
              return;
            }
            if (response?.success && response.data) {
              setLabelOptions(response.data);
              setLabelsInitialized(true);
            }
            setLabelsLoading(false);
          }
        );
      }
    }
  }, [availableLabels, labelsInitialized, targetPlatformId]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (labelSearchTimeoutRef.current) {
        clearTimeout(labelSearchTimeoutRef.current);
      }
      if (authorSearchTimeoutRef.current) {
        clearTimeout(authorSearchTimeoutRef.current);
      }
    };
  }, []);

  // Load initial authors on mount
  useEffect(() => {
    if (availableAuthors.length > 0) {
      setAuthorOptions(availableAuthors);
      setAuthorsInitialized(true);
      // Set selected author from containerSpecificFields
      const currentAuthor = availableAuthors.find(a => a.id === containerSpecificFields.createdBy);
      if (currentAuthor) {
        setSelectedAuthor(currentAuthor);
      }
    } else if (!authorsInitialized && targetPlatformId) {
      // Fetch initial authors
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        setAuthorsLoading(true);
        chrome.runtime.sendMessage(
          { 
            type: 'SEARCH_IDENTITIES', 
            payload: { 
              search: '', 
              first: 50,
              platformId: targetPlatformId 
            } 
          }, 
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Initial authors load error:', chrome.runtime.lastError);
              setAuthorsLoading(false);
              return;
            }
            if (response?.success && response.data) {
              setAuthorOptions(response.data);
              setAuthorsInitialized(true);
            }
            setAuthorsLoading(false);
          }
        );
      }
    }
  }, [availableAuthors, authorsInitialized, targetPlatformId, containerSpecificFields.createdBy]);

  // Execute label search (called after debounce)
  const executeLabelSearch = useCallback((searchValue: string) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setLabelsLoading(true);
    chrome.runtime.sendMessage(
      { 
        type: 'SEARCH_LABELS', 
        payload: { 
          search: searchValue.trim(), 
          first: 10,
          platformId: targetPlatformId 
        } 
      }, 
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Label search error:', chrome.runtime.lastError);
          setLabelsLoading(false);
          return;
        }
        if (response?.success && response.data) {
          setLabelOptions(response.data);
        } else if (response?.error) {
          console.error('Label search failed:', response.error);
        }
        setLabelsLoading(false);
      }
    );
  }, [targetPlatformId]);

  // Search labels with debounce
  const searchLabels = useCallback((searchValue: string) => {
    // Clear any pending timeout
    if (labelSearchTimeoutRef.current) {
      clearTimeout(labelSearchTimeoutRef.current);
      labelSearchTimeoutRef.current = null;
    }

    // Set timeout for debounced search
    labelSearchTimeoutRef.current = setTimeout(() => {
      executeLabelSearch(searchValue);
    }, SEARCH_DEBOUNCE_MS);
  }, [executeLabelSearch]);

  // Execute author search (called after debounce)
  const executeAuthorSearch = useCallback((searchValue: string) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setAuthorsLoading(true);
    chrome.runtime.sendMessage(
      { 
        type: 'SEARCH_IDENTITIES', 
        payload: { 
          search: searchValue.trim(), 
          first: 50,
          platformId: targetPlatformId 
        } 
      }, 
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Author search error:', chrome.runtime.lastError);
          setAuthorsLoading(false);
          return;
        }
        if (response?.success && response.data) {
          setAuthorOptions(response.data);
        } else if (response?.error) {
          console.error('Author search failed:', response.error);
        }
        setAuthorsLoading(false);
      }
    );
  }, [targetPlatformId]);

  // Search authors with debounce
  const searchAuthors = useCallback((searchValue: string) => {
    // Clear any pending timeout
    if (authorSearchTimeoutRef.current) {
      clearTimeout(authorSearchTimeoutRef.current);
      authorSearchTimeoutRef.current = null;
    }

    // Set timeout for debounced search
    authorSearchTimeoutRef.current = setTimeout(() => {
      executeAuthorSearch(searchValue);
    }, SEARCH_DEBOUNCE_MS);
  }, [executeAuthorSearch]);

  // Load labels when autocomplete is opened (if not already loaded)
  const handleLabelsOpen = useCallback(() => {
    // Load if not initialized or if options are empty
    if (labelsInitialized && labelOptions.length > 0) return;

    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setLabelsLoading(true);
    chrome.runtime.sendMessage(
      { 
        type: 'SEARCH_LABELS', 
        payload: { 
          search: '', 
          first: 10,
          platformId: targetPlatformId 
        } 
      }, 
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Labels open error:', chrome.runtime.lastError);
          setLabelsLoading(false);
          return;
        }
        if (response?.success && response.data) {
          setLabelOptions(response.data);
          setLabelsInitialized(true);
        } else if (response?.error) {
          console.error('Labels load failed:', response.error);
        }
        setLabelsLoading(false);
      }
    );
  }, [targetPlatformId, labelsInitialized, labelOptions.length]);

  // Load authors when autocomplete is opened (if not already loaded)
  const handleAuthorsOpen = useCallback(() => {
    if (authorsInitialized && authorOptions.length > 0) return;

    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setAuthorsLoading(true);
    chrome.runtime.sendMessage(
      { 
        type: 'SEARCH_IDENTITIES', 
        payload: { 
          search: '', 
          first: 50,
          platformId: targetPlatformId 
        } 
      }, 
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Authors open error:', chrome.runtime.lastError);
          setAuthorsLoading(false);
          return;
        }
        if (response?.success && response.data) {
          setAuthorOptions(response.data);
          setAuthorsInitialized(true);
        } else if (response?.error) {
          console.error('Authors load failed:', response.error);
        }
        setAuthorsLoading(false);
      }
    );
  }, [targetPlatformId, authorsInitialized, authorOptions.length]);

  // Handle label input change with debounced search
  const handleLabelInputChange = useCallback((_event: React.SyntheticEvent, value: string, reason: string) => {
    setLabelInputValue(value);
    
    // Only trigger search on actual user input, not on reset/clear from selecting an option
    if (reason === 'input') {
      if (value.trim()) {
        searchLabels(value);
      } else {
        // If cleared by user typing, reload initial labels after debounce
        searchLabels('');
      }
    }
  }, [searchLabels]);

  // Handle author input change with debounced search
  const handleAuthorInputChange = useCallback((_event: React.SyntheticEvent, value: string, reason: string) => {
    setAuthorInputValue(value);
    
    if (reason === 'input') {
      if (value.trim()) {
        searchAuthors(value);
      } else {
        searchAuthors('');
      }
    }
  }, [searchAuthors]);

  // Handle author selection change
  const handleAuthorChange = useCallback((_event: React.SyntheticEvent, newValue: AuthorOption | null) => {
    setSelectedAuthor(newValue);
    setContainerSpecificFields(prev => ({
      ...prev,
      createdBy: newValue?.id || ''
    }));
  }, [setContainerSpecificFields]);

  // Create new label
  const handleCreateLabel = useCallback(() => {
    if (!newLabelValue.trim()) return;
    
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setCreatingLabel(true);
    chrome.runtime.sendMessage(
      { 
        type: 'CREATE_LABEL', 
        payload: { 
          value: newLabelValue.trim(), 
          color: newLabelColor,
          platformId: targetPlatformId 
        } 
      }, 
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Create label error:', chrome.runtime.lastError);
          setCreatingLabel(false);
          return;
        }
        if (response?.success && response.data) {
          const newLabel = response.data as LabelOption;
          // Add to options and select it
          setLabelOptions(prev => [newLabel, ...prev]);
          setSelectedLabels([...selectedLabels, newLabel]);
          // Close dialog and reset
          setCreateLabelDialogOpen(false);
          setNewLabelValue('');
          setNewLabelColor(generateRandomColor());
        } else if (response?.error) {
          console.error('Create label failed:', response.error);
        }
        setCreatingLabel(false);
      }
    );
  }, [newLabelValue, newLabelColor, targetPlatformId, selectedLabels, setSelectedLabels]);

  // Create new author (Organization or Individual)
  const handleCreateAuthor = useCallback(() => {
    if (!newAuthorName.trim()) return;
    
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setCreatingAuthor(true);
    chrome.runtime.sendMessage(
      { 
        type: 'CREATE_IDENTITY', 
        payload: { 
          name: newAuthorName.trim(), 
          entityType: newAuthorType,
          platformId: targetPlatformId 
        } 
      }, 
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Create author error:', chrome.runtime.lastError);
          setCreatingAuthor(false);
          return;
        }
        if (response?.success && response.data) {
          const newAuthor = response.data as AuthorOption;
          // Add to options and select it
          setAuthorOptions(prev => [newAuthor, ...prev]);
          setSelectedAuthor(newAuthor);
          setContainerSpecificFields(prev => ({
            ...prev,
            createdBy: newAuthor.id
          }));
          // Close dialog and reset
          setCreateAuthorDialogOpen(false);
          setNewAuthorName('');
          setNewAuthorType('Organization');
        } else if (response?.error) {
          console.error('Create author failed:', response.error);
        }
        setCreatingAuthor(false);
      }
    );
  }, [newAuthorName, newAuthorType, targetPlatformId, setContainerSpecificFields]);

  // Check if AI is available for the container platform
  const targetPlatform = availablePlatforms.find(p => p.id === targetPlatformId);
  const isAIAvailable = aiSettings.available && targetPlatform?.isEnterprise;
  const aiColors = getAiColor(mode);

  let tooltipMessage = '';
  if (!aiSettings.available) {
    tooltipMessage = 'AI is not configured. Configure AI in extension settings.';
  } else if (!targetPlatform?.isEnterprise) {
    tooltipMessage = 'AI features require Enterprise Edition. The selected platform is Community Edition.';
  } else {
    tooltipMessage = 'Use AI to generate a summary of the page content as description';
  }

  return (
    <Box sx={{ p: 2 }}>
      {/* Stepper - activeStep should be the last step (Configure Details) */}
      <Stepper activeStep={containerSteps.length - 1} sx={{ mb: 3 }}>
        {containerSteps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Back button */}
      <Box sx={{ mb: 1.5 }}>
        <Button
          size="small"
          startIcon={<ChevronLeftOutlined />}
          onClick={() => setPanelMode('container-type')}
          sx={{ 
            color: 'text.secondary',
            textTransform: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          Back to container type
        </Button>
      </Box>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <ItemIcon type={containerType} size="small" />
        <Typography variant="h6" sx={{ fontSize: 16 }}>
          {containerType.replace(/-/g, ' ')} Details
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Name"
          value={containerForm.name}
          onChange={(e) => setContainerForm({ ...containerForm, name: e.target.value })}
          fullWidth
          required
          size="small"
          placeholder="Enter container name..."
          helperText={updatingContainerId ? "Name from existing container (cannot be changed)" : "Pre-filled from page title"}
          disabled={!!updatingContainerId}
        />

        {/* Report-specific: Report Types */}
        {containerType === 'Report' && (
          <Autocomplete
            multiple
            options={availableReportTypes}
            getOptionLabel={(option) => option.name}
            value={availableReportTypes.filter(r => containerSpecificFields.report_types.includes(r.name))}
            onChange={(_, newValue) => setContainerSpecificFields(prev => ({
              ...prev,
              report_types: newValue.map(v => v.name)
            }))}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField {...params} label="Report Types" size="small" placeholder="Select type..." />
            )}
            size="small"
          />
        )}

        {/* Grouping-specific: Context (mandatory) */}
        {containerType === 'Grouping' && (
          <Autocomplete
            options={availableContexts}
            getOptionLabel={(option) => option.name}
            value={availableContexts.find(c => c.name === containerSpecificFields.context) || null}
            onChange={(_, newValue) => setContainerSpecificFields(prev => ({
              ...prev,
              context: newValue?.name || ''
            }))}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField {...params} label="Context" size="small" required placeholder="Select context..." />
            )}
            size="small"
          />
        )}

        {/* Case-specific: Severity, Priority, Response Types */}
        {containerType.startsWith('Case') && (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Autocomplete
                options={availableSeverities}
                getOptionLabel={(option) => option.name}
                value={availableSeverities.find(s => s.name === containerSpecificFields.severity) || null}
                onChange={(_, newValue) => setContainerSpecificFields(prev => ({
                  ...prev,
                  severity: newValue?.name || ''
                }))}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField {...params} label="Severity" size="small" placeholder="Select..." />
                )}
                size="small"
              />
              <Autocomplete
                options={availablePriorities}
                getOptionLabel={(option) => option.name}
                value={availablePriorities.find(p => p.name === containerSpecificFields.priority) || null}
                onChange={(_, newValue) => setContainerSpecificFields(prev => ({
                  ...prev,
                  priority: newValue?.name || ''
                }))}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField {...params} label="Priority" size="small" placeholder="Select..." />
                )}
                size="small"
              />
            </Box>
            {containerType === 'Case-Incident' && (
              <Autocomplete
                multiple
                options={availableResponseTypes}
                getOptionLabel={(option) => option.name}
                value={availableResponseTypes.filter(r => containerSpecificFields.response_types.includes(r.name))}
                onChange={(_, newValue) => setContainerSpecificFields(prev => ({
                  ...prev,
                  response_types: newValue.map(v => v.name)
                }))}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField {...params} label="Incident Types" size="small" placeholder="Select..." />
                )}
                size="small"
              />
            )}
          </>
        )}

        {/* Author (createdBy) - for all container types */}
        <Autocomplete
          fullWidth
          options={authorOptions}
          getOptionLabel={(option) => option.name}
          value={selectedAuthor}
          onChange={handleAuthorChange}
          onOpen={handleAuthorsOpen}
          inputValue={authorInputValue}
          onInputChange={handleAuthorInputChange}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          loading={authorsLoading}
          filterOptions={(x) => x} // Disable client-side filtering, server handles it
          renderInput={(params) => (
            <TextField
              {...params}
              label="Author"
              size="small"
              placeholder="Type to search..."
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {authorsLoading ? <CircularProgress color="inherit" size={16} /> : null}
                    <Tooltip title="Create new author">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreateAuthorDialogOpen(true);
                        }}
                        sx={{ 
                          p: 0.5,
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ItemIcon type={option.entity_type} size="small" />
              <Typography variant="body2">{option.name}</Typography>
            </Box>
          )}
          size="small"
          noOptionsText={authorsLoading ? "Searching..." : "No authors found"}
        />

        {/* Description field with AI generate button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TextField
            label="Description"
            value={containerForm.description}
            onChange={(e) => setContainerForm({ ...containerForm, description: e.target.value })}
            multiline
            minRows={4}
            maxRows={16}
            fullWidth
            size="small"
            placeholder="Enter description..."
            helperText="Extracted from article content"
          />
          <Tooltip title={tooltipMessage} placement="top">
            <span>
              <Button
                variant="outlined"
                size="small"
                onClick={handleGenerateAIDescription}
                disabled={!isAIAvailable || aiGeneratingDescription}
                startIcon={aiGeneratingDescription ? <CircularProgress size={14} /> : <AutoAwesomeOutlined />}
                sx={{
                  alignSelf: 'flex-start',
                  textTransform: 'none',
                  opacity: !isAIAvailable ? 0.5 : 1,
                  color: isAIAvailable ? aiColors.main : undefined,
                  borderColor: isAIAvailable ? aiColors.main : undefined,
                  '&:hover': {
                    borderColor: isAIAvailable ? aiColors.dark : undefined,
                    bgcolor: isAIAvailable ? hexToRGB(aiColors.main, 0.08) : undefined,
                  },
                }}
              >
                {aiGeneratingDescription ? 'Generating...' : 'Generate with AI'}
              </Button>
            </span>
          </Tooltip>
        </Box>

        {/* Labels Autocomplete with search and create */}
        <Autocomplete
          multiple
          fullWidth
          options={labelOptions}
          getOptionLabel={(option) => option.value}
          value={selectedLabels}
          onChange={(_, newValue) => setSelectedLabels(newValue)}
          onOpen={handleLabelsOpen}
          inputValue={labelInputValue}
          onInputChange={handleLabelInputChange}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          loading={labelsLoading}
          filterOptions={(x) => x} // Disable client-side filtering, server handles it
          renderInput={(params) => (
            <TextField
              {...params}
              label="Labels"
              size="small"
              placeholder={selectedLabels.length === 0 ? "Type to search..." : ""}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {labelsLoading ? <CircularProgress color="inherit" size={16} /> : null}
                    <Tooltip title="Create new label">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreateLabelDialogOpen(true);
                        }}
                        sx={{ 
                          p: 0.5,
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: option.color }} />
              <Typography variant="body2">{option.value}</Typography>
            </Box>
          )}
          ChipProps={{
            size: 'small',
            sx: {
              borderRadius: '4px',
              maxWidth: 80,
              bgcolor: 'action.selected',
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
              '& .MuiChip-deleteIcon': { fontSize: 16 },
            }
          }}
          sx={{
            '& .MuiAutocomplete-tag': {
              maxWidth: 80,
            }
          }}
          limitTags={2}
          noOptionsText={labelsLoading ? "Searching..." : "No labels found"}
        />

        {/* Create Label Dialog */}
        <Dialog 
          open={createLabelDialogOpen} 
          onClose={() => !creatingLabel && setCreateLabelDialogOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Create New Label</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Label Name"
                value={newLabelValue}
                onChange={(e) => setNewLabelValue(e.target.value)}
                size="small"
                fullWidth
                autoFocus
                placeholder="Enter label name..."
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">Color:</Typography>
                <Box
                  sx={{
                    position: 'relative',
                    width: 40,
                    height: 30,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: mode === 'dark' ? 'rgba(255,255,255,0.23)' : 'rgba(0,0,0,0.23)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    bgcolor: newLabelColor,
                    '&:hover': {
                      borderColor: mode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                    },
                  }}
                >
                  <input
                    type="color"
                    value={newLabelColor}
                    onChange={(e) => setNewLabelColor(e.target.value)}
                    style={{ 
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '200%',
                      height: '200%',
                      transform: 'translate(-25%, -25%)',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: 0,
                    }}
                  />
                </Box>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 0.5,
                    bgcolor: newLabelColor,
                    color: '#fff',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {newLabelValue || 'Preview'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setCreateLabelDialogOpen(false)} 
              disabled={creatingLabel}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateLabel}
              disabled={!newLabelValue.trim() || creatingLabel}
              startIcon={creatingLabel ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            >
              {creatingLabel ? 'Creating...' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Create Author Dialog */}
        <Dialog 
          open={createAuthorDialogOpen} 
          onClose={() => !creatingAuthor && setCreateAuthorDialogOpen(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Create New Author</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Author Name"
                value={newAuthorName}
                onChange={(e) => setNewAuthorName(e.target.value)}
                size="small"
                fullWidth
                autoFocus
                placeholder="Enter author name..."
              />
              <Autocomplete
                value={newAuthorType}
                onChange={(_, value) => setNewAuthorType(value || 'Organization')}
                options={['Organization', 'Individual'] as const}
                disableClearable
                renderInput={(params) => (
                  <TextField {...params} label="Author Type" size="small" />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ItemIcon type={option} size="small" />
                    <Typography variant="body2">{option}</Typography>
                  </Box>
                )}
                size="small"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button 
              onClick={() => setCreateAuthorDialogOpen(false)} 
              disabled={creatingAuthor}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleCreateAuthor}
              disabled={!newAuthorName.trim() || creatingAuthor}
              startIcon={creatingAuthor ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            >
              {creatingAuthor ? 'Creating...' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Markings Autocomplete */}
        <Autocomplete
          multiple
          options={availableMarkings}
          getOptionLabel={(option) => option.definition}
          value={selectedMarkings}
          onChange={(_, newValue) => setSelectedMarkings(newValue)}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Marking Definitions"
              size="small"
              placeholder={selectedMarkings.length === 0 ? "Select markings..." : ""}
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  minWidth: 14,
                  minHeight: 14,
                  flexShrink: 0,
                  borderRadius: 0.5,
                  bgcolor: (option as any).x_opencti_color || 'grey.500'
                }}
              />
              <Typography variant="body2">{option.definition}</Typography>
            </Box>
          )}
          ChipProps={{
            size: 'small',
            sx: {
              borderRadius: '4px',
              maxWidth: 80,
              bgcolor: 'action.selected',
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
              '& .MuiChip-deleteIcon': { fontSize: 16 },
            }
          }}
          sx={{
            '& .MuiAutocomplete-tag': {
              maxWidth: 80,
            }
          }}
          limitTags={2}
        />

        {/* PDF Attachment Option */}
        <FormControlLabel
          control={
            <Switch
              checked={attachPdf}
              onChange={(e) => setAttachPdf(e.target.checked)}
              color="primary"
              size="small"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PictureAsPdfOutlined fontSize="small" sx={{ color: attachPdf ? 'primary.main' : 'text.secondary' }} />
              <Typography variant="body2">
                {isPdfSource ? 'Upload the PDF' : 'Attach PDF snapshot of this page'}
              </Typography>
            </Box>
          }
          sx={{ ml: 0 }}
        />

        {/* Create as draft option - only show when creating, not updating */}
        {!updatingContainerId && (
          <FormControlLabel
            control={
              <Switch
                checked={createAsDraft}
                onChange={(e) => setCreateAsDraft(e.target.checked)}
                size="small"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2">Create as draft</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  (requires validation before publishing)
                </Typography>
              </Box>
            }
            sx={{ ml: 0 }}
          />
        )}

        {/* Content field info */}
        <Alert severity="info" sx={{ borderRadius: 1, py: 0.5 }}>
          <Typography variant="caption">
            Page HTML content will be saved to the container's "content" field for indexing.
          </Typography>
        </Alert>

        {entitiesToAdd.length > 0 && (
          <Alert severity="success" sx={{ borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {entitiesToAdd.length} entit{entitiesToAdd.length === 1 ? 'y' : 'ies'} will be added
            </Typography>
          </Alert>
        )}

        <Button
          variant="contained"
          onClick={handleCreateContainer}
          disabled={!containerForm.name || submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <AddOutlined />}
          fullWidth
          sx={{ mt: 1 }}
        >
          {generatingPdf ? 'Generating PDF...' : submitting ? (updatingContainerId ? 'Updating...' : 'Creating...') : (updatingContainerId ? 'Update Container' : 'Create Container')}
        </Button>
      </Box>
    </Box>
  );
};

export default OCTIContainerFormView;

