/**
 * Container Form View Component
 *
 * Form for creating or updating containers (Reports, Groupings, Cases).
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Autocomplete,
  IconButton,
  Alert,
  FormControlLabel,
  Switch,
  Tooltip,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  ArrowForwardOutlined,
  AutoAwesomeOutlined,
  PictureAsPdfOutlined,
} from '@mui/icons-material';
import ItemIcon from '../../shared/components/ItemIcon';
import { hexToRGB } from '../../shared/theme/colors';
import { getAiColor } from '../utils/platform-helpers';
import type { PanelMode, EntityData, PlatformInfo, ContainerFormState, ContainerSpecificFields, AISettings } from '../types';
import type { LabelOption, MarkingOption } from '../types/view-props';

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
  aiSettings: AISettings;
  aiGeneratingDescription: boolean;
  handleGenerateAIDescription: () => void;
  availableLabels: LabelOption[];
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
}) => {
  // Check if AI is available for the container platform
  const selectedIsOpenCTI = openctiPlatforms.some(p => p.id === selectedPlatformId);
  const targetPlatformId = selectedIsOpenCTI ? selectedPlatformId : openctiPlatforms[0]?.id;
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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={() => setPanelMode('container-type')}>
          <ChevronLeftOutlined />
        </IconButton>
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
          options={availableAuthors}
          getOptionLabel={(option) => option.name}
          value={availableAuthors.find(a => a.id === containerSpecificFields.createdBy) || null}
          onChange={(_, newValue) => setContainerSpecificFields(prev => ({
            ...prev,
            createdBy: newValue?.id || ''
          }))}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => (
            <TextField {...params} label="Author" size="small" placeholder="Select author..." />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ItemIcon type={option.entity_type} size="small" />
              <Typography variant="body2">{option.name}</Typography>
            </Box>
          )}
          size="small"
        />

        {/* Description field with AI generate button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TextField
            label="Description"
            value={containerForm.description}
            onChange={(e) => setContainerForm({ ...containerForm, description: e.target.value })}
            multiline
            rows={4}
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

        {/* Labels Autocomplete */}
        <Autocomplete
          multiple
          options={availableLabels}
          getOptionLabel={(option) => option.value}
          value={selectedLabels}
          onChange={(_, newValue) => setSelectedLabels(newValue)}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Labels"
              size="small"
              placeholder={selectedLabels.length === 0 ? "Select labels..." : ""}
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
              borderRadius: 0.5,
              maxWidth: 80,
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
            }
          }}
          sx={{
            '& .MuiAutocomplete-tag': {
              maxWidth: 80,
            }
          }}
          limitTags={2}
        />

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
                  borderRadius: 0.5,
                  bgcolor: (option as any).x_opencti_color || 'grey.500'
                }}
              />
              <Typography variant="body2">{option.definition}</Typography>
            </Box>
          )}
          ChipProps={{
            size: 'small',
            variant: 'outlined',
            sx: {
              borderRadius: 0.5,
              maxWidth: 80,
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
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
                Attach PDF snapshot of this page
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
          endIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <ArrowForwardOutlined />}
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

