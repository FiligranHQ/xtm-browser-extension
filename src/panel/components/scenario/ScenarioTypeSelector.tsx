/**
 * Scenario Type Selector
 * 
 * Component for selecting scenario type (ENDPOINT, CLOUD, WEB, TABLE-TOP)
 * and platform affinity (Windows, Linux, macOS).
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ComputerOutlined,
  CloudOutlined,
  LanguageOutlined,
  GroupsOutlined,
  AutoAwesomeOutlined,
} from '@mui/icons-material';
import { hexToRGB } from '../../../shared/theme/colors';
import { getAiColor, getPlatformIcon, getPlatformColor } from '../../utils/platform-helpers';

// Type options for scenario creation
const SCENARIO_TYPE_OPTIONS = [
  { 
    value: 'ENDPOINT', 
    label: 'Endpoint', 
    icon: ComputerOutlined, 
    description: 'Target endpoint systems' 
  },
  { 
    value: 'CLOUD', 
    label: 'Cloud', 
    icon: CloudOutlined, 
    description: 'Target cloud infrastructure' 
  },
  { 
    value: 'WEB', 
    label: 'Web', 
    icon: LanguageOutlined, 
    description: 'Target web applications' 
  },
  { 
    value: 'TABLE-TOP', 
    label: 'Table-Top', 
    icon: GroupsOutlined, 
    description: 'Email-based exercise' 
  },
];

interface ScenarioTypeSelectorProps {
  mode: 'dark' | 'light';
  scenarioTypeAffinity: string;
  setScenarioTypeAffinity: (type: string) => void;
  scenarioPlatformsAffinity: string[];
  setScenarioPlatformsAffinity: React.Dispatch<React.SetStateAction<string[]>>;
  scenarioInjectSpacing: number;
  setScenarioInjectSpacing: (spacing: number) => void;
  isAIAvailable: boolean;
  scenarioAIMode: boolean;
  scenarioAIGenerating: boolean;
  onAIGenerate: () => void;
}

export const ScenarioTypeSelector: React.FC<ScenarioTypeSelectorProps> = ({
  mode,
  scenarioTypeAffinity,
  setScenarioTypeAffinity,
  scenarioPlatformsAffinity,
  setScenarioPlatformsAffinity,
  setScenarioInjectSpacing,
  isAIAvailable,
  scenarioAIMode,
  scenarioAIGenerating,
  onAIGenerate,
}) => {
  const aiColors = getAiColor(mode);

  return (
    <Box sx={{ mb: 3 }}>
      {/* Scenario Type Selection */}
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        Scenario Type
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        {SCENARIO_TYPE_OPTIONS.map((option) => {
          const IconComponent = option.icon;
          return (
            <Paper
              key={option.value}
              elevation={0}
              onClick={() => {
                setScenarioTypeAffinity(option.value);
                setScenarioInjectSpacing(option.value === 'TABLE-TOP' ? 5 : 1);
              }}
              sx={{
                p: 1.5,
                flex: '1 1 calc(50% - 4px)',
                minWidth: 120,
                border: 2,
                borderColor: scenarioTypeAffinity === option.value ? 'primary.main' : 'divider',
                borderRadius: 1,
                cursor: 'pointer',
                bgcolor: scenarioTypeAffinity === option.value ? 'action.selected' : 'transparent',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <IconComponent sx={{ fontSize: 20, color: scenarioTypeAffinity === option.value ? 'primary.main' : 'text.secondary' }} />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {option.label}
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', pl: 3.5 }}>
                {option.description}
              </Typography>
            </Paper>
          );
        })}
      </Box>
      
      {/* Platform Affinity - Only show for technical scenarios */}
      {scenarioTypeAffinity !== 'TABLE-TOP' && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Platform Affinity
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {['windows', 'linux', 'macos'].map((platform) => {
              const isSelected = scenarioPlatformsAffinity.includes(platform);
              const color = getPlatformColor(platform);
              return (
                <Chip
                  key={platform}
                  icon={getPlatformIcon(platform)}
                  label={platform}
                  onClick={() => {
                    if (isSelected && scenarioPlatformsAffinity.length > 1) {
                      setScenarioPlatformsAffinity(prev => prev.filter(p => p !== platform));
                    } else if (!isSelected) {
                      setScenarioPlatformsAffinity(prev => [...prev, platform]);
                    }
                  }}
                  sx={{
                    bgcolor: isSelected ? color : 'transparent',
                    color: isSelected ? 'white' : 'text.primary',
                    border: 1,
                    borderColor: isSelected ? color : 'divider',
                    '& .MuiChip-icon': { color: isSelected ? 'white' : color },
                  }}
                />
              );
            })}
          </Box>
        </>
      )}
      
      {/* Table-top info */}
      {scenarioTypeAffinity === 'TABLE-TOP' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Table-top scenarios use email notifications to simulate attack phases.
        </Alert>
      )}
      
      {/* AI Generate Scenario Option */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 2,
          borderRadius: 1,
          border: 1,
          borderColor: isAIAvailable ? aiColors.main : 'divider',
          bgcolor: isAIAvailable ? hexToRGB(aiColors.main, 0.08) : 'action.disabledBackground',
          opacity: isAIAvailable ? 1 : 0.6,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AutoAwesomeOutlined sx={{ fontSize: 24, color: isAIAvailable ? aiColors.main : 'text.disabled' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: isAIAvailable ? 'text.primary' : 'text.disabled' }}>
              Generate Scenario with AI
            </Typography>
            <Typography variant="caption" sx={{ color: isAIAvailable ? 'text.secondary' : 'text.disabled' }}>
              {isAIAvailable ? 'AI will generate a complete scenario' : 'AI not available'}
            </Typography>
          </Box>
          <Button
            size="small"
            variant={scenarioAIMode ? 'contained' : 'outlined'}
            disabled={!isAIAvailable || scenarioAIGenerating}
            onClick={onAIGenerate}
            startIcon={scenarioAIGenerating ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeOutlined />}
            sx={{
              borderColor: aiColors.main,
              color: scenarioAIMode ? 'white' : aiColors.main,
              bgcolor: scenarioAIMode ? aiColors.main : 'transparent',
              '&:hover': {
                borderColor: aiColors.main,
                bgcolor: scenarioAIMode ? aiColors.dark : hexToRGB(aiColors.main, 0.1),
              },
            }}
          >
            {scenarioAIGenerating ? 'Generating...' : 'Generate'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ScenarioTypeSelector;

