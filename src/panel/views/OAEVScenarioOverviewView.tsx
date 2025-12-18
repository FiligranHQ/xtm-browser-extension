/**
 * Scenario Overview View
 * 
 * Displays the scenario creation workflow including:
 * - Platform selection
 * - Type/affinity selection (ENDPOINT, CLOUD, WEB, TABLE-TOP)
 * - Attack pattern selection
 * - Inject configuration
 * - AI scenario generation
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Paper,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  ArrowForwardOutlined,
} from '@mui/icons-material';
import type { PlatformInfo } from '../types/panel-types';
import type { ScenarioStateReturn } from '../hooks/useScenarioState';

export interface ScenarioOverviewViewProps extends ScenarioStateReturn {
  mode: 'dark' | 'light';
  availablePlatforms: PlatformInfo[];
  selectedPlatformId: string;
  setSelectedPlatformId: (id: string) => void;
  setPlatformUrl: (url: string) => void;
  setPanelMode: (mode: string) => void;
  showToast: (options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
  }) => void;
  currentPageTitle: string;
  currentPageUrl: string;
}

export const OAEVScenarioOverviewView: React.FC<ScenarioOverviewViewProps> = (props) => {
  const {
    mode,
    availablePlatforms,
    setSelectedPlatformId,
    setPlatformUrl,
    setPanelMode,
    scenarioLoading,
    scenarioStep,
    setScenarioStep,
    scenarioTypeAffinity,
    setScenarioTypeAffinity,
    scenarioPlatformsAffinity,
    setScenarioPlatformsAffinity,
    scenarioPlatformSelected,
    setScenarioPlatformSelected,
    setScenarioPlatformId,
  } = props;

  const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';
  const openaevLogoPath = `../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`;
  
  // Get OpenAEV platforms
  const openaevPlatforms = availablePlatforms.filter(p => p.type === 'openaev');
  
  // Handle platform selection
  const handlePlatformSelect = (platformId: string) => {
    const platform = openaevPlatforms.find(p => p.id === platformId);
    if (platform) {
      setScenarioPlatformId(platformId);
      setScenarioPlatformSelected(true);
      setSelectedPlatformId(platformId);
      setPlatformUrl(platform.url);
    }
  };

  // Handle affinity next
  const handleAffinityNext = () => {
    setScenarioStep(1);
  };

  // Handle back
  const handleBack = () => {
    if (scenarioStep > 0) {
      setScenarioStep((scenarioStep - 1) as 0 | 1 | 2);
    } else {
      setPanelMode('scan-results');
    }
  };

  // Render platform selection (when multiple OpenAEV platforms)
  if (!scenarioPlatformSelected && openaevPlatforms.length > 1) {
    return (
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <img 
            src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
              ? chrome.runtime.getURL(openaevLogoPath)
              : openaevLogoPath
            } 
            alt="OpenAEV" 
            style={{ width: 24, height: 24 }} 
          />
          <Typography variant="h6">Create Scenario</Typography>
        </Box>
        
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Select the OpenAEV platform to create the scenario in:
        </Typography>
        
        {openaevPlatforms.map((platform) => (
          <Paper
            key={platform.id}
            onClick={() => handlePlatformSelect(platform.id)}
            sx={{
              p: 2,
              mb: 1,
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Typography variant="subtitle2">{platform.name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {platform.url}
            </Typography>
          </Paper>
        ))}
        
        <Button
          size="small"
          startIcon={<ChevronLeftOutlined />}
          onClick={() => setPanelMode('scan-results')}
          sx={{ 
            mt: 2,
            color: 'text.secondary',
            textTransform: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          Back to scan results
        </Button>
      </Box>
    );
  }

  // Loading state
  if (scenarioLoading) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Loading scenario data...
        </Typography>
      </Box>
    );
  }

  // Step 0: Type/Affinity Selection
  if (scenarioStep === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <img 
            src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
              ? chrome.runtime.getURL(openaevLogoPath)
              : openaevLogoPath
            } 
            alt="OpenAEV" 
            style={{ width: 24, height: 24 }} 
          />
          <Typography variant="h6">Create Scenario</Typography>
        </Box>
        
        <Stepper activeStep={0} sx={{ mb: 3 }}>
          <Step><StepLabel>Configuration</StepLabel></Step>
          <Step><StepLabel>Injects</StepLabel></Step>
          <Step><StepLabel>Details</StepLabel></Step>
        </Stepper>
        
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Scenario Type</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
          {(['ENDPOINT', 'CLOUD', 'WEB', 'TABLE-TOP'] as const).map((type) => (
            <Chip
              key={type}
              label={type}
              onClick={() => setScenarioTypeAffinity(type)}
              color={scenarioTypeAffinity === type ? 'primary' : 'default'}
              variant={scenarioTypeAffinity === type ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
        
        {scenarioTypeAffinity !== 'TABLE-TOP' && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Target Platforms</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
              {['windows', 'linux', 'macos'].map((platform) => (
                <Chip
                  key={platform}
                  label={platform}
                  onClick={() => {
                    if (scenarioPlatformsAffinity.includes(platform)) {
                      setScenarioPlatformsAffinity(
                        scenarioPlatformsAffinity.filter(p => p !== platform)
                      );
                    } else {
                      setScenarioPlatformsAffinity([...scenarioPlatformsAffinity, platform]);
                    }
                  }}
                  color={scenarioPlatformsAffinity.includes(platform) ? 'primary' : 'default'}
                  variant={scenarioPlatformsAffinity.includes(platform) ? 'filled' : 'outlined'}
                />
              ))}
            </Box>
          </>
        )}
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            startIcon={<ChevronLeftOutlined />}
            onClick={handleBack}
            sx={{ 
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            Back to scan results
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<ArrowForwardOutlined />}
            onClick={handleAffinityNext}
            sx={{ flex: 1 }}
          >
            Next
          </Button>
        </Box>
      </Box>
    );
  }

  // Step 1 and 2 would go here...
  // For now, show a placeholder
  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <img 
          src={typeof chrome !== 'undefined' && chrome.runtime?.getURL 
            ? chrome.runtime.getURL(openaevLogoPath)
            : openaevLogoPath
          } 
          alt="OpenAEV" 
          style={{ width: 24, height: 24 }} 
        />
        <Typography variant="h6">Create Scenario - Step {scenarioStep + 1}</Typography>
      </Box>
      
      <Stepper activeStep={scenarioStep} sx={{ mb: 3 }}>
        <Step><StepLabel>Configuration</StepLabel></Step>
        <Step><StepLabel>Injects</StepLabel></Step>
        <Step><StepLabel>Details</StepLabel></Step>
      </Stepper>
      
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Scenario workflow step {scenarioStep + 1} - Full implementation in progress
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          size="small"
          startIcon={<ChevronLeftOutlined />}
          onClick={handleBack}
          sx={{ 
            color: 'text.secondary',
            textTransform: 'none',
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          {scenarioStep === 1 ? 'Back to configuration' : scenarioStep === 2 ? 'Back to injects' : 'Back to scan results'}
        </Button>
        {scenarioStep < 2 && (
          <Button
            variant="contained"
            size="small"
            startIcon={<ArrowForwardOutlined />}
            onClick={() => setScenarioStep((scenarioStep + 1) as 0 | 1 | 2)}
            sx={{ flex: 1 }}
          >
            Next
          </Button>
        )}
      </Box>
    </Box>
  );
};

