import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  ThemeProvider, 
  createTheme,
  CssBaseline, 
  Box, 
  Typography, 
  IconButton, 
  Divider,
  Tooltip,
  Paper,
  Button,
  keyframes,
  Popover,
  ListItemIcon,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  SettingsOutlined,
  CenterFocusStrongOutlined,
  SearchOutlined,
  DescriptionOutlined,
  TravelExploreOutlined,
  DevicesOutlined,
  OpenInNewOutlined,
  VisibilityOutlined,
  VisibilityOffOutlined,
  ChevronRightOutlined,
  SkipNextOutlined,
  MovieFilterOutlined,
  MoreHorizOutlined,
  AutoAwesomeOutlined,
  RocketLaunchOutlined,
} from '@mui/icons-material';
import { Target } from 'mdi-material-ui';
import ThemeDark from '../shared/theme/ThemeDark';
import ThemeLight from '../shared/theme/ThemeLight';
import { loggers } from '../shared/utils/logger';
import { PLATFORM_REGISTRY, type PlatformType } from '../shared/platform';

const log = loggers.popup;

// Pulsing animation for connection indicator
const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(76, 175, 80, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
  }
`;

interface PlatformStatus {
  id: string;
  name: string;
  url: string;
  connected: boolean;
  version?: string;
  userName?: string;
  isEnterprise?: boolean;
  /** Platform type for identification */
  platformType?: PlatformType;
}

/**
 * Connection status organized by platform type
 * When adding a new platform, add its key here
 */
interface ConnectionStatus {
  opencti: PlatformStatus[];
  openaev: PlatformStatus[];
  // Add new platforms here as they are integrated:
  // opengrc: PlatformStatus[];
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  tooltip: string;
  onClick: () => void;
  color: string;
  disabled?: boolean;
  compact?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, subtitle, tooltip, onClick, color, disabled, compact = false }) => (
  <Tooltip title={tooltip} arrow>
    <Paper
      onClick={disabled ? undefined : onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 0.25 : 0.5,
        p: compact ? 1 : 1.5,
        width: '100%',
        height: compact ? 72 : 100,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        background: `linear-gradient(135deg, ${color}20, ${color}08)`,
        border: `1px solid ${color}50`,
        borderRadius: 1,
        transition: 'all 0.2s ease',
        '&:hover': disabled ? {} : {
          transform: 'translateY(-2px)',
          boxShadow: `0 4px 12px ${color}30`,
          borderColor: color,
        },
      }}
    >
      <Box sx={{ color, display: 'flex' }}>{icon}</Box>
      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: compact ? 14 : 15, lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: compact ? 11 : 12, textAlign: 'center', lineHeight: 1.2 }}>
        {subtitle}
      </Typography>
    </Paper>
  </Tooltip>
);

type SetupStep = 'welcome' | 'opencti' | 'openaev' | 'complete';

const App: React.FC = () => {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [status, setStatus] = useState<ConnectionStatus>({ 
    opencti: [], 
    openaev: [] 
  });
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  
  // Setup wizard state
  const [setupStep, setSetupStep] = useState<SetupStep>('welcome');
  const [setupUrl, setSetupUrl] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [setupName, setSetupName] = useState('');
  const [showSetupToken, setShowSetupToken] = useState(false);
  const [setupTesting, setSetupTesting] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSuccess, setSetupSuccess] = useState(false);
  
  // AI and EE state
  const [aiConfigured, setAiConfigured] = useState(false);
  const [showEETrialDialog, setShowEETrialDialog] = useState(false);

  const theme = useMemo(() => {
    const themeOptions = mode === 'dark' ? ThemeDark() : ThemeLight();
    return createTheme(themeOptions);
  }, [mode]);

  // Platform connection status helpers
  // To add a new platform, add corresponding status checks here
  const hasOpenCTI = status.opencti.some(p => p.connected);
  const hasOpenAEV = status.openaev.some(p => p.connected);
  // const hasOpenGRC = status.opengrc?.some(p => p.connected) ?? false;
  
  // Platform configuration status
  const hasAnyOpenCTIConfigured = status.opencti.length > 0;
  const hasAnyOpenAEVConfigured = status.openaev.length > 0;
  // const hasAnyOpenGRCConfigured = (status.opengrc?.length ?? 0) > 0;
  
  // Combined platform checks
  const hasAnyPlatformConfigured = hasAnyOpenCTIConfigured || hasAnyOpenAEVConfigured;
  // When adding new platforms: hasAnyPlatformConfigured = hasAnyOpenCTIConfigured || hasAnyOpenAEVConfigured || hasAnyOpenGRCConfigured;
  const hasEnterprise = status.opencti.some(p => p.isEnterprise) || status.openaev.some(p => p.isEnterprise);

  useEffect(() => {
    // Check if we're running in an extension context
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(isDark ? 'dark' : 'light');
      return;
    }

    // Get theme setting
    chrome.runtime.sendMessage({ type: 'GET_PLATFORM_THEME' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success) {
        let themeMode = response.data;
        if (themeMode === 'auto') {
          themeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        setMode(themeMode);
      }
    });

    // Get settings and platform status
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, async (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.success && response.data) {
        const settings = response.data;
        const openctiPlatforms = settings.openctiPlatforms || [];
        const openaevPlatforms = settings.openaevPlatforms || [];
        
        // Check AI configuration
        const aiSettings = settings.aiSettings;
        setAiConfigured(!!(aiSettings?.enabled && aiSettings?.provider && aiSettings?.apiKey));

        // Build initial platform lists - include isEnterprise from saved settings
        const openctiList: PlatformStatus[] = openctiPlatforms.map((p: any) => ({
          id: p.id || 'default',
          name: p.name || p.platformName || 'OpenCTI',
          url: p.url || '',
          connected: false,
          version: undefined,
          userName: undefined,
          isEnterprise: p.isEnterprise, // Include saved EE status
        }));
        
        const openaevList: PlatformStatus[] = openaevPlatforms.map((p: any) => ({
          id: p.id || 'default',
          name: p.name || p.platformName || 'OpenAEV',
          url: p.url || '',
          connected: false,
          userName: undefined,
          isEnterprise: p.isEnterprise, // Include saved EE status
        }));

        // Set initial status first (all disconnected) - UI shows immediately
        setStatus({ opencti: openctiList, openaev: openaevList });

        // Test platforms PROGRESSIVELY - update UI as each responds, don't wait for all
        // This prevents slow/unresponsive platforms from blocking the UI
        log.debug(' Testing', openctiPlatforms.length, 'OpenCTI and', openaevPlatforms.length, 'OpenAEV platforms');
        
        // Test OpenCTI platforms - each updates UI immediately when it responds
        openctiPlatforms
          .filter((platform: any) => platform?.url && platform?.apiToken)
          .forEach((platform: any) => {
            const platformId = platform.id;
            log.debug(`Testing OpenCTI platform:`, platformId, platform.name);
            
            // Add timeout wrapper for unresponsive platforms
            const timeoutId = setTimeout(() => {
              log.warn(`OpenCTI platform ${platformId} timeout`);
              // Don't update status on timeout - leave as disconnected
            }, 10000); // 10 second timeout
            
            chrome.runtime.sendMessage(
              { type: 'TEST_PLATFORM_CONNECTION', payload: { platformId, platformType: 'opencti' } },
              (testResponse) => {
                clearTimeout(timeoutId);
                if (chrome.runtime.lastError) {
                  log.error(' Connection test error for', platformId, chrome.runtime.lastError);
                  return; // Leave as disconnected
                }
                
                if (testResponse?.success) {
                  log.debug(`Connection test SUCCESS for ${platformId}:`, testResponse.data?.version);
                  // Update status IMMEDIATELY for this platform only
                  setStatus(prev => ({
                    ...prev,
                    opencti: prev.opencti.map(p => 
                      p.id === platformId 
                        ? { 
                            ...p, 
                            connected: true, 
                            version: testResponse.data?.version, 
                            userName: testResponse.data?.me?.name || testResponse.data?.me?.user_email,
                            isEnterprise: testResponse.data?.enterprise_edition,
                          }
                        : p
                    ),
                  }));
                } else {
                  log.error(' Connection test failed for', platformId, testResponse?.error);
                  // Leave as disconnected
                }
              }
            );
          });

        // Test OpenAEV platforms - each updates UI immediately when it responds
        openaevPlatforms
          .filter((platform: any) => platform?.url && platform?.apiToken)
          .forEach((platform: any) => {
            const platformId = platform.id;
            
            // Add timeout wrapper for unresponsive platforms
            const timeoutId = setTimeout(() => {
              log.warn(`OpenAEV platform ${platformId} timeout`);
              // Don't update status on timeout - leave as disconnected
            }, 10000); // 10 second timeout
            
            chrome.runtime.sendMessage(
              { type: 'TEST_PLATFORM_CONNECTION', payload: { platformId, platformType: 'openaev' } },
              (testResponse) => {
                clearTimeout(timeoutId);
                if (chrome.runtime.lastError) {
                  return; // Leave as disconnected
                }
                
                if (testResponse?.success) {
                  // Update status IMMEDIATELY for this platform only
                  setStatus(prev => ({
                    ...prev,
                    openaev: prev.openaev.map(p => 
                      p.id === platformId 
                        ? { 
                            ...p, 
                            connected: true, 
                            userName: testResponse.data?.user?.user_email,
                            version: testResponse.data?.version,
                            isEnterprise: testResponse.data?.enterprise_edition,
                          }
                        : p
                    ),
                  }));
                }
                // Leave as disconnected on failure
              }
            );
          });
      }
    });
    
    // Listen for storage changes to keep status in sync
    // This ensures the popup updates when settings are saved (e.g., from splash setup completing)
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.settings) {
        const newSettings = changes.settings.newValue;
        if (newSettings) {
          // Update platform status with new isEnterprise values
          const openctiPlatforms = newSettings.openctiPlatforms || [];
          const openaevPlatforms = newSettings.openaevPlatforms || [];
          
          setStatus(prev => ({
            opencti: openctiPlatforms.map((p: any) => {
              const existing = prev.opencti.find(e => e.id === p.id);
              return existing 
                ? { ...existing, isEnterprise: p.isEnterprise }
                : {
                    id: p.id || 'default',
                    name: p.name || p.platformName || 'OpenCTI',
                    url: p.url || '',
                    connected: false,
                    isEnterprise: p.isEnterprise,
                  };
            }),
            openaev: openaevPlatforms.map((p: any) => {
              const existing = prev.openaev.find(e => e.id === p.id);
              return existing 
                ? { ...existing, isEnterprise: p.isEnterprise }
                : {
                    id: p.id || 'default',
                    name: p.name || p.platformName || 'OpenAEV',
                    url: p.url || '',
                    connected: false,
                    isEnterprise: p.isEnterprise,
                  };
            }),
          }));
        }
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Helper function to ensure content script is loaded before sending messages
  const ensureContentScriptAndSendMessage = async (tabId: number, message: { type: string; payload?: unknown }) => {
    try {
      // First try to send the message directly
      await chrome.tabs.sendMessage(tabId, message);
    } catch {
      // Content script not loaded - inject it first
      try {
        await chrome.runtime.sendMessage({
          type: 'INJECT_CONTENT_SCRIPT',
          payload: { tabId },
        });
        
        // Wait a bit for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Try sending the message again
        await chrome.tabs.sendMessage(tabId, message);
      } catch (error) {
        log.error('Failed to inject content script or send message:', error);
      }
    }
  };

  // Unified scan across ALL platforms (OpenCTI and OpenAEV)
  const handleUnifiedScan = async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Fire and forget - don't await, close popup immediately
      ensureContentScriptAndSendMessage(tab.id, { type: 'SCAN_ALL' });
    }
    window.close();
  };

  // Unified search across ALL platforms (OpenCTI and OpenAEV)
  const handleUnifiedSearch = async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Fire and forget - don't await, close popup immediately
      ensureContentScriptAndSendMessage(tab.id, { type: 'OPEN_UNIFIED_SEARCH_PANEL' });
    }
    window.close();
  };

  const handleCreateContainer = async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Fire and forget - don't await, close popup immediately
      ensureContentScriptAndSendMessage(tab.id, { type: 'CREATE_CONTAINER_FROM_PAGE' });
    }
    window.close();
  };

  const handleInvestigate = async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Fire and forget - don't await, close popup immediately
      ensureContentScriptAndSendMessage(tab.id, { type: 'CREATE_INVESTIGATION' });
    }
    window.close();
  };

  const handleClear = async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await ensureContentScriptAndSendMessage(tab.id, { type: 'CLEAR_HIGHLIGHTS' });
    }
  };

  const handleOpenSettings = () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.openOptionsPage) return;
    chrome.runtime.openOptionsPage();
  };

  // Helper to handle AI-powered actions with proper status checks
  const handleAIAction = async (action: () => Promise<void>) => {
    // If AI is configured, proceed with action
    if (aiConfigured) {
      await action();
      return;
    }
    
    // If not configured but has EE, redirect to AI config in settings
    if (hasEnterprise) {
      if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
        chrome.runtime.openOptionsPage();
        // The settings page will open on the default tab, but we can't specify the AI tab directly
        // User will see the AI section in the left menu
      }
      window.close();
      return;
    }
    
    // No EE - show trial dialog
    setShowEETrialDialog(true);
  };

  const handleGenerateScenario = async () => {
    // Scenario creation doesn't require AI - it scans for attack patterns and lets user select injects
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Trigger scenario creation scan and panel - fire and forget
      ensureContentScriptAndSendMessage(tab.id, { type: 'CREATE_SCENARIO_FROM_PAGE' });
    }
    window.close();
  };


  const handleAtomicTesting = async () => {
    // Atomic testing doesn't require AI - it just scans for attack patterns
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Trigger atomic testing scan and panel - fire and forget
      ensureContentScriptAndSendMessage(tab.id, { type: 'SCAN_ATOMIC_TESTING' });
    }
    window.close();
  };

  const handleOpenPlatform = (url: string) => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    chrome.tabs.create({ url });
    setPopoverAnchor(null);
  };

  const handleFooterClick = (event: React.MouseEvent<HTMLElement>) => {
    setPopoverAnchor(event.currentTarget);
  };

  const handleSetupTestAndSave = async (platformType: 'opencti' | 'openaev') => {
    if (!setupUrl.trim() || !setupToken.trim()) return;
    
    setSetupTesting(true);
    setSetupError(null);
    setSetupSuccess(false);
    
    try {
      // Normalize URL: remove trailing slashes
      const normalizedUrl = setupUrl.trim().replace(/\/+$/, '');
      
      // Test connection FIRST without saving (using temp test)
      const testResponse = await chrome.runtime.sendMessage({
        type: 'TEST_PLATFORM_CONNECTION_TEMP',
        payload: { 
          platformType,
          url: normalizedUrl,
          apiToken: setupToken.trim(),
        },
      });
      
      if (!testResponse?.success) {
        throw new Error(testResponse?.error || 'Connection test failed');
      }
      
      // Get platform title from response
      const remotePlatformName = platformType === 'opencti' 
        ? testResponse.data?.settings?.platform_title 
        : testResponse.data?.platform_name;
      
      // Get enterprise edition status from response - ensure it's a boolean
      const isEnterprise = Boolean(testResponse.data?.enterprise_edition);
      
      log.debug(`Setup test result for ${platformType}:`, {
        remotePlatformName,
        isEnterprise,
        rawEnterpriseEdition: testResponse.data?.enterprise_edition,
      });
      
      // Test passed! Now get current settings and save
      const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (!settingsResponse?.success) {
        throw new Error('Failed to get settings');
      }
      
      const currentSettings = settingsResponse.data;
      const platformId = `${platformType}-setup-${Date.now()}`;
      
      // Create platform with the final name - explicitly set isEnterprise as boolean
      const finalName = setupName.trim() || remotePlatformName || (platformType === 'opencti' ? 'OpenCTI' : 'OpenAEV');
      const newPlatform = {
        id: platformId,
        name: finalName,
        url: normalizedUrl,
        apiToken: setupToken.trim(),
        enabled: true,
        isEnterprise: isEnterprise, // Explicitly include the boolean value
      };
      
      log.debug(`Creating new ${platformType} platform:`, {
        id: newPlatform.id,
        name: newPlatform.name,
        isEnterprise: newPlatform.isEnterprise,
      });
      
      // Add the new platform
      const updatedSettings = {
        ...currentSettings,
        [`${platformType}Platforms`]: [
          ...(currentSettings[`${platformType}Platforms`] || []),
          newPlatform,
        ],
      };
      
      // Save settings
      const saveResponse = await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: updatedSettings,
      });
      
      if (!saveResponse?.success) {
        throw new Error(saveResponse?.error || 'Failed to save settings');
      }
      
      log.debug(`Settings saved successfully for ${platformType}, isEnterprise: ${isEnterprise}`);
      
      setSetupSuccess(true);
      
      // Inject content scripts into all open tabs so scanning works without reload
      try {
        await chrome.runtime.sendMessage({ type: 'INJECT_ALL_TABS' });
      } catch (error) {
        log.debug('Note: Could not inject content scripts into existing tabs:', error);
      }
      
      // Move to next step after a short delay
      setTimeout(async () => {
        setSetupUrl('');
        setSetupToken('');
        setSetupName('');
        setSetupSuccess(false);
        setSetupTesting(false);
        
        if (platformType === 'opencti') {
          setSetupStep('openaev');
        } else {
          // Refresh status and close the popup to complete setup
          setSetupStep('complete');
          
          // Wait for cache to start building, then reload status
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Reload status by fetching connection status again
          try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_CONNECTION_STATUS' });
            if (response?.success && response.data) {
              setStatus(response.data);
            }
          } catch {
            // If status fetch fails, reload the popup
            window.location.reload();
          }
        }
      }, 1000);
      
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Connection failed');
      setSetupTesting(false);
    }
  };

  const handleSetupSkip = (currentStep: 'opencti' | 'openaev') => {
    setSetupUrl('');
    setSetupToken('');
    setSetupName('');
    setSetupError(null);
    setSetupSuccess(false);
    
    if (currentStep === 'opencti') {
      setSetupStep('openaev');
    } else {
      // After OAEV, reload to show main screen if anything was configured
      // The status will be refreshed from storage
      window.location.reload();
    }
  };

  const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ width: 480, minHeight: 340, display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <img
              src={`../assets/logos/logo_filigran_${logoSuffix}_embleme_square.svg`}
              alt="Filigran"
              width={32}
              height={32}
            />
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 18, color: mode === 'dark' ? '#ffffff' : 'text.primary' }}>
                  Filigran Threat Management
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 500, fontSize: 9, color: '#ff9800' }}>
                  (beta)
                </Typography>
              </Box>
            </Box>
          </Box>
          <Tooltip title="Settings" arrow>
            <IconButton size="small" onClick={handleOpenSettings} sx={{ color: 'primary.main' }}>
              <SettingsOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Divider />

        {/* Welcome Splash when nothing is configured */}
        {!hasAnyPlatformConfigured && setupStep === 'welcome' && (
          <Box sx={{ p: 3, textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Box sx={{ mb: 2 }}>
              <img
                src={`../assets/logos/logo_filigran_${logoSuffix}_full-with-text_rectangle.svg`}
                alt="Filigran"
                width={150}
                style={{ opacity: 0.9 }}
              />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Welcome to XTM
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, lineHeight: 1.6 }}>
              Connect to your platforms to start scanning pages for threats.
            </Typography>
            <Button
              variant="contained"
              endIcon={<ChevronRightOutlined />}
              onClick={() => setSetupStep('opencti')}
              sx={{ borderRadius: 1, mb: 1.5 }}
              fullWidth
            >
              Get Started
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={handleOpenSettings}
              sx={{ color: 'text.secondary' }}
            >
              Advanced Settings
            </Button>
          </Box>
        )}
        
        {/* OpenCTI Setup Step */}
        {!hasAnyPlatformConfigured && setupStep === 'opencti' && (
          <Box sx={{ p: 2.5, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <img
                src={`../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`}
                alt="OpenCTI"
                width={28}
                height={28}
              />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Connect OpenCTI
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Threat Intelligence Platform
                </Typography>
              </Box>
            </Box>
            
            <TextField
              label="Platform URL"
              placeholder="https://your-opencti.domain.com"
              value={setupUrl}
              onChange={(e) => setSetupUrl(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
            />
            
            <TextField
              label="API Token"
              placeholder="Enter your API token"
              type={showSetupToken ? 'text' : 'password'}
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowSetupToken(!showSetupToken)}
                      edge="end"
                    >
                      {showSetupToken ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            
            {setupError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>
                {setupError}
              </Alert>
            )}
            
            {setupSuccess && (
              <Alert severity="success" sx={{ mb: 2, borderRadius: 1 }}>
                Connected successfully!
              </Alert>
            )}
            
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="contained"
                onClick={() => handleSetupTestAndSave('opencti')}
                disabled={!setupUrl.trim() || !setupToken.trim() || setupTesting}
                startIcon={setupTesting ? <CircularProgress size={16} /> : undefined}
                sx={{ flex: 1, borderRadius: 1 }}
              >
                {setupTesting ? 'Testing...' : 'Connect'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleSetupSkip('opencti')}
                startIcon={<SkipNextOutlined />}
                sx={{ borderRadius: 1 }}
              >
                Skip
              </Button>
            </Box>
          </Box>
        )}
        
        {/* OpenAEV Setup Step */}
        {!hasAnyPlatformConfigured && setupStep === 'openaev' && (
          <Box sx={{ p: 2.5, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <img
                src={`../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`}
                alt="OpenAEV"
                width={28}
                height={28}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `../assets/logos/logo_filigran_${logoSuffix}_embleme_square.svg`;
                }}
              />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Connect OpenAEV
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Attack & Exposure Validation
                </Typography>
              </Box>
            </Box>
            
            <TextField
              label="Platform URL"
              placeholder="https://your-openaev.domain.com"
              value={setupUrl}
              onChange={(e) => setSetupUrl(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
            />
            
            <TextField
              label="API Token"
              placeholder="Enter your API token"
              type={showSetupToken ? 'text' : 'password'}
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowSetupToken(!showSetupToken)}
                      edge="end"
                    >
                      {showSetupToken ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            
            {setupError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 1 }}>
                {setupError}
              </Alert>
            )}
            
            {setupSuccess && (
              <Alert severity="success" sx={{ mb: 2, borderRadius: 1 }}>
                Connected successfully!
              </Alert>
            )}
            
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="contained"
                onClick={() => handleSetupTestAndSave('openaev')}
                disabled={!setupUrl.trim() || !setupToken.trim() || setupTesting}
                startIcon={setupTesting ? <CircularProgress size={16} /> : undefined}
                sx={{ flex: 1, borderRadius: 1 }}
              >
                {setupTesting ? 'Testing...' : 'Connect'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleSetupSkip('openaev')}
                startIcon={<SkipNextOutlined />}
                sx={{ borderRadius: 1 }}
              >
                Skip
              </Button>
            </Box>
          </Box>
        )}

        {/* Main Actions Section */}
        {hasAnyPlatformConfigured && (
        <>
        {/* Global Actions - Scan & Search across all platforms */}
        <Box sx={{ p: 2, pb: 1 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1,
            }}
          >
            <ActionButton
              icon={<CenterFocusStrongOutlined />}
              label="Scan"
              subtitle="Find entities across all platforms"
              tooltip="Scan page for entities in OpenCTI and OpenAEV"
              onClick={handleUnifiedScan}
              color="#00bcd4"
              compact
            />
            <ActionButton
              icon={<SearchOutlined />}
              label="Search"
              subtitle="Query all platforms"
              tooltip="Search across OpenCTI and OpenAEV"
              onClick={handleUnifiedSearch}
              color="#9c27b0"
              disabled={!hasOpenCTI && !hasOpenAEV}
              compact
            />
          </Box>
        </Box>

        <Divider sx={{ mx: 2 }} />

        {/* OpenCTI Section */}
        <Box sx={{ p: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <img
              src={`../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`}
              alt="OpenCTI"
              width={18}
              height={18}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 13 }}>
              OpenCTI
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10 }}>
              Threat Intelligence
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1,
            }}
          >
            <ActionButton
              icon={<DescriptionOutlined />}
              label="Container"
              subtitle="Create report"
              tooltip="Create container from page content"
              onClick={handleCreateContainer}
              color="#4caf50"
              disabled={!hasOpenCTI}
              compact
            />
            <ActionButton
              icon={<TravelExploreOutlined />}
              label="Investigate"
              subtitle="Start workbench"
              tooltip="Start investigation with entities"
              onClick={handleInvestigate}
              color="#ff9800"
              disabled={!hasOpenCTI}
              compact
            />
          </Box>
        </Box>

        <Divider sx={{ mx: 2 }} />

        {/* OpenAEV Section */}
        <Box sx={{ p: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <img
              src={`../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`}
              alt="OpenAEV"
              width={18}
              height={18}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: 13 }}>
              OpenAEV
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10 }}>
              Attack & Exposure Validation
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 1,
            }}
          >
            <ActionButton
              icon={<Target />}
              label="Atomic Test"
              subtitle="Trigger a test"
              tooltip="Create atomic testing from attack pattern or domain"
              onClick={handleAtomicTesting}
              color="#f44336"
              disabled={!hasOpenAEV}
              compact
            />
            <ActionButton
              icon={<MovieFilterOutlined />}
              label="Scenario"
              subtitle="Generate attack"
              tooltip="Generate attack scenario from page"
              onClick={handleGenerateScenario}
              color="#e91e63"
              disabled={!hasOpenAEV}
              compact
            />
          </Box>
        </Box>

        <Divider sx={{ mx: 2 }} />

        {/* Clear Button - Thin, light color */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleClear}
            sx={{ 
              height: 32,
              borderRadius: 1,
              borderColor: 'divider',
              color: 'text.secondary',
              fontSize: 12,
              '&:hover': {
                borderColor: 'text.secondary',
                bgcolor: 'action.hover',
              },
            }}
          >
            Clear highlights
          </Button>
        </Box>
        </>
        )}

        {/* Footer - Clickable with platform info, pushed to bottom */}
        <Box sx={{ mt: 'auto' }}>
          <Divider />
          <Box 
            onClick={handleFooterClick}
            sx={{ 
              p: 1.5, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            {/* Connection Status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* OpenCTI Status */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: hasOpenCTI ? '#4caf50' : hasAnyOpenCTIConfigured ? '#f44336' : '#9e9e9e',
                    animation: hasOpenCTI ? `${pulse} 2s infinite` : undefined,
                  }}
                />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: hasOpenCTI ? '#4caf50' : hasAnyOpenCTIConfigured ? '#f44336' : '#9e9e9e', 
                    fontSize: 10, 
                    fontWeight: 500 
                  }}
                >
                  {hasOpenCTI 
                    ? `OCTI (${status.opencti.filter(p => p.connected).length})`
                    : hasAnyOpenCTIConfigured ? 'OCTI offline' : 'OCTI'
                  }
                </Typography>
              </Box>
              {/* OpenAEV Status */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: hasOpenAEV ? '#4caf50' : hasAnyOpenAEVConfigured ? '#f44336' : '#9e9e9e',
                    animation: hasOpenAEV ? `${pulse} 2s infinite` : undefined,
                  }}
                />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: hasOpenAEV ? '#4caf50' : hasAnyOpenAEVConfigured ? '#f44336' : '#9e9e9e', 
                    fontSize: 10,
                    fontWeight: 500,
                  }}
                >
                  {hasOpenAEV 
                    ? `OAEV (${status.openaev.filter(p => p.connected).length})`
                    : hasAnyOpenAEVConfigured ? 'OAEV offline' : 'OAEV'
                  }
                </Typography>
              </Box>
            </Box>
            {/* Version */}
            <Typography variant="caption" sx={{ color: 'text.secondary', opacity: 0.7, fontSize: 10 }}>
              v1.0.0 • Click for details
            </Typography>
          </Box>
        </Box>

        {/* Platform Details Popover */}
        <Popover
          open={Boolean(popoverAnchor)}
          anchorEl={popoverAnchor}
          onClose={() => setPopoverAnchor(null)}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
        >
          <Box sx={{ p: 2, minWidth: 380 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              Connected Platforms
            </Typography>
            
            {/* OpenCTI Platforms */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <img
                  src={`../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`}
                  alt="OpenCTI"
                  width={18}
                  height={18}
                />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  OpenCTI
                </Typography>
                {hasAnyOpenCTIConfigured && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    ({status.opencti.filter(p => p.connected).length}/{status.opencti.length} connected)
                  </Typography>
                )}
              </Box>
              {status.opencti.length > 0 ? (
                status.opencti.map((platform) => (
                  <Paper
                    key={platform.id}
                    elevation={0}
                    onClick={() => platform.url && platform.connected && handleOpenPlatform(platform.url)}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      p: 1.5, 
                      mb: 1, 
                      borderRadius: 1,
                      border: 1,
                      borderColor: platform.connected ? 'success.main' : 'divider',
                      opacity: platform.connected ? 1 : 0.6,
                      cursor: platform.connected ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                      '&:hover': platform.connected ? { borderColor: 'primary.main', bgcolor: 'action.hover' } : {},
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {platform.name || 'OpenCTI'}
                        </Typography>
                        {platform.connected && (
                          <Box
                            sx={{
                              px: 0.5,
                              py: 0.1,
                              borderRadius: 0.5,
                              fontSize: '9px',
                              fontWeight: 700,
                              lineHeight: 1.3,
                              bgcolor: platform.isEnterprise 
                                ? (mode === 'dark' ? '#00f1bd' : '#0c7e69') 
                                : '#616161',
                              color: platform.isEnterprise ? '#000' : '#fff',
                            }}
                          >
                            {platform.isEnterprise ? 'EE' : 'CE'}
                          </Box>
                        )}
                      </Box>
                      {platform.connected ? (
                        <>
                          <Typography variant="caption" sx={{ color: '#4caf50', display: 'block' }}>
                            Connected {platform.version ? `• v${platform.version}` : ''}
                          </Typography>
                          {platform.userName && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                              {platform.userName}
                            </Typography>
                          )}
                        </>
                      ) : (
                        <Typography variant="caption" sx={{ color: '#f44336' }}>
                          Not connected
                        </Typography>
                      )}
                    </Box>
                    {platform.connected && <OpenInNewOutlined fontSize="small" sx={{ color: 'text.secondary', ml: 1 }} />}
                  </Paper>
                ))
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 0.5 }}>
                  No platforms configured
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 1.5 }} />

            {/* OpenAEV Platforms */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <img
                  src={`../assets/logos/logo_openaev_${logoSuffix}_embleme_square.svg`}
                  alt="OpenAEV"
                  width={18}
                  height={18}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `../assets/logos/logo_filigran_${logoSuffix}_embleme_square.svg`;
                  }}
                />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  OpenAEV
                </Typography>
                {hasAnyOpenAEVConfigured && (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    ({status.openaev.filter(p => p.connected).length}/{status.openaev.length} connected)
                  </Typography>
                )}
              </Box>
              {status.openaev.length > 0 ? (
                status.openaev.map((platform) => (
                  <Paper
                    key={platform.id}
                    elevation={0}
                    onClick={() => platform.url && platform.connected && handleOpenPlatform(platform.url)}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      p: 1.5, 
                      mb: 1, 
                      borderRadius: 1,
                      border: 1,
                      borderColor: platform.connected ? 'success.main' : 'divider',
                      opacity: platform.connected ? 1 : 0.6,
                      cursor: platform.connected ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                      '&:hover': platform.connected ? { borderColor: 'primary.main', bgcolor: 'action.hover' } : {},
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {platform.name || 'OpenAEV'}
                        </Typography>
                        {platform.connected && (
                          <Box
                            sx={{
                              px: 0.5,
                              py: 0.1,
                              borderRadius: 0.5,
                              fontSize: '9px',
                              fontWeight: 700,
                              lineHeight: 1.3,
                              bgcolor: platform.isEnterprise 
                                ? (mode === 'dark' ? '#00f1bd' : '#0c7e69') 
                                : '#616161',
                              color: platform.isEnterprise ? '#000' : '#fff',
                            }}
                          >
                            {platform.isEnterprise ? 'EE' : 'CE'}
                          </Box>
                        )}
                      </Box>
                      {platform.connected ? (
                        <>
                          <Typography variant="caption" sx={{ color: '#4caf50', display: 'block' }}>
                            Connected {platform.version ? `• v${platform.version}` : ''}
                          </Typography>
                          {platform.userName && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                              {platform.userName}
                            </Typography>
                          )}
                        </>
                      ) : (
                        <Typography variant="caption" sx={{ color: '#f44336' }}>
                          Not connected
                        </Typography>
                      )}
                    </Box>
                    {platform.connected && <OpenInNewOutlined fontSize="small" sx={{ color: 'text.secondary', ml: 1 }} />}
                  </Paper>
                ))
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 0.5 }}>
                  No platforms configured
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 1.5 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                XTM Browser Extension v0.0.1 (beta)
              </Typography>
              <Typography
                component="a"
                href="https://filigran.io"
                target="_blank"
                variant="caption"
                sx={{ 
                  color: 'primary.main', 
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                filigran.io
              </Typography>
            </Box>
          </Box>
        </Popover>

        {/* Enterprise Edition Trial Dialog */}
        <Dialog
          open={showEETrialDialog}
          onClose={() => setShowEETrialDialog(false)}
          PaperProps={{
            sx: {
              borderRadius: 2,
              minWidth: 380,
              background: mode === 'dark' 
                ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' 
                : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
            }
          }}
        >
          <DialogTitle sx={{ 
            textAlign: 'center', 
            pt: 4,
            pb: 1,
          }}>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: 2 
            }}>
              <Box sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00bcd4, #0097a7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(0, 188, 212, 0.3)',
              }}>
                <AutoAwesomeOutlined sx={{ fontSize: 32, color: '#fff' }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Unlock AI Features
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ textAlign: 'center', px: 4, pb: 2 }}>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2 }}>
              AI-powered features like scenario generation and on-the-fly atomic testing require an{' '}
              <strong>Enterprise Edition</strong> license.
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Start your free 30-day trial to experience the full power of Filigran's XTM platform with AI capabilities.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ 
            flexDirection: 'column', 
            gap: 1.5, 
            px: 4, 
            pb: 4,
            pt: 1,
          }}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<RocketLaunchOutlined />}
              onClick={() => {
                window.open('https://filigran.io/enterprise-editions-trial/', '_blank');
                setShowEETrialDialog(false);
              }}
              sx={{
                background: 'linear-gradient(135deg, #00bcd4, #0097a7)',
                py: 1.5,
                fontWeight: 600,
                '&:hover': {
                  background: 'linear-gradient(135deg, #0097a7, #00838f)',
                },
              }}
            >
              Start Free Trial
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={() => setShowEETrialDialog(false)}
              sx={{ color: 'text.secondary' }}
            >
              Maybe later
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
};

export default App;
