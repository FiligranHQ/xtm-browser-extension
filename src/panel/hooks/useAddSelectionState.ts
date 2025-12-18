/**
 * Add Selection State Hook
 * 
 * Manages add selection (context menu "Add to OpenCTI") state for the panel.
 */

import { useState, useEffect, useCallback } from 'react';
import { detectObservableType } from '../../shared/detection/patterns';

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
  clearAddSelection: () => void;
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
      const detected = detectObservableType(addSelectionText);
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
    clearAddSelection,
  };
}
