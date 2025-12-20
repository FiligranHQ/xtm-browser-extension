/**
 * Scenario Inject Selector
 * 
 * Component for selecting attack patterns and their associated injector contracts
 * to include in a scenario.
 */

import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Chip,
  Paper,
  MenuItem,
} from '@mui/material';
import {
  SettingsInputSvideoOutlined,
} from '@mui/icons-material';
import { LockPattern } from 'mdi-material-ui';
import { getPlatformIcon, getPlatformColor } from '../../utils/platform-helpers';
import { formatInjectorName, getContractLabel } from '../../utils/injector-helpers';

interface AttackPattern {
  id: string;
  name: string;
  externalId?: string;
  killChainPhases?: Array<{ phase_name?: string; kill_chain_name?: string }>;
  contracts?: Array<{
    injector_contract_id: string;
    injector_contract_labels?: { en?: string };
    injector_name?: string;
    injector_type?: string;
    injector_contract_platforms?: string[];
    injector_contract_attack_patterns?: string[];
    injector_contract_kill_chain_phases?: Array<{ phase_name?: string }>;
  }>;
}

interface SelectedInject {
  attackPatternId: string;
  attackPatternName: string;
  contractId: string;
  contractLabel: string;
  delayMinutes: number;
}

interface ScenarioInjectSelectorProps {
  attackPatterns: AttackPattern[];
  selectedInjects: SelectedInject[];
  setSelectedInjects: React.Dispatch<React.SetStateAction<SelectedInject[]>>;
  scenarioTypeAffinity: string;
  scenarioPlatformsAffinity: string[];
  scenarioInjectSpacing: number;
  isTableTop: boolean;
}

export const ScenarioInjectSelector: React.FC<ScenarioInjectSelectorProps> = ({
  attackPatterns,
  selectedInjects,
  setSelectedInjects,
  scenarioTypeAffinity,
  scenarioPlatformsAffinity,
  scenarioInjectSpacing,
  isTableTop,
}) => {
  // Handle contract selection for an attack pattern
  const handleContractSelect = (attackPatternId: string, attackPatternName: string, contractId: string, contractLabel: string) => {
    setSelectedInjects(prev => {
      const existing = prev.find(i => i.attackPatternId === attackPatternId);
      if (!contractId) {
        // Remove selection
        return prev.filter(i => i.attackPatternId !== attackPatternId);
      }
      if (existing) {
        return prev.map(i => 
          i.attackPatternId === attackPatternId 
            ? { ...i, contractId, contractLabel }
            : i
        );
      }
      const newInject: SelectedInject = {
        attackPatternId,
        attackPatternName,
        contractId,
        contractLabel,
        delayMinutes: prev.length * scenarioInjectSpacing,
      };
      return [...prev, newInject];
    });
  };

  // For table-top: handle attack pattern toggle
  const handleTableTopToggle = (attackPatternId: string, attackPatternName: string, checked: boolean) => {
    setSelectedInjects(prev => {
      if (checked) {
        const newInject: SelectedInject = {
          attackPatternId,
          attackPatternName,
          contractId: 'email',
          contractLabel: 'Email Notification',
          delayMinutes: prev.length * scenarioInjectSpacing,
        };
        return [...prev, newInject];
      }
      return prev.filter(i => i.attackPatternId !== attackPatternId);
    });
  };

  if (attackPatterns.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
        <LockPattern sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
        <Typography variant="body2">
          No attack patterns found on this page
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {attackPatterns.map((ap) => {
        const selectedInject = selectedInjects.find(i => i.attackPatternId === ap.id);
        
        // Filter contracts by type affinity and platform affinity
        const filteredContracts = (ap.contracts || []).filter(contract => {
          const platforms = contract.injector_contract_platforms || [];
          const attackPatternIds = contract.injector_contract_attack_patterns || [];
          
          // Must match the attack pattern
          if (attackPatternIds.length > 0 && !attackPatternIds.includes(ap.id)) {
            return false;
          }
          
          // Filter by platform affinity if not TABLE-TOP
          if (scenarioTypeAffinity !== 'TABLE-TOP' && platforms.length > 0) {
            const hasMatchingPlatform = scenarioPlatformsAffinity.some(p => 
              platforms.map(pl => pl.toLowerCase()).includes(p.toLowerCase())
            );
            if (!hasMatchingPlatform) return false;
          }
          
          return true;
        });

        // For table-top, show checkbox instead of dropdown
        if (isTableTop) {
          return (
            <Paper
              key={ap.id}
              elevation={0}
              sx={{
                p: 1.5,
                border: 1,
                borderColor: selectedInject ? 'primary.main' : 'divider',
                borderRadius: 1,
                cursor: 'pointer',
                bgcolor: selectedInject ? 'action.selected' : 'transparent',
              }}
              onClick={() => handleTableTopToggle(ap.id, ap.name, !selectedInject)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockPattern sx={{ fontSize: 18, color: '#d4e157', flexShrink: 0 }} />
                {ap.externalId && (
                  <Chip label={ap.externalId} size="small" sx={{ height: 18, fontSize: 10 }} />
                )}
                <Typography variant="body2" sx={{ flex: 1, fontWeight: selectedInject ? 600 : 400 }}>
                  {ap.name}
                </Typography>
                <Chip 
                  label={selectedInject ? 'Selected' : 'Select'} 
                  size="small"
                  color={selectedInject ? 'primary' : 'default'}
                  sx={{ height: 20, fontSize: 10 }}
                />
              </Box>
            </Paper>
          );
        }

        // For technical scenarios, show contract dropdown
        return (
          <Paper
            key={ap.id}
            elevation={0}
            sx={{
              p: 1.5,
              border: 1,
              borderColor: selectedInject ? 'primary.main' : 'divider',
              borderRadius: 1,
              bgcolor: selectedInject ? 'action.selected' : 'transparent',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <LockPattern sx={{ fontSize: 18, color: '#d4e157', flexShrink: 0 }} />
              {ap.externalId && (
                <Chip label={ap.externalId} size="small" sx={{ height: 18, fontSize: 10 }} />
              )}
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                {ap.name}
              </Typography>
            </Box>
            
            <TextField
              select
              fullWidth
              size="small"
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

export default ScenarioInjectSelector;

