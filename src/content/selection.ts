/**
 * Content Script - Selection Management
 * 
 * Handles entity selection state for bulk operations.
 */

import { sendPanelMessage } from './panel';

/**
 * Selection state singleton
 */
const selectedForImport: Set<string> = new Set();

/**
 * Get current selection set (read-only access)
 */
export function getSelectedItems(): ReadonlySet<string> {
  return selectedForImport;
}

/**
 * Get selection as array
 */
export function getSelectedItemsArray(): string[] {
  return Array.from(selectedForImport);
}

/**
 * Get selection count
 */
export function getSelectionCount(): number {
  return selectedForImport.size;
}

/**
 * Check if item is selected
 */
export function isSelected(value: string): boolean {
  return selectedForImport.has(value);
}

/**
 * Clear all selections
 */
export function clearSelection(): void {
  selectedForImport.forEach(value => {
    document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
      el.classList.remove('xtm-selected');
    });
  });
  selectedForImport.clear();
}

/**
 * Notify listeners about selection change
 */
function notifySelectionChanged(): void {
  sendPanelMessage('SELECTION_UPDATED', {
    selectedCount: selectedForImport.size,
    selectedItems: Array.from(selectedForImport),
  });
  
  chrome.runtime.sendMessage({
    type: 'SELECTION_CHANGED',
    payload: {
      selectedCount: selectedForImport.size,
      selectedItems: Array.from(selectedForImport),
    },
  });
}

/**
 * Toggle selection for a value
 */
export function toggleSelection(_element: HTMLElement, value: string): void {
  if (selectedForImport.has(value)) {
    selectedForImport.delete(value);
    document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
      el.classList.remove('xtm-selected');
    });
  } else {
    selectedForImport.add(value);
    document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
      el.classList.add('xtm-selected');
    });
  }
  
  notifySelectionChanged();
}

/**
 * Handle toggle item selection from panel
 */
export function handleToggleItem(value: string): void {
  const highlightEl = document.querySelector(`.xtm-highlight[data-value="${CSS.escape(value)}"]`) as HTMLElement;
  if (highlightEl) {
    toggleSelection(highlightEl, value);
  } else {
    if (selectedForImport.has(value)) {
      selectedForImport.delete(value);
    } else {
      selectedForImport.add(value);
    }
    notifySelectionChanged();
  }
}

/**
 * Select multiple values
 */
export function handleSelectAll(values: string[]): void {
  values.forEach(value => {
    if (!selectedForImport.has(value)) {
      selectedForImport.add(value);
      document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
        el.classList.add('xtm-selected');
      });
    }
  });
  notifySelectionChanged();
}

/**
 * Deselect all
 */
export function handleDeselectAll(): void {
  selectedForImport.forEach(value => {
    document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
      el.classList.remove('xtm-selected');
    });
  });
  selectedForImport.clear();
  notifySelectionChanged();
}

/**
 * Deselect single item
 */
export function handleDeselectItem(value: string): void {
  selectedForImport.delete(value);
  document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
    el.classList.remove('xtm-selected');
  });
  notifySelectionChanged();
}

/**
 * Add item to selection without toggling
 */
export function addToSelection(value: string): void {
  if (!selectedForImport.has(value)) {
    selectedForImport.add(value);
    document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
      el.classList.add('xtm-selected');
    });
    notifySelectionChanged();
  }
}

/**
 * Remove item from selection
 */
export function removeFromSelection(value: string): void {
  if (selectedForImport.has(value)) {
    selectedForImport.delete(value);
    document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
      el.classList.remove('xtm-selected');
    });
    notifySelectionChanged();
  }
}
