/**
 * useTheme - Shared hook for managing theme across extension pages
 * 
 * Consolidates theme fetching logic that was duplicated across:
 * - src/panel/App.tsx
 * - src/popup/hooks/usePlatformStatus.ts
 * - src/options/App.tsx
 * - src/pdf-scanner/App.tsx
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createTheme, type Theme } from '@mui/material';
import themeDark from '../theme/theme-dark';
import themeLight from '../theme/theme-light';

export type ThemeMode = 'dark' | 'light';

interface UseThemeOptions {
  /** If true, listen for storage changes and update theme automatically */
  listenForChanges?: boolean;
  /** Callback when theme mode changes */
  onModeChange?: (mode: ThemeMode) => void;
}

interface UseThemeReturn {
  /** Current theme mode ('dark' or 'light') */
  mode: ThemeMode;
  /** Set the theme mode */
  setMode: React.Dispatch<React.SetStateAction<ThemeMode>>;
  /** MUI theme object based on current mode */
  theme: Theme;
  /** Logo suffix for theme-aware assets (e.g., 'dark-theme' or 'light-theme') */
  logoSuffix: string;
  /** Force refresh theme from settings */
  refreshTheme: () => void;
}

/**
 * Check if running in extension context
 */
function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.sendMessage;
}

/**
 * Fetch theme from extension settings
 */
function fetchThemeFromSettings(
  onSuccess: (mode: ThemeMode) => void
): void {
  if (!isExtensionContext()) {
    onSuccess('dark');
    return;
  }

  // First try GET_PLATFORM_THEME for immediate theme
  chrome.runtime.sendMessage({ type: 'GET_PLATFORM_THEME' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.success) {
      onSuccess(response.data === 'light' ? 'light' : 'dark');
    }
  });

  // Also get from settings for consistency
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.success && response.data?.theme) {
      onSuccess(response.data.theme === 'light' ? 'light' : 'dark');
    }
  });
}

/**
 * Hook for managing theme across extension pages
 * 
 * @example
 * ```tsx
 * const { mode, theme, logoSuffix } = useTheme();
 * 
 * return (
 *   <ThemeProvider theme={theme}>
 *     <img src={`logo-${logoSuffix}.png`} />
 *   </ThemeProvider>
 * );
 * ```
 */
export function useTheme(options: UseThemeOptions = {}): UseThemeReturn {
  const { listenForChanges = false, onModeChange } = options;
  const [mode, setMode] = useState<ThemeMode>('dark');

  // Create MUI theme based on mode
  const theme = useMemo(() => {
    const themeOptions = mode === 'dark' ? themeDark() : themeLight();
    return createTheme(themeOptions);
  }, [mode]);

  // Logo suffix for theme-aware assets
  const logoSuffix = mode === 'dark' ? 'dark-theme' : 'light-theme';

  // Refresh theme from settings
  const refreshTheme = useCallback(() => {
    fetchThemeFromSettings((newMode) => {
      setMode(newMode);
      onModeChange?.(newMode);
    });
  }, [onModeChange]);

  // Initial theme load
  useEffect(() => {
    refreshTheme();
  }, [refreshTheme]);

  // Listen for storage changes if enabled
  useEffect(() => {
    if (!listenForChanges || !isExtensionContext()) return;

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      const newValue = changes.settings?.newValue as { theme?: string } | undefined;
      if (areaName === 'local' && newValue?.theme) {
        const newTheme = newValue.theme;
        setMode(newTheme === 'light' ? 'light' : 'dark');
        onModeChange?.(newTheme === 'light' ? 'light' : 'dark');
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [listenForChanges, onModeChange]);

  return {
    mode,
    setMode,
    theme,
    logoSuffix,
    refreshTheme,
  };
}

export default useTheme;

