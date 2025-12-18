/**
 * Options Page Main Component
 * Orchestrates the settings UI for the browser extension
 */
import React, { useEffect, useState, useMemo } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Typography,
  Snackbar,
  Alert,
} from '@mui/material';
import ThemeDark from '../shared/theme/ThemeDark';
import ThemeLight from '../shared/theme/ThemeLight';
import type { ExtensionSettings, PlatformConfig } from '../shared/types/settings';
import { loggers } from '../shared/utils/logger';

const log = loggers.options;

// Import constants
import {
  DEFAULT_DETECTION,
  type TabType,
  type CacheStats,
  type PlatformCacheStats,
  type TestResult,
  type SnackbarState,
  type AITestResult,
  type AvailableModel,
} from './constants';

// Import components
import Sidebar from './components/Sidebar';
import OpenCTITab from './components/OpenCTITab';
import OpenAEVTab from './components/OpenAEVTab';
import DetectionTab from './components/DetectionTab';
import AITab from './components/AITab';
import AppearanceTab from './components/AppearanceTab';
import AboutTab from './components/AboutTab';

const App: React.FC = () => {
  // Theme and navigation state
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<TabType>('opencti');
  
  // Settings state
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<ExtensionSettings | null>(null);
  
  // Platform configuration state
  const [showTokens, setShowTokens] = useState<{ [key: string]: boolean }>({});
  const [testing, setTesting] = useState<{ [key: string]: boolean }>({});
  const [testResults, setTestResults] = useState<{ [key: string]: TestResult }>({});
  const [testedPlatforms, setTestedPlatforms] = useState<Set<string>>(new Set());
  
  // Cache state
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  
  // AI state
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<AITestResult | null>(null);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Create theme based on mode
  const theme = useMemo(() => {
    const themeOptions = mode === 'dark' ? ThemeDark() : ThemeLight();
    return createTheme(themeOptions);
  }, [mode]);

  // Load settings on mount
  useEffect(() => {
    // Check if we're running in an extension context
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      // Outside extension context - use default dark theme
      setMode('dark');
      setSettings({
        openctiPlatforms: [{ id: '1', name: 'OpenCTI', url: '', apiToken: '', enabled: true }],
        openaevPlatforms: [],
        theme: 'dark',
        autoScan: false,
        showNotifications: true,
        detection: DEFAULT_DETECTION,
      });
      return;
    }

    loadSettings();
    loadCacheStats();
    
    // Listen for storage changes to keep settings in sync
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.settings) {
        const newSettings = changes.settings.newValue;
        if (newSettings) {
          loadSettings();
        }
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Reload cache stats when switching to detection tab
  useEffect(() => {
    if (activeTab === 'detection') {
      loadCacheStats();
    }
  }, [activeTab]);

  // ============================================================================
  // Data Loading Functions
  // ============================================================================

  const loadSettings = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    if (chrome.runtime.lastError) return;
    if (response?.success && response.data) {
      const loadedSettings = response.data;
      
      // Ensure required fields have defaults
      if (!loadedSettings.openctiPlatforms) {
        loadedSettings.openctiPlatforms = [];
      }
      if (!loadedSettings.openaevPlatforms) {
        loadedSettings.openaevPlatforms = [];
      }
      if (!loadedSettings.theme) {
        loadedSettings.theme = 'dark';
      }
      if (!loadedSettings.detection) {
        loadedSettings.detection = DEFAULT_DETECTION;
      }
      // Ensure disabled arrays exist (empty = all enabled)
      if (!loadedSettings.detection.disabledObservableTypes) {
        loadedSettings.detection.disabledObservableTypes = [];
      }
      if (!loadedSettings.detection.disabledOpenCTITypes) {
        loadedSettings.detection.disabledOpenCTITypes = [];
      }
      if (!loadedSettings.detection.disabledOpenAEVTypes) {
        loadedSettings.detection.disabledOpenAEVTypes = [];
      }
      setSettings(loadedSettings);
      setSavedSettings(JSON.parse(JSON.stringify(loadedSettings)));
      
      // Mark existing platforms as tested
      const existingTested = new Set<string>();
      loadedSettings.openctiPlatforms?.forEach((p: PlatformConfig) => {
        if (p.url && p.apiToken) existingTested.add(`opencti-${p.id}`);
      });
      loadedSettings.openaevPlatforms?.forEach((p: PlatformConfig) => {
        if (p.url && p.apiToken) existingTested.add(`openaev-${p.id}`);
      });
      setTestedPlatforms(existingTested);
      
      const themeMode = loadedSettings.theme;
      setMode(themeMode === 'light' ? 'light' : 'dark');
    }
  };

  const loadCacheStats = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    const response = await chrome.runtime.sendMessage({ type: 'GET_CACHE_STATS' });
    if (chrome.runtime.lastError) return;
    if (response?.success && response.data) {
      setCacheStats({
        total: response.data.total,
        age: Math.round(response.data.age / 60000),
        byPlatform: response.data.byPlatform?.map((p: PlatformCacheStats) => ({
          ...p,
          age: Math.round(p.age / 60000),
          byType: p.byType || {},
        })),
        oaevByPlatform: response.data.oaevByPlatform?.map((p: PlatformCacheStats) => ({
          ...p,
          age: Math.round(p.age / 60000),
          byType: p.byType || {},
        })),
        oaevTotal: response.data.oaevTotal || 0,
        isRefreshing: response.data.isRefreshing,
      });
      setIsRefreshingCache(response.data.isRefreshing || false);
    }
  };

  // ============================================================================
  // Platform Handler Functions
  // ============================================================================

  const handleTestConnection = async (type: 'opencti' | 'openaev', platformId: string) => {
    if (!settings) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    const key = `${type}-${platformId}`;
    setTesting({ ...testing, [key]: true });
    setTestResults({ ...testResults, [key]: undefined as any });

    const platforms = type === 'opencti' ? settings.openctiPlatforms : settings.openaevPlatforms;
    const platform = platforms?.find(p => p.id === platformId);
    
    if (!platform?.url || !platform?.apiToken) {
      setTesting({ ...testing, [key]: false });
      setTestResults({
        ...testResults,
        [key]: { type: 'error', message: 'URL and API Token are required' },
      });
      return;
    }

    const response = await chrome.runtime.sendMessage({ 
      type: 'TEST_PLATFORM_CONNECTION',
      payload: { 
        platformType: type,
        temporary: true,
        url: platform.url,
        apiToken: platform.apiToken,
      },
    });
    
    if (chrome.runtime.lastError) {
      setTesting({ ...testing, [key]: false });
      return;
    }
    
    if (response?.success) {
      const remotePlatformName = type === 'opencti' 
        ? response.data?.settings?.platform_title 
        : response.data?.platform_name;
      
      const platformIndex = platforms?.findIndex(p => p.id === platformId) ?? -1;
      const currentPlatform = platforms?.[platformIndex];
      
      const isDefaultName = currentPlatform?.name === 'New OpenCTI' || 
                           currentPlatform?.name === 'New OpenAEV' ||
                           !currentPlatform?.name;
      
      const isEnterprise = response.data?.enterprise_edition ?? false;
      
      const settingsKey = `${type}Platforms` as const;
      const updatedPlatforms = [...(settings[settingsKey] || [])];
      if (platformIndex >= 0 && currentPlatform) {
        const updatedPlatform: PlatformConfig = { 
          ...currentPlatform,
          isEnterprise,
          name: (remotePlatformName && isDefaultName) ? remotePlatformName : currentPlatform.name,
        };
        updatedPlatforms[platformIndex] = updatedPlatform;
      }
      const updatedSettings = { ...settings, [settingsKey]: updatedPlatforms };
      
      setSettings(updatedSettings);
      
      setTestResults({
        ...testResults,
        [key]: {
          type: 'success',
          message: type === 'opencti' 
            ? `Connected to ${remotePlatformName || 'OpenCTI'} v${response.data?.version}`
            : `Connected to ${remotePlatformName || 'OpenAEV'}`,
        },
      });
      setTestedPlatforms(prev => new Set(prev).add(key));
      
      // Auto-save after successful test
      try {
        const normalizedSettings = {
          ...updatedSettings,
          openctiPlatforms: updatedSettings.openctiPlatforms.map(p => ({
            ...p,
            url: p.url.replace(/\/+$/, ''),
          })),
          openaevPlatforms: updatedSettings.openaevPlatforms.map(p => ({
            ...p,
            url: p.url.replace(/\/+$/, ''),
          })),
        };
        
        const saveResponse = await chrome.runtime.sendMessage({
          type: 'SAVE_SETTINGS',
          payload: normalizedSettings,
        });
        
        if (saveResponse?.success) {
          setSavedSettings(JSON.parse(JSON.stringify(normalizedSettings)));
          setSettings(normalizedSettings);
          setSnackbar({ open: true, message: 'Platform connected and saved', severity: 'success' });
        }
      } catch (error) {
        log.error('Auto-save after test failed:', error);
      }
    } else {
      setTestResults({
        ...testResults,
        [key]: {
          type: 'error',
          message: response?.error || 'Connection failed',
        },
      });
    }
    setTesting({ ...testing, [key]: false });
  };

  const addPlatform = (type: 'opencti' | 'openaev') => {
    if (!settings) return;
    const id = Date.now().toString();
    const newPlatform: PlatformConfig = {
      id,
      name: type === 'opencti' ? 'New OpenCTI' : 'New OpenAEV',
      url: '',
      apiToken: '',
      enabled: true,
    };
    if (type === 'opencti') {
      updateSetting('openctiPlatforms', [...settings.openctiPlatforms, newPlatform]);
    } else {
      updateSetting('openaevPlatforms', [...settings.openaevPlatforms, newPlatform]);
    }
  };

  const updatePlatform = (type: 'opencti' | 'openaev', index: number, updates: Partial<PlatformConfig>) => {
    if (!settings) return;
    const key = `${type}Platforms` as const;
    const platforms = [...settings[key]];
    platforms[index] = { ...platforms[index], ...updates };
    updateSetting(key, platforms);
    // Mark as needing test if URL or token changed
    if (updates.url !== undefined || updates.apiToken !== undefined) {
      const platformKey = `${type}-${platforms[index].id}`;
      setTestedPlatforms(prev => {
        const newSet = new Set(prev);
        newSet.delete(platformKey);
        return newSet;
      });
    }
  };

  const removePlatform = async (type: 'opencti' | 'openaev', index: number) => {
    if (!settings) return;
    if (!confirm('Are you sure you want to remove this platform?')) return;
    
    const key = `${type}Platforms` as const;
    const platforms = [...settings[key]];
    const removedPlatform = platforms[index];
    platforms.splice(index, 1);
    
    const updatedSettings = { ...settings, [key]: platforms };
    setSettings(updatedSettings);
    
    const platformKey = `${type}-${removedPlatform.id}`;
    setTestedPlatforms(prev => {
      const newSet = new Set(prev);
      newSet.delete(platformKey);
      return newSet;
    });
    setTestResults(prev => {
      const newResults = { ...prev };
      delete newResults[platformKey];
      return newResults;
    });
    
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'SAVE_SETTINGS',
          payload: updatedSettings,
        });
        
        if (response?.success) {
          setSavedSettings(JSON.parse(JSON.stringify(updatedSettings)));
          setSnackbar({ open: true, message: 'Platform removed', severity: 'success' });
        } else {
          setSnackbar({ open: true, message: response?.error || 'Failed to save', severity: 'error' });
        }
      } catch (error) {
        setSnackbar({ open: true, message: 'Failed to save settings', severity: 'error' });
      }
    }
  };

  // ============================================================================
  // Settings Handler Functions
  // ============================================================================

  const updateSetting = <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const handleSave = async () => {
    if (!settings) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setSnackbar({ open: true, message: 'Settings saved (preview mode)', severity: 'success' });
      return;
    }
    
    const normalizedSettings = {
      ...settings,
      openctiPlatforms: settings.openctiPlatforms.map(p => ({
        ...p,
        url: p.url.replace(/\/+$/, ''),
      })),
      openaevPlatforms: settings.openaevPlatforms.map(p => ({
        ...p,
        url: p.url.replace(/\/+$/, ''),
      })),
    };
    
    setSettings(normalizedSettings);
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: normalizedSettings,
      });
      
      if (response?.success) {
        setSavedSettings(JSON.parse(JSON.stringify(normalizedSettings)));
        setSettings(normalizedSettings);
        setSnackbar({ open: true, message: 'Settings saved successfully!', severity: 'success' });
        
        setIsRefreshingCache(true);
        const pollInterval = setInterval(async () => {
          const statusResponse = await chrome.runtime.sendMessage({ type: 'GET_CACHE_REFRESH_STATUS' });
          if (statusResponse?.success && !statusResponse.data?.isRefreshing) {
            clearInterval(pollInterval);
            setIsRefreshingCache(false);
            await loadCacheStats();
          }
        }, 1000);
        
        setTimeout(() => {
          clearInterval(pollInterval);
          setIsRefreshingCache(false);
          loadCacheStats();
        }, 120000);
      } else {
        setSnackbar({ open: true, message: response?.error || 'Failed to save settings', severity: 'error' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save settings', severity: 'error' });
    }
  };

  const setTheme = async (newTheme: 'auto' | 'dark' | 'light') => {
    if (!settings) return;
    
    const updatedSettings = { ...settings, theme: newTheme };
    setSettings(updatedSettings);
    setMode(newTheme === 'light' ? 'light' : 'dark');
    
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: updatedSettings,
      });
    }
  };

  // ============================================================================
  // Reset Handler Functions
  // ============================================================================

  const handleResetAllSettings = async () => {
    if (!confirm('Are you sure you want to reset ALL settings? This will remove all connections and preferences.')) {
      return;
    }
    
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;

    await chrome.runtime.sendMessage({ type: 'CLEAR_PLATFORM_CACHE', payload: { platformType: 'opencti' } });

    const defaultSettings: ExtensionSettings = {
      openctiPlatforms: [],
      openaevPlatforms: [],
      theme: 'auto',
      autoScan: false,
      showNotifications: true,
      detection: DEFAULT_DETECTION,
    };

    await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      payload: defaultSettings,
    });

    setSettings(defaultSettings);
    setTestResults({});
    setTestedPlatforms(new Set());
    setCacheStats(null);
  };

  const handleRemoveAllOpenCTI = async () => {
    if (!confirm('Remove all OpenCTI platforms? This action cannot be undone.')) return;
    if (!settings) return;
    
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_PLATFORM_CACHE', payload: { platformType: 'opencti' } });
    }
    
    const updatedSettings = {
      ...settings,
      openctiPlatforms: [],
    };
    
    setSettings(updatedSettings);
    
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: updatedSettings,
      });
      setSavedSettings(JSON.parse(JSON.stringify(updatedSettings)));
      setSnackbar({ open: true, message: 'All OpenCTI platforms removed', severity: 'success' });
    }
    
    setTestResults({});
    setTestedPlatforms(new Set());
    setCacheStats(null);
  };

  const handleRemoveAllOpenAEV = async () => {
    if (!confirm('Remove all OpenAEV platforms? This action cannot be undone.')) return;
    if (!settings) return;
    
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_PLATFORM_CACHE', payload: { platformType: 'openaev' } });
    }
    
    const updatedSettings = {
      ...settings,
      openaevPlatforms: [],
    };
    
    setSettings(updatedSettings);
    
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: updatedSettings,
      });
      setSavedSettings(JSON.parse(JSON.stringify(updatedSettings)));
      setSnackbar({ open: true, message: 'All OpenAEV platforms removed', severity: 'success' });
    }
    
    setTestResults({});
    setTestedPlatforms(new Set());
  };

  const handleResetDetection = () => {
    if (!settings) return;
    updateSetting('detection', DEFAULT_DETECTION);
  };

  const handleResetAppearance = () => {
    if (!settings) return;
    setTheme('auto');
    setSplitScreenMode(false);
  };

  const setSplitScreenMode = async (enabled: boolean) => {
    if (!settings) return;
    
    const updatedSettings = { ...settings, splitScreenMode: enabled };
    setSettings(updatedSettings);
    
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: updatedSettings,
      });
      setSavedSettings(JSON.parse(JSON.stringify(updatedSettings)));
    }
  };

  const handleClearAI = () => {
    if (!settings) return;
    if (!confirm('Are you sure you want to clear AI configuration? This will disable all AI features.')) {
      return;
    }
    setAiTestResult(null);
    setAvailableModels([]);
    updateSetting('ai', {
      provider: undefined,
      apiKey: undefined,
      model: undefined,
      availableModels: undefined,
      connectionTested: false,
    });
    setSnackbar({ open: true, message: 'AI configuration cleared', severity: 'success' });
  };

  // ============================================================================
  // Cache Handler Functions
  // ============================================================================

  const handleRefreshCache = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setIsRefreshingCache(true);
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'REFRESH_CACHE' });
      
      if (response?.success) {
        // Poll for cache refresh completion since the actual refresh is async
        const pollInterval = setInterval(async () => {
          const statusResponse = await chrome.runtime.sendMessage({ type: 'GET_CACHE_REFRESH_STATUS' });
          if (statusResponse?.success && !statusResponse.data?.isRefreshing) {
            clearInterval(pollInterval);
            setIsRefreshingCache(false);
            await loadCacheStats();
          } else {
            // Update cache stats while refreshing to show progress
            await loadCacheStats();
          }
        }, 1000);
        
        // Safety timeout to prevent infinite polling
        setTimeout(() => {
          clearInterval(pollInterval);
          setIsRefreshingCache(false);
          loadCacheStats();
        }, 120000); // 2 minute timeout
      } else {
        setIsRefreshingCache(false);
      }
    } catch (error) {
      log.error('Cache refresh error:', error);
      setIsRefreshingCache(false);
    }
  };

  // ============================================================================
  // AI Handler Functions
  // ============================================================================

  const handleTestAndFetchModels = async () => {
    if (!settings?.ai?.provider || !settings?.ai?.apiKey) return;
    
    setAiTesting(true);
    setAiTestResult(null);
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AI_TEST_AND_FETCH_MODELS',
        payload: {
          provider: settings.ai.provider,
          apiKey: settings.ai.apiKey,
        },
      });
      
      if (response?.success && response.data?.models) {
        setAvailableModels(response.data.models);
        setAiTestResult({ success: true, message: `Connected! ${response.data.models.length} models available.` });
        
        if (!settings.ai.model && response.data.models.length > 0) {
          updateSetting('ai', {
            ...settings.ai,
            model: response.data.models[0].id,
            availableModels: response.data.models,
            connectionTested: true,
          });
        } else {
          updateSetting('ai', {
            ...settings.ai,
            availableModels: response.data.models,
            connectionTested: true,
          });
        }
      } else {
        setAiTestResult({ success: false, message: response?.error || 'Connection failed' });
      }
    } catch (error) {
      setAiTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      });
    } finally {
      setAiTesting(false);
    }
  };

  // ============================================================================
  // Utility Functions
  // ============================================================================

  const hasPlatformChanges = (type: 'opencti' | 'openaev'): boolean => {
    if (!settings || !savedSettings) return false;
    const currentPlatforms = type === 'opencti' ? settings.openctiPlatforms : settings.openaevPlatforms;
    const savedPlatforms = type === 'opencti' ? savedSettings.openctiPlatforms : savedSettings.openaevPlatforms;
    
    if (currentPlatforms.length !== savedPlatforms.length) return true;
    
    for (let i = 0; i < currentPlatforms.length; i++) {
      const current = currentPlatforms[i];
      const saved = savedPlatforms[i];
      
      if (current.id !== saved.id ||
          current.name !== saved.name ||
          current.url !== saved.url ||
          current.apiToken !== saved.apiToken ||
          current.enabled !== saved.enabled ||
          current.isEnterprise !== saved.isEnterprise) {
        return true;
      }
    }
    
    return false;
  };

  const isPlatformSaveDisabled = (type: 'opencti' | 'openaev') => {
    if (!settings) return true;
    const platforms = type === 'opencti' ? settings.openctiPlatforms : settings.openaevPlatforms;
    
    for (const platform of platforms) {
      const key = `${type}-${platform.id}`;
      const hasUrl = platform.url && platform.url.trim().length > 0;
      const hasToken = platform.apiToken && platform.apiToken.trim().length > 0;
      
      if (!hasUrl && !hasToken) {
        return true;
      }
      
      if ((hasUrl && !hasToken) || (!hasUrl && hasToken)) {
        return true;
      }
      
      if (hasUrl && hasToken && !testedPlatforms.has(key)) {
        return true;
      }
    }
    
    if (!hasPlatformChanges(type)) {
      return true;
    }
    
    return false;
  };

  const handleToggleTokenVisibility = (key: string) => {
    setShowTokens({ ...showTokens, [key]: !showTokens[key] });
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (!settings) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          mode={mode}
          settings={settings}
        />

        {/* Main Content */}
        <Box sx={{ flex: 1, p: 4, maxWidth: 900, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* OpenCTI Tab */}
          {activeTab === 'opencti' && (
            <OpenCTITab
              settings={settings}
              showTokens={showTokens}
              testing={testing}
              testResults={testResults}
              testedPlatforms={testedPlatforms}
              onToggleTokenVisibility={handleToggleTokenVisibility}
              onUpdatePlatform={updatePlatform}
              onRemovePlatform={removePlatform}
              onTestConnection={handleTestConnection}
              onAddPlatform={addPlatform}
              onRemoveAll={handleRemoveAllOpenCTI}
              onSave={handleSave}
              isSaveDisabled={isPlatformSaveDisabled('opencti')}
            />
          )}

          {/* OpenAEV Tab */}
          {activeTab === 'openaev' && (
            <OpenAEVTab
              settings={settings}
              showTokens={showTokens}
              testing={testing}
              testResults={testResults}
              testedPlatforms={testedPlatforms}
              onToggleTokenVisibility={handleToggleTokenVisibility}
              onUpdatePlatform={updatePlatform}
              onRemovePlatform={removePlatform}
              onTestConnection={handleTestConnection}
              onAddPlatform={addPlatform}
              onRemoveAll={handleRemoveAllOpenAEV}
              onSave={handleSave}
              isSaveDisabled={isPlatformSaveDisabled('openaev')}
            />
          )}

          {/* Detection Tab */}
          {activeTab === 'detection' && (
            <DetectionTab
              settings={settings}
              cacheStats={cacheStats}
              isRefreshingCache={isRefreshingCache}
              mode={mode}
              onUpdateSetting={updateSetting}
              onRefreshCache={handleRefreshCache}
              onResetDetection={handleResetDetection}
              onSave={handleSave}
            />
          )}

          {/* AI Tab */}
          {activeTab === 'ai' && (
            <AITab
              settings={settings}
              mode={mode}
              aiTesting={aiTesting}
              aiTestResult={aiTestResult}
              availableModels={availableModels}
              onUpdateSetting={updateSetting}
              onTestAndFetchModels={handleTestAndFetchModels}
              onClearAI={handleClearAI}
              onSave={handleSave}
              setAiTestResult={setAiTestResult}
              setAvailableModels={setAvailableModels}
            />
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <AppearanceTab
              settings={settings}
              onSetTheme={setTheme}
              onSetSplitScreenMode={setSplitScreenMode}
              onResetAppearance={handleResetAppearance}
              onSave={handleSave}
            />
          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <AboutTab
              mode={mode}
              onResetAllSettings={handleResetAllSettings}
            />
          )}
        </Box>
      </Box>
      
      {/* Save Confirmation Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%', borderRadius: 1 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
};

export default App;
