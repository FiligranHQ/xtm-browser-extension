/**
 * useSetupWizard - Hook for managing setup wizard state and actions
 */

import { useState, useCallback } from 'react';
import { loggers } from '../../shared/utils/logger';
import { getPlatformName } from '../../shared/platform/registry';
import type { SetupStep, ConnectionStatus, PlatformStatus } from '../types';

const log = loggers.popup;

interface UseSetupWizardProps {
  setStatus: React.Dispatch<React.SetStateAction<ConnectionStatus>>;
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
  handleSetupTestAndSave: (platformType: 'opencti' | 'openaev') => Promise<void>;
  handleSetupSkip: (currentStep: 'opencti' | 'openaev') => void;
  startSetupWizard: () => void;
}

export const useSetupWizard = ({ setStatus }: UseSetupWizardProps): UseSetupWizardReturn => {
  // Setup wizard state
  const [setupStep, setSetupStep] = useState<SetupStep>('welcome');
  const [isInSetupWizard, setIsInSetupWizard] = useState(false);
  const [setupUrl, setSetupUrl] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [setupName, setSetupName] = useState('');
  const [showSetupToken, setShowSetupToken] = useState(false);
  const [setupTesting, setSetupTesting] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupSuccess, setSetupSuccess] = useState(false);

  const resetSetupForm = useCallback(() => {
    setSetupUrl('');
    setSetupToken('');
    setSetupName('');
    setSetupError(null);
    setSetupSuccess(false);
  }, []);

  const startSetupWizard = useCallback(() => {
    setIsInSetupWizard(true);
    setSetupStep('opencti');
  }, []);

  const handleSetupSkip = useCallback((currentStep: 'opencti' | 'openaev') => {
    resetSetupForm();
    
    if (currentStep === 'opencti') {
      setSetupStep('openaev');
    } else {
      setIsInSetupWizard(false);
      setSetupStep('welcome');
    }
  }, [resetSetupForm]);

  const handleSetupTestAndSave = useCallback(async (platformType: 'opencti' | 'openaev') => {
    if (!setupUrl.trim() || !setupToken.trim()) return;
    
    setSetupTesting(true);
    setSetupError(null);
    setSetupSuccess(false);
    
    try {
      // Normalize URL: remove trailing slashes
      const normalizedUrl = setupUrl.trim().replace(/\/+$/, '');
      
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
      const platformId = `${platformType}-setup-${Date.now()}`;
      
      // Create platform with the final name
      const finalName = setupName.trim() || remotePlatformName || getPlatformName(platformType);
      const newPlatform = {
        id: platformId,
        name: finalName,
        url: normalizedUrl,
        apiToken: setupToken.trim(),
        enabled: true,
        isEnterprise: isEnterprise,
      };
      
      log.debug(`Creating new ${platformType} platform:`, {
        id: newPlatform.id,
        name: newPlatform.name,
        isEnterprise: newPlatform.isEnterprise,
      });
      
      // Update the status to show this platform as connected
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
      
      if (platformType === 'opencti') {
        setStatus(prev => ({
          ...prev,
          opencti: [...prev.opencti, newPlatformStatus],
        }));
      } else {
        setStatus(prev => ({
          ...prev,
          openaev: [...prev.openaev, newPlatformStatus],
        }));
      }
      
      // Add the new platform to settings
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
      
      // Inject content scripts into all open tabs
      try {
        await chrome.runtime.sendMessage({ type: 'INJECT_ALL_TABS' });
      } catch (error) {
        log.debug('Note: Could not inject content scripts into existing tabs:', error);
      }
      
      // Move to next step after a short delay
      setTimeout(async () => {
        resetSetupForm();
        setSetupTesting(false);
        
        if (platformType === 'opencti') {
          setSetupStep('openaev');
        } else {
          setIsInSetupWizard(false);
          setSetupStep('welcome');
        }
      }, 1000);
      
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Connection failed');
      setSetupTesting(false);
    }
  }, [setupUrl, setupToken, setupName, setStatus, resetSetupForm]);

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

