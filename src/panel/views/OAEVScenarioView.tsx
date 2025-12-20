/**
 * OpenAEV Scenario View
 * 
 * Comprehensive component for scenario creation workflow including:
 * - Platform selection (when multiple OpenAEV platforms)
 * - Step 0: Type/Affinity selection (ENDPOINT, CLOUD, WEB, TABLE-TOP)
 * - Step 1: Inject selection (attack patterns and contracts)
 * - Step 2: Scenario form (name, description, targets, timeline)
 * - AI scenario generation support
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
  Stepper,
  Step,
  StepLabel,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  ArrowForwardOutlined,
  RefreshOutlined,
  MovieFilterOutlined,
  AutoAwesomeOutlined,
} from '@mui/icons-material';
import { LockPattern } from 'mdi-material-ui';
import { hexToRGB } from '../../shared/theme/colors';
import { loggers } from '../../shared/utils/logger';
import { getAiColor, getPlatformIcon, getPlatformColor } from '../utils/platform-helpers';
import type { PlatformInfo, PanelMode } from '../types/panel-types';
import type { ScenarioStateReturn } from '../hooks/useScenarioState';
import {
  SCENARIO_DEFAULT_VALUES,
} from '../../shared/types/openaev';
import { ScenarioTypeSelector } from '../components/scenario/ScenarioTypeSelector';
import { ScenarioPlatformSelector } from '../components/scenario/ScenarioPlatformSelector';
import { ScenarioInjectSelector } from '../components/scenario/ScenarioInjectSelector';
import { ScenarioFormView } from '../components/scenario/ScenarioFormView';

const log = loggers.panel;

import { EMAIL_INJECTOR_CONTRACT_ID } from '../../shared/constants/openaev';

export interface OAEVScenarioViewProps extends ScenarioStateReturn {
  mode: 'dark' | 'light';
  panelMode: 'scenario-overview' | 'scenario-form';
  availablePlatforms: PlatformInfo[];
  selectedPlatformId: string;
  setSelectedPlatformId: (id: string) => void;
  setPlatformUrl: (url: string) => void;
  setPanelMode: React.Dispatch<React.SetStateAction<PanelMode>>;
  showToast: (options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
  }) => void;
  currentPageTitle: string;
  currentPageUrl: string;
  aiSettings: {
    enabled: boolean;
    provider?: string;
    available: boolean;
  };
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  // AI state for inject/email generation
  aiSelectingInjects: boolean;
  setAiSelectingInjects: (value: boolean) => void;
  aiFillingEmails: boolean;
  setAiFillingEmails: (value: boolean) => void;
  // Handler functions passed from App
  handleClose: () => void;
}

export const OAEVScenarioView: React.FC<OAEVScenarioViewProps> = (props) => {
  const {
    mode,
    panelMode,
    availablePlatforms,
    selectedPlatformId,
    setSelectedPlatformId,
    setPlatformUrl,
    setPanelMode,
    showToast,
    currentPageTitle,
    currentPageUrl,
    aiSettings,
    submitting,
    setSubmitting,
    aiSelectingInjects,
    setAiSelectingInjects,
    aiFillingEmails,
    setAiFillingEmails,
    handleClose,
    // Scenario state
    scenarioOverviewData,
    setScenarioOverviewData,
    scenarioForm,
    setScenarioForm,
    selectedInjects,
    setSelectedInjects,
    scenarioEmails,
    setScenarioEmails,
    scenarioLoading,
    setScenarioLoading,
    scenarioStep,
    setScenarioStep,
    scenarioTypeAffinity,
    setScenarioTypeAffinity,
    scenarioPlatformsAffinity,
    setScenarioPlatformsAffinity,
    scenarioInjectSpacing,
    setScenarioInjectSpacing,
    scenarioPlatformSelected,
    setScenarioPlatformSelected,
    scenarioPlatformId,
    setScenarioPlatformId,
    scenarioRawAttackPatterns,
    scenarioTargetType,
    setScenarioTargetType,
    scenarioAssets,
    setScenarioAssets,
    scenarioAssetGroups,
    setScenarioAssetGroups,
    scenarioTeams,
    setScenarioTeams,
    scenarioSelectedAsset,
    setScenarioSelectedAsset,
    scenarioSelectedAssetGroup,
    setScenarioSelectedAssetGroup,
    scenarioSelectedTeam,
    setScenarioSelectedTeam,
    scenarioCreating,
    setScenarioCreating,
    scenarioAIMode,
    setScenarioAIMode,
    scenarioAIGenerating,
    setScenarioAIGenerating,
    scenarioAINumberOfInjects,
    setScenarioAINumberOfInjects,
    scenarioAIPayloadAffinity,
    setScenarioAIPayloadAffinity,
    scenarioAITableTopDuration,
    setScenarioAITableTopDuration,
    scenarioAIEmailLanguage,
    setScenarioAIEmailLanguage,
    scenarioAITheme,
    setScenarioAITheme,
    scenarioAIContext,
    setScenarioAIContext,
    scenarioAIGeneratedScenario,
    setScenarioAIGeneratedScenario,
  } = props;

  const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';
  const openaevLogoPath = `../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`;
  
  // Get OpenAEV platforms
  const openaevPlatforms = availablePlatforms.filter(p => p.type === 'openaev');

  // Filter contracts by platform affinity for technical scenarios
  const getFilteredContracts = (contracts: any[]) => {
    if (scenarioTypeAffinity === 'TABLE-TOP') return []; // No contracts for table-top
    if (!contracts) return [];
    
    return contracts.filter((contract: any) => {
      const contractPlatforms = contract.injector_contract_platforms || [];
      // If no platforms specified on contract, include it
      if (contractPlatforms.length === 0) return true;
      // Check if any selected platform matches contract platforms
      return scenarioPlatformsAffinity.some(p => 
        contractPlatforms.map((cp: string) => cp.toLowerCase()).includes(p.toLowerCase())
      );
    });
  };

  // Handle platform selection
  const handleSelectScenarioPlatform = async (platformId: string) => {
    setScenarioPlatformId(platformId);
    setScenarioPlatformSelected(true);
    setSelectedPlatformId(platformId);
    
    const platform = availablePlatforms.find(p => p.id === platformId);
    if (platform) {
      setPlatformUrl(platform.url);
    }
    
    // Fetch assets, asset groups, and teams for target selection
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        const [assetsRes, assetGroupsRes, teamsRes] = await Promise.all([
          chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSETS', payload: { platformId } }),
          chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSET_GROUPS', payload: { platformId } }),
          chrome.runtime.sendMessage({ type: 'FETCH_OAEV_TEAMS', payload: { platformId } }),
        ]);
        if (assetsRes?.success) setScenarioAssets(assetsRes.data || []);
        if (assetGroupsRes?.success) setScenarioAssetGroups(assetGroupsRes.data || []);
        if (teamsRes?.success) setScenarioTeams(teamsRes.data || []);
      } catch (error) {
        log.error(' Failed to fetch scenario targets:', error);
      }
    }
    
    // Reset target selections when platform changes
    setScenarioSelectedAsset(null);
    setScenarioSelectedAssetGroup(null);
    setScenarioSelectedTeam(null);
    
    // Filter attack patterns to only those from the selected platform
    const filteredPatterns = scenarioRawAttackPatterns.filter(
      (ap) => ap.platformId === platformId
    );
    
    // Fetch contracts for filtered attack patterns
    if (filteredPatterns.length > 0 && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      setScenarioLoading(true);
      
      const attackPatternIds = filteredPatterns.map((ap) => ap.id || ap.entityId);
      
      chrome.runtime.sendMessage({
        type: 'FETCH_SCENARIO_OVERVIEW',
        payload: { attackPatternIds, platformId },
      }, (response) => {
        setScenarioLoading(false);
        if (response?.success && response.data) {
          setScenarioOverviewData({
            ...response.data,
            pageTitle: currentPageTitle || '',
            pageUrl: currentPageUrl || '',
            pageDescription: scenarioForm.description || '',
          });
          
          // Don't auto-select contracts - let the user choose
          setSelectedInjects([]);
        }
      });
    } else {
      setScenarioOverviewData({
        attackPatterns: [],
        killChainPhases: [],
        pageTitle: currentPageTitle || '',
        pageUrl: currentPageUrl || '',
        pageDescription: scenarioForm.description || '',
      });
    }
  };

  // Handle proceeding from affinity selection to inject selection
  const handleAffinityNext = async () => {
    setScenarioStep(1);
    // For table-top, we don't need to fetch contracts
    // For technical scenarios, we already have the data loaded
  };

  // Handle AI scenario generation
  const handleGenerateAIScenario = async () => {
    if (!scenarioPlatformId) return;
    
    setScenarioAIGenerating(true);
    setScenarioAIGeneratedScenario(null);
    
    try {
      // Get page content for context
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let pageContent = '';
      let pageTitle = '';
      let pageUrl = '';
      
      if (tab?.id) {
        const contentResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
        if (contentResponse?.success) {
          pageContent = contentResponse.data?.content || '';
          pageTitle = contentResponse.data?.title || tab.title || '';
          pageUrl = contentResponse.data?.url || tab.url || '';
        }
      }
      
      const response = await chrome.runtime.sendMessage({
        type: 'AI_GENERATE_FULL_SCENARIO',
        payload: {
          pageTitle,
          pageUrl,
          pageContent,
          scenarioName: scenarioForm.name || `AI Scenario - ${pageTitle || 'Generated'}`,
          typeAffinity: scenarioTypeAffinity,
          platformAffinity: scenarioPlatformsAffinity,
          numberOfInjects: scenarioAINumberOfInjects,
          payloadAffinity: scenarioTypeAffinity !== 'TABLE-TOP' ? scenarioAIPayloadAffinity : undefined,
          tableTopDuration: scenarioTypeAffinity === 'TABLE-TOP' ? scenarioAITableTopDuration : undefined,
          scenarioTheme: scenarioTypeAffinity === 'TABLE-TOP' ? scenarioAITheme : undefined,
          emailLanguage: scenarioTypeAffinity === 'TABLE-TOP' ? scenarioAIEmailLanguage : undefined,
          additionalContext: scenarioAIContext,
          detectedAttackPatterns: scenarioOverviewData?.attackPatterns?.map(ap => ({
            name: ap.name,
            id: ap.externalId,
            description: ap.description,
          })) || [],
        },
      });
      
      if (response?.success && response.data) {
        const generatedScenario = response.data;
        setScenarioAIGeneratedScenario({
          name: generatedScenario.name || `AI Generated Scenario`,
          description: generatedScenario.description || 'AI-generated security simulation scenario',
          subtitle: generatedScenario.subtitle,
          category: generatedScenario.category,
          injects: generatedScenario.injects || [],
        });
        
        // Set the scenario name from generated
        if (generatedScenario.name) {
          setScenarioForm(prev => ({ ...prev, name: generatedScenario.name }));
        }
      } else {
        log.error(' AI scenario generation failed:', response?.error);
      }
    } catch (error) {
      log.error(' AI scenario generation error:', error);
    } finally {
      setScenarioAIGenerating(false);
    }
  };

  // Handle creating the AI-generated scenario
  const handleCreateAIGeneratedScenario = async () => {
    if (!scenarioAIGeneratedScenario || !scenarioPlatformId) return;
    
    setScenarioCreating(true);
    
    try {
      const isTableTop = scenarioTypeAffinity === 'TABLE-TOP';
      
      // Create the scenario first
      const scenarioResponse = await chrome.runtime.sendMessage({
        type: 'CREATE_SCENARIO',
        payload: {
          platformId: scenarioPlatformId,
          name: scenarioForm.name || scenarioAIGeneratedScenario.name,
          description: scenarioAIGeneratedScenario.description,
          subtitle: scenarioAIGeneratedScenario.subtitle,
          category: scenarioForm.category || scenarioAIGeneratedScenario.category || SCENARIO_DEFAULT_VALUES.category,
          mainFocus: scenarioForm.mainFocus || SCENARIO_DEFAULT_VALUES.mainFocus,
          severity: scenarioForm.severity || SCENARIO_DEFAULT_VALUES.severity,
        },
      });
      
      if (!scenarioResponse?.success || !scenarioResponse.data?.scenario_id) {
        log.error(' Failed to create scenario:', scenarioResponse?.error);
        setScenarioCreating(false);
        return;
      }
      
      const scenarioId = scenarioResponse.data.scenario_id;
      
      // Now add all generated injects
      // AI returns absolute timing values (0, 15, 30, 45, 60) - use directly without accumulating
      for (let i = 0; i < scenarioAIGeneratedScenario.injects.length; i++) {
        const inject = scenarioAIGeneratedScenario.injects[i];
        // Use AI-provided delayMinutes directly (absolute timing), or fallback to calculated spacing
        const delayMinutes = inject.delayMinutes ?? (i * scenarioInjectSpacing);
        
        if (isTableTop) {
          // For table-top, create email injects
          const emailInjectPayload: Record<string, unknown> = {
            platformId: scenarioPlatformId,
            scenarioId,
            title: inject.title,
            description: inject.description,
            subject: inject.subject || inject.title,
            body: inject.body || inject.content || inject.description,
            delayMinutes,
          };
          
          // Add team if selected
          if (scenarioSelectedTeam) {
            emailInjectPayload.teamId = scenarioSelectedTeam;
          }
          
          const injectResponse = await chrome.runtime.sendMessage({
            type: 'ADD_EMAIL_INJECT_TO_SCENARIO',
            payload: emailInjectPayload,
          });
          
          if (!injectResponse?.success) {
            log.warn(' Failed to add email inject:', inject.title, injectResponse?.error);
          }
        } else {
          // For technical scenarios, create command injects with payloads
          const technicalInjectPayload: Record<string, unknown> = {
            platformId: scenarioPlatformId,
            scenarioId,
            title: inject.title,
            description: inject.description,
            command: inject.content,
            executor: inject.executor || scenarioAIPayloadAffinity,
            platforms: scenarioPlatformsAffinity,
            delayMinutes,
          };
          
          // Add asset or asset group if selected
          if (scenarioTargetType === 'asset' && scenarioSelectedAsset) {
            technicalInjectPayload.assetId = scenarioSelectedAsset;
          } else if (scenarioTargetType === 'asset_group' && scenarioSelectedAssetGroup) {
            technicalInjectPayload.assetGroupId = scenarioSelectedAssetGroup;
          }
          
          const injectResponse = await chrome.runtime.sendMessage({
            type: 'ADD_TECHNICAL_INJECT_TO_SCENARIO',
            payload: technicalInjectPayload,
          });
          
          if (!injectResponse?.success) {
            log.warn(' Failed to add technical inject:', inject.title, injectResponse?.error);
          }
        }
      }
      
      // Success - open scenario in platform
      const targetPlatform = openaevPlatforms.find(p => p.id === scenarioPlatformId);
      if (targetPlatform) {
        const scenarioUrl = `${targetPlatform.url}/admin/scenarios/${scenarioId}`;
        window.open(scenarioUrl, '_blank');
      }
      
      // Reset and close
      setScenarioAIMode(false);
      setScenarioAIGeneratedScenario(null);
      handleClose();
      
    } catch (error) {
      log.error(' Create AI scenario error:', error);
    } finally {
      setScenarioCreating(false);
    }
  };

  // Handle creating the manual scenario
  const handleCreateScenario = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setSubmitting(true);
    
    // Use scenarioPlatformId if available, fallback to selectedPlatformId
    const targetPlatformId = scenarioPlatformId || selectedPlatformId;
    if (!targetPlatformId) {
      log.error(' No platform ID available for scenario creation');
      setSubmitting(false);
      return;
    }
    
    try {
      // First create the scenario
      const scenarioResponse = await chrome.runtime.sendMessage({
        type: 'CREATE_SCENARIO',
        payload: {
          name: scenarioForm.name,
          description: scenarioForm.description,
          subtitle: scenarioForm.subtitle,
          category: scenarioForm.category,
          mainFocus: scenarioForm.mainFocus,
          severity: scenarioForm.severity,
          platformId: targetPlatformId,
        },
      });
      
      if (!scenarioResponse?.success || !scenarioResponse.data) {
        log.error(' Scenario creation failed:', scenarioResponse?.error);
        showToast({ type: 'error', message: scenarioResponse?.error || 'Scenario creation failed' });
        setSubmitting(false);
        return;
      }
      
      const scenario = scenarioResponse.data;
      log.info(' Scenario created:', scenario.scenario_id);
      
      // Add selected injects to the scenario
      const isTableTop = scenarioTypeAffinity === 'TABLE-TOP';
      
      for (let i = 0; i < selectedInjects.length; i++) {
        const inject = selectedInjects[i];
        
        // Build inject payload based on scenario type
        const injectPayload: any = {
          inject_title: isTableTop 
            ? `Email - ${inject.attackPatternName}`
            : `${inject.attackPatternName} - ${inject.contractLabel}`,
          inject_description: isTableTop
            ? `Email notification for ${inject.attackPatternName}`
            : `Inject for ${inject.attackPatternName}`,
          inject_injector_contract: isTableTop 
            ? EMAIL_INJECTOR_CONTRACT_ID
            : inject.contractId,
          inject_depends_duration: i * scenarioInjectSpacing * 60,
        };
        
        // Add target based on scenario type
        if (isTableTop) {
          if (scenarioSelectedTeam) {
            injectPayload.inject_teams = [scenarioSelectedTeam];
          }
          
          const aiContent = scenarioEmails.find((e: { attackPatternId: string; subject: string; body: string }) => e.attackPatternId === inject.attackPatternId);
          
          injectPayload.inject_content = {
            subject: aiContent?.subject || `[SIMULATION] Security Alert: ${inject.attackPatternName}`,
            body: aiContent?.body || `<p>This is a simulated security exercise notification.</p>
<p><strong>Attack Pattern:</strong> ${inject.attackPatternName}</p>
<p><strong>Description:</strong> A simulated ${inject.attackPatternName} attack has been detected in this exercise.</p>
<p>Please follow your incident response procedures.</p>
<p><em>This is a simulation exercise - no actual security incident has occurred.</em></p>`,
          };
        } else {
          if (scenarioTargetType === 'asset' && scenarioSelectedAsset) {
            injectPayload.inject_assets = [scenarioSelectedAsset];
          } else if (scenarioTargetType === 'asset_group' && scenarioSelectedAssetGroup) {
            injectPayload.inject_asset_groups = [scenarioSelectedAssetGroup];
          }
        }
        
        const injectResponse = await chrome.runtime.sendMessage({
          type: 'ADD_INJECT_TO_SCENARIO',
          payload: {
            scenarioId: scenario.scenario_id,
            inject: injectPayload,
            platformId: targetPlatformId,
          },
        });
        
        if (!injectResponse?.success || !injectResponse.data?.inject_id) {
          log.error(` Failed to create inject:`, injectResponse?.error);
        }
      }
      
      log.info(` Scenario creation complete with ${selectedInjects.length} injects`);
      
      // Open the scenario in the platform
      if (scenario.url) {
        chrome.tabs.create({ url: scenario.url });
      }
      
      showToast({ type: 'success', message: 'Scenario created successfully' });
      
      // Reset and close
      setScenarioForm({
        name: '',
        description: '',
        subtitle: '',
        category: SCENARIO_DEFAULT_VALUES.category,
        mainFocus: SCENARIO_DEFAULT_VALUES.mainFocus,
        severity: SCENARIO_DEFAULT_VALUES.severity,
      });
      setSelectedInjects([]);
      setScenarioOverviewData(null);
      setScenarioEmails([]);
      handleClose();
    } catch (error) {
      log.error(' Scenario creation error:', error);
      showToast({ type: 'error', message: 'Scenario creation failed' });
    }
    
    setSubmitting(false);
  };

  // Render scenario form view (step 2) - Using extracted component
  // Guard: scenarioPlatformId must be set (auto-selected in single-platform mode or user-selected in multi-platform mode)
  if (panelMode === 'scenario-form' && scenarioPlatformId) {
    return (
      <ScenarioFormView
        mode={mode}
        openaevLogoPath={openaevLogoPath}
        openaevPlatforms={openaevPlatforms}
        scenarioPlatformId={scenarioPlatformId}
        scenarioForm={scenarioForm}
        setScenarioForm={setScenarioForm}
        scenarioTypeAffinity={scenarioTypeAffinity}
        scenarioPlatformsAffinity={scenarioPlatformsAffinity}
        scenarioInjectSpacing={scenarioInjectSpacing}
        selectedInjects={selectedInjects}
        scenarioStep={scenarioStep}
        setScenarioStep={(step) => setScenarioStep(step as 0 | 1 | 2)}
        setPanelMode={setPanelMode}
        scenarioTeams={scenarioTeams}
        scenarioSelectedTeam={scenarioSelectedTeam}
        setScenarioSelectedTeam={setScenarioSelectedTeam}
        scenarioAssets={scenarioAssets}
        scenarioAssetGroups={scenarioAssetGroups}
        scenarioTargetType={scenarioTargetType}
        setScenarioTargetType={setScenarioTargetType}
        scenarioSelectedAsset={scenarioSelectedAsset}
        setScenarioSelectedAsset={setScenarioSelectedAsset}
        scenarioSelectedAssetGroup={scenarioSelectedAssetGroup}
        setScenarioSelectedAssetGroup={setScenarioSelectedAssetGroup}
        scenarioEmails={scenarioEmails}
        setScenarioEmails={setScenarioEmails}
        scenarioAIEmailLanguage={scenarioAIEmailLanguage}
        setScenarioAIEmailLanguage={setScenarioAIEmailLanguage}
        aiSettings={aiSettings}
        aiFillingEmails={aiFillingEmails}
        setAiFillingEmails={setAiFillingEmails}
        currentPageTitle={currentPageTitle}
        currentPageUrl={currentPageUrl}
        scenarioOverviewData={scenarioOverviewData}
        submitting={submitting}
        onCreateScenario={handleCreateScenario}
        onClose={handleClose}
      />
    );
  }

  // Platform selection step (if multiple OpenAEV platforms and not yet selected)
  if (openaevPlatforms.length > 1 && !scenarioPlatformSelected) {
    return (
      <ScenarioPlatformSelector
        mode={mode}
        openaevPlatforms={openaevPlatforms}
        openaevLogoPath={openaevLogoPath}
        scenarioRawAttackPatterns={scenarioRawAttackPatterns}
        onSelectPlatform={handleSelectScenarioPlatform}
        setPanelMode={setPanelMode}
      />
    );
  }

  // Main scenario overview content
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
      <Stepper activeStep={scenarioStep} sx={{ mb: 3, flexShrink: 0 }}>
        <Step>
          <StepLabel>Select Affinity</StepLabel>
        </Step>
        <Step>
          <StepLabel>Select Injects</StepLabel>
        </Step>
        <Step>
          <StepLabel>Configure Details</StepLabel>
        </Step>
      </Stepper>
      
      {scenarioLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 2 }}>
          <CircularProgress size={40} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Loading attack patterns and inject contracts...
          </Typography>
        </Box>
      ) : scenarioAIMode ? (
        /* AI Scenario Generation Form */
        renderAIGenerationForm()
      ) : scenarioStep === 0 ? (
        /* Step 0: Affinity Selection */
        renderAffinitySelection()
      ) : scenarioStep === 1 && scenarioPlatformId ? (
        /* Step 1: Inject Selection - scenarioPlatformId must be set */
        <ScenarioInjectSelector
          mode={mode}
          scenarioOverviewData={scenarioOverviewData}
          selectedInjects={selectedInjects}
          setSelectedInjects={setSelectedInjects}
          scenarioTypeAffinity={scenarioTypeAffinity}
          scenarioPlatformsAffinity={scenarioPlatformsAffinity}
          scenarioInjectSpacing={scenarioInjectSpacing}
          setScenarioInjectSpacing={setScenarioInjectSpacing}
          setScenarioStep={setScenarioStep}
          setPanelMode={setPanelMode}
          handleClose={handleClose}
          openaevPlatforms={openaevPlatforms}
          scenarioPlatformId={scenarioPlatformId}
          aiSettings={aiSettings}
          aiSelectingInjects={aiSelectingInjects}
          setAiSelectingInjects={setAiSelectingInjects}
          currentPageTitle={currentPageTitle}
          currentPageUrl={currentPageUrl}
          scenarioForm={scenarioForm}
          getFilteredContracts={getFilteredContracts}
        />
      ) : null}
    </Box>
  );

  // Helper render functions
  function renderAIGenerationForm() {
    const aiColors = getAiColor(mode);
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
        {/* Back button */}
        <Box sx={{ mb: 1.5, flexShrink: 0 }}>
          <Button
            size="small"
            startIcon={<ChevronLeftOutlined />}
            onClick={() => {
              setScenarioAIMode(false);
              setScenarioAIGeneratedScenario(null);
            }}
            sx={{ 
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            Back to affinity selection
          </Button>
        </Box>
        
        {/* AI Info Card */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            mb: 2, 
            border: 1, 
            borderColor: aiColors.main, 
            borderRadius: 1, 
            bgcolor: hexToRGB(aiColors.main, 0.08), 
            flexShrink: 0 
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AutoAwesomeOutlined sx={{ color: aiColors.main }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>AI-Generated Scenario</Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {scenarioTypeAffinity === 'TABLE-TOP'
              ? 'AI will analyze the page content and generate a complete table-top scenario with realistic email notifications.'
              : 'AI will analyze the page content and generate a complete technical scenario with executable payloads.'}
          </Typography>
        </Paper>
        
        {/* Affinity Summary */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', flexShrink: 0 }}>
          <Chip 
            label={`Type: ${scenarioTypeAffinity}`} 
            size="small"
            sx={{ 
              bgcolor: scenarioTypeAffinity === 'TABLE-TOP' ? '#42a5f5' : '#4caf50',
              color: 'white',
            }}
          />
          {scenarioTypeAffinity !== 'TABLE-TOP' && scenarioPlatformsAffinity.map(p => (
            <Chip 
              key={p}
              icon={getPlatformIcon(p)}
              label={p} 
              size="small"
              sx={{ 
                bgcolor: getPlatformColor(p),
                color: 'white',
                '& .MuiChip-icon': { color: 'white' },
              }}
            />
          ))}
        </Box>
        
        {scenarioAIGeneratedScenario ? (
          /* Show generated scenario preview */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Generated Scenario</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>{scenarioAIGeneratedScenario.name}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontSize: 12 }}>
                {scenarioAIGeneratedScenario.description}
              </Typography>
            </Paper>
            
            {/* Injects Preview */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Generated Injects ({scenarioAIGeneratedScenario.injects.length})
              </Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {scenarioAIGeneratedScenario.injects.map((inject, index) => (
                  <Paper key={index} elevation={0} sx={{ p: 1.5, mb: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip label={`#${index + 1}`} size="small" sx={{ height: 18, fontSize: 10, minWidth: 28 }} />
                      <Typography variant="body2" sx={{ fontWeight: 500, flex: 1 }} noWrap>
                        {inject.title}
                      </Typography>
                      <Chip 
                        label={inject.type} 
                        size="small" 
                        sx={{ 
                          height: 18, 
                          fontSize: 10,
                          bgcolor: inject.type === 'email' ? '#42a5f5' : inject.type === 'command' ? '#ff9800' : '#9e9e9e',
                          color: 'white',
                        }} 
                      />
                    </Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
                      {inject.description}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
            
            {/* Scenario Name */}
            <TextField
              label="Scenario Name"
              value={scenarioForm.name}
              onChange={(e) => setScenarioForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder={scenarioAIGeneratedScenario.name}
              size="small"
              fullWidth
            />
            
            {/* Create Scenario Button */}
            <Button
              variant="contained"
              fullWidth
              disabled={scenarioCreating}
              onClick={handleCreateAIGeneratedScenario}
              startIcon={scenarioCreating ? <CircularProgress size={16} color="inherit" /> : <MovieFilterOutlined />}
            >
              {scenarioCreating ? 'Creating Scenario...' : 'Create Scenario'}
            </Button>
            
            {/* Regenerate Button */}
            <Button
              variant="outlined"
              size="small"
              onClick={() => setScenarioAIGeneratedScenario(null)}
              startIcon={<RefreshOutlined />}
              sx={{ textTransform: 'none' }}
            >
              Generate Different Scenario
            </Button>
          </Box>
        ) : (
          /* Show AI generation form */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
            <TextField
              label="Number of Injects"
              type="number"
              value={scenarioAINumberOfInjects || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setScenarioAINumberOfInjects(0);
                } else {
                  const num = parseInt(val, 10);
                  if (!isNaN(num)) {
                    // Allow typing any value, cap at 50
                    setScenarioAINumberOfInjects(Math.min(50, Math.max(0, num)));
                  }
                }
              }}
              size="small"
              fullWidth
              inputProps={{ min: 1, max: 50 }}
              error={scenarioAINumberOfInjects < 1 || scenarioAINumberOfInjects > 50}
              helperText={
                scenarioAINumberOfInjects < 1 
                  ? "Number of injects is required (1-50)" 
                  : scenarioAINumberOfInjects > 50 
                    ? "Maximum is 50 injects"
                    : "Number of injects to generate (1-50)"
              }
            />
            
            {scenarioTypeAffinity === 'TABLE-TOP' ? (
              <>
                <FormControl fullWidth size="small">
                  <InputLabel>Scenario Theme</InputLabel>
                  <Select
                    value={scenarioAITheme}
                    label="Scenario Theme"
                    onChange={(e) => setScenarioAITheme(e.target.value)}
                  >
                    <MenuItem value="cybersecurity">Cybersecurity & Technology</MenuItem>
                    <MenuItem value="physical-security">Physical Security & Safety</MenuItem>
                    <MenuItem value="business-continuity">Business Continuity</MenuItem>
                    <MenuItem value="crisis-communication">Crisis Communication</MenuItem>
                    <MenuItem value="health-safety">Health & Safety</MenuItem>
                    <MenuItem value="geopolitical">Geopolitical & Economic</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Exercise Duration (minutes)"
                  type="number"
                  value={scenarioAITableTopDuration || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setScenarioAITableTopDuration(0);
                    } else {
                      const num = parseInt(val, 10);
                      if (!isNaN(num)) {
                        // Allow typing any value, cap at 2880 (48 hours)
                        setScenarioAITableTopDuration(Math.min(2880, Math.max(0, num)));
                      }
                    }
                  }}
                  size="small"
                  fullWidth
                  inputProps={{ min: 1, max: 2880 }}
                  error={scenarioAITableTopDuration < 1 || scenarioAITableTopDuration > 2880}
                  helperText={
                    scenarioAITableTopDuration < 1 
                      ? "Duration is required (1-2880 minutes)" 
                      : scenarioAITableTopDuration > 2880 
                        ? "Maximum duration is 48 hours (2880 minutes)"
                        : "Total exercise duration (max 48 hours)"
                  }
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Email Language</InputLabel>
                  <Select
                    value={scenarioAIEmailLanguage}
                    label="Email Language"
                    onChange={(e) => setScenarioAIEmailLanguage(e.target.value)}
                  >
                    <MenuItem value="english">English</MenuItem>
                    <MenuItem value="french">Français</MenuItem>
                    <MenuItem value="german">Deutsch</MenuItem>
                    <MenuItem value="spanish">Español</MenuItem>
                  </Select>
                </FormControl>
              </>
            ) : (
              <FormControl fullWidth size="small">
                <InputLabel>Payload Technical Affinity</InputLabel>
                <Select
                  value={scenarioAIPayloadAffinity}
                  label="Payload Technical Affinity"
                  onChange={(e) => setScenarioAIPayloadAffinity(e.target.value)}
                >
                  <MenuItem value="powershell">PowerShell</MenuItem>
                  <MenuItem value="cmd">Command Prompt (cmd)</MenuItem>
                  <MenuItem value="bash">Bash</MenuItem>
                  <MenuItem value="sh">Sh</MenuItem>
                </Select>
              </FormControl>
            )}
            
            <TextField
              label="Additional Context (optional)"
              value={scenarioAIContext}
              onChange={(e) => setScenarioAIContext(e.target.value)}
              multiline
              rows={3}
              size="small"
              placeholder="Provide any additional context..."
              helperText="AI will use the page content plus this context to generate the scenario"
            />
            
            {/* Generate Button */}
            <Button
              variant="outlined"
              fullWidth
              disabled={
                scenarioAIGenerating || 
                scenarioAINumberOfInjects < 1 || scenarioAINumberOfInjects > 50 ||
                (scenarioTypeAffinity === 'TABLE-TOP' && (scenarioAITableTopDuration < 1 || scenarioAITableTopDuration > 2880))
              }
              onClick={handleGenerateAIScenario}
              startIcon={scenarioAIGenerating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeOutlined />}
              sx={{
                borderColor: aiColors.main,
                color: aiColors.main,
                '&:hover': {
                  borderColor: aiColors.dark,
                  bgcolor: hexToRGB(aiColors.main, 0.08),
                },
              }}
            >
              {scenarioAIGenerating ? 'Generating Scenario...' : 'Generate Scenario with AI'}
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  function renderAffinitySelection() {
    const targetPlatform = openaevPlatforms.find(p => p.id === scenarioPlatformId);
    const isAIAvailable = !!(aiSettings.available && targetPlatform?.isEnterprise);
    
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
        {/* Back to actions button */}
        <Box sx={{ mb: 1.5, flexShrink: 0 }}>
          <Button
            size="small"
            startIcon={<ChevronLeftOutlined />}
            onClick={() => setPanelMode('empty')}
            sx={{ 
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            Back to actions
          </Button>
        </Box>

        {/* Type Affinity, Platform Affinity, and AI Generate using extracted component */}
        <ScenarioTypeSelector
          mode={mode}
          scenarioTypeAffinity={scenarioTypeAffinity}
          setScenarioTypeAffinity={(type) => setScenarioTypeAffinity(type as typeof scenarioTypeAffinity)}
          scenarioPlatformsAffinity={scenarioPlatformsAffinity}
          setScenarioPlatformsAffinity={setScenarioPlatformsAffinity}
          scenarioInjectSpacing={scenarioInjectSpacing}
          setScenarioInjectSpacing={setScenarioInjectSpacing}
          isAIAvailable={isAIAvailable}
          scenarioAIMode={scenarioAIMode || false}
          scenarioAIGenerating={scenarioAIGenerating || false}
          onAIGenerate={() => setScenarioAIMode(true)}
        />
        
        {/* Attack Patterns Preview */}
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Detected Attack Patterns ({scenarioOverviewData?.attackPatterns?.length || 0})
        </Typography>
        <Box sx={{ flex: 1, overflow: 'auto', mb: 2, minHeight: 0 }}>
          {scenarioOverviewData?.attackPatterns?.slice(0, 5).map((ap) => (
            <Box key={ap.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
              <LockPattern sx={{ fontSize: 16, color: '#d4e157' }} />
              <Typography variant="body2" sx={{ flex: 1 }} noWrap>{ap.name}</Typography>
              <Chip label={ap.externalId} size="small" sx={{ fontSize: 9, height: 18 }} />
            </Box>
          ))}
          {(scenarioOverviewData?.attackPatterns?.length || 0) > 5 && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              +{(scenarioOverviewData?.attackPatterns?.length || 0) - 5} more...
            </Typography>
          )}
        </Box>
        
        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1, mt: 'auto', flexShrink: 0 }}>
          <Button variant="outlined" onClick={handleClose} sx={{ flex: 1 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAffinityNext}
            endIcon={<ArrowForwardOutlined />}
            sx={{ flex: 1 }}
          >
            Next
          </Button>
        </Box>
      </Box>
    );
  }

};
