/**
 * Scenario Form View
 * 
 * Component for the scenario creation form (step 2/3).
 * Includes name, description, category, targets, and timeline preview.
 */

import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Paper,
  CircularProgress,
  Autocomplete,
  Stepper,
  Step,
  StepLabel,
  MenuItem,
  Select,
  FormControl,
  Tooltip,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  AddOutlined,
  ComputerOutlined,
  LanOutlined,
  GroupsOutlined,
  EmailOutlined,
  AutoAwesomeOutlined,
} from '@mui/icons-material';
import { LockPattern } from 'mdi-material-ui';
import { getPlatformIcon, getPlatformColor } from '../../utils/platform-helpers';
import {
  SCENARIO_CATEGORY_OPTIONS,
  SCENARIO_MAIN_FOCUS_OPTIONS,
  SCENARIO_SEVERITY_OPTIONS,
} from '../../../shared/types/openaev';
import type { PlatformInfo, PanelMode } from '../../types/panel-types';

interface ScenarioForm {
  name: string;
  description: string;
  subtitle: string;
  category: string;
  mainFocus: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SelectedInject {
  attackPatternId: string;
  attackPatternName: string;
  contractId: string;
  contractLabel: string;
  delayMinutes: number;
}

interface EmailTimelineItem {
  attackPatternId: string;
  attackPatternName: string;
  externalId: string;
  killChainPhases: Array<{ phase_name?: string; kill_chain_name?: string }>;
  delayMinutes: number;
}

interface ScenarioFormViewProps {
  mode: 'dark' | 'light';
  openaevLogoPath: string;
  openaevPlatforms: PlatformInfo[];
  scenarioPlatformId: string;
  scenarioForm: ScenarioForm;
  setScenarioForm: React.Dispatch<React.SetStateAction<ScenarioForm>>;
  scenarioTypeAffinity: string;
  scenarioPlatformsAffinity: string[];
  scenarioInjectSpacing: number;
  selectedInjects: SelectedInject[];
  scenarioStep: number;
  setScenarioStep: (step: number) => void;
  setPanelMode: React.Dispatch<React.SetStateAction<PanelMode>>;
  // Team selection (for table-top)
  scenarioTeams: Array<{ team_id: string; team_name: string }>;
  scenarioSelectedTeam: string | null;
  setScenarioSelectedTeam: (id: string | null) => void;
  // Asset selection (for technical)
  scenarioAssets: Array<{ asset_id: string; asset_name?: string; endpoint_hostname?: string }>;
  scenarioAssetGroups: Array<{ asset_group_id: string; asset_group_name: string }>;
  scenarioTargetType: 'asset' | 'asset_group';
  setScenarioTargetType: (type: 'asset' | 'asset_group') => void;
  scenarioSelectedAsset: string | null;
  setScenarioSelectedAsset: (id: string | null) => void;
  scenarioSelectedAssetGroup: string | null;
  setScenarioSelectedAssetGroup: (id: string | null) => void;
  // Email generation
  scenarioEmails: Array<{ attackPatternId: string; subject: string; body: string }>;
  setScenarioEmails: React.Dispatch<React.SetStateAction<Array<{ attackPatternId: string; subject: string; body: string }>>>;
  scenarioAIEmailLanguage: string;
  setScenarioAIEmailLanguage: (lang: string) => void;
  // AI state
  aiSettings: { available: boolean };
  aiFillingEmails: boolean;
  setAiFillingEmails: (value: boolean) => void;
  // Page context
  currentPageTitle: string;
  currentPageUrl: string;
  // Overview data
  scenarioOverviewData: { attackPatterns?: Array<{ id: string; externalId?: string; killChainPhases?: Array<{ phase_name?: string; kill_chain_name?: string }> }> } | null;
  // Submit
  submitting: boolean;
  onCreateScenario: () => void;
  onClose: () => void;
}

export const ScenarioFormView: React.FC<ScenarioFormViewProps> = ({
  openaevLogoPath,
  openaevPlatforms,
  scenarioPlatformId,
  scenarioForm,
  setScenarioForm,
  scenarioTypeAffinity,
  scenarioPlatformsAffinity,
  scenarioInjectSpacing,
  selectedInjects,
  setScenarioStep,
  setPanelMode,
  scenarioTeams,
  scenarioSelectedTeam,
  setScenarioSelectedTeam,
  scenarioAssets,
  scenarioAssetGroups,
  scenarioTargetType,
  setScenarioTargetType,
  scenarioSelectedAsset,
  setScenarioSelectedAsset,
  scenarioSelectedAssetGroup,
  setScenarioSelectedAssetGroup,
  scenarioEmails,
  setScenarioEmails,
  scenarioAIEmailLanguage,
  setScenarioAIEmailLanguage,
  aiSettings,
  aiFillingEmails,
  setAiFillingEmails,
  currentPageTitle,
  currentPageUrl,
  scenarioOverviewData,
  submitting,
  onCreateScenario,
  onClose,
}) => {
  const isTableTop = scenarioTypeAffinity === 'TABLE-TOP';
  
  // For table-top, create email timeline from selected attack patterns only
  const emailTimeline: EmailTimelineItem[] = isTableTop && selectedInjects.length > 0
    ? selectedInjects.map((inject, index) => {
        const ap = scenarioOverviewData?.attackPatterns?.find(p => p.id === inject.attackPatternId);
        return {
          attackPatternId: inject.attackPatternId,
          attackPatternName: inject.attackPatternName,
          externalId: ap?.externalId || '',
          killChainPhases: ap?.killChainPhases || [],
          delayMinutes: index * scenarioInjectSpacing,
        };
      })
    : [];

  const targetPlatform = openaevPlatforms.find(p => p.id === scenarioPlatformId);
  const isAIAvailable = aiSettings.available && targetPlatform?.isEnterprise;

  const handleGenerateEmails = async () => {
    if (!isAIAvailable) return;
    
    setAiFillingEmails(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AI_GENERATE_EMAILS',
        payload: {
          pageTitle: currentPageTitle,
          pageUrl: currentPageUrl,
          pageContent: document.body?.innerText?.substring(0, 3000) || '',
          scenarioName: scenarioForm.name || 'Security Simulation',
          language: scenarioAIEmailLanguage,
          attackPatterns: emailTimeline.map(email => ({
            id: email.attackPatternId,
            name: email.attackPatternName,
            externalId: email.externalId,
            killChainPhases: email.killChainPhases,
          })),
        },
      });
      
      if (response?.success && response.data?.emails) {
        const mappedEmails = response.data.emails.map((aiEmail: { attackPatternId: string; subject: string; body: string }) => {
          const matchingAp = emailTimeline.find(e => 
            e.attackPatternId === aiEmail.attackPatternId ||
            e.externalId === aiEmail.attackPatternId
          );
          return {
            ...aiEmail,
            attackPatternId: matchingAp?.attackPatternId || aiEmail.attackPatternId,
          };
        });
        setScenarioEmails(mappedEmails);
      }
    } catch {
      // Error handled by caller
    } finally {
      setAiFillingEmails(false);
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexShrink: 0 }}>
        <img src={openaevLogoPath} alt="OpenAEV" style={{ height: 24, width: 'auto' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Create Scenario
        </Typography>
      </Box>
      
      {/* Stepper */}
      <Stepper activeStep={2} sx={{ mb: 3, flexShrink: 0 }}>
        <Step completed>
          <StepLabel>Select Affinity</StepLabel>
        </Step>
        <Step completed>
          <StepLabel>Select Injects</StepLabel>
        </Step>
        <Step>
          <StepLabel>Configure Details</StepLabel>
        </Step>
      </Stepper>
      
      {/* Back button */}
      <Box sx={{ mb: 1.5, flexShrink: 0 }}>
        <Button
          size="small"
          startIcon={<ChevronLeftOutlined />}
          onClick={() => {
            setScenarioStep(1);
            setPanelMode('scenario-overview');
          }}
          sx={{ 
            color: 'text.secondary',
            textTransform: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          Back to inject selection
        </Button>
      </Box>
      
      {/* Affinity Summary */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', flexShrink: 0 }}>
        <Chip 
          label={`Type: ${scenarioTypeAffinity}`} 
          size="small" 
          sx={{ 
            bgcolor: isTableTop ? '#42a5f5' : '#4caf50',
            color: 'white',
          }} 
        />
        {!isTableTop && scenarioPlatformsAffinity.map(p => (
          <Chip 
            key={p}
            icon={getPlatformIcon(p)}
            label={p.charAt(0).toUpperCase() + p.slice(1)} 
            size="small" 
            sx={{ 
              bgcolor: getPlatformColor(p),
              color: 'white',
              '& .MuiChip-icon': { color: 'white', ml: 0.5 },
            }} 
          />
        ))}
      </Box>
      
      {/* Form */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        <TextField
          label="Scenario Name"
          value={scenarioForm.name}
          onChange={(e) => setScenarioForm(prev => ({ ...prev, name: e.target.value }))}
          fullWidth
          required
          size="small"
          sx={{ mb: 2 }}
        />
        
        <TextField
          label="Subtitle"
          value={scenarioForm.subtitle}
          onChange={(e) => setScenarioForm(prev => ({ ...prev, subtitle: e.target.value }))}
          fullWidth
          size="small"
          placeholder="Short tagline for the scenario"
          sx={{ mb: 2 }}
        />
        
        {/* Category and Main Focus side by side */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            select
            label="Category"
            value={scenarioForm.category}
            onChange={(e) => setScenarioForm(prev => ({ ...prev, category: e.target.value }))}
            fullWidth
            size="small"
          >
            {SCENARIO_CATEGORY_OPTIONS.map((cat) => (
              <MenuItem key={cat.value} value={cat.value}>
                {cat.label}
              </MenuItem>
            ))}
          </TextField>
          
          <TextField
            select
            label="Main Focus"
            value={scenarioForm.mainFocus}
            onChange={(e) => setScenarioForm(prev => ({ ...prev, mainFocus: e.target.value }))}
            fullWidth
            size="small"
          >
            {SCENARIO_MAIN_FOCUS_OPTIONS.map((focus) => (
              <MenuItem key={focus.value} value={focus.value}>
                {focus.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        
        {/* Severity */}
        <TextField
          select
          label="Severity"
          value={scenarioForm.severity}
          onChange={(e) => setScenarioForm(prev => ({ ...prev, severity: e.target.value as 'low' | 'medium' | 'high' | 'critical' }))}
          fullWidth
          size="small"
          sx={{ mb: 2 }}
        >
          {SCENARIO_SEVERITY_OPTIONS.map((sev) => (
            <MenuItem key={sev.value} value={sev.value}>
              {sev.label}
            </MenuItem>
          ))}
        </TextField>
        
        <TextField
          label="Description"
          value={scenarioForm.description}
          onChange={(e) => setScenarioForm(prev => ({ ...prev, description: e.target.value }))}
          fullWidth
          multiline
          rows={4}
          placeholder="Detailed description of the scenario..."
          sx={{ mb: 2 }}
        />
        
        {/* Target Selection */}
        {isTableTop ? (
          /* Team Selection for Table-top */
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
              Default Team (for all email notifications)
            </Typography>
            {scenarioTeams.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Loading teams...
                </Typography>
              </Box>
            ) : (
              <Autocomplete
                options={scenarioTeams}
                getOptionLabel={(option) => option.team_name || 'Unknown'}
                value={scenarioTeams.find(t => t.team_id === scenarioSelectedTeam) || null}
                onChange={(_, value) => setScenarioSelectedTeam(value?.team_id || null)}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Select Team" 
                    size="small" 
                    placeholder="Choose a team"
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props} key={option.team_id}>
                    <GroupsOutlined sx={{ mr: 1, fontSize: 18, color: 'primary.main' }} />
                    <Typography variant="body2">{option.team_name}</Typography>
                  </Box>
                )}
                size="small"
                noOptionsText="No teams found"
              />
            )}
          </Box>
        ) : (
          /* Asset/Asset Group Selection for Technical scenarios */
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
              Default Target (for all injects)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Button
                variant={scenarioTargetType === 'asset' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setScenarioTargetType('asset')}
                startIcon={<ComputerOutlined />}
                sx={{ flex: 1, minWidth: 0 }}
              >
                Asset
              </Button>
              <Button
                variant={scenarioTargetType === 'asset_group' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setScenarioTargetType('asset_group')}
                startIcon={<LanOutlined />}
                sx={{ flex: 1, minWidth: 0 }}
              >
                Asset Group
              </Button>
            </Box>
            {scenarioTargetType === 'asset' ? (
              scenarioAssets.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Loading assets...
                  </Typography>
                </Box>
              ) : (
                <Autocomplete
                  options={scenarioAssets}
                  getOptionLabel={(option) => option.asset_name || option.endpoint_hostname || 'Unknown'}
                  value={scenarioAssets.find(a => a.asset_id === scenarioSelectedAsset) || null}
                  onChange={(_, value) => setScenarioSelectedAsset(value?.asset_id || null)}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Select Asset" 
                      size="small"
                      placeholder="Choose an asset"
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.asset_id}>
                      <ComputerOutlined sx={{ mr: 1, fontSize: 18, color: 'primary.main' }} />
                      <Typography variant="body2">{option.asset_name || option.endpoint_hostname}</Typography>
                    </Box>
                  )}
                  size="small"
                  noOptionsText="No assets found"
                />
              )
            ) : (
              scenarioAssetGroups.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                  <CircularProgress size={20} />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Loading asset groups...
                  </Typography>
                </Box>
              ) : (
                <Autocomplete
                  options={scenarioAssetGroups}
                  getOptionLabel={(option) => option.asset_group_name || 'Unknown'}
                  value={scenarioAssetGroups.find(g => g.asset_group_id === scenarioSelectedAssetGroup) || null}
                  onChange={(_, value) => setScenarioSelectedAssetGroup(value?.asset_group_id || null)}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Select Asset Group" 
                      size="small"
                      placeholder="Choose an asset group"
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.asset_group_id}>
                      <LanOutlined sx={{ mr: 1, fontSize: 18, color: 'primary.main' }} />
                      <Typography variant="body2">{option.asset_group_name}</Typography>
                    </Box>
                  )}
                  size="small"
                  noOptionsText="No asset groups found"
                />
              )
            )}
          </Box>
        )}
        
        {/* Timeline Preview - Simplified */}
        {isTableTop && emailTimeline.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Email Timeline ({emailTimeline.length})
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <Select
                    value={scenarioAIEmailLanguage}
                    onChange={(e) => setScenarioAIEmailLanguage(e.target.value)}
                    sx={{ fontSize: 12, height: 30 }}
                  >
                    <MenuItem value="english">English</MenuItem>
                    <MenuItem value="french">Français</MenuItem>
                    <MenuItem value="german">Deutsch</MenuItem>
                    <MenuItem value="spanish">Español</MenuItem>
                  </Select>
                </FormControl>
                <Tooltip title={isAIAvailable ? 'Use AI to generate email content' : 'AI not available'}>
                  <span>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={!isAIAvailable || aiFillingEmails}
                      onClick={handleGenerateEmails}
                      startIcon={aiFillingEmails ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeOutlined />}
                      sx={{ textTransform: 'none' }}
                    >
                      {aiFillingEmails ? 'Generating...' : 'Fill with AI'}
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Box>
            {/* Simplified email list */}
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {emailTimeline.map((email, index) => {
                const aiEmail = scenarioEmails.find(e => e.attackPatternId === email.attackPatternId);
                return (
                  <Paper key={email.attackPatternId} elevation={0} sx={{ p: 1, mb: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={`#${index + 1}`} size="small" sx={{ height: 18, fontSize: 10 }} />
                      <EmailOutlined sx={{ fontSize: 16, color: aiEmail ? '#4caf50' : 'text.secondary' }} />
                      <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                        {aiEmail?.subject || `[Simulation] ${email.attackPatternName}`}
                      </Typography>
                      <Chip label={`+${email.delayMinutes}m`} size="small" sx={{ height: 18, fontSize: 10 }} />
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Box>
        )}
        
        {/* Technical inject timeline */}
        {!isTableTop && selectedInjects.length > 0 && (
          <Box sx={{ flexShrink: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Inject Timeline ({selectedInjects.length})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {selectedInjects.map((inject, index) => (
                <Paper
                  key={inject.attackPatternId}
                  elevation={0}
                  sx={{
                    p: 1,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={`#${index + 1}`} size="small" sx={{ height: 18, fontSize: 10 }} />
                    <LockPattern sx={{ fontSize: 16, color: '#d4e157' }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{inject.attackPatternName}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>{inject.contractLabel}</Typography>
                    </Box>
                    <Chip label={`+${inject.delayMinutes}m`} size="small" sx={{ height: 18, fontSize: 10 }} />
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        )}
      </Box>
      
      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, pt: 2, flexShrink: 0 }}>
        <Button
          variant="outlined"
          onClick={onClose}
          sx={{ flex: 1 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onCreateScenario}
          disabled={!scenarioForm.name || submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <AddOutlined />}
          sx={{ flex: 1 }}
        >
          Create Scenario
        </Button>
      </Box>
    </Box>
  );
};

export default ScenarioFormView;

