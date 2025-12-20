/**
 * Firefox WebExtensions API type declarations
 * Firefox uses the 'browser' namespace for its WebExtensions API
 * 
 * browser.sidebarAction is used in split screen mode to:
 * - Open the sidebar automatically when user triggers actions from popup
 * - Query sidebar state
 * 
 * These declarations cover the subset of APIs used by this extension.
 */

interface BrowserSidebarAction {
  open(): Promise<void>;
  close(): Promise<void>;
  toggle(): Promise<void>;
  isOpen(details?: { windowId?: number }): Promise<boolean>;
  setPanel(details: { panel: string; tabId?: number; windowId?: number }): Promise<void>;
  getPanel(details: { tabId?: number; windowId?: number }): Promise<string>;
  setTitle(details: { title: string; tabId?: number; windowId?: number }): Promise<void>;
  getTitle(details: { tabId?: number; windowId?: number }): Promise<string>;
  setIcon(details: { 
    imageData?: ImageData | { [size: number]: ImageData };
    path?: string | { [size: number]: string };
    tabId?: number;
    windowId?: number;
  }): Promise<void>;
}

interface BrowserNamespace {
  sidebarAction?: BrowserSidebarAction;
  // Add other Firefox-specific APIs as needed
}

declare const browser: BrowserNamespace | undefined;
