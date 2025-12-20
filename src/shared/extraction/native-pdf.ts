/**
 * Native PDF Generation using Chrome DevTools Protocol
 * 
 * Uses the Debugger API to access Chrome's built-in print-to-PDF functionality.
 * This produces the highest quality PDFs, identical to "Print > Save as PDF".
 * 
 * Note: Requires "debugger" permission in manifest.json
 */

import { loggers } from '../utils/logger';

const log = loggers.extraction;

export interface NativePDFOptions {
  /** Display header and footer (default: false) */
  displayHeaderFooter?: boolean;
  /** Header HTML template */
  headerTemplate?: string;
  /** Footer HTML template */
  footerTemplate?: string;
  /** Print background graphics (default: true) */
  printBackground?: boolean;
  /** Paper width in inches (default: 8.27 for A4) */
  paperWidth?: number;
  /** Paper height in inches (default: 11.69 for A4) */
  paperHeight?: number;
  /** Top margin in inches */
  marginTop?: number;
  /** Bottom margin in inches */
  marginBottom?: number;
  /** Left margin in inches */
  marginLeft?: number;
  /** Right margin in inches */
  marginRight?: number;
  /** Scale (0.1 to 2.0, default: 1) */
  scale?: number;
  /** Prefer CSS page size (default: false) */
  preferCSSPageSize?: boolean;
}

const DEFAULT_OPTIONS: NativePDFOptions = {
  displayHeaderFooter: true,
  headerTemplate: `
    <div style="font-size: 9px; color: #888; width: 100%; padding: 5px 20px; display: flex; justify-content: space-between;">
      <span>Filigran XTM Browser Extension</span>
      <span class="date"></span>
    </div>
  `,
  footerTemplate: `
    <div style="font-size: 9px; color: #888; width: 100%; padding: 5px 20px; display: flex; justify-content: space-between;">
      <span class="url"></span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
  `,
  printBackground: true,
  paperWidth: 8.27, // A4
  paperHeight: 11.69,
  marginTop: 0.5,
  marginBottom: 0.5,
  marginLeft: 0.5,
  marginRight: 0.5,
  scale: 1,
  preferCSSPageSize: false,
};

/**
 * Generate PDF using Chrome's native print-to-PDF via Debugger API
 * This must be called from the background script.
 * 
 * @param tabId - The tab ID to capture
 * @param options - PDF generation options
 * @returns Base64 encoded PDF data, or null on failure
 */
export async function generateNativePDF(
  tabId: number,
  options: NativePDFOptions = {}
): Promise<string | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const target = { tabId };
  
  try {
    // Attach debugger to the tab
    await attachDebugger(target);
    log.debug('[NativePDF] Debugger attached to tab:', tabId);
    
    // Wait a moment for any dynamic content to settle
    await sleep(100);
    
    // Generate PDF using Page.printToPDF
    const pdfParams = {
      displayHeaderFooter: opts.displayHeaderFooter,
      headerTemplate: opts.headerTemplate,
      footerTemplate: opts.footerTemplate,
      printBackground: opts.printBackground,
      paperWidth: opts.paperWidth,
      paperHeight: opts.paperHeight,
      marginTop: opts.marginTop,
      marginBottom: opts.marginBottom,
      marginLeft: opts.marginLeft,
      marginRight: opts.marginRight,
      scale: opts.scale,
      preferCSSPageSize: opts.preferCSSPageSize,
      // Use print media type for cleaner output
      transferMode: 'ReturnAsBase64',
    };
    
    log.debug('[NativePDF] Generating PDF with params:', pdfParams);
    
    const result = await sendDebuggerCommand(target, 'Page.printToPDF', pdfParams) as { data?: string } | undefined;
    
    if (!result || !result.data) {
      log.error('[NativePDF] No PDF data returned');
      return null;
    }
    
    log.debug('[NativePDF] PDF generated successfully, size:', result.data.length);
    return result.data;
  } catch (error) {
    log.error('[NativePDF] Failed to generate PDF:', error);
    return null;
  } finally {
    // Always detach debugger
    try {
      await detachDebugger(target);
      log.debug('[NativePDF] Debugger detached');
    } catch (detachError) {
      // Ignore detach errors (tab might be closed)
      log.debug('[NativePDF] Debugger detach failed (expected if tab closed):', detachError);
    }
  }
}

/**
 * Generate PDF from a reader-view HTML blob
 * First loads the HTML in a hidden tab, then prints it
 */
export async function generatePDFFromHtml(
  htmlContent: string,
  options: NativePDFOptions = {}
): Promise<string | null> {
  let tabId: number | undefined;
  
  try {
    // Create a blob URL for the HTML content
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    
    // Create a hidden tab with the content
    const tab = await chrome.tabs.create({
      url: blobUrl,
      active: false,
    });
    
    if (!tab.id) {
      log.error('[NativePDF] Failed to create tab');
      return null;
    }
    
    tabId = tab.id;
    
    // Wait for tab to load
    await waitForTabLoad(tabId);
    
    // Generate PDF from the tab
    const pdfData = await generateNativePDF(tabId, {
      ...options,
      // Override for clean reader view output
      displayHeaderFooter: false,
      marginTop: 0.75,
      marginBottom: 0.75,
    });
    
    // Clean up blob URL
    URL.revokeObjectURL(blobUrl);
    
    return pdfData;
  } catch (error) {
    log.error('[NativePDF] Failed to generate PDF from HTML:', error);
    return null;
  } finally {
    // Close the temporary tab
    if (tabId) {
      try {
        await chrome.tabs.remove(tabId);
      } catch { /* Tab might already be closed */ }
    }
  }
}

/**
 * Check if native PDF generation is available
 * (requires debugger permission)
 */
export function isNativePDFAvailable(): boolean {
  return typeof chrome !== 'undefined' && 
         typeof chrome.debugger !== 'undefined' &&
         typeof chrome.debugger.attach === 'function';
}

// === Helper Functions ===

function attachDebugger(target: chrome.debugger.Debuggee): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach(target, '1.3', () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

function detachDebugger(target: chrome.debugger.Debuggee): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.debugger.detach(target, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

function sendDebuggerCommand(
  target: chrome.debugger.Debuggee,
  method: string,
  params?: Record<string, unknown>
): Promise<Record<string, unknown> | undefined> {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result as Record<string, unknown> | undefined);
      }
    });
  });
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const checkTab = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          resolve();
        } else {
          setTimeout(checkTab, 100);
        }
      } catch {
        resolve(); // Tab might be gone
      }
    };
    checkTab();
    
    // Timeout after 10 seconds
    setTimeout(resolve, 10000);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

