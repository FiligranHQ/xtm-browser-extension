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
} from '@mui/icons-material';
import { Target } from 'mdi-material-ui';
import ThemeDark from '../shared/theme/ThemeDark';
import ThemeLight from '../shared/theme/ThemeLight';
import { loggers } from '../shared/utils/logger';

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
}

interface ConnectionStatus {
  opencti: PlatformStatus[];
  openaev: PlatformStatus[];
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  tooltip: string;
  onClick: () => void;
  color: string;
  disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, subtitle, tooltip, onClick, color, disabled }) => (
  <Tooltip title={tooltip} arrow>
    <Paper
      onClick={disabled ? undefined : onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        p: 1.5,
        width: '100%',
        height: 90,
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
      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12, lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 9, textAlign: 'center', lineHeight: 1.2 }}>
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

  const theme = useMemo(() => {
    const themeOptions = mode === 'dark' ? ThemeDark() : ThemeLight();
    return createTheme(themeOptions);
  }, [mode]);

  const hasOpenCTI = status.opencti.some(p => p.connected);
  const hasOpenAEV = status.openaev.some(p => p.connected);
  const hasAnyOpenCTIConfigured = status.opencti.length > 0;
  const hasAnyOpenAEVConfigured = status.openaev.length > 0;
  const hasAnyPlatformConfigured = hasAnyOpenCTIConfigured || hasAnyOpenAEVConfigured;

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

        // Build initial platform lists
        const openctiList: PlatformStatus[] = openctiPlatforms.map((p: any) => ({
          id: p.id || 'default',
          name: p.name || p.platformName || 'OpenCTI',
          url: p.url || '',
          connected: false,
          version: undefined,
          userName: undefined,
        }));
        
        const openaevList: PlatformStatus[] = openaevPlatforms.map((p: any) => ({
          id: p.id || 'default',
          name: p.name || p.platformName || 'OpenAEV',
          url: p.url || '',
          connected: false,
          userName: undefined,
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
        console.error('Failed to inject content script or send message:', error);
      }
    }
  };

  const handleScanPage = async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Fire and forget - don't await, close popup immediately
      ensureContentScriptAndSendMessage(tab.id, { type: 'SCAN_PAGE' });
    }
    window.close();
  };

  const handleSearch = async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Fire and forget - don't await, close popup immediately
      ensureContentScriptAndSendMessage(tab.id, { type: 'OPEN_SEARCH_PANEL' });
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

  const handleGenerateScenario = async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Fire and forget - don't await, close popup immediately
      ensureContentScriptAndSendMessage(tab.id, { type: 'GENERATE_SCENARIO' });
    }
    window.close();
  };

  const handleSearchAssets = async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Use SCAN_OAEV for OpenAEV-only scanning - fire and forget
      ensureContentScriptAndSendMessage(tab.id, { type: 'SCAN_OAEV' });
    }
    window.close();
  };

  const handleSearchOAEV = async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      // Fire and forget - don't await, close popup immediately
      ensureContentScriptAndSendMessage(tab.id, { type: 'OPEN_OAEV_SEARCH_PANEL' });
    }
    window.close();
  };

  const handleAtomicTesting = async () => {
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
      // Get current settings
      const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (!settingsResponse?.success) {
        throw new Error('Failed to get settings');
      }
      
      const currentSettings = settingsResponse.data;
      const platformId = `${platformType}-setup-${Date.now()}`;
      
      // Create platform with temporary name first
      // Normalize URL: remove trailing slashes
      const normalizedUrl = setupUrl.trim().replace(/\/+$/, '');
      const newPlatform = {
        id: platformId,
        name: setupName.trim() || (platformType === 'opencti' ? 'OpenCTI' : 'OpenAEV'),
        url: normalizedUrl,
        apiToken: setupToken.trim(),
        enabled: true,
      };
      
      // Add the new platform
      const updatedSettings = {
        ...currentSettings,
        [`${platformType}Platforms`]: [
          ...(currentSettings[`${platformType}Platforms`] || []),
          newPlatform,
        ],
      };
      
      // Save settings
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: updatedSettings,
      });
      
      // Test connection
      const testResponse = await chrome.runtime.sendMessage({
        type: 'TEST_PLATFORM_CONNECTION',
        payload: { platformId, platformType },
      });
      
      if (!testResponse?.success) {
        throw new Error(testResponse?.error || 'Connection test failed');
      }
      
      // Get platform title from response and update the name if not manually set
      const remotePlatformName = platformType === 'opencti' 
        ? testResponse.data?.settings?.platform_title 
        : testResponse.data?.platform_name;
      
      if (remotePlatformName && !setupName.trim()) {
        // Update platform with remote name
        const finalPlatforms = updatedSettings[`${platformType}Platforms`].map((p: any) =>
          p.id === platformId ? { ...p, name: remotePlatformName } : p
        );
        
        await chrome.runtime.sendMessage({
          type: 'SAVE_SETTINGS',
          payload: { ...updatedSettings, [`${platformType}Platforms`]: finalPlatforms },
        });
      }
      
      setSetupSuccess(true);
      
      // Inject content scripts into all open tabs so scanning works without reload
      try {
        await chrome.runtime.sendMessage({ type: 'INJECT_ALL_TABS' });
      } catch (error) {
        console.log('Note: Could not inject content scripts into existing tabs:', error);
      }
      
      // Move to next step after a short delay
      setTimeout(async () => {
        setSetupUrl('');
        setSetupToken('');
        setSetupName('');
        setSetupSuccess(false);
        
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
    } finally {
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
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 18, color: mode === 'dark' ? '#ffffff' : 'text.primary' }}>
              Filigran Threat Management
            </Typography>
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

        {/* OpenCTI Section */}
        {hasAnyPlatformConfigured && (
        <>
        <Box sx={{ p: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <img
              src={`../assets/logos/logo_opencti_${logoSuffix}_embleme_square.svg`}
              alt="OpenCTI"
              width={20}
              height={20}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              OpenCTI
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Threat Intelligence Platform
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
            }}
          >
            <ActionButton
              icon={<CenterFocusStrongOutlined />}
              label="Scan"
              subtitle="Find entities"
              tooltip="Scan page for entities and observables"
              onClick={handleScanPage}
              color="#00bcd4"
            />
            <ActionButton
              icon={<SearchOutlined />}
              label="Search"
              subtitle="Query platform"
              tooltip="Search in OpenCTI"
              onClick={handleSearch}
              color="#9c27b0"
              disabled={!hasOpenCTI}
            />
            <ActionButton
              icon={<DescriptionOutlined />}
              label="Container"
              subtitle="Create report"
              tooltip="Create container from page content"
              onClick={handleCreateContainer}
              color="#4caf50"
              disabled={!hasOpenCTI}
            />
            <ActionButton
              icon={<TravelExploreOutlined />}
              label="Investigate"
              subtitle="Start workbench"
              tooltip="Start investigation with entities"
              onClick={handleInvestigate}
              color="#ff9800"
              disabled={!hasOpenCTI}
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
              width={20}
              height={20}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              OpenAEV
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Attack & Exposure Validation
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
            }}
          >
            <ActionButton
              icon={<CenterFocusStrongOutlined />}
              label="Scan"
              subtitle="Find entities"
              tooltip="Scan page for assets and findings"
              onClick={handleSearchAssets}
              color="#00bcd4"
              disabled={!hasOpenAEV}
            />
            <ActionButton
              icon={<SearchOutlined />}
              label="Search"
              subtitle="Query platform"
              tooltip="Search in OpenAEV"
              onClick={handleSearchOAEV}
              color="#9c27b0"
              disabled={!hasOpenAEV}
            />
            <ActionButton
              icon={<Target />}
              label="Atomic Test"
              subtitle="Trigger a test"
              tooltip="Create atomic testing from attack pattern or domain"
              onClick={handleAtomicTesting}
              color="#f44336"
              disabled={!hasOpenAEV}
            />
            <ActionButton
              icon={<MovieFilterOutlined />}
              label="Scenario"
              subtitle="Generate attack"
              tooltip="Generate attack scenario from page"
              onClick={handleGenerateScenario}
              color="#e91e63"
              disabled={!hasOpenAEV}
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
              height: 36,
              borderRadius: 1,
              borderColor: 'divider',
              color: 'text.secondary',
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
                XTM Browser Extension v1.0.0
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
      </Box>
    </ThemeProvider>
  );
};

export default App;
