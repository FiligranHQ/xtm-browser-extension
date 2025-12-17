/**
 * Add Selection State Hook
 * 
 * Manages add selection (context menu "Add to OpenCTI") state for the panel.
 */

import { useState, useEffect, useCallback } from 'react';

export interface AddSelectionStateReturn {
  // Selection text and type
  addSelectionText: string;
  setAddSelectionText: (text: string) => void;
  addSelectionEntityType: string;
  setAddSelectionEntityType: (type: string) => void;
  
  // State tracking
  addingSelection: boolean;
  setAddingSelection: (adding: boolean) => void;
  addSelectionFromContextMenu: boolean;
  setAddSelectionFromContextMenu: (from: boolean) => void;
  
  // Helper functions
  detectEntityType: (text: string) => string;
  clearAddSelection: () => void;
}

/**
 * Helper to detect entity type from text
 */
export function detectEntityType(text: string): string {
  const trimmed = text.trim();
  // IPv4
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) return 'IPv4-Addr';
  // IPv6 (simplified)
  if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(trimmed) || 
      /^([0-9a-fA-F]{1,4}:){1,7}:$/.test(trimmed) ||
      /^:(:([0-9a-fA-F]{1,4})){1,7}$/.test(trimmed) ||
      /^([0-9a-fA-F]{1,4}:)+(:([0-9a-fA-F]{1,4})){1,6}$/.test(trimmed)) return 'IPv6-Addr';
  // Domain
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(trimmed)) return 'Domain-Name';
  // URL
  if (/^https?:\/\//i.test(trimmed)) return 'Url';
  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Email-Addr';
  // CVE
  if (/^CVE-\d{4}-\d+$/i.test(trimmed)) return 'Vulnerability';
  // MD5
  if (/^[a-fA-F0-9]{32}$/.test(trimmed)) return 'StixFile';
  // SHA-1
  if (/^[a-fA-F0-9]{40}$/.test(trimmed)) return 'StixFile';
  // SHA-256
  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) return 'StixFile';
  // SHA-512
  if (/^[a-fA-F0-9]{128}$/.test(trimmed)) return 'StixFile';
  // MITRE ATT&CK
  if (/^T\d{4}(\.\d{3})?$/.test(trimmed)) return 'Attack-Pattern';
  // Default to unknown - user must select
  return '';
}

/**
 * Hook for managing add selection state
 */
export function useAddSelectionState(): AddSelectionStateReturn {
  const [addSelectionText, setAddSelectionText] = useState<string>('');
  const [addSelectionEntityType, setAddSelectionEntityType] = useState<string>('');
  const [addingSelection, setAddingSelection] = useState<boolean>(false);
  const [addSelectionFromContextMenu, setAddSelectionFromContextMenu] = useState<boolean>(false);
  
  // Auto-detect type when addSelectionText changes
  useEffect(() => {
    if (addSelectionText) {
      const detected = detectEntityType(addSelectionText);
      setAddSelectionEntityType(detected);
    }
  }, [addSelectionText]);
  
  // Clear add selection state
  const clearAddSelection = useCallback(() => {
    setAddSelectionText('');
    setAddSelectionEntityType('');
    setAddingSelection(false);
    setAddSelectionFromContextMenu(false);
  }, []);
  
  return {
    addSelectionText,
    setAddSelectionText,
    addSelectionEntityType,
    setAddSelectionEntityType,
    addingSelection,
    setAddingSelection,
    addSelectionFromContextMenu,
    setAddSelectionFromContextMenu,
    detectEntityType,
    clearAddSelection,
  };
}
