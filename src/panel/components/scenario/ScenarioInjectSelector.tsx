/**
 * Scenario Inject Selector
 * 
 * Complete component for Step 1: Inject Selection
 * Includes back button, spacing selector, AI selection, attack pattern list,
 * summary, and navigation actions.
 */

import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Chip,
  Paper,
  MenuItem,
  Alert,
  Checkbox,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  SettingsInputSvideoOutlined,
  EmailOutlined,
  ChevronLeftOutlined,
  ArrowForwardOutlined,
  AutoAwesomeOutlined,
} from '@mui/icons-material';
import { LockPattern } from 'mdi-material-ui';
import { getPlatformIcon, getPlatformColor, getAiColor } from '../../utils/platform-helpers';
import { formatInjectorName, getContractLabel } from '../../utils/injector-helpers';
import { ScenarioSummary } from './ScenarioSummary';
import { loggers } from '../../../shared/utils/logger';
import type {
  PlatformInfo,
  PanelMode,
  SelectedInject,
  ScenarioOverviewData,
  ScenarioFormData,
  PanelAIState,
} from '../../types/panel-types';
import type { OAEVInjectorContract } from '../../../shared/types/openaev';

const log = loggers.panel;

interface ScenarioInjectSelectorProps {
  mode: 'dark' | 'light';
  scenarioOverviewData: ScenarioOverviewData | null;
  selectedInjects: SelectedInject[];
  setSelectedInjects: React.Dispatch<React.SetStateAction<SelectedInject[]>>;
  scenarioTypeAffinity: string;
  scenarioPlatformsAffinity: string[];
  scenarioInjectSpacing: number;
  setScenarioInjectSpacing: (spacing: number) => void;
  setScenarioStep: (step: 0 | 1 | 2) => void;
  setPanelMode: (mode: PanelMode) => void;
  handleClose: () => void;
  openaevPlatforms: PlatformInfo[];
  scenarioPlatformId: string;
  aiSettings: PanelAIState;
  aiSelectingInjects: boolean;
  setAiSelectingInjects: (selecting: boolean) => void;
  currentPageTitle: string;
  currentPageUrl: string;
  scenarioForm: ScenarioFormData;
  getFilteredContracts: (contracts: unknown[]) => OAEVInjectorContract[];
}

export const ScenarioInjectSelector: React.FC<ScenarioInjectSelectorProps> = ({
  mode,
  scenarioOverviewData,
  selectedInjects,
  setSelectedInjects,
  scenarioTypeAffinity,
  scenarioPlatformsAffinity,
  scenarioInjectSpacing,
  setScenarioInjectSpacing,
  setScenarioStep,
  setPanelMode,
  handleClose,
  openaevPlatforms,
  scenarioPlatformId,
  aiSettings,
  aiSelectingInjects,
  setAiSelectingInjects,
  currentPageTitle,
  currentPageUrl,
  scenarioForm,
  getFilteredContracts,
}) => {
  const aiColors = getAiColor(mode);
  const targetPlatform = openaevPlatforms.find(p => p.id === scenarioPlatformId);
  const isAIAvailable = aiSettings.available && targetPlatform?.isEnterprise;
  const isTableTop = scenarioTypeAffinity === 'TABLE-TOP';
  const attackPatterns = scenarioOverviewData?.attackPatterns || [];

  // Handle table-top attack pattern toggle
  const handleTableTopToggle = (attackPatternId: string, attackPatternName: string) => {
    const isSelected = selectedInjects.some(i => i.attackPatternId === attackPatternId);
    
    setSelectedInjects(prev => {
      if (isSelected) {
        return prev.filter(i => i.attackPatternId !== attackPatternId);
      }
      return [
        ...prev,
        {
          attackPatternId,
          attackPatternName,
          contractId: 'email-placeholder',
          contractLabel: 'Email Notification',
          delayMinutes: prev.length * scenarioInjectSpacing,
        },
      ];
    });
  };

  // Handle contract selection for technical scenarios
  const handleContractSelect = (
    attackPatternId: string,
    attackPatternName: string,
    contractId: string,
    contractLabel: string
  ) => {
    setSelectedInjects(prev => {
      if (!contractId) {
        return prev.filter(i => i.attackPatternId !== attackPatternId);
      }
      
      const existing = prev.findIndex(i => i.attackPatternId === attackPatternId);
      const newInject: SelectedInject = {
        attackPatternId,
        attackPatternName,
        contractId,
        contractLabel,
        delayMinutes: existing >= 0 ? prev[existing].delayMinutes : prev.length * scenarioInjectSpacing,
      };
      
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newInject;
        return updated;
      }
      return [...prev, newInject];
    });
  };

  // Handle AI inject selection
  const handleAISelectInjects = async () => {
    setAiSelectingInjects(true);
    try {
      const playableAps = attackPatterns.filter(ap => getFilteredContracts(ap.contracts || []).length > 0);
      
      const response = await chrome.runtime.sendMessage({
        type: 'AI_GENERATE_SCENARIO',
        payload: {
          pageTitle: currentPageTitle,
          pageUrl: currentPageUrl,
          pageContent: document.body?.innerText?.substring(0, 3000) || '',
          scenarioName: scenarioForm.name || 'Security Simulation',
          typeAffinity: scenarioTypeAffinity,
          platformAffinity: scenarioPlatformsAffinity,
          detectedAttackPatterns: playableAps.map(ap => ({
            name: ap.name,
            id: ap.externalId,
            description: ap.description,
            availableInjects: getFilteredContracts(ap.contracts || []).map((c: OAEVInjectorContract) => ({
              id: c.injector_contract_id,
              label: c.injector_contract_labels?.en || c.injector_name || 'Unknown',
            })),
          })),
        },
      });
      
      if (response?.success && response.data?.injects) {
        const newSelectedInjects: SelectedInject[] = [];
        let delayAccumulator = 0;
        
        for (const aiInject of response.data.injects) {
          // Match by attackPatternId (external ID like T1566) which AI returns
          const ap = playableAps.find(p => 
            p.externalId === aiInject.attackPatternId ||
            // Fallback: try matching by name if AI returned a name-based title
            (aiInject.title && p.name.toLowerCase() === aiInject.title.toLowerCase())
          );
          
          if (ap) {
            const contracts = getFilteredContracts(ap.contracts || []);
            const contract = contracts[0];
            
            if (contract) {
              newSelectedInjects.push({
                attackPatternId: ap.id,
                attackPatternName: ap.name,
                contractId: contract.injector_contract_id,
                contractLabel: getContractLabel(contract),
                delayMinutes: delayAccumulator,
              });
              delayAccumulator += scenarioInjectSpacing;
            }
          }
        }
        
        if (newSelectedInjects.length > 0) {
          setSelectedInjects(newSelectedInjects);
        } else {
          log.warn('AI returned injects but none matched available attack patterns');
        }
      } else if (response?.success && (!response.data?.injects || response.data.injects.length === 0)) {
        log.info('AI returned no relevant injects for this page content');
      }
    } catch (error) {
      log.error('AI inject selection failed:', error);
    } finally {
      setAiSelectingInjects(false);
    }
  };

  // Render TABLE-TOP attack pattern list (email placeholders)
  const renderTableTopList = () => {
    if (attackPatterns.length === 0) {
      return (
        <Alert severity="info" sx={{ mb: 2 }}>
          No attack patterns found. Add attack patterns to generate email notifications.
        </Alert>
      );
    }

    return (
      <Box sx={{ flex: 1, overflow: 'auto', mb: 2, minHeight: 0 }}>
        {attackPatterns.map((ap) => {
          const isSelected = selectedInjects.some(i => i.attackPatternId === ap.id);
          
          return (
            <Paper
              key={ap.id}
              elevation={0}
              onClick={() => handleTableTopToggle(ap.id, ap.name)}
              sx={{
                p: 1.5,
                mb: 1,
                border: 2,
                borderColor: isSelected ? '#42a5f5' : 'divider',
                borderRadius: 1,
                cursor: 'pointer',
                bgcolor: isSelected ? 'rgba(66, 165, 245, 0.08)' : 'transparent',
                '&:hover': { bgcolor: isSelected ? 'rgba(66, 165, 245, 0.12)' : 'action.hover' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Checkbox checked={isSelected} size="small" sx={{ p: 0, mr: 0.5 }} />
                <EmailOutlined sx={{ fontSize: 18, color: isSelected ? '#42a5f5' : 'text.secondary' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>{ap.name}</Typography>
                <Chip label={ap.externalId} size="small" sx={{ fontSize: 10, height: 20 }} />
              </Box>
            </Paper>
          );
        })}
      </Box>
    );
  };

  // Render Technical attack pattern list (inject contracts)
  const renderTechnicalList = () => {
    if (attackPatterns.length === 0) {
      return (
        <Alert severity="info" sx={{ mb: 2 }}>
          No attack patterns found on this page.
        </Alert>
      );
    }

    return (
      <Box sx={{ flex: 1, overflow: 'auto', mb: 2, minHeight: 0 }}>
        {attackPatterns.map((ap) => {
          const filteredContracts = getFilteredContracts(ap.contracts || []);
          if (filteredContracts.length === 0) return null;
          
          const selectedInject = selectedInjects.find(i => i.attackPatternId === ap.id);
          
          return (
            <Paper key={ap.id} elevation={0} sx={{ p: 1.5, mb: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <LockPattern sx={{ fontSize: 18, color: '#d4e157' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>{ap.name}</Typography>
                <Chip label={ap.externalId} size="small" sx={{ fontSize: 10, height: 20 }} />
              </Box>
              
              <TextField
                select
                label="Select inject"
                size="small"
                fullWidth
                value={selectedInject?.contractId || ''}
                onChange={(e) => {
                  const contract = filteredContracts.find(c => c.injector_contract_id === e.target.value);
                  handleContractSelect(
                    ap.id,
                    ap.name,
                    e.target.value,
                    contract ? getContractLabel(contract) : ''
                  );
                }}
                sx={{ mt: 1 }}
                SelectProps={{
                  renderValue: (value): React.ReactNode => {
                    if (!value) return <em style={{ color: 'inherit', opacity: 0.5 }}>Skip this attack pattern</em>;
                    const contract = filteredContracts.find(c => c.injector_contract_id === value);
                    if (!contract) return String(value);
                    
                    const label = getContractLabel(contract);
                    const injectorName = contract.injector_name || contract.injector_type || '';
                    const platforms = contract.injector_contract_platforms || [];
                    
                    return (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                          {label}
                        </Typography>
                        {injectorName && (
                          <Chip
                            label={formatInjectorName(injectorName)}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: 'action.selected',
                              flexShrink: 0,
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        )}
                        {platforms.length > 0 && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                            {platforms.slice(0, 3).map((p: string) => (
                              <Box key={p} sx={{ display: 'flex', alignItems: 'center', color: getPlatformColor(p) }}>
                                {getPlatformIcon(p)}
                              </Box>
                            ))}
                            {platforms.length > 3 && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                                +{platforms.length - 3}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  },
                }}
              >
                <MenuItem value=""><em>Skip this attack pattern</em></MenuItem>
                {filteredContracts.map((contract) => {
                  const label = getContractLabel(contract);
                  const injectorName = contract.injector_name || contract.injector_type || '';
                  const platforms = contract.injector_contract_platforms || [];
                  
                  return (
                    <MenuItem 
                      key={contract.injector_contract_id} 
                      value={contract.injector_contract_id}
                      sx={{ 
                        py: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 0.5,
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3 }}>
                        {label}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        {injectorName && (
                          <Chip
                            icon={<SettingsInputSvideoOutlined sx={{ fontSize: 12 }} />}
                            label={formatInjectorName(injectorName)}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: 'action.selected',
                              '& .MuiChip-icon': { ml: 0.5 },
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        )}
                        {platforms.length > 0 && platforms.slice(0, 3).map((platform: string) => (
                          <Chip
                            key={platform}
                            icon={getPlatformIcon(platform)}
                            label={platform}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: `${getPlatformColor(platform)}22`,
                              color: getPlatformColor(platform),
                              borderColor: `${getPlatformColor(platform)}44`,
                              border: 1,
                              '& .MuiChip-icon': { ml: 0.5, color: 'inherit' },
                              '& .MuiChip-label': { px: 0.75 },
                            }}
                          />
                        ))}
                        {platforms.length > 3 && (
                          <Chip
                            label={`+${platforms.length - 3}`}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: 'action.selected',
                              '& .MuiChip-label': { px: 0.5 },
                            }}
                          />
                        )}
                      </Box>
                    </MenuItem>
                  );
                })}
              </TextField>
            </Paper>
          );
        })}
      </Box>
    );
  };

  return (
    <>
      {/* Back button */}
      <Box sx={{ mb: 1.5, flexShrink: 0 }}>
        <Button
          size="small"
          startIcon={<ChevronLeftOutlined />}
          onClick={() => setScenarioStep(0)}
          sx={{ 
            color: 'text.secondary',
            textTransform: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          Back to affinity selection
        </Button>
      </Box>
      
      {isTableTop ? (
        /* Table-top: Email placeholders */
        <>
          <TextField
            select
            label="Email spacing"
            size="small"
            fullWidth
            value={scenarioInjectSpacing}
            onChange={(e) => setScenarioInjectSpacing(Number(e.target.value))}
            helperText="Time interval between each email notification"
            sx={{ mb: 2 }}
          >
            <MenuItem value={1}>1 minute</MenuItem>
            <MenuItem value={5}>5 minutes</MenuItem>
            <MenuItem value={10}>10 minutes</MenuItem>
            <MenuItem value={30}>30 minutes</MenuItem>
          </TextField>
          
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Select Attack Patterns ({selectedInjects.length}/{attackPatterns.length})
          </Typography>
          
          {renderTableTopList()}
        </>
      ) : (
        /* Technical: Inject contracts */
        <>
          <TextField
            select
            label="Inject spacing"
            size="small"
            fullWidth
            value={scenarioInjectSpacing}
            onChange={(e) => setScenarioInjectSpacing(Number(e.target.value))}
            helperText="Time interval between each inject execution"
            sx={{ mb: 2 }}
          >
            <MenuItem value={1}>1 minute</MenuItem>
            <MenuItem value={5}>5 minutes</MenuItem>
            <MenuItem value={10}>10 minutes</MenuItem>
            <MenuItem value={30}>30 minutes</MenuItem>
          </TextField>
          
          {/* AI Select Injects Button */}
          {isAIAvailable && attackPatterns.some(ap => getFilteredContracts(ap.contracts || []).length > 0) && (
            <Button
              variant="outlined"
              fullWidth
              disabled={aiSelectingInjects}
              onClick={handleAISelectInjects}
              startIcon={aiSelectingInjects ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeOutlined />}
              sx={{
                mb: 2,
                textTransform: 'none',
                borderColor: aiColors.main,
                color: aiColors.main,
              }}
            >
              {aiSelectingInjects ? 'Selecting injects...' : 'Select using AI'}
            </Button>
          )}
          
          {renderTechnicalList()}
        </>
      )}
      
      {/* Summary */}
      <ScenarioSummary
        selectedInjects={selectedInjects}
        scenarioInjectSpacing={scenarioInjectSpacing}
        isTableTop={isTableTop}
      />
      
      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <Button variant="outlined" onClick={handleClose} sx={{ flex: 1 }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => setPanelMode('scenario-form')}
          startIcon={<ArrowForwardOutlined />}
          sx={{ flex: 1 }}
        >
          Next
        </Button>
      </Box>
    </>
  );
};

export default ScenarioInjectSelector;
