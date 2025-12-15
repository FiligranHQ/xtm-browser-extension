import React, { useEffect, useState, useMemo } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Alert,
  Paper,
  Switch,
  FormControlLabel,
  Checkbox,
  FormGroup,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  CardActions,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  VisibilityOutlined,
  VisibilityOffOutlined,
  CheckOutlined,
  RefreshOutlined,
  InfoOutlined,
  LightModeOutlined,
  DarkModeOutlined,
  ContrastOutlined,
  DescriptionOutlined,
  PublicOutlined,
  DeleteOutlined,
  AddOutlined,
  LinkOffOutlined,
  RestartAltOutlined,
  PaletteOutlined,
} from '@mui/icons-material';
import {
  CenterFocusStrongOutlined,
  GitHub,
  AutoAwesomeOutlined,
  KeyOutlined,
} from '@mui/icons-material';
import ThemeDark from '../shared/theme/ThemeDark';
import ThemeLight from '../shared/theme/ThemeLight';
import type { ExtensionSettings, PlatformConfig, AIProvider, AISettings } from '../shared/types';

// Observable types that can be detected - sorted alphabetically by label
const OBSERVABLE_TYPES = [
  { value: 'Bank-Account', label: 'Bank Accounts (IBAN)' },
  { value: 'Cryptocurrency-Wallet', label: 'Cryptocurrency Wallets' },
  { value: 'Domain-Name', label: 'Domain Names' },
  { value: 'Email-Addr', label: 'Email Addresses' },
  { value: 'StixFile', label: 'File Hashes (MD5, SHA1, SHA256)' },
  { value: 'Hostname', label: 'Hostnames' },
  { value: 'IPv4-Addr', label: 'IPv4 Addresses' },
  { value: 'IPv6-Addr', label: 'IPv6 Addresses' },
  { value: 'Mac-Addr', label: 'MAC Addresses' },
  { value: 'Phone-Number', label: 'Phone Numbers' },
  { value: 'Url', label: 'URLs' },
  { value: 'User-Agent', label: 'User Agents' },
];

// Entity types that can be detected - sorted alphabetically by label
// These match the entity types that are cached for detection (see storage.ts SDOCache)
const ENTITY_TYPES = [
  { value: 'Administrative-Area', label: 'Administrative Areas' },
  { value: 'Attack-Pattern', label: 'Attack Patterns' },
  { value: 'Campaign', label: 'Campaigns' },
  { value: 'City', label: 'Cities' },
  { value: 'Country', label: 'Countries' },
  { value: 'Event', label: 'Events' },
  { value: 'Incident', label: 'Incidents' },
  { value: 'Individual', label: 'Individuals' },
  { value: 'Intrusion-Set', label: 'Intrusion Sets' },
  { value: 'Malware', label: 'Malware' },
  { value: 'Organization', label: 'Organizations' },
  { value: 'Position', label: 'Positions' },
  { value: 'Region', label: 'Regions' },
  { value: 'Sector', label: 'Sectors' },
  { value: 'Threat-Actor-Group', label: 'Threat Actor Groups' },
  { value: 'Threat-Actor-Individual', label: 'Threat Actor Individuals' },
];

// OpenAEV entity types - sorted alphabetically by label
const OAEV_ENTITY_TYPES = [
  { value: 'AssetGroup', label: 'Asset Groups' },
  { value: 'Asset', label: 'Assets (Endpoints)' },
  { value: 'Finding', label: 'Findings' },
  { value: 'Player', label: 'People' },
  { value: 'Team', label: 'Teams' },
];

const DEFAULT_DETECTION = {
  entityTypes: ENTITY_TYPES.map(e => e.value),
  observableTypes: OBSERVABLE_TYPES.map(o => o.value),
  oaevEntityTypes: OAEV_ENTITY_TYPES.map(o => o.value),
};

type TabType = 'opencti' | 'openaev' | 'detection' | 'ai' | 'appearance' | 'about';

const App: React.FC = () => {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<TabType>('opencti');
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [showTokens, setShowTokens] = useState<{ [key: string]: boolean }>({});
  const [testing, setTesting] = useState<{ [key: string]: boolean }>({});
  const [testResults, setTestResults] = useState<{ [key: string]: { type: 'success' | 'error'; message: string } }>({});
  const [testedPlatforms, setTestedPlatforms] = useState<Set<string>>(new Set());
  const [cacheStats, setCacheStats] = useState<{ 
    total: number; 
    age: number;
    byPlatform?: Array<{ platformId: string; platformName: string; total: number; age: number }>;
    oaevByPlatform?: Array<{ platformId: string; platformName: string; total: number; age: number }>;
    oaevTotal?: number;
    isRefreshing?: boolean;
  } | null>(null);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const theme = useMemo(() => {
    const themeOptions = mode === 'dark' ? ThemeDark() : ThemeLight();
    return createTheme(themeOptions);
  }, [mode]);

  useEffect(() => {
    // Check if we're running in an extension context
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      // Running outside extension context - use defaults
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(isDark ? 'dark' : 'light');
      setSettings({
        openctiPlatforms: [{ id: '1', name: 'OpenCTI', url: '', apiToken: '', enabled: true }],
        openaevPlatforms: [],
        theme: 'auto',
        autoScan: false,
        scanOnLoad: false,
        showNotifications: true,
        detection: DEFAULT_DETECTION,
      });
      return;
    }

    loadSettings();
    loadCacheStats();
  }, []);

  const loadSettings = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    if (chrome.runtime.lastError) return;
    if (response?.success && response.data) {
      // Migrate old settings format if needed
      const loadedSettings = response.data;
      if (!loadedSettings.openctiPlatforms) {
        loadedSettings.openctiPlatforms = loadedSettings.opencti 
          ? [{ id: '1', name: 'OpenCTI', ...loadedSettings.opencti }]
          : [];
      }
      if (!loadedSettings.openaevPlatforms) {
        loadedSettings.openaevPlatforms = loadedSettings.openaev?.url 
          ? [{ id: '1', name: 'OpenAEV', ...loadedSettings.openaev }]
          : [];
      }
      if (!loadedSettings.detection) {
        loadedSettings.detection = DEFAULT_DETECTION;
      }
      if (!loadedSettings.detection.oaevEntityTypes) {
        loadedSettings.detection.oaevEntityTypes = OAEV_ENTITY_TYPES.map(o => o.value);
      }
      setSettings(loadedSettings);
      
      // Mark existing platforms as tested
      const existingTested = new Set<string>();
      loadedSettings.openctiPlatforms?.forEach((p: PlatformConfig) => {
        if (p.url && p.apiToken) existingTested.add(`opencti-${p.id}`);
      });
      loadedSettings.openaevPlatforms?.forEach((p: PlatformConfig) => {
        if (p.url && p.apiToken) existingTested.add(`openaev-${p.id}`);
      });
      setTestedPlatforms(existingTested);
      
      let themeMode = loadedSettings.theme;
      if (themeMode === 'auto') {
        themeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      setMode(themeMode);
    }
  };

  const loadCacheStats = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    const response = await chrome.runtime.sendMessage({ type: 'GET_SDO_CACHE_STATS' });
    if (chrome.runtime.lastError) return;
    if (response?.success && response.data) {
      setCacheStats({
        total: response.data.total,
        age: Math.round(response.data.age / 60000),
        byPlatform: response.data.byPlatform?.map((p: any) => ({
          ...p,
          age: Math.round(p.age / 60000),
        })),
        oaevByPlatform: response.data.oaevByPlatform?.map((p: any) => ({
          ...p,
          age: Math.round(p.age / 60000),
        })),
        oaevTotal: response.data.oaevTotal || 0,
        isRefreshing: response.data.isRefreshing,
      });
      setIsRefreshingCache(response.data.isRefreshing || false);
    }
  };

  const handleTestConnection = async (type: 'opencti' | 'openaev', platformId: string) => {
    if (!settings) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    const key = `${type}-${platformId}`;
    setTesting({ ...testing, [key]: true });
    setTestResults({ ...testResults, [key]: undefined as any });

    const platforms = type === 'opencti' ? settings.openctiPlatforms : settings.openaevPlatforms;
    const platform = platforms.find(p => p.id === platformId);
    
    if (!platform?.url || !platform?.apiToken) {
      setTesting({ ...testing, [key]: false });
      setTestResults({
        ...testResults,
        [key]: { type: 'error', message: 'URL and API Token are required' },
      });
      return;
    }

    // Test connection without saving - send credentials directly
    const response = await chrome.runtime.sendMessage({ 
      type: 'TEST_PLATFORM_CONNECTION_TEMP',
      payload: { 
        platformType: type,
        url: platform.url,
        apiToken: platform.apiToken,
      },
    });
    
    if (chrome.runtime.lastError) {
      setTesting({ ...testing, [key]: false });
      return;
    }
    
    if (response?.success) {
      // Get remote platform name and auto-fill if the current name is default
      const remotePlatformName = type === 'opencti' 
        ? response.data?.settings?.platform_title 
        : response.data?.platform_name;
      
      const platformIndex = platforms.findIndex(p => p.id === platformId);
      const currentPlatform = platforms[platformIndex];
      
      // Auto-fill name if it's a default/generic name or empty
      const isDefaultName = currentPlatform?.name === 'OpenCTI' || 
                           currentPlatform?.name === 'OpenAEV' || 
                           currentPlatform?.name === 'New OpenCTI' || 
                           currentPlatform?.name === 'New OpenAEV' ||
                           !currentPlatform?.name;
      
      // Get enterprise edition status from response
      const isEnterprise = response.data?.enterprise_edition ?? false;
      
      // Update platform with name (if default) and enterprise status
      if (platformIndex >= 0) {
        const updates: Partial<PlatformConfig> = { isEnterprise };
        if (remotePlatformName && isDefaultName) {
          updates.name = remotePlatformName;
        }
        updatePlatform(type, platformIndex, updates);
      }
      
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

  const handleSave = async () => {
    if (!settings) return;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setSnackbar({ open: true, message: 'Settings saved (preview mode)', severity: 'success' });
      return;
    }
    
    // Normalize URLs: remove trailing slashes
    const normalizedSettings = {
      ...settings,
      openctiPlatforms: settings.openctiPlatforms.map(p => ({
        ...p,
        url: p.url.replace(/\/+$/, ''), // Remove trailing slashes
      })),
      openaevPlatforms: settings.openaevPlatforms.map(p => ({
        ...p,
        url: p.url.replace(/\/+$/, ''), // Remove trailing slashes
      })),
    };
    
    // Update local state with normalized URLs
    setSettings(normalizedSettings);
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: normalizedSettings,
      });
      
      if (response?.success) {
        setSnackbar({ open: true, message: 'Settings saved successfully!', severity: 'success' });
        
        // Start polling for cache refresh completion
        // The background script triggers cache refresh after settings save
        setIsRefreshingCache(true);
        const pollInterval = setInterval(async () => {
          const statusResponse = await chrome.runtime.sendMessage({ type: 'GET_CACHE_REFRESH_STATUS' });
          if (statusResponse?.success && !statusResponse.data?.isRefreshing) {
            clearInterval(pollInterval);
            setIsRefreshingCache(false);
            await loadCacheStats();
          }
        }, 1000);
        
        // Timeout after 2 minutes
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

  const handleResetAllSettings = async () => {
    if (!confirm('Are you sure you want to reset ALL settings? This will remove all connections and preferences.')) {
      return;
    }
    
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;

    // Clear all caches first
    await chrome.runtime.sendMessage({ type: 'CLEAR_SDO_CACHE' });

    const defaultSettings: ExtensionSettings = {
      openctiPlatforms: [],
      openaevPlatforms: [],
      theme: 'auto',
      autoScan: false,
      scanOnLoad: false,
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
    
    // Clear caches for all OpenCTI platforms
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_SDO_CACHE' });
    }
    
    // Create updated settings with empty OpenCTI platforms
    const updatedSettings = {
      ...settings,
      openctiPlatforms: [],
    };
    
    // Update local state
    setSettings(updatedSettings);
    
    // Save directly to avoid async state issues
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: updatedSettings,
      });
      setSnackbar({ open: true, message: 'All OpenCTI platforms removed', severity: 'success' });
    }
    
    setTestResults({});
    setTestedPlatforms(new Set());
    setCacheStats(null);
  };

  const handleRemoveAllOpenAEV = async () => {
    if (!confirm('Remove all OpenAEV platforms? This action cannot be undone.')) return;
    if (!settings) return;
    
    // Clear caches for all OpenAEV platforms
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_OAEV_CACHE' });
    }
    
    // Create updated settings with empty OpenAEV platforms
    const updatedSettings = {
      ...settings,
      openaevPlatforms: [],
    };
    
    // Update local state
    setSettings(updatedSettings);
    
    // Save directly to avoid async state issues
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: updatedSettings,
      });
      setSnackbar({ open: true, message: 'All OpenAEV platforms removed', severity: 'success' });
    }
    
    setTestResults({});
    setTestedPlatforms(new Set());
  };
  
  const handleRemoveAllPlatforms = async () => {
    if (!confirm('Remove ALL platforms (both OpenCTI and OpenAEV)? This action cannot be undone.')) return;
    if (!settings) return;
    
    // Clear all caches
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_SDO_CACHE' });
      await chrome.runtime.sendMessage({ type: 'CLEAR_OAEV_CACHE' });
    }
    
    const updatedSettings = {
      ...settings,
      openctiPlatforms: [],
      openaevPlatforms: [],
    };
    setSettings(updatedSettings);
    
    await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      payload: updatedSettings,
    });
    
    setTestResults({});
    setCacheStats(null);
    setSnackbar({ open: true, message: 'All platforms removed', severity: 'success' });
  };

  const handleResetDetection = () => {
    if (!settings) return;
    updateSetting('detection', DEFAULT_DETECTION);
  };

  const handleResetAppearance = () => {
    if (!settings) return;
    setTheme('auto');
  };

  const handleRefreshCache = async () => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    
    setIsRefreshingCache(true);
    chrome.runtime.sendMessage({ type: 'REFRESH_SDO_CACHE' });
    
    // Poll for completion
    const pollInterval = setInterval(async () => {
      const response = await chrome.runtime.sendMessage({ type: 'GET_CACHE_REFRESH_STATUS' });
      if (response?.success && !response.data?.isRefreshing) {
        clearInterval(pollInterval);
        setIsRefreshingCache(false);
        await loadCacheStats();
      }
    }, 1000);
    
    // Timeout after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setIsRefreshingCache(false);
      loadCacheStats();
    }, 120000);
  };

  const updateSetting = <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const setTheme = async (newTheme: 'auto' | 'dark' | 'light') => {
    if (!settings) return;
    
    // Update local state
    const updatedSettings = { ...settings, theme: newTheme };
    setSettings(updatedSettings);
    
    const effectiveMode = newTheme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : newTheme;
    setMode(effectiveMode);
    
    // Save immediately for theme changes
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        payload: updatedSettings,
      });
    }
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

  const removePlatform = (type: 'opencti' | 'openaev', index: number) => {
    if (!settings) return;
    if (!confirm('Are you sure you want to remove this platform?')) return;
    const key = `${type}Platforms` as const;
    const platforms = [...settings[key]];
    platforms.splice(index, 1);
    updateSetting(key, platforms);
  };

  const isPlatformSaveDisabled = (type: 'opencti' | 'openaev') => {
    if (!settings) return true;
    const platforms = type === 'opencti' ? settings.openctiPlatforms : settings.openaevPlatforms;
    
    for (const platform of platforms) {
      const key = `${type}-${platform.id}`;
      const hasUrl = platform.url && platform.url.trim().length > 0;
      const hasToken = platform.apiToken && platform.apiToken.trim().length > 0;
      
      // If platform has no URL and no token, it's completely empty - disable save
      if (!hasUrl && !hasToken) {
        return true; // Empty platform configuration
      }
      
      // If platform has URL but no token, or token but no URL, it's incomplete
      if ((hasUrl && !hasToken) || (!hasUrl && hasToken)) {
        return true; // Incomplete platform configuration
      }
      
      // If platform has both URL and token, but hasn't been tested, disable save
      if (hasUrl && hasToken && !testedPlatforms.has(key)) {
        return true; // Has untested platform with credentials
      }
    }
    return false;
  };

  if (!settings) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  const renderPlatformCard = (platform: PlatformConfig, type: 'opencti' | 'openaev', index: number) => {
    const key = `${type}-${platform.id}`;
    const isShowingToken = showTokens[key];
    const isTesting = testing[key];
    const testResult = testResults[key];
    
    // Platform name is only shown after it has been tested (auto-resolved from remote)
    const isPlatformTested = testedPlatforms.has(key);
    const isDefaultName = platform.name === 'New OpenCTI' || 
                         platform.name === 'New OpenAEV' ||
                         platform.name === 'OpenCTI' ||
                         platform.name === 'OpenAEV' ||
                         !platform.name;
    const showNameField = isPlatformTested || !isDefaultName;

    return (
      <Card key={platform.id} variant="outlined" sx={{ mb: 2, borderRadius: 1 }}>
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Platform Name - only shown after testing or if customized */}
            {showNameField && (
              <TextField
                label="Platform Name"
                size="small"
                value={platform.name}
                onChange={(e) => updatePlatform(type, index, { name: e.target.value })}
                fullWidth
                helperText="Auto-resolved from platform. You can customize it."
              />
            )}
            <TextField
              label="URL"
              size="small"
              placeholder={type === 'opencti' ? 'https://opencti.example.com' : 'https://openaev.example.com'}
              value={platform.url}
              onChange={(e) => updatePlatform(type, index, { url: e.target.value })}
              fullWidth
            />
            <TextField
              label="API Token"
              size="small"
              type={isShowingToken ? 'text' : 'password'}
              value={platform.apiToken}
              onChange={(e) => updatePlatform(type, index, { apiToken: e.target.value })}
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowTokens({ ...showTokens, [key]: !isShowingToken })} edge="end" size="small">
                        {isShowingToken ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            {testResult && (
              <Alert severity={testResult.type} sx={{ borderRadius: 1, py: 0 }}>
                {testResult.message}
              </Alert>
            )}
          </Box>
        </CardContent>
        <CardActions sx={{ px: 2, pb: 2, pt: 0, mt: 2.5, justifyContent: 'space-between' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleTestConnection(type, platform.id)}
            disabled={isTesting || !platform.url || !platform.apiToken}
            startIcon={<CheckOutlined />}
          >
            {isTesting ? 'Testing...' : 'Test'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => removePlatform(type, index)}
            startIcon={<DeleteOutlined />}
          >
            Remove
          </Button>
        </CardActions>
      </Card>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar - OpenCTI-inspired navigation */}
        <Box
          sx={{
            width: 220,
            bgcolor: 'background.paper',
            borderRight: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <img
                src={`../assets/logos/logo_filigran_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
                alt="Filigran"
                width={24}
                height={24}
              />
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 11, lineHeight: 1.2 }}>
                Filigran Threat Management
              </Typography>
            </Box>
          </Box>

          {/* Navigation - OpenCTI-style */}
          <List sx={{ flex: 1, py: 1 }}>
            {[
              { 
                id: 'opencti', 
                label: 'OpenCTI', 
                icon: (
                  <img 
                    src={`../assets/logos/logo_opencti_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
                    alt="OpenCTI" 
                    width={20} 
                    height={20}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )
              },
              { 
                id: 'openaev', 
                label: 'OpenAEV', 
                icon: (
                  <img 
                    src={`../assets/logos/logo_openaev_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
                    alt="OpenAEV" 
                    width={20} 
                    height={20}
                    onError={(e) => { 
                      // Fallback to filigran logo if openaev fails
                      (e.target as HTMLImageElement).src = `../assets/logos/logo_filigran_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`;
                    }}
                  />
                )
              },
              { 
                id: 'detection', 
                label: 'Detection', 
                icon: <CenterFocusStrongOutlined sx={{ fontSize: 20 }} />,
                disabled: (settings?.openctiPlatforms?.length || 0) === 0 && (settings?.openaevPlatforms?.length || 0) === 0,
              },
              { 
                id: 'ai', 
                label: 'AI Assistant', 
                icon: <AutoAwesomeOutlined sx={{ fontSize: 20 }} />,
                // AI is only available if at least one platform is Enterprise Edition
                disabled: ![
                  ...(settings?.openctiPlatforms || []),
                  ...(settings?.openaevPlatforms || []),
                ].some((p: any) => p.isEnterprise),
                badge: ![
                  ...(settings?.openctiPlatforms || []),
                  ...(settings?.openaevPlatforms || []),
                ].some((p: any) => p.isEnterprise) ? 'EE' : undefined,
              },
              { id: 'appearance', label: 'Appearance', icon: <PaletteOutlined sx={{ fontSize: 20 }} /> },
              { id: 'about', label: 'About', icon: <InfoOutlined sx={{ fontSize: 20 }} /> },
            ].map((item) => (
              <ListItemButton
                key={item.id}
                selected={activeTab === item.id}
                onClick={() => !item.disabled && setActiveTab(item.id as TabType)}
                disabled={item.disabled}
                sx={{
                  mx: 1,
                  borderRadius: 1,
                  mb: 0.5,
                  height: 40,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(0, 188, 212, 0.08)',
                    borderLeft: '3px solid',
                    borderLeftColor: 'primary.main',
                    '&:hover': {
                      bgcolor: 'rgba(0, 188, 212, 0.12)',
                    },
                  },
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                  '&.Mui-disabled': {
                    opacity: 0.5,
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: item.disabled ? 'text.disabled' : activeTab === item.id ? 'primary.main' : 'text.secondary' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.label} 
                  primaryTypographyProps={{ 
                    fontSize: 13, 
                    fontWeight: activeTab === item.id ? 600 : 400,
                    color: item.disabled ? 'text.disabled' : activeTab === item.id ? 'primary.main' : 'text.primary',
                  }} 
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        {/* Main Content */}
        <Box sx={{ flex: 1, p: 4, maxWidth: 900, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* OpenCTI Tab */}
          {activeTab === 'opencti' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>OpenCTI Platforms</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Configure one or more OpenCTI platform connections for threat intelligence
              </Typography>

              <Box sx={{ flex: 1 }}>
                {settings.openctiPlatforms.map((platform, index) => renderPlatformCard(platform, 'opencti', index))}

                <Button
                  variant="outlined"
                  startIcon={<AddOutlined />}
                  onClick={() => addPlatform('opencti')}
                  sx={{ mt: 1, mb: 3 }}
                >
                  Add OpenCTI Platform
                </Button>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<LinkOffOutlined />}
                  onClick={handleRemoveAllOpenCTI}
                  disabled={settings.openctiPlatforms.length === 0}
                >
                  Remove All
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={isPlatformSaveDisabled('opencti')}
                >
                  Save Settings
                </Button>
              </Box>
            </Box>
          )}

          {/* OpenAEV Tab */}
          {activeTab === 'openaev' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>OpenAEV Platforms</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Configure one or more OpenAEV platform connections for attack & exposure validation
              </Typography>

              <Box sx={{ flex: 1 }}>
                {settings.openaevPlatforms.map((platform, index) => renderPlatformCard(platform, 'openaev', index))}
                <Button
                  variant="outlined"
                  startIcon={<AddOutlined />}
                  onClick={() => addPlatform('openaev')}
                  sx={{ mt: 1, mb: 3 }}
                >
                  Add OpenAEV Platform
                </Button>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<LinkOffOutlined />}
                  onClick={handleRemoveAllOpenAEV}
                  disabled={settings.openaevPlatforms.length === 0}
                >
                  Remove All
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={isPlatformSaveDisabled('openaev')}
                >
                  Save Settings
                </Button>
              </Box>
            </Box>
          )}

          {/* Detection Tab */}
          {activeTab === 'detection' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Detection Settings</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Configure how entities are detected on web pages
              </Typography>

              <Box sx={{ flex: 1 }}>
                <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Scan Behavior</Typography>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.autoScan}
                        onChange={(e) => updateSetting('autoScan', e.target.checked)}
                        color="success"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">Auto-scan on page load</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Automatically scan pages when they finish loading
                        </Typography>
                      </Box>
                    }
                    sx={{ mb: 2, alignItems: 'flex-start' }}
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showNotifications}
                        onChange={(e) => updateSetting('showNotifications', e.target.checked)}
                        color="success"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">Show notifications</Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          Display notifications for scan results
                        </Typography>
                      </Box>
                    }
                    sx={{ alignItems: 'flex-start' }}
                  />
                </Paper>
                
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                  <Button variant="contained" onClick={handleSave}>
                    Save Scan Behavior
                  </Button>
                </Box>

                <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Entity Cache</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    Cached entities for offline detection
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: cacheStats?.byPlatform?.length ? 2 : 0 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {cacheStats ? `${cacheStats.total} entities cached` : 'No cache data'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {isRefreshingCache 
                          ? 'Refreshing cache...' 
                          : cacheStats 
                            ? `Last updated ${cacheStats.age} minutes ago` 
                            : 'Cache not initialized'}
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={isRefreshingCache ? <CircularProgress size={16} /> : <RefreshOutlined />}
                      onClick={handleRefreshCache}
                      disabled={isRefreshingCache}
                    >
                      {isRefreshingCache ? 'Refreshing...' : 'Refresh Cache'}
                    </Button>
                  </Box>
                  
                  {/* Per-platform breakdown - OpenCTI */}
                  {cacheStats?.byPlatform && cacheStats.byPlatform.length > 0 && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 1, display: 'block' }}>
                        OpenCTI Platforms
                      </Typography>
                      {cacheStats.byPlatform.map((platform) => (
                        <Box 
                          key={platform.platformId}
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            py: 0.5,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <img
                              src={`../assets/logos/logo_opencti_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
                              alt="OpenCTI"
                              width={16}
                              height={16}
                            />
                            <Typography variant="body2">{platform.platformName}</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {platform.timestamp === 0 
                              ? 'Building cache...' 
                              : `${platform.total} entities • ${platform.age}m ago`}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* Per-platform breakdown - OpenAEV */}
                  {cacheStats?.oaevByPlatform && cacheStats.oaevByPlatform.length > 0 && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mb: 1, display: 'block' }}>
                        OpenAEV Platforms
                      </Typography>
                      {cacheStats.oaevByPlatform.map((platform) => (
                        <Box 
                          key={platform.platformId}
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            py: 0.5,
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <img
                              src={`../assets/logos/logo_openaev_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
                              alt="OpenAEV"
                              width={16}
                              height={16}
                            />
                            <Typography variant="body2">{platform.platformName}</Typography>
                          </Box>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {platform.timestamp === 0 
                              ? 'Building cache...' 
                              : `${platform.total} entities • ${platform.age}m ago`}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>

                {/* Observable Types */}
                <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Observable Types</Typography>
                  <FormGroup sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                    {OBSERVABLE_TYPES.map((item) => (
                      <FormControlLabel
                        key={item.value}
                        control={
                          <Checkbox
                            size="small"
                            checked={settings.detection?.observableTypes?.includes(item.value) ?? true}
                            onChange={(e) => {
                              const types = settings.detection?.observableTypes || [];
                              updateSetting('detection', {
                                ...settings.detection,
                                observableTypes: e.target.checked
                                  ? [...types, item.value]
                                  : types.filter((t) => t !== item.value),
                              });
                            }}
                          />
                        }
                        label={<Typography variant="body2">{item.label}</Typography>}
                      />
                    ))}
                  </FormGroup>
                </Paper>

                {/* OpenCTI Entity Types */}
                <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>OpenCTI Entity Types</Typography>
                  <FormGroup sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                    {ENTITY_TYPES.map((item) => (
                      <FormControlLabel
                        key={item.value}
                        control={
                          <Checkbox
                            size="small"
                            checked={settings.detection?.entityTypes?.includes(item.value) ?? true}
                            onChange={(e) => {
                              const types = settings.detection?.entityTypes || [];
                              updateSetting('detection', {
                                ...settings.detection,
                                entityTypes: e.target.checked
                                  ? [...types, item.value]
                                  : types.filter((t) => t !== item.value),
                              });
                            }}
                          />
                        }
                        label={<Typography variant="body2">{item.label}</Typography>}
                      />
                    ))}
                  </FormGroup>
                </Paper>

                {/* OpenAEV Entity Types */}
                <Paper elevation={0} sx={{ p: 3, mb: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>OpenAEV Entity Types</Typography>
                  <FormGroup sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                    {OAEV_ENTITY_TYPES.map((item) => (
                      <FormControlLabel
                        key={item.value}
                        control={
                          <Checkbox
                            size="small"
                            checked={settings.detection?.oaevEntityTypes?.includes(item.value) ?? true}
                            onChange={(e) => {
                              const types = settings.detection?.oaevEntityTypes || [];
                              updateSetting('detection', {
                                ...settings.detection,
                                oaevEntityTypes: e.target.checked
                                  ? [...types, item.value]
                                  : types.filter((t) => t !== item.value),
                              });
                            }}
                          />
                        }
                        label={<Typography variant="body2">{item.label}</Typography>}
                      />
                    ))}
                  </FormGroup>
                </Paper>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<RestartAltOutlined />}
                  onClick={handleResetDetection}
                >
                  Reset to Default
                </Button>
                <Button variant="contained" onClick={handleSave}>
                  Save Detection Settings
                </Button>
              </Box>
            </Box>
          )}

          {/* AI Assistant Tab */}
          {activeTab === 'ai' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>AI Assistant</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Configure AI-powered features for content generation and scenario creation
              </Typography>

              {/* Check if any platform has EE */}
              {![
                ...(settings?.openctiPlatforms || []),
                ...(settings?.openaevPlatforms || []),
              ].some((p: any) => p.isEnterprise) ? (
                <Alert severity="info" sx={{ mb: 3 }}>
                  AI features require at least one Enterprise Edition (EE) platform. 
                  Connect an EE platform to enable AI capabilities.
                </Alert>
              ) : (
                <Box sx={{ flex: 1 }}>
                  {/* AI Provider Selection */}
                  <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1, mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>AI Provider</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                      Select your preferred AI provider and enter your API key
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                      {[
                        { value: 'openai', label: 'OpenAI', sublabel: 'GPT-4o' },
                        { value: 'anthropic', label: 'Anthropic', sublabel: 'Claude' },
                        { value: 'gemini', label: 'Google', sublabel: 'Gemini' },
                        { value: 'xtm-one', label: 'XTM One', sublabel: 'Coming Soon', disabled: true },
                      ].map((provider) => (
                        <Paper
                          key={provider.value}
                          onClick={() => !provider.disabled && updateSetting('ai', { 
                            ...settings?.ai, 
                            provider: provider.value as AIProvider,
                            enabled: true,
                          })}
                          sx={{
                            p: 2,
                            minWidth: 140,
                            cursor: provider.disabled ? 'not-allowed' : 'pointer',
                            opacity: provider.disabled ? 0.5 : 1,
                            border: settings?.ai?.provider === provider.value ? '2px solid' : '1px solid',
                            borderColor: settings?.ai?.provider === provider.value ? 'primary.main' : 'divider',
                            bgcolor: settings?.ai?.provider === provider.value ? 'action.selected' : 'background.paper',
                            borderRadius: 1,
                            textAlign: 'center',
                            transition: 'all 0.2s',
                            '&:hover': !provider.disabled ? {
                              borderColor: 'primary.main',
                              bgcolor: 'action.hover',
                            } : {},
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {provider.label}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {provider.sublabel}
                          </Typography>
                          {provider.disabled && (
                            <Chip 
                              label="Soon" 
                              size="small" 
                              sx={{ 
                                mt: 1, 
                                fontSize: '0.65rem',
                                height: 18,
                                bgcolor: 'warning.main',
                                color: 'warning.contrastText',
                              }} 
                            />
                          )}
                        </Paper>
                      ))}
                    </Box>

                    {/* API Key Input */}
                    {settings?.ai?.provider && settings.ai.provider !== 'xtm-one' && (
                      <TextField
                        fullWidth
                        type="password"
                        label={`${settings.ai.provider === 'openai' ? 'OpenAI' : settings.ai.provider === 'anthropic' ? 'Anthropic' : 'Google'} API Key`}
                        placeholder={`Enter your ${settings.ai.provider === 'openai' ? 'OpenAI' : settings.ai.provider === 'anthropic' ? 'Anthropic' : 'Google'} API key`}
                        value={settings?.ai?.apiKey || ''}
                        onChange={(e) => updateSetting('ai', { 
                          ...settings?.ai,
                          enabled: settings?.ai?.enabled ?? false,
                          apiKey: e.target.value,
                        })}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <KeyOutlined sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                          ),
                        }}
                        helperText={
                          settings.ai.provider === 'openai' 
                            ? 'Get your API key from platform.openai.com' 
                            : settings.ai.provider === 'anthropic'
                            ? 'Get your API key from console.anthropic.com'
                            : 'Get your API key from aistudio.google.com'
                        }
                        sx={{ mb: 2 }}
                      />
                    )}

                    {/* Enable/Disable Toggle */}
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings?.ai?.enabled && !!settings?.ai?.apiKey}
                          onChange={(e) => updateSetting('ai', { 
                            ...settings?.ai, 
                            enabled: e.target.checked,
                          })}
                          disabled={!settings?.ai?.apiKey}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">Enable AI Features</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {!settings?.ai?.apiKey 
                              ? 'Enter an API key to enable AI features' 
                              : settings?.ai?.enabled 
                                ? 'AI features are active' 
                                : 'AI features are disabled'}
                          </Typography>
                        </Box>
                      }
                    />
                  </Paper>

                  {/* AI Capabilities Info */}
                  <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>AI Capabilities</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                      When enabled, AI powers the following features:
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <DescriptionOutlined sx={{ color: 'primary.main', mt: 0.3 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>Container Description</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Generate intelligent descriptions when creating containers in OpenCTI
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <AutoAwesomeOutlined sx={{ color: 'primary.main', mt: 0.3 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>Scenario Generation</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Create complete OpenAEV scenarios with injects based on page content
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <CenterFocusStrongOutlined sx={{ color: 'primary.main', mt: 0.3 }} />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>On-the-fly Atomic Testing</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Generate custom atomic tests with executable commands
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                </Box>
              )}

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" onClick={handleSave}>
                  Save AI Settings
                </Button>
              </Box>
            </Box>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>Appearance</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Customize the extension's appearance
              </Typography>

              <Box sx={{ flex: 1 }}>
                <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Theme</Typography>
                  
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {[
                      { value: 'auto', label: 'Auto', icon: <ContrastOutlined /> },
                      { value: 'dark', label: 'Dark', icon: <DarkModeOutlined /> },
                      { value: 'light', label: 'Light', icon: <LightModeOutlined /> },
                    ].map((item) => (
                      <Paper
                        key={item.value}
                        onClick={() => setTheme(item.value as 'auto' | 'dark' | 'light')}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 1,
                          p: 2,
                          cursor: 'pointer',
                          border: 2,
                          borderColor: settings.theme === item.value ? 'primary.main' : 'divider',
                          borderRadius: 1,
                          bgcolor: settings.theme === item.value ? 'action.selected' : 'transparent',
                          transition: 'all 0.2s',
                          '&:hover': { borderColor: 'primary.main' },
                        }}
                      >
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: item.value === 'auto'
                              ? 'linear-gradient(135deg, #1a1a2e 50%, #e8e8e8 50%)'
                              : item.value === 'dark'
                              ? '#1a1a2e'
                              : '#e8e8e8',
                            background: item.value === 'auto'
                              ? 'linear-gradient(135deg, #1a1a2e 50%, #e8e8e8 50%)'
                              : undefined,
                          }}
                        >
                          {item.icon}
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.label}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                  
                  <Typography variant="caption" sx={{ color: 'text.secondary', mt: 2, display: 'block' }}>
                    Auto mode follows your browser's color scheme preference.
                  </Typography>
                </Paper>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<RestartAltOutlined />}
                  onClick={handleResetAppearance}
                >
                  Reset to Default
                </Button>
                <Button variant="contained" onClick={handleSave}>
                  Save Appearance
                </Button>
              </Box>
            </Box>
          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>About</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Filigran Threat Management Extension
              </Typography>

              <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1, textAlign: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 2 }}>
                  <img
                    src={`../assets/logos/logo_filigran_${mode === 'dark' ? 'dark' : 'light'}-theme_embleme_square.svg`}
                    alt="Filigran"
                    width={40}
                    height={40}
                  />
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                      Filigran
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Threat Management
                    </Typography>
                  </Box>
                  <Chip label="v1.0.0" size="small" sx={{ ml: 1 }} />
                </Box>

                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, maxWidth: 400, mx: 'auto' }}>
                  A powerful browser extension for threat intelligence scanning with OpenCTI and attack surface validation with OpenAEV.
                </Typography>

                <Divider sx={{ my: 3 }} />

                {/* Links as horizontal tiles */}
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, textAlign: 'left' }}>Links</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
                  <Paper
                    component="a"
                    href="https://github.com/FiligranHQ/xtm-browser-extension/tree/main/docs"
                    target="_blank"
                    elevation={0}
                    sx={{
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      bgcolor: 'action.hover',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: 'primary.main',
                        transform: 'translateY(-2px)',
                        boxShadow: 2,
                      },
                    }}
                  >
                    <DescriptionOutlined sx={{ fontSize: 28, color: 'primary.main' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Documentation
                    </Typography>
                  </Paper>
                  <Paper
                    component="a"
                    href="https://github.com/FiligranHQ/xtm-browser-extension"
                    target="_blank"
                    elevation={0}
                    sx={{
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      bgcolor: 'action.hover',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: 'primary.main',
                        transform: 'translateY(-2px)',
                        boxShadow: 2,
                      },
                    }}
                  >
                    <GitHub sx={{ fontSize: 28, color: 'primary.main' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      GitHub
                    </Typography>
                  </Paper>
                  <Paper
                    component="a"
                    href="https://filigran.io"
                    target="_blank"
                    elevation={0}
                    sx={{
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      bgcolor: 'action.hover',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: 'primary.main',
                        transform: 'translateY(-2px)',
                        boxShadow: 2,
                      },
                    }}
                  >
                    <PublicOutlined sx={{ fontSize: 28, color: 'primary.main' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      Filigran.io
                    </Typography>
                  </Paper>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  © 2025 Filigran. Licensed under Apache 2.0.
                </Typography>
              </Paper>

              {/* Reset All Settings */}
              <Paper elevation={0} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Reset Settings</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Clear all settings and connections to start fresh
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlined />}
                  onClick={handleResetAllSettings}
                >
                  Reset All Settings
                </Button>
              </Paper>
            </Box>
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
