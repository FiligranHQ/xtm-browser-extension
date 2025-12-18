/**
 * OpenAEV Atomic Testing View
 * 
 * Displays the atomic testing workflow including:
 * - Platform selection
 * - Target list (attack patterns, domains, hostnames)
 * - AI payload generation
 * - Inject selection and configuration
 * - Asset/Asset group target selection
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
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  ChevronLeftOutlined,
  ChevronRightOutlined,
  RefreshOutlined,
  ComputerOutlined,
  LanOutlined,
  LanguageOutlined,
  DnsOutlined,
  InfoOutlined,
  AutoAwesomeOutlined,
} from '@mui/icons-material';
import { LockPattern, Target } from 'mdi-material-ui';
import { hexToRGB } from '../../shared/theme/colors';
import { getAiColor, getPlatformIcon, getPlatformColor } from '../utils/platform-helpers';
import { loggers } from '../../shared/utils/logger';
import type { PlatformInfo, PanelMode } from '../types/panel-types';
import type { AtomicTestingStateReturn } from '../hooks/useAtomicTestingState';
import type { AISettings } from '../hooks/useAIState';

const log = loggers.panel;

export interface OAEVAtomicTestingViewProps extends AtomicTestingStateReturn {
  mode: 'dark' | 'light';
  availablePlatforms: PlatformInfo[];
  aiSettings: AISettings;
  setPanelMode: (mode: PanelMode) => void;
  showToast: (options: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
  }) => void;
}

export const OAEVAtomicTestingView: React.FC<OAEVAtomicTestingViewProps> = (props) => {
  const {
    mode,
    availablePlatforms,
    aiSettings,
    setPanelMode,
    showToast,
    // Atomic testing state
    atomicTestingTargets,
    setAtomicTestingTargets,
    selectedAtomicTarget,
    setSelectedAtomicTarget,
    atomicTestingShowList,
    setAtomicTestingShowList,
    atomicTestingPlatformId,
    setAtomicTestingPlatformId,
    atomicTestingPlatformSelected,
    setAtomicTestingPlatformSelected,
    atomicTestingTargetType,
    setAtomicTestingTargetType,
    atomicTestingAssets,
    setAtomicTestingAssets,
    atomicTestingAssetGroups,
    setAtomicTestingAssetGroups,
    atomicTestingTypeFilter,
    setAtomicTestingTypeFilter,
    atomicTestingInjectorContracts,
    setAtomicTestingInjectorContracts,
    atomicTestingSelectedAsset,
    setAtomicTestingSelectedAsset,
    atomicTestingSelectedAssetGroup,
    setAtomicTestingSelectedAssetGroup,
    atomicTestingSelectedContract,
    setAtomicTestingSelectedContract,
    atomicTestingTitle,
    setAtomicTestingTitle,
    atomicTestingCreating,
    setAtomicTestingCreating,
    atomicTestingLoadingAssets,
    setAtomicTestingLoadingAssets,
    atomicTestingAIMode,
    setAtomicTestingAIMode,
    atomicTestingAIGenerating,
    setAtomicTestingAIGenerating,
    atomicTestingAIPlatform,
    setAtomicTestingAIPlatform,
    atomicTestingAIExecutor,
    setAtomicTestingAIExecutor,
    atomicTestingAIContext,
    setAtomicTestingAIContext,
    atomicTestingAIGeneratedPayload,
    setAtomicTestingAIGeneratedPayload,
  } = props;

  const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';
  const openaevLogoPath = `../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`;
  
  // Get OpenAEV platforms only
  const openaevPlatforms = React.useMemo(() => 
    availablePlatforms.filter(p => p.type === 'openaev'), 
    [availablePlatforms]
  );

  // Handle platform selection
  const handleSelectAtomicTestingPlatform = async (platformId: string) => {
    setAtomicTestingPlatformId(platformId);
    setAtomicTestingPlatformSelected(true);
    setAtomicTestingTypeFilter('all');
    
    setAtomicTestingLoadingAssets(true);
    try {
      const [assetsRes, groupsRes, allContractsRes] = await Promise.all([
        chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSETS', payload: { platformId } }),
        chrome.runtime.sendMessage({ type: 'FETCH_OAEV_ASSET_GROUPS', payload: { platformId } }),
        chrome.runtime.sendMessage({ type: 'FETCH_INJECTOR_CONTRACTS', payload: { platformId } }),
      ]);
      
      if (assetsRes?.success) {
        setAtomicTestingAssets(assetsRes.data || []);
      }
      if (groupsRes?.success) {
        setAtomicTestingAssetGroups(groupsRes.data || []);
      }
      
      // Enrich attack patterns with contract availability
      if (allContractsRes?.success) {
        const allContracts = allContractsRes.data || [];
        setAtomicTestingTargets(prevTargets => {
          return prevTargets.map(target => {
            if (target.type !== 'attack-pattern') return target;
            if (target.platformId !== platformId) return target;
            
            const targetId = target.entityId || target.data?.entityId || target.data?.attack_pattern_id || target.data?.id;
            if (!targetId) return target;
            
            const matchingContracts = allContracts.filter((contract: any) => {
              const contractApIds: string[] = contract.injector_contract_attack_patterns || [];
              return contractApIds.includes(targetId);
            });
            
            const availablePlatformsSet = new Set<string>();
            for (const contract of matchingContracts) {
              const platforms = contract.injector_contract_platforms || [];
              for (const p of platforms) {
                availablePlatformsSet.add(p);
              }
            }
            return {
              ...target,
              data: {
                ...target.data,
                hasContracts: matchingContracts.length > 0,
                contractCount: matchingContracts.length,
                availablePlatforms: Array.from(availablePlatformsSet),
              },
            };
          });
        });
      }
      
      // If selected target is attack pattern, load injector contracts for it
      if (selectedAtomicTarget?.type === 'attack-pattern') {
        const entityId = selectedAtomicTarget.entityId || 
          selectedAtomicTarget.data?.entityId || 
          selectedAtomicTarget.data?.attack_pattern_id ||
          selectedAtomicTarget.data?.id;
        
        if (entityId) {
          const contractsRes = await chrome.runtime.sendMessage({
            type: 'FETCH_INJECTOR_CONTRACTS',
            payload: { attackPatternId: entityId, platformId },
          });
          if (contractsRes?.success) {
            setAtomicTestingInjectorContracts(contractsRes.data || []);
          }
        }
      }
    } catch (error) {
      log.error('Failed to load assets:', error);
    } finally {
      setAtomicTestingLoadingAssets(false);
    }
  };

  // Handle selecting a target from the list
  const handleSelectAtomicTargetFromList = (target: typeof atomicTestingTargets[0]) => {
    setSelectedAtomicTarget(target);
    setAtomicTestingTitle(`Atomic Test - ${target.name}`);
    setAtomicTestingShowList(false);
    setAtomicTestingInjectorContracts([]);
    setAtomicTestingSelectedContract(null);
    
    const entityId = target.entityId || 
      target.data?.entityId || 
      target.data?.attack_pattern_id ||
      target.data?.id;
    if (target.type === 'attack-pattern' && entityId && atomicTestingPlatformId) {
      chrome.runtime.sendMessage({
        type: 'FETCH_INJECTOR_CONTRACTS',
        payload: { attackPatternId: entityId, platformId: atomicTestingPlatformId },
      }).then((res: any) => {
        if (res?.success) {
          setAtomicTestingInjectorContracts(res.data || []);
        }
      });
    }
  };

  // Handle AI payload generation
  const handleGenerateAIPayload = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setAtomicTestingAIGenerating(true);
    setAtomicTestingAIGeneratedPayload(null);
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let pageContent = '';
      
      if (tab?.id) {
        const contentResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
        if (contentResponse?.success) {
          pageContent = contentResponse.data?.content || '';
        }
      }
      
      const MAX_PAGE_CONTENT = 6000;
      let contextContent = pageContent;
      if (contextContent.length > MAX_PAGE_CONTENT) {
        contextContent = contextContent.substring(0, MAX_PAGE_CONTENT) + '\n\n[Page content truncated]';
      }
      
      const fullContext = contextContent + (atomicTestingAIContext ? `\n\nAdditional context from user: ${atomicTestingAIContext}` : '');
      const response = await chrome.runtime.sendMessage({
        type: 'AI_GENERATE_ATOMIC_TEST',
        payload: {
          attackPattern: {
            name: `AI Generated Payload for ${atomicTestingAIPlatform}`,
            description: atomicTestingAIContext || 'Generate a security simulation payload based on the page content',
          },
          targetPlatform: atomicTestingAIPlatform.toLowerCase(),
          context: fullContext,
        },
      });
      
      if (response?.success && response.data) {
        const generatedTest = response.data;
        setAtomicTestingAIGeneratedPayload({
          name: generatedTest.name || `AI Payload - ${atomicTestingAIPlatform}`,
          description: generatedTest.description || 'AI-generated security simulation payload',
          executor: atomicTestingAIExecutor,
          command: generatedTest.command || '# AI failed to generate a command - please try again',
          cleanupCommand: generatedTest.cleanupCommand,
          cleanupExecutor: atomicTestingAIExecutor,
          platform: atomicTestingAIPlatform,
        });
        setAtomicTestingTitle(`Atomic Test - ${generatedTest.name || 'AI Generated'}`);
      } else {
        const errorMessage = response?.error || 'Unknown error - AI did not return a response';
        log.error('AI payload generation failed:', errorMessage);
        setAtomicTestingAIGeneratedPayload({
          name: 'AI Generation Failed',
          description: `Error: ${errorMessage}. Please try again or provide more specific context.`,
          executor: atomicTestingAIExecutor,
          command: `# AI generation failed: ${errorMessage}\n# Please try again with different context or check AI settings`,
          cleanupCommand: undefined,
          cleanupExecutor: atomicTestingAIExecutor,
          platform: atomicTestingAIPlatform,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
      log.error('AI payload generation error:', error);
      setAtomicTestingAIGeneratedPayload({
        name: 'AI Generation Failed',
        description: `Error: ${errorMessage}. Please check your AI settings and try again.`,
        executor: atomicTestingAIExecutor,
        command: `# AI generation error: ${errorMessage}`,
        cleanupCommand: undefined,
        cleanupExecutor: atomicTestingAIExecutor,
        platform: atomicTestingAIPlatform,
      });
    } finally {
      setAtomicTestingAIGenerating(false);
    }
  };

  // Handle atomic testing creation
  const handleCreateAtomicTesting = async () => {
    if (!selectedAtomicTarget || !atomicTestingPlatformId) return;
    
    const targetAssetId = atomicTestingTargetType === 'asset' ? atomicTestingSelectedAsset : null;
    const targetAssetGroupId = atomicTestingTargetType === 'asset_group' ? atomicTestingSelectedAssetGroup : null;
    
    if (!targetAssetId && !targetAssetGroupId) {
      log.error('No target selected');
      return;
    }
    
    setAtomicTestingCreating(true);
    
    try {
      let injectorContractId = atomicTestingSelectedContract;
      
      const isDomainOrHostname = selectedAtomicTarget.type === 'Domain-Name' || 
                                  selectedAtomicTarget.type === 'Hostname' ||
                                  selectedAtomicTarget.type === 'domain' || 
                                  selectedAtomicTarget.type === 'hostname';
      
      if (isDomainOrHostname) {
        const existingPayloadRes = await chrome.runtime.sendMessage({
          type: 'FIND_DNS_RESOLUTION_PAYLOAD',
          payload: {
            hostname: selectedAtomicTarget.value,
            platformId: atomicTestingPlatformId,
          },
        });
        
        let payload: any = null;
        
        if (existingPayloadRes?.success && existingPayloadRes.data) {
          payload = existingPayloadRes.data;
        } else {
          const payloadRes = await chrome.runtime.sendMessage({
            type: 'CREATE_OAEV_PAYLOAD',
            payload: {
              hostname: selectedAtomicTarget.value,
              name: `DNS Resolution - ${selectedAtomicTarget.value}`,
              platforms: ['Linux', 'Windows', 'MacOS'],
              platformId: atomicTestingPlatformId,
            },
          });
          if (!payloadRes?.success) {
            log.error('Failed to create payload:', payloadRes?.error);
            return;
          }
          payload = payloadRes.data;
        }
        
        injectorContractId = payload?.payload_injector_contract?.injector_contract_id ||
                            payload?.payload_injector_contract ||
                            payload?.injector_contract_id;
        
        if (!injectorContractId && payload?.payload_id) {
          const findContractRes = await chrome.runtime.sendMessage({
            type: 'FIND_INJECTOR_CONTRACT_BY_PAYLOAD',
            payload: {
              payloadId: payload.payload_id,
              platformId: atomicTestingPlatformId,
            },
          });
          if (findContractRes?.success && findContractRes.data) {
            injectorContractId = findContractRes.data.injector_contract_id;
          }
        }
        
        if (!injectorContractId) {
          log.error('No injector contract found for payload. Payload:', payload);
          return;
        }
      }
      
      if (!injectorContractId) {
        log.error('No injector contract selected');
        return;
      }
      
      const result = await chrome.runtime.sendMessage({
        type: 'CREATE_ATOMIC_TESTING',
        payload: {
          title: atomicTestingTitle || `Atomic Test - ${selectedAtomicTarget.name}`,
          injectorContractId,
          assetIds: targetAssetId ? [targetAssetId] : [],
          assetGroupIds: targetAssetGroupId ? [targetAssetGroupId] : [],
          platformId: atomicTestingPlatformId,
        },
      });
      
      if (result?.success && result.data?.url) {
        chrome.tabs.create({ url: result.data.url });
        window.parent.postMessage({ type: 'XTM_CLOSE_PANEL' }, '*');
        showToast({ type: 'success', message: 'Atomic testing created successfully' });
        
        setAtomicTestingTargets([]);
        setSelectedAtomicTarget(null);
        setAtomicTestingPlatformSelected(false);
        setPanelMode('empty');
      } else {
        showToast({ type: 'error', message: result?.error || 'Failed to create atomic testing' });
      }
    } catch (error) {
      log.error('Failed to create atomic testing:', error);
      showToast({ type: 'error', message: 'Failed to create atomic testing' });
    } finally {
      setAtomicTestingCreating(false);
    }
  };

  // Handle creating atomic testing with AI-generated payload
  const handleCreateAtomicTestingWithAIPayload = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    if (!atomicTestingAIGeneratedPayload) return;
    
    setAtomicTestingCreating(true);
    
    try {
      const payloadData = {
        payload_type: 'Command',
        payload_name: atomicTestingAIGeneratedPayload.name,
        payload_description: atomicTestingAIGeneratedPayload.description,
        payload_platforms: [atomicTestingAIGeneratedPayload.platform],
        command_executor: atomicTestingAIGeneratedPayload.executor,
        command_content: atomicTestingAIGeneratedPayload.command,
        payload_cleanup_executor: atomicTestingAIGeneratedPayload.cleanupExecutor || null,
        payload_cleanup_command: atomicTestingAIGeneratedPayload.cleanupCommand || null,
        payload_source: 'MANUAL',
        payload_status: 'VERIFIED',
        payload_execution_arch: 'ALL_ARCHITECTURES',
        payload_expectations: ['PREVENTION', 'DETECTION'],
      };
      
      const payloadRes = await chrome.runtime.sendMessage({
        type: 'CREATE_OAEV_PAYLOAD',
        payload: {
          payload: payloadData,
          platformId: atomicTestingPlatformId,
        },
      });
      
      if (!payloadRes?.success || !payloadRes.data) {
        log.error('Failed to create AI payload:', payloadRes?.error);
        setAtomicTestingCreating(false);
        return;
      }
      const createdPayload = payloadRes.data;
      
      let injectorContractId = createdPayload.payload_injector_contract?.injector_contract_id ||
        createdPayload.payload_injector_contract ||
        createdPayload.injector_contract_id;
      
      if (!injectorContractId) {
        const findContractRes = await chrome.runtime.sendMessage({
          type: 'FIND_INJECTOR_CONTRACT_BY_PAYLOAD',
          payload: {
            payloadId: createdPayload.payload_id,
            platformId: atomicTestingPlatformId,
          },
        });
        
        if (findContractRes?.success && findContractRes.data) {
          injectorContractId = findContractRes.data.injector_contract_id;
        }
      }
      
      if (!injectorContractId) {
        log.error('No injector contract found for AI-generated payload');
        setAtomicTestingCreating(false);
        return;
      }
      
      const targetAssetId = atomicTestingTargetType === 'asset' ? atomicTestingSelectedAsset : null;
      const targetAssetGroupId = atomicTestingTargetType === 'asset_group' ? atomicTestingSelectedAssetGroup : null;
      
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_ATOMIC_TESTING',
        payload: {
          title: atomicTestingTitle || `Atomic Test - ${atomicTestingAIGeneratedPayload.name}`,
          injectorContractId,
          assetIds: targetAssetId ? [targetAssetId] : [],
          assetGroupIds: targetAssetGroupId ? [targetAssetGroupId] : [],
          platformId: atomicTestingPlatformId,
        },
      });
      
      if (response?.success && response.data) {
        window.parent.postMessage({ type: 'XTM_CLOSE_PANEL' }, '*');
        window.parent.postMessage({ type: 'XTM_CLEAR_HIGHLIGHTS' }, '*');
        
        const atomicTestId = response.data.inject_id || response.data.atomic_id || response.data.id;
        if (atomicTestId && atomicTestingPlatformId) {
          if (response.data.url) {
            chrome.tabs.create({ url: response.data.url });
          } else {
            const platformUrl = openaevPlatforms.find(p => p.id === atomicTestingPlatformId)?.url || '';
            const atomicUrl = `${platformUrl}/admin/atomic_testings/${atomicTestId}`;
            chrome.tabs.create({ url: atomicUrl });
          }
        }
        
        showToast({ type: 'success', message: 'AI atomic testing created successfully' });
        
        setAtomicTestingAIMode(false);
        setAtomicTestingAIGeneratedPayload(null);
        setAtomicTestingShowList(true);
      } else {
        log.error('Failed to create atomic testing from AI payload:', response?.error);
        showToast({ type: 'error', message: response?.error || 'Failed to create atomic testing' });
      }
    } catch (error) {
      log.error('Error creating atomic testing with AI payload:', error);
      showToast({ type: 'error', message: 'Error creating atomic testing' });
    } finally {
      setAtomicTestingCreating(false);
    }
  };

  // Step 1: Platform selection (if multiple OpenAEV platforms)
  if (openaevPlatforms.length > 1 && !atomicTestingPlatformSelected) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <img src={openaevLogoPath} alt="OpenAEV" style={{ height: 24, width: 'auto' }} />
          <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Atomic Testing</Typography>
        </Box>
        
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Select OpenAEV platform to create atomic testing:
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {openaevPlatforms.map((platform) => (
            <Paper
              key={platform.id}
              onClick={() => handleSelectAtomicTestingPlatform(platform.id)}
              elevation={0}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 2,
                cursor: 'pointer',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
              }}
            >
              <img src={openaevLogoPath} alt="OpenAEV" style={{ width: 24, height: 24 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {platform.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {platform.url}
                </Typography>
              </Box>
              <ChevronRightOutlined sx={{ color: 'text.secondary' }} />
            </Paper>
          ))}
        </Box>
      </Box>
    );
  }

  // Auto-select single platform
  if (openaevPlatforms.length === 1 && !atomicTestingPlatformSelected && !atomicTestingLoadingAssets) {
    handleSelectAtomicTestingPlatform(openaevPlatforms[0].id);
  }

  // Step 2: Show list of found targets
  if (atomicTestingShowList && atomicTestingPlatformSelected) {
    const attackPatterns = atomicTestingTargets.filter(t => 
      t.type === 'attack-pattern' && t.platformId === atomicTestingPlatformId
    );
    const domains = atomicTestingTargets.filter(t => t.type === 'Domain-Name' || t.type === 'domain');
    const hostnames = atomicTestingTargets.filter(t => t.type === 'Hostname' || t.type === 'hostname');
    
    const attackPatternsWithContracts = attackPatterns.filter(t => t.data?.hasContracts === true);
    const attackPatternsWithoutContracts = attackPatterns.filter(t => t.data?.hasContracts !== true);
    
    const showAttackPatterns = atomicTestingTypeFilter === 'all' || atomicTestingTypeFilter === 'attack-pattern';
    const showDomains = atomicTestingTypeFilter === 'all' || atomicTestingTypeFilter === 'domain';
    
    const targetPlatform = openaevPlatforms.find(p => p.id === atomicTestingPlatformId);
    const isAIAvailable = aiSettings.available && targetPlatform?.isEnterprise;
    const aiColors = getAiColor(mode);
    
    let tooltipMessage = '';
    if (!aiSettings.available) {
      tooltipMessage = 'AI is not configured. Configure AI in extension settings.';
    } else if (!targetPlatform?.isEnterprise) {
      tooltipMessage = 'AI features require Enterprise Edition.';
    }

    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexShrink: 0 }}>
          <img src={openaevLogoPath} alt="OpenAEV" style={{ height: 24, width: 'auto' }} />
          <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Atomic Testing</Typography>
        </Box>
        
        {/* Type Stats - Clickable Boxes */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexShrink: 0 }}>
          {attackPatterns.length > 0 && (
            <Paper
              elevation={0}
              onClick={() => setAtomicTestingTypeFilter(atomicTestingTypeFilter === 'attack-pattern' ? 'all' : 'attack-pattern')}
              sx={{
                flex: 1,
                p: 1.5,
                borderRadius: 1,
                textAlign: 'center',
                cursor: 'pointer',
                border: 2,
                borderColor: atomicTestingTypeFilter === 'attack-pattern' ? '#d4e157' : 'transparent',
                bgcolor: atomicTestingTypeFilter === 'attack-pattern' ? 'rgba(212, 225, 87, 0.1)' : 'action.hover',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: 'rgba(212, 225, 87, 0.15)' },
              }}
            >
              <LockPattern sx={{ fontSize: 24, color: '#d4e157', mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#d4e157' }}>
                {attackPatterns.length}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Attack Patterns
              </Typography>
            </Paper>
          )}
          {(domains.length > 0 || hostnames.length > 0) && (
            <Paper
              elevation={0}
              onClick={() => setAtomicTestingTypeFilter(atomicTestingTypeFilter === 'domain' ? 'all' : 'domain')}
              sx={{
                flex: 1,
                p: 1.5,
                borderRadius: 1,
                textAlign: 'center',
                cursor: 'pointer',
                border: 2,
                borderColor: atomicTestingTypeFilter === 'domain' ? '#00bcd4' : 'transparent',
                bgcolor: atomicTestingTypeFilter === 'domain' ? 'rgba(0, 188, 212, 0.1)' : 'action.hover',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: 'rgba(0, 188, 212, 0.15)' },
              }}
            >
              <LanguageOutlined sx={{ fontSize: 24, color: '#00bcd4', mb: 0.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#00bcd4' }}>
                {domains.length + hostnames.length}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                Domains
              </Typography>
            </Paper>
          )}
        </Box>
        
        {/* AI Generate Payload Option */}
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
                Generate Payload with AI
              </Typography>
              <Typography variant="caption" sx={{ color: isAIAvailable ? 'text.secondary' : 'text.disabled' }}>
                {isAIAvailable ? 'Create a custom payload based on page content' : tooltipMessage}
              </Typography>
            </Box>
            <Tooltip title={isAIAvailable ? 'Create payload with AI' : tooltipMessage}>
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!isAIAvailable}
                  onClick={() => {
                    setAtomicTestingAIMode(true);
                    setAtomicTestingShowList(false);
                    setSelectedAtomicTarget(null);
                  }}
                  startIcon={<AutoAwesomeOutlined />}
                  sx={{
                    textTransform: 'none',
                    borderColor: aiColors.main,
                    color: aiColors.main,
                    '&:hover': {
                      borderColor: aiColors.dark,
                      bgcolor: hexToRGB(aiColors.main, 0.08),
                    },
                  }}
                >
                  Generate
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Paper>
        
        {/* Loading indicator */}
        {atomicTestingLoadingAssets && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1.5, 
            p: 1.5, 
            mb: 2, 
            bgcolor: 'action.hover', 
            borderRadius: 1,
            flexShrink: 0,
          }}>
            <CircularProgress size={18} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Resolving compatible injects for attack patterns...
            </Typography>
          </Box>
        )}
        
        {atomicTestingTargets.length === 0 ? (
          <Alert severity="info">
            No attack patterns or domains found on this page
          </Alert>
        ) : (
          <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {/* Domains/Hostnames - Always Playable */}
            {showDomains && (domains.length > 0 || hostnames.length > 0) && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    Domains & Hostnames ({domains.length + hostnames.length})
                  </Typography>
                  <Chip label="Always playable" size="small" sx={{ height: 18, fontSize: 10, bgcolor: '#4caf50', color: 'white' }} />
                </Box>
                {domains.map((target, i) => (
                  <Paper
                    key={`domain-${i}`}
                    onClick={() => handleSelectAtomicTargetFromList(target)}
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      mb: 1,
                      cursor: 'pointer',
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: 'action.hover', borderColor: '#00bcd4' },
                    }}
                  >
                    <LanguageOutlined sx={{ fontSize: 20, color: '#00bcd4' }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                        {target.value}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#4caf50' }}>
                        DNS Resolution payload
                      </Typography>
                    </Box>
                    <ChevronRightOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
                  </Paper>
                ))}
                {hostnames.map((target, i) => (
                  <Paper
                    key={`hostname-${i}`}
                    onClick={() => handleSelectAtomicTargetFromList(target)}
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      mb: 1,
                      cursor: 'pointer',
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: 'action.hover', borderColor: '#9c27b0' },
                    }}
                  >
                    <DnsOutlined sx={{ fontSize: 20, color: '#9c27b0' }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                        {target.value}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#4caf50' }}>
                        DNS Resolution payload
                      </Typography>
                    </Box>
                    <ChevronRightOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
                  </Paper>
                ))}
              </>
            )}
            
            {/* Attack Patterns WITH Contracts */}
            {showAttackPatterns && attackPatternsWithContracts.length > 0 && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: domains.length > 0 || hostnames.length > 0 ? 2 : 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    Attack Patterns ({attackPatternsWithContracts.length})
                  </Typography>
                  <Chip label="Injects available" size="small" sx={{ height: 18, fontSize: 10, bgcolor: '#4caf50', color: 'white' }} />
                </Box>
                {attackPatternsWithContracts.map((target, i) => (
                  <Paper
                    key={`ap-ready-${i}`}
                    onClick={() => handleSelectAtomicTargetFromList(target)}
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      mb: 1,
                      cursor: 'pointer',
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: 'action.hover', borderColor: '#d4e157' },
                    }}
                  >
                    <LockPattern sx={{ fontSize: 20, color: '#d4e157' }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                        {target.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        {target.data?.attack_pattern_external_id && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {target.data.attack_pattern_external_id}
                          </Typography>
                        )}
                        {target.data?.contractCount && (
                          <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 500 }}>
                            {target.data?.attack_pattern_external_id ? ' · ' : ''}{target.data.contractCount} inject{target.data.contractCount !== 1 ? 's' : ''}
                          </Typography>
                        )}
                      </Box>
                      {target.data?.availablePlatforms && target.data.availablePlatforms.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                          {target.data.availablePlatforms.map((platform: string) => (
                            <Chip
                              key={platform}
                              icon={getPlatformIcon(platform)}
                              label={platform}
                              size="small"
                              sx={{ 
                                height: 20, 
                                fontSize: 10,
                                bgcolor: getPlatformColor(platform),
                                color: 'white',
                                '& .MuiChip-icon': { color: 'white', ml: 0.5 },
                              }}
                            />
                          ))}
                        </Box>
                      )}
                    </Box>
                    <ChevronRightOutlined fontSize="small" sx={{ color: 'text.secondary' }} />
                  </Paper>
                ))}
              </>
            )}
            
            {/* Attack Patterns WITHOUT Contracts */}
            {showAttackPatterns && attackPatternsWithoutContracts.length > 0 && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    Attack Patterns ({attackPatternsWithoutContracts.length})
                  </Typography>
                  <Chip label="No injects" size="small" sx={{ height: 18, fontSize: 10, bgcolor: 'text.disabled', color: 'white' }} />
                </Box>
                {attackPatternsWithoutContracts.map((target, i) => (
                  <Paper
                    key={`ap-no-contract-${i}`}
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      mb: 1,
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                      opacity: 0.6,
                    }}
                  >
                    <LockPattern sx={{ fontSize: 20, color: 'text.disabled' }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word', color: 'text.secondary' }}>
                        {target.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        {target.data?.attack_pattern_external_id || ''} • No inject contracts
                      </Typography>
                    </Box>
                  </Paper>
                ))}
              </>
            )}
          </Box>
        )}
        
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 2, textAlign: 'center', flexShrink: 0 }}>
          Select a target from the list or click on a highlight on the page
        </Typography>
      </Box>
    );
  }

  // Step 3: AI generation form
  if (atomicTestingAIMode) {
    const aiColors = getAiColor(mode);
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexShrink: 0 }}>
          <img src={openaevLogoPath} alt="OpenAEV" style={{ height: 24, width: 'auto' }} />
          <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>AI Payload Generation</Typography>
        </Box>
        
        <Box sx={{ mb: 1.5, flexShrink: 0 }}>
          <Button
            size="small"
            startIcon={<ChevronLeftOutlined />}
            onClick={() => {
              setAtomicTestingAIMode(false);
              setAtomicTestingShowList(true);
              setAtomicTestingAIGeneratedPayload(null);
            }}
            sx={{ 
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            Back to attack patterns
          </Button>
        </Box>
        
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
            <Typography variant="body2" sx={{ fontWeight: 600 }}>AI-Generated Payload</Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            AI will analyze the page content and generate a command payload for testing. 
            Select target platform and executor below.
          </Typography>
        </Paper>
        
        {atomicTestingAIGeneratedPayload ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Generated Payload</Typography>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>{atomicTestingAIGeneratedPayload.name}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1, fontSize: 12 }}>
                {atomicTestingAIGeneratedPayload.description}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <Chip label={atomicTestingAIGeneratedPayload.platform} size="small" sx={{ height: 20, fontSize: 10 }} />
                <Chip label={atomicTestingAIGeneratedPayload.executor} size="small" sx={{ height: 20, fontSize: 10 }} />
              </Box>
            </Paper>
            
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>Command</Typography>
              <Box 
                sx={{ 
                  p: 1.5, 
                  bgcolor: mode === 'dark' ? '#1e1e1e' : '#f5f5f5', 
                  borderRadius: 1, 
                  fontFamily: 'monospace', 
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: 120,
                  overflow: 'auto',
                }}
              >
                {atomicTestingAIGeneratedPayload.command}
              </Box>
            </Box>
            
            {atomicTestingAIGeneratedPayload.cleanupCommand && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>Cleanup Command</Typography>
                <Box 
                  sx={{ 
                    p: 1.5, 
                    bgcolor: mode === 'dark' ? '#1e1e1e' : '#f5f5f5', 
                    borderRadius: 1, 
                    fontFamily: 'monospace', 
                    fontSize: 11,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: 80,
                    overflow: 'auto',
                  }}
                >
                  {atomicTestingAIGeneratedPayload.cleanupCommand}
                </Box>
              </Box>
            )}
            
            <TextField
              label="Test Title"
              value={atomicTestingTitle}
              onChange={(e) => setAtomicTestingTitle(e.target.value)}
              placeholder={`Atomic Test - ${atomicTestingAIGeneratedPayload.name}`}
              size="small"
              fullWidth
            />
            
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                Target Type
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant={atomicTestingTargetType === 'asset' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setAtomicTestingTargetType('asset')}
                  startIcon={<ComputerOutlined />}
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  Asset
                </Button>
                <Button
                  variant={atomicTestingTargetType === 'asset_group' ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setAtomicTestingTargetType('asset_group')}
                  startIcon={<LanOutlined />}
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  Asset Group
                </Button>
              </Box>
            </Box>
            
            {atomicTestingTargetType === 'asset' ? (
              <Autocomplete
                options={atomicTestingAssets}
                getOptionLabel={(option) => option.asset_name || option.endpoint_hostname || 'Unknown'}
                value={atomicTestingAssets.find(a => a.asset_id === atomicTestingSelectedAsset) || null}
                onChange={(_, value) => setAtomicTestingSelectedAsset(value?.asset_id || null)}
                renderInput={(params) => <TextField {...params} label="Select Asset" size="small" />}
                size="small"
              />
            ) : (
              <Autocomplete
                options={atomicTestingAssetGroups}
                getOptionLabel={(option) => option.asset_group_name || 'Unknown'}
                value={atomicTestingAssetGroups.find(g => g.asset_group_id === atomicTestingSelectedAssetGroup) || null}
                onChange={(_, value) => setAtomicTestingSelectedAssetGroup(value?.asset_group_id || null)}
                renderInput={(params) => <TextField {...params} label="Select Asset Group" size="small" />}
                size="small"
              />
            )}
            
            <Button
              variant="contained"
              fullWidth
              disabled={
                atomicTestingCreating ||
                (atomicTestingTargetType === 'asset' && !atomicTestingSelectedAsset) ||
                (atomicTestingTargetType === 'asset_group' && !atomicTestingSelectedAssetGroup)
              }
              onClick={handleCreateAtomicTestingWithAIPayload}
              startIcon={atomicTestingCreating ? <CircularProgress size={16} color="inherit" /> : <Target />}
            >
              {atomicTestingCreating ? 'Creating...' : 'Create Atomic Testing'}
            </Button>
            
            <Button
              variant="outlined"
              size="small"
              onClick={() => setAtomicTestingAIGeneratedPayload(null)}
              startIcon={<RefreshOutlined />}
              sx={{ textTransform: 'none' }}
            >
              Generate Different Payload
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Target Platform</InputLabel>
              <Select
                value={atomicTestingAIPlatform}
                label="Target Platform"
                onChange={(e) => {
                  setAtomicTestingAIPlatform(e.target.value);
                  if (e.target.value === 'Windows') {
                    setAtomicTestingAIExecutor('psh');
                  } else {
                    setAtomicTestingAIExecutor('bash');
                  }
                }}
              >
                <MenuItem value="Windows">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getPlatformIcon('Windows')}
                    <span>Windows</span>
                  </Box>
                </MenuItem>
                <MenuItem value="Linux">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getPlatformIcon('Linux')}
                    <span>Linux</span>
                  </Box>
                </MenuItem>
                <MenuItem value="MacOS">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getPlatformIcon('MacOS')}
                    <span>macOS</span>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth size="small">
              <InputLabel>Command Executor</InputLabel>
              <Select
                value={atomicTestingAIExecutor}
                label="Command Executor"
                onChange={(e) => setAtomicTestingAIExecutor(e.target.value)}
              >
                {atomicTestingAIPlatform === 'Windows' ? (
                  [
                    <MenuItem key="psh" value="psh">PowerShell</MenuItem>,
                    <MenuItem key="cmd" value="cmd">Command Prompt (cmd)</MenuItem>,
                  ]
                ) : (
                  [
                    <MenuItem key="bash" value="bash">Bash</MenuItem>,
                    <MenuItem key="sh" value="sh">Sh</MenuItem>,
                  ]
                )}
              </Select>
            </FormControl>
            
            <TextField
              label="Additional Context (optional)"
              value={atomicTestingAIContext}
              onChange={(e) => setAtomicTestingAIContext(e.target.value)}
              multiline
              rows={3}
              size="small"
              placeholder="Provide any additional context or specific behavior you want the payload to simulate..."
              helperText="AI will use the page content plus this context to generate a relevant payload"
            />
            
            <Button
              variant="outlined"
              fullWidth
              disabled={atomicTestingAIGenerating}
              onClick={handleGenerateAIPayload}
              startIcon={atomicTestingAIGenerating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeOutlined />}
              sx={{
                borderColor: aiColors.main,
                color: aiColors.main,
                '&:hover': {
                  borderColor: aiColors.dark,
                  bgcolor: hexToRGB(aiColors.main, 0.08),
                },
                '&.Mui-disabled': {
                  borderColor: hexToRGB(aiColors.main, 0.3),
                  color: hexToRGB(aiColors.main, 0.5),
                },
              }}
            >
              {atomicTestingAIGenerating ? 'Generating Payload...' : 'Generate Payload with AI'}
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  // Step 4: Form once target is selected
  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexShrink: 0 }}>
        <img src={openaevLogoPath} alt="OpenAEV" style={{ height: 24, width: 'auto' }} />
        <Typography variant="h6" sx={{ fontSize: 16, flex: 1 }}>Atomic Testing</Typography>
      </Box>
      
      {atomicTestingTargets.length > 0 && (
        <Box sx={{ mb: 1.5, flexShrink: 0 }}>
          <Button
            size="small"
            startIcon={<ChevronLeftOutlined />}
            onClick={() => {
              setSelectedAtomicTarget(null);
              setAtomicTestingShowList(true);
            }}
            sx={{ 
              color: 'text.secondary',
              textTransform: 'none',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            Back to attack patterns
          </Button>
        </Box>
      )}
      
      {selectedAtomicTarget ? (
        <Paper elevation={0} sx={{ p: 2, mb: 2, border: 1, borderColor: '#f44336', borderRadius: 1, bgcolor: 'rgba(244, 67, 54, 0.1)', flexShrink: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Selected Target</Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>{selectedAtomicTarget.name}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
            {selectedAtomicTarget.type.replace('-', ' ').replace('_', ' ')}
          </Typography>
        </Paper>
      ) : (
        <Alert severity="info" sx={{ mb: 2, flexShrink: 0 }}>
          Click on a highlighted target on the page or select from the list
        </Alert>
      )}
      
      {atomicTestingLoadingAssets ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : selectedAtomicTarget && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
          <TextField
            label="Test Title"
            value={atomicTestingTitle}
            onChange={(e) => setAtomicTestingTitle(e.target.value)}
            placeholder={`Atomic Test - ${selectedAtomicTarget.name}`}
            size="small"
            fullWidth
          />
          
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
              Target Type
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={atomicTestingTargetType === 'asset' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setAtomicTestingTargetType('asset')}
                startIcon={<ComputerOutlined />}
                sx={{ flex: 1, minWidth: 0 }}
              >
                Asset
              </Button>
              <Button
                variant={atomicTestingTargetType === 'asset_group' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setAtomicTestingTargetType('asset_group')}
                startIcon={<LanOutlined />}
                sx={{ flex: 1, minWidth: 0 }}
              >
                Asset Group
              </Button>
            </Box>
          </Box>
          
          {atomicTestingTargetType === 'asset' ? (
            <Autocomplete
              options={atomicTestingAssets}
              getOptionLabel={(option) => option.asset_name || option.endpoint_hostname || 'Unknown'}
              value={atomicTestingAssets.find(a => a.asset_id === atomicTestingSelectedAsset) || null}
              onChange={(_, value) => setAtomicTestingSelectedAsset(value?.asset_id || null)}
              renderInput={(params) => <TextField {...params} label="Select Asset" size="small" />}
              size="small"
            />
          ) : (
            <Autocomplete
              options={atomicTestingAssetGroups}
              getOptionLabel={(option) => option.asset_group_name || 'Unknown'}
              value={atomicTestingAssetGroups.find(g => g.asset_group_id === atomicTestingSelectedAssetGroup) || null}
              onChange={(_, value) => setAtomicTestingSelectedAssetGroup(value?.asset_group_id || null)}
              renderInput={(params) => <TextField {...params} label="Select Asset Group" size="small" />}
              size="small"
            />
          )}
          
          {selectedAtomicTarget.type === 'attack-pattern' && (
            <Box>
              <Autocomplete
                options={atomicTestingInjectorContracts}
                getOptionLabel={(option) => {
                  const label = option.injector_contract_labels?.en || 
                    option.injector_contract_labels?.['en-US'] || 
                    option.injector_name || 
                    'Unknown Inject';
                  return label;
                }}
                value={atomicTestingInjectorContracts.find(c => c.injector_contract_id === atomicTestingSelectedContract) || null}
                onChange={(_, value) => setAtomicTestingSelectedContract(value?.injector_contract_id || null)}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Select inject" 
                    size="small"
                    helperText={atomicTestingInjectorContracts.length === 0 ? 'No injects available for this attack pattern' : undefined}
                  />
                )}
                renderOption={(props, option) => {
                  const label = option.injector_contract_labels?.en || 
                    option.injector_contract_labels?.['en-US'] || 
                    option.injector_name || 
                    'Unknown Inject';
                  const platforms = option.injector_contract_platforms || [];
                  const injectorType = option.injector_contract_injector_type || option.injector_type || '';
                  
                  return (
                    <li {...props} key={option.injector_contract_id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{label}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            {platforms.map((platform: string) => (
                              <Chip
                                key={platform}
                                icon={getPlatformIcon(platform)}
                                label={platform}
                                size="small"
                                sx={{ 
                                  height: 20, 
                                  fontSize: 10,
                                  bgcolor: getPlatformColor(platform),
                                  color: 'white',
                                  '& .MuiChip-icon': { color: 'white', ml: 0.5 },
                                }}
                              />
                            ))}
                            {injectorType && (
                              <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                                {injectorType}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <InfoOutlined fontSize="small" sx={{ color: 'text.secondary', opacity: 0.5 }} />
                      </Box>
                    </li>
                  );
                }}
                size="small"
                noOptionsText="No injects available for this attack pattern"
              />
              {atomicTestingInjectorContracts.length > 0 && atomicTestingSelectedContract && (
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {(() => {
                    const selectedContract = atomicTestingInjectorContracts.find(c => c.injector_contract_id === atomicTestingSelectedContract);
                    const platforms = selectedContract?.injector_contract_platforms || [];
                    return platforms.map((platform: string) => (
                      <Chip
                        key={platform}
                        icon={getPlatformIcon(platform)}
                        label={platform}
                        size="small"
                        sx={{ 
                          height: 22, 
                          fontSize: 11,
                          bgcolor: getPlatformColor(platform),
                          color: 'white',
                          '& .MuiChip-icon': { color: 'white', ml: 0.5 },
                        }}
                      />
                    ));
                  })()}
                </Box>
              )}
            </Box>
          )}
          
          {(selectedAtomicTarget.type === 'Domain-Name' || selectedAtomicTarget.type === 'domain' || 
            selectedAtomicTarget.type === 'Hostname' || selectedAtomicTarget.type === 'hostname') && (
            <Alert severity="info" sx={{ fontSize: 12 }}>
              A DNS Resolution payload will be created automatically for this {selectedAtomicTarget.type.toLowerCase().replace('-', ' ')}.
            </Alert>
          )}
          
          <Box sx={{ mt: 'auto', pt: 2, flexShrink: 0 }}>
            <Button
              fullWidth
              variant="contained"
              color="error"
              onClick={handleCreateAtomicTesting}
              disabled={
                atomicTestingCreating || 
                !selectedAtomicTarget ||
                (atomicTestingTargetType === 'asset' && !atomicTestingSelectedAsset) ||
                (atomicTestingTargetType === 'asset_group' && !atomicTestingSelectedAssetGroup) ||
                (selectedAtomicTarget.type === 'attack-pattern' && !atomicTestingSelectedContract)
              }
              startIcon={atomicTestingCreating ? <CircularProgress size={16} color="inherit" /> : <Target />}
            >
              {atomicTestingCreating ? 'Creating...' : 'Create Atomic Testing'}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};
