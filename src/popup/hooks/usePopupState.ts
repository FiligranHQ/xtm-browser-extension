/**
 * usePopupState Hook
 * 
 * Centralized state management for the popup component
 */

import { useState } from 'react';
import type { ConnectionStatus, SetupStep } from '../types';

/**
 * Popup state interface
 */
export interface PopupState {
  // Theme
  mode: 'dark' | 'light';
  setMode: React.Dispatch<React.SetStateAction<'dark' | 'light'>>;
  
  // Platform connection status
  status: ConnectionStatus;
  setStatus: React.Dispatch<React.SetStateAction<ConnectionStatus>>;
  
  // Popover
  popoverAnchor: HTMLElement | null;
  setPopoverAnchor: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
  
  // Setup wizard
  setupStep: SetupStep;
  setSetupStep: React.Dispatch<React.SetStateAction<SetupStep>>;
  isInSetupWizard: boolean;
  setIsInSetupWizard: React.Dispatch<React.SetStateAction<boolean>>;
  setupUrl: string;
  setSetupUrl: React.Dispatch<React.SetStateAction<string>>;
  setupToken: string;
  setSetupToken: React.Dispatch<React.SetStateAction<string>>;
  setupName: string;
  setSetupName: React.Dispatch<React.SetStateAction<string>>;
  showSetupToken: boolean;
  setShowSetupToken: React.Dispatch<React.SetStateAction<boolean>>;
  setupTesting: boolean;
  setSetupTesting: React.Dispatch<React.SetStateAction<boolean>>;
  setupError: string | null;
  setSetupError: React.Dispatch<React.SetStateAction<string | null>>;
  setupSuccess: boolean;
  setSetupSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  
  // AI and EE state
  aiConfigured: boolean;
  setAiConfigured: React.Dispatch<React.SetStateAction<boolean>>;
  showEETrialDialog: boolean;
  setShowEETrialDialog: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Custom hook for popup state management
 */
export function usePopupState(): PopupState {
  // Theme
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  
  // Platform connection status
  const [status, setStatus] = useState<ConnectionStatus>({
    opencti: [],
    openaev: [],
  });
  
  // Popover
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  
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
  
  // AI and EE state
  const [aiConfigured, setAiConfigured] = useState(false);
  const [showEETrialDialog, setShowEETrialDialog] = useState(false);
  
  return {
    mode,
    setMode,
    status,
    setStatus,
    popoverAnchor,
    setPopoverAnchor,
    setupStep,
    setSetupStep,
    isInSetupWizard,
    setIsInSetupWizard,
    setupUrl,
    setSetupUrl,
    setupToken,
    setSetupToken,
    setupName,
    setSetupName,
    showSetupToken,
    setShowSetupToken,
    setupTesting,
    setSetupTesting,
    setupError,
    setSetupError,
    setupSuccess,
    setSetupSuccess,
    aiConfigured,
    setAiConfigured,
    showEETrialDialog,
    setShowEETrialDialog,
  };
}

