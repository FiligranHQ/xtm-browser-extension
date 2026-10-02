/**
 * useSetupWizard - Hook for managing setup wizard state and actions
 * 
 * Persists setup state to chrome.storage.local so users don't lose their
 * input if the popup closes (e.g., when copying a token from another window).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { loggers } from '../../shared/utils/logger';
import { normalizeUrl, normalizeUrlForComparison } from '../../shared/utils/formatters';
import { getPlatformName } from '../../shared/platform/registry';
import type { SetupStep, ConnectionStatus, PlatformStatus } from '../types';

const log = loggers.popup;

// Storage key for persisting setup state
const SETUP_STATE_KEY = 'xtm_setup_wizard_state';

interface PersistedSetupState {
  setupStep: SetupStep;
  isInSetupWizard: boolean;
  setupUrl: string;
  setupToken: string;
  setupName: string;
}

interface SettingsPlatforms {
  openctiPlatforms?: Array<{ isEnterprise?: boolean }>;
  openaevPlatforms?: Array<{ isEnterprise?: boolean }>;
}

// hasEnterpriseConfigured is filled in asynchronously after the popup opens,
// so check the saved settings directly before deciding to skip XTM One
const settingsHaveEnterprise = (settings: SettingsPlatforms | undefined): boolean =>
  [...(settings?.openctiPlatforms ?? []), ...(settings?.openaevPlatforms ?? [])]
    .some((p) => p.isEnterprise);

interface UseSetupWizardProps {
  setStatus: React.Dispatch<React.SetStateAction<ConnectionStatus>>;
  hasEnterpriseConfigured: boolean;
}

interface UseSetupWizardReturn {
  // State
  setupStep: SetupStep;
  isInSetupWizard: boolean;
  setupUrl: string;
  setupToken: string;
  setupName: string;
  showSetupToken: boolean;
  setupTesting: boolean;
  setupError: string | null;
  setupSuccess: boolean;
  
  // Actions
  setSetupStep: (step: SetupStep) => void;
  setIsInSetupWizard: (value: boolean) => void;
  setSetupUrl: (value: string) => void;
  setSetupToken: (value: string) => void;
  setSetupName: (value: string) => void;
  setShowSetupToken: (value: boolean) => void;
  handleSetupTestAndSave: (platformType: 'opencti' | 'openaev' | 'xtm-one') => Promise<void>;
  handleSetupSkip: (currentStep: 'opencti' | 'openaev' | 'xtm-one') => Promise<void>;
  startSetupWizard: () => void;
}

export const useSetupWizard = ({ setStatus, hasEnterpriseConfigured }: UseSetupWizardProps): UseSetupWizardReturn => {
  // Setup wizard state
  const [setupStep, setSetupStepInternal] = useState<SetupStep>('welcome');
  const [isInSetupWizard, setIsInSetupWizardInternal] = useState(false);
  const [setupUrl, setSetupUrlInternal] = useState('');
  const [setupToken, setSetupTokenInternal] = useState('');
  const [setupName, setSetupNameInternal] = useState('');
  const [showSetupToken, setShowSetupToken] = useState(false);
  const [setupTesting, setSetupTesting] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSuccess, setSetupSuccess] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const busyRef = useRef(false);

  // Load persisted state on mount
  useEffect(() => {
    chrome.storage.local.get(SETUP_STATE_KEY).then((result) => {
      const saved = result[SETUP_STATE_KEY] as PersistedSetupState | undefined;
      if (saved && saved.isInSetupWizard) {
        log.debug('Restoring setup wizard state:', saved);
        setSetupStepInternal(saved.setupStep);
        setIsInSetupWizardInternal(saved.isInSetupWizard);
        setSetupUrlInternal(saved.setupUrl || '');
        setSetupTokenInternal(saved.setupToken || '');
        setSetupNameInternal(saved.setupName || '');
      }
      setInitialized(true);
    }).catch((error) => {
      log.error('Failed to load setup state:', error);
      setInitialized(true);
    });
  }, []);

  const persistState = useCallback((state: PersistedSetupState) => {
    chrome.storage.local.set({ [SETUP_STATE_KEY]: state }).catch((error) => {
      log.error('Failed to save setup state:', error);
    });
  }, []);

  // Save state to storage whenever it changes (after initialization)
  useEffect(() => {
    // On success the next step is already persisted
    if (!initialized || setupSuccess) return;
    
    if (isInSetupWizard) {
      persistState({
        setupStep,
        isInSetupWizard,
        setupUrl,
        setupToken,
        setupName,
      });
    }
  }, [initialized, setupSuccess, setupStep, isInSetupWizard, setupUrl, setupToken, setupName, persistState]);

  // Clear persisted state
  const clearPersistedState = useCallback(() => {
    chrome.storage.local.remove(SETUP_STATE_KEY).catch((error) => {
      log.error('Failed to clear setup state:', error);
    });
  }, []);

  // Wrapped setters that update both state and storage
  const setSetupStep = useCallback((step: SetupStep) => {
    setSetupStepInternal(step);
  }, []);

  const setIsInSetupWizard = useCallback((value: boolean) => {
    setIsInSetupWizardInternal(value);
    if (!value) {
      clearPersistedState();
    }
  }, [clearPersistedState]);

  const setSetupUrl = useCallback((value: string) => {
    setSetupUrlInternal(value);
  }, []);

  const setSetupToken = useCallback((value: string) => {
    setSetupTokenInternal(value);
  }, []);

  const setSetupName = useCallback((value: string) => {
    setSetupNameInternal(value);
  }, []);

  const resetSetupForm = useCallback(() => {
    setSetupUrlInternal('');
    setSetupTokenInternal('');
    setSetupNameInternal('');
    setSetupError(null);
    setSetupSuccess(false);
  }, []);

  const startSetupWizard = useCallback(() => {
    setIsInSetupWizardInternal(true);
    setSetupStepInternal('opencti');
  }, []);

  const handleSetupSkip = useCallback(async (currentStep: 'opencti' | 'openaev' | 'xtm-one') => {
    // A Connect in flight or finishing will move the wizard itself
    if (busyRef.current) return;
    resetSetupForm();

    if (currentStep === 'opencti') {
      setSetupStepInternal('openaev');
    } else if (currentStep === 'openaev') {
      let hasEnterprise = hasEnterpriseConfigured;
      if (!hasEnterprise) {
        busyRef.current = true;
        try {
          const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
          if (!settingsResponse?.success) {
            throw new Error(settingsResponse?.error || 'Failed to get settings');
          }
          hasEnterprise = settingsHaveEnterprise(settingsResponse.data);
        } catch (error) {
          // Without the settings we cannot tell whether XTM One applies, so stay on this step
          log.error('Could not read settings to check for an EE platform:', error);
          setSetupError(error instanceof Error ? error.message : 'Failed to get settings');
          return;
        } finally {
          busyRef.current = false;
        }
      }

      if (hasEnterprise) {
        setSetupStepInternal('xtm-one');
      } else {
        // No EE platform configured — skip XTM One, end wizard
        setIsInSetupWizardInternal(false);
        setSetupStepInternal('welcome');
        clearPersistedState();
      }
    } else {
      // Setup complete - clear persisted state
      setIsInSetupWizardInternal(false);
      setSetupStepInternal('welcome');
      clearPersistedState();
    }
  }, [resetSetupForm, clearPersistedState, hasEnterpriseConfigured]);

  const handleSetupTestAndSave = useCallback(async (platformType: 'opencti' | 'openaev' | 'xtm-one') => {
    if (!setupUrl.trim() || !setupToken.trim() || busyRef.current) return;
    busyRef.current = true;
    
    setSetupTesting(true);
    setSetupError(null);
    setSetupSuccess(false);
    
    try {
      const normalizedUrl = normalizeUrl(setupUrl);
      
      // XTM-One has a different test/save flow
      if (platformType === 'xtm-one') {
        const testResponse = await chrome.runtime.sendMessage({
          type: 'AI_TEST_CONNECTION',
          payload: {
            xtmOneUrl: normalizedUrl,
            apiToken: setupToken.trim(),
          },
        });
        
        if (!testResponse?.success) {
          throw new Error(testResponse?.error || 'Connection test failed');
        }
        
        // Save to settings.ai
        const settingsResponse = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        if (!settingsResponse?.success) {
          throw new Error('Failed to get settings');
        }
        
        const updatedSettings = {
          ...settingsResponse.data,
          ai: {
            ...settingsResponse.data?.ai,
            xtmOneUrl: normalizedUrl,
            apiToken: setupToken.trim(),
            connectionTested: true,
          },
        };
        
        const saveResponse = await chrome.runtime.sendMessage({
          type: 'SAVE_SETTINGS',
          payload: updatedSettings,
        });
        
        if (!saveResponse?.success) {
          throw new Error(saveResponse?.error || 'Failed to save settings');
        }
        
        log.debug('XTM One settings saved successfully');
        
        clearPersistedState();
        setSetupSuccess(true);
        setSetupTesting(false);
        
        // Move to completion after a short delay
        setTimeout(() => {
          resetSetupForm();
          setIsInSetupWizardInternal(false);
          setSetupStepInternal('welcome');
          busyRef.current = false;
        }, 1000);
        
        return;
      }
      
      // Test connection FIRST without saving (using temp test)
      const testResponse = await chrome.runtime.sendMessage({
        type: 'TEST_PLATFORM_CONNECTION',
        payload: { 
          platformType,
          temporary: true,
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
      
      // Get enterprise edition status from response
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
      const existingPlatforms: Array<{ id: string; name?: string; url: string; apiToken: string }> =
        currentSettings[`${platformType}Platforms`] || [];
      // One platform per URL, compared the same way as the options page
      const existing = existingPlatforms.find(
        (p) => normalizeUrlForComparison(p.url) === normalizeUrlForComparison(normalizedUrl)
      );
      const platformId = existing?.id ?? `${platformType}-setup-${Date.now()}`;

      // Create platform with the final name
      const finalName = setupName.trim() || existing?.name || remotePlatformName || getPlatformName(platformType);
      const newPlatform = {
        id: platformId,
        name: finalName,
        url: normalizedUrl,
        apiToken: setupToken.trim(),
        enabled: true,
        isEnterprise: isEnterprise,
      };

      log.debug(`${existing ? 'Updating' : 'Creating new'} ${platformType} platform:`, {
        id: newPlatform.id,
        name: newPlatform.name,
        isEnterprise: newPlatform.isEnterprise,
      });

      if (existing?.apiToken === newPlatform.apiToken) {
        log.debug(`${platformType} platform already configured (${existing.id}), not saving it again`);
      } else {
        // A known URL with a new token updates that platform instead of adding a second one
        const platforms = existing
          ? existingPlatforms.map((p) => (p.id === existing.id ? { ...p, ...newPlatform } : p))
          : [...existingPlatforms, newPlatform];
        const updatedSettings = {
          ...currentSettings,
          [`${platformType}Platforms`]: platforms,
        };
        
        const saveResponse = await chrome.runtime.sendMessage({
          type: 'SAVE_SETTINGS',
          payload: updatedSettings,
        });
        
        if (!saveResponse?.success) {
          throw new Error(saveResponse?.error || 'Failed to save settings');
        }
        
        log.debug(`Settings saved successfully for ${platformType}, isEnterprise: ${isEnterprise}`);
      }

      // Only show the platform as connected once it is saved
      const newPlatformStatus: PlatformStatus = {
        id: platformId,
        name: finalName,
        url: normalizedUrl,
        connected: true,
        version: testResponse.data?.version,
        userName: platformType === 'opencti'
          ? (testResponse.data?.me?.name || testResponse.data?.me?.user_email)
          : testResponse.data?.user?.user_email,
        isEnterprise: isEnterprise,
      };

      setStatus(prev => ({
        ...prev,
        [platformType]: [
          ...prev[platformType].filter(p => p.id !== platformId),
          newPlatformStatus,
        ],
      }));

      // After OAEV: show XTM One only if this platform or another saved one is EE.
      // The test just run is authoritative for this platform, so its saved copy is left
      // out, and hasEnterpriseConfigured (which may include that copy) only counts for
      // a new platform.
      const otherSettings = {
        ...currentSettings,
        [`${platformType}Platforms`]: existingPlatforms.filter((p) => p.id !== platformId),
      };
      const otherIsEnterprise = settingsHaveEnterprise(otherSettings) || (!existing && hasEnterpriseConfigured);
      const nextStep: SetupStep | null = platformType === 'opencti'
        ? 'openaev'
        : (isEnterprise || otherIsEnterprise) ? 'xtm-one' : null;
      
      // The popup may close before the timeout below fires
      if (nextStep) {
        persistState({ setupStep: nextStep, isInSetupWizard: true, setupUrl: '', setupToken: '', setupName: '' });
      } else {
        clearPersistedState();
      }
      
      setSetupSuccess(true);
      setSetupTesting(false);

      // Inject content scripts into all open tabs without blocking setup flow.
      // Some environments/tabs may keep this message pending for too long.
      void chrome.runtime.sendMessage({ type: 'INJECT_ALL_TABS' }).catch((error) => {
        log.debug('Note: Could not inject content scripts into existing tabs:', error);
      });
      
      // Move to next step after a short delay
      setTimeout(() => {
        resetSetupForm();
        
        if (nextStep) {
          setSetupStepInternal(nextStep);
        } else {
          setIsInSetupWizardInternal(false);
          setSetupStepInternal('welcome');
        }
        busyRef.current = false;
      }, 1000);
      
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Connection failed');
      setSetupTesting(false);
      busyRef.current = false;
    }
  }, [setupUrl, setupToken, setupName, setStatus, resetSetupForm, persistState, clearPersistedState, hasEnterpriseConfigured]);

  return {
    // State
    setupStep,
    isInSetupWizard,
    setupUrl,
    setupToken,
    setupName,
    showSetupToken,
    setupTesting,
    setupError,
    setupSuccess,
    
    // Actions
    setSetupStep,
    setIsInSetupWizard,
    setSetupUrl,
    setSetupToken,
    setSetupName,
    setShowSetupToken,
    handleSetupTestAndSave,
    handleSetupSkip,
    startSetupWizard,
  };
};

export default useSetupWizard;
