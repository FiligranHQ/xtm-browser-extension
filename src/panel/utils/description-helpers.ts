/**
 * Description Helper Functions
 * 
 * Utilities for generating and cleaning descriptions from HTML content.
 */

/**
 * Generate clean description from HTML
 * Removes non-content elements and extracts meaningful text
 */
export const generateDescription = (html: string, maxLength = 500): string => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove non-content elements aggressively
  const selectorsToRemove = [
    'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
    'nav', 'footer', 'header', 'aside', 'menu', 'menuitem',
    'form', 'input', 'button', 'select', 'textarea',
    'figure', 'figcaption', 'picture', 'video', 'audio', 'source', 'track',
    '[role="navigation"]', '[role="banner"]', '[role="complementary"]', '[role="contentinfo"]',
    '[role="search"]', '[role="form"]', '[role="menu"]', '[role="menubar"]',
    '.sidebar', '.navigation', '.menu', '.advertisement', '.ad', '.advert',
    '.share', '.social', '.comments', '.comment', '.related', '.recommended',
    '.newsletter', '.subscribe', '.popup', '.modal', '.cookie', '.banner',
    '[class*="share"]', '[class*="social"]', '[class*="comment"]', '[class*="sidebar"]',
    '[class*="advert"]', '[class*="cookie"]', '[class*="newsletter"]', '[class*="popup"]',
    '[id*="share"]', '[id*="social"]', '[id*="comment"]', '[id*="sidebar"]',
    '[id*="advert"]', '[id*="cookie"]', '[id*="newsletter"]', '[id*="popup"]',
  ];
  
  selectorsToRemove.forEach(selector => {
    try {
      temp.querySelectorAll(selector).forEach(el => el.remove());
    } catch { /* Skip invalid selectors */ }
  });
  
  // Get text content and clean it
  let text = temp.textContent || temp.innerText || '';
  
  // Clean up whitespace, tabs, and multiple newlines
  text = text
    .replace(/[\t\r]/g, ' ')           // Replace tabs/carriage returns with spaces
    .replace(/\n{3,}/g, '\n\n')        // Max 2 newlines in a row
    .replace(/[ ]{2,}/g, ' ')          // Max 1 space in a row
    .replace(/\n /g, '\n')             // Remove spaces after newlines
    .replace(/ \n/g, '\n')             // Remove spaces before newlines
    .trim();
  
  // Get first meaningful paragraph (skip very short lines)
  const lines = text.split('\n').filter(line => line.trim().length > 20);
  if (lines.length > 0) {
    text = lines.slice(0, 5).join(' ').replace(/\s+/g, ' ').trim();
  }
  
  // Truncate and add ellipsis
  if (text.length > maxLength) {
    // Try to cut at a sentence or word boundary
    let cutPoint = text.lastIndexOf('. ', maxLength);
    if (cutPoint < maxLength / 2) {
      cutPoint = text.lastIndexOf(' ', maxLength);
    }
    if (cutPoint < maxLength / 2) {
      cutPoint = maxLength;
    }
    text = text.substring(0, cutPoint).trim() + '...';
  }
  
  return text;
};

/**
 * Clean HTML content for content field - minimal cleaning to preserve article content
 * We intentionally do LIGHT cleaning to avoid breaking paywalled/restricted content
 */
export const cleanHtmlContent = (html: string): string => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove ONLY elements that are definitely not content
  // Be conservative - better to include too much than lose actual content
  const elementsToRemove = [
    // Scripts and styles (never content)
    'script', 'style', 'noscript',
    // Interactive elements that don't render as text
    'iframe', 'object', 'embed', 'applet',
    // Form elements
    'input', 'button', 'select', 'textarea',
    // Only remove clearly modal/overlay framework elements (exact class matches)
    '.MuiModal-root', '.MuiBackdrop-root', '.MuiDialog-root',
    '.ReactModal__Overlay', '.ReactModal__Content',
    // Hidden elements
    '[hidden]', '[aria-hidden="true"]',
  ];
  
  elementsToRemove.forEach(selector => {
    try {
      temp.querySelectorAll(selector).forEach(el => el.remove());
    } catch { /* Skip invalid selectors */ }
  });
  
  // Remove ONLY event handlers (keep styles - they may affect layout/images)
  temp.querySelectorAll('*').forEach(el => {
    // Remove event handlers only
    el.removeAttribute('onclick');
    el.removeAttribute('onload');
    el.removeAttribute('onerror');
    el.removeAttribute('onmouseover');
    el.removeAttribute('onmouseout');
    el.removeAttribute('onfocus');
    el.removeAttribute('onblur');
  });
  
  return temp.innerHTML;
};

