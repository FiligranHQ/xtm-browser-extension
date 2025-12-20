/**
 * Content Extraction Utilities
 * Functions for extracting clean content from web pages for scanning and PDF generation.
 */

import { loggers } from '../shared/utils/logger';
import { 
  extractContent, 
  type ExtractedContent 
} from '../shared/extraction/content-extractor';
import { generatePDF } from '../shared/extraction/pdf-generator';
import { jsPDF } from 'jspdf';

const log = loggers.content;

// ============================================================================
// Article Extraction
// ============================================================================

/**
 * Extract clean article content using the enhanced extraction module
 * This extracts just the main article content, removing menus, sidebars, etc.
 */
export function extractArticleContent(): { 
  title: string; 
  content: string; 
  textContent: string; 
  excerpt: string; 
  byline: string;
} {
  try {
    const extracted = extractContent();
    
    log.debug(' Enhanced extraction complete:', extracted.title, 'text length:', extracted.textContent.length, 'images:', extracted.images.length);
    
    return {
      title: extracted.title || document.title,
      content: extracted.content,
      textContent: extracted.textContent,
      excerpt: extracted.excerpt,
      byline: extracted.byline,
    };
  } catch (error) {
    log.warn(' Failed to extract article with enhanced extractor:', error);
  }
  
  // Fallback: return basic cleaned content
  log.debug(' Using fallback content extraction');
  return {
    title: document.title,
    content: getFallbackContent(),
    textContent: getFallbackTextContent(),
    excerpt: '',
    byline: '',
  };
}

/**
 * Get full extracted content with all metadata (for PDF generation)
 */
export function getFullExtractedContent(): ExtractedContent {
  return extractContent();
}

/**
 * Fallback content extraction when Readability fails - returns HTML
 */
function getFallbackContent(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  
  // Comprehensive list of elements to remove
  const selectorsToRemove = [
    'script', 'style', 'noscript', 'iframe', 'svg', 'canvas', 'video', 'audio',
    'object', 'embed', 'applet', 'form', 'input', 'button', 'select', 'textarea',
    'nav', 'header', 'footer', 'aside', 'menu', 'menuitem',
    '[class*="overlay"]', '[class*="modal"]', '[class*="popup"]', '[class*="dialog"]',
    '[class*="lightbox"]', '[class*="drawer"]', '[class*="sheet"]', '[class*="backdrop"]',
    '[id*="overlay"]', '[id*="modal"]', '[id*="popup"]', '[id*="dialog"]',
    '[class*="cookie"]', '[class*="consent"]', '[class*="gdpr"]', '[class*="privacy-"]',
    '[class*="banner"]', '[class*="notice"]', '[class*="alert"]',
    '[id*="cookie"]', '[id*="consent"]', '[id*="gdpr"]', '[id*="banner"]',
    '[class*="sticky"]', '[class*="fixed"]', '[class*="floating"]',
    '[class*="toolbar"]', '[class*="toast"]', '[class*="snackbar"]',
    '[class*="ad-"]', '[class*="advert"]', '[class*="advertisement"]', '[class*="sponsor"]',
    '[class*="promo"]', '[class*="promotion"]', '[class*="cta"]',
    '[id*="ad-"]', '[id*="advert"]', '[id*="sponsor"]',
    '[class*="share"]', '[class*="social"]', '[class*="follow"]', '[class*="like"]',
    '[class*="comment"]', '[class*="related"]', '[class*="recommended"]', '[class*="suggested"]',
    '[class*="sidebar"]', '[class*="widget"]',
    '[class*="newsletter"]', '[class*="subscribe"]', '[class*="signup"]', '[class*="login"]',
    '[class*="paywall"]', '[class*="subscription"]', '[class*="premium"]',
    '[class*="breadcrumb"]', '[class*="pagination"]', '[class*="nav-"]', '[class*="menu-"]',
    '[role="navigation"]', '[role="banner"]', '[role="complementary"]', '[role="contentinfo"]',
    '[role="search"]', '[role="form"]', '[role="menu"]', '[role="menubar"]', '[role="dialog"]',
    '[role="alertdialog"]', '[role="tooltip"]', '[role="status"]', '[role="alert"]',
    '[hidden]', '[aria-hidden="true"]',
    '.MuiModal-root', '.MuiBackdrop-root', '.MuiDialog-root', '.MuiDrawer-root',
    '.chakra-modal', '.chakra-overlay', '.ant-modal', '.ant-drawer',
    '.ReactModal__Overlay', '.ReactModal__Content',
  ];
  
  selectorsToRemove.forEach(selector => {
    try {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    } catch { /* Skip invalid selectors */ }
  });
  
  // Remove elements with fixed/absolute positioning (likely overlays)
  clone.querySelectorAll('*').forEach(el => {
    const style = (el as HTMLElement).style;
    if (style) {
      const position = style.position;
      if (position === 'fixed' || position === 'sticky') {
        el.remove();
        return;
      }
    }
    try {
      const computed = window.getComputedStyle(el as HTMLElement);
      if (computed.position === 'fixed' || computed.position === 'sticky') {
        el.remove();
        return;
      }
      const zIndex = parseInt(computed.zIndex);
      if (!isNaN(zIndex) && zIndex > 9000) {
        el.remove();
        return;
      }
    } catch { /* Skip if computed style fails */ }
  });
  
  // Clean attributes
  clone.querySelectorAll('*').forEach(el => {
    el.removeAttribute('style');
    el.removeAttribute('onclick');
    el.removeAttribute('onload');
    el.removeAttribute('onerror');
    el.removeAttribute('onmouseover');
    el.removeAttribute('onmouseout');
    el.removeAttribute('onfocus');
    el.removeAttribute('onblur');
    el.removeAttribute('data-scroll-lock');
    el.removeAttribute('data-overlay');
    el.removeAttribute('data-modal');
  });
  
  // Remove empty wrapper elements
  clone.querySelectorAll('div, span').forEach(el => {
    const hasText = el.textContent?.trim();
    const hasContent = el.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, li, table, img, figure, blockquote, pre, code, a');
    if (!hasText && !hasContent) {
      el.remove();
    }
  });
  
  return clone.innerHTML;
}

/**
 * Fallback text content extraction - returns clean text
 */
function getFallbackTextContent(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  
  const selectorsToRemove = [
    'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
    'nav', 'header', 'footer', 'aside', 'menu',
    '.sidebar', '.navigation', '.menu', '.advertisement', '.ad', '.advert',
    '.share', '.social', '.comments', '.related', '.recommended',
    '.newsletter', '.subscribe', '.popup', '.modal', '.cookie', '.banner',
    '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
    '[role="search"]', '[role="form"]', '[role="menu"]',
  ];
  
  selectorsToRemove.forEach(selector => {
    try {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    } catch { /* Skip invalid selectors */ }
  });
  
  let text = clone.textContent || clone.innerText || '';
  text = text
    .replace(/[\t\r]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
  
  return cleanArticleText(text);
}

/**
 * Clean article text by removing paywall/subscription messages and other boilerplate
 */
export function cleanArticleText(text: string): string {
  if (!text) return '';
  
  const patternsToRemove = [
    // French patterns
    /Cet article (vous est offert|est réservé|est accessible)[^.]*\./gi,
    /Pour lire gratuitement[^.]*\./gi,
    /connectez-vous/gi,
    /Se connecter/gi,
    /Vous n['']êtes pas inscrit[^.]*\./gi,
    /Inscrivez-vous gratuitement/gi,
    /réservé aux abonnés/gi,
    /Abonnez-vous/gi,
    /article réservé/gi,
    /Accédez à l['']intégralité[^.]*\./gi,
    /Offre spéciale[^.]*\./gi,
    /Profitez de[^.]*abonnement[^.]*\./gi,
    /Découvrez nos offres/gi,
    /S['']abonner/gi,
    /Déjà abonné \?/gi,
    /Pour soutenir[^.]*journalisme[^.]*\./gi,
    // English patterns
    /This article is for subscribers/gi,
    /Subscribe to continue reading/gi,
    /Already a subscriber\?/gi,
    /Sign in to read/gi,
    /Create a free account/gi,
    /Subscribe now/gi,
    /Members only/gi,
    /Premium content/gi,
    /Unlock this article/gi,
    /Get unlimited access/gi,
    /Start your free trial/gi,
    /Register for free/gi,
    /Continue reading with a subscription/gi,
    /You['']ve reached your limit of free articles/gi,
    /This is a subscriber-only story/gi,
    // German patterns
    /Dieser Artikel ist nur für Abonnenten/gi,
    /Jetzt abonnieren/gi,
    /Zum Weiterlesen/gi,
    // Spanish patterns
    /Este artículo es solo para suscriptores/gi,
    /Suscríbete/gi,
    // UI elements
    /Share this article/gi,
    /Partager cet article/gi,
    /Newsletter/gi,
    /Suivez-nous/gi,
    /Follow us/gi,
    /More stories/gi,
    /Related articles/gi,
    /Lire aussi/gi,
    /Read more/gi,
    /À lire aussi/gi,
    /Sur le même sujet/gi,
    // Navigation elements
    /Économie\s+Économie/gi,
    /Politique\s+Politique/gi,
    /International\s+International/gi,
    /Culture\s+Culture/gi,
    /Sport\s+Sport/gi,
    /Sciences\s+Sciences/gi,
    // Social media
    /Share on Facebook/gi,
    /Share on Twitter/gi,
    /Share on LinkedIn/gi,
    /Partager sur Facebook/gi,
    /Partager sur Twitter/gi,
    // Cookie/GDPR
    /Nous utilisons des cookies/gi,
    /We use cookies/gi,
    /Accepter et continuer/gi,
    /Accept and continue/gi,
  ];
  
  let cleanedText = text;
  
  for (const pattern of patternsToRemove) {
    cleanedText = cleanedText.replace(pattern, '');
  }
  
  cleanedText = cleanedText
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^\s+/gm, '')
    .replace(/\s+$/gm, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
  
  return cleanedText;
}

/**
 * Extract the first meaningful paragraph from article text for description
 */
export function extractFirstParagraph(textContent: string, maxLength = 500): string {
  if (!textContent) return '';
  
  const cleanedContent = cleanArticleText(textContent);
  
  const paragraphs = cleanedContent
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => {
      if (p.length < 80) return false;
      if (/^(économie|politique|international|culture|sport|sciences|société|monde|france|europe|opinion|idées|environnement|planète|afrique|amérique|asie|style|immobilier|emploi|argent)\b/i.test(p)) {
        return false;
      }
      const words = p.split(/\s+/);
      const capitalizedWords = words.filter(w => w.length > 1 && w === w.toUpperCase());
      if (capitalizedWords.length > words.length * 0.5) {
        return false;
      }
      if (/^(publié|published|par |by |le \d|on \d|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i.test(p)) {
        return false;
      }
      return true;
    });
  
  if (paragraphs.length === 0) {
    const text = cleanedContent.replace(/\s+/g, ' ').trim();
    if (text.length < 80) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
  
  let description = paragraphs[0];
  
  if (description.length < 200 && paragraphs.length > 1) {
    description = paragraphs.slice(0, 2).join(' ');
  }
  
  if (description.length > maxLength) {
    let cutPoint = description.lastIndexOf('. ', maxLength);
    if (cutPoint < maxLength / 2) {
      cutPoint = description.lastIndexOf(' ', maxLength);
    }
    if (cutPoint < maxLength / 2) {
      cutPoint = maxLength;
    }
    description = description.substring(0, cutPoint).trim() + '...';
  }
  
  return description;
}

// ============================================================================
// SPA/Shadow DOM Content Extraction
// ============================================================================

/**
 * Check if an element is truly visible on the page
 */
function isElementVisible(el: Element): boolean {
  const htmlEl = el as HTMLElement;
  
  // Check if element has dimensions
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }
  
  // Check computed styles
  try {
    const style = window.getComputedStyle(htmlEl);
    if (style.display === 'none' || 
        style.visibility === 'hidden' || 
        style.opacity === '0') {
      return false;
    }
  } catch {
    // If we can't get computed style, assume visible
  }
  
  // Check for hidden attribute
  if (htmlEl.hidden) {
    return false;
  }
  
  // Check aria-hidden
  if (htmlEl.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  
  return true;
}

/**
 * Tags that should be excluded from text extraction
 */
const EXCLUDED_TAGS = new Set([
  'script', 'style', 'noscript', 'template', 
  'video', 'audio', 'link', 'meta',
  'head', 'br', 'hr', 'img',
]);

/**
 * Extract text content from Shadow DOM elements (recursive)
 * Only extracts from visible elements
 */
export function extractTextFromShadowDOM(root: Document | ShadowRoot | Element): string {
  const textParts: string[] = [];
  
  const elements = root.querySelectorAll('*');
  
  elements.forEach(el => {
    // Only process if the host element is visible
    if (!isElementVisible(el)) {
      return;
    }
    
    if (el.shadowRoot) {
      // Get visible text from shadow root
      const visibleText = getVisibleTextFromNode(el.shadowRoot);
      if (visibleText.trim()) {
        textParts.push(visibleText);
      }
      // Recursively check nested shadow roots
      const nestedText = extractTextFromShadowDOM(el.shadowRoot);
      if (nestedText.trim()) {
        textParts.push(nestedText);
      }
    }
  });
  
  return textParts.join(' ');
}

/**
 * Recursively extract visible text from a node
 */
function getVisibleTextFromNode(node: Node): string {
  // Text node - return the text
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.trim() || '';
  }
  
  // Not an element node - skip
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  
  const el = node as Element;
  const tagName = el.tagName?.toLowerCase();
  
  // Skip excluded tags
  if (tagName && EXCLUDED_TAGS.has(tagName)) {
    return '';
  }
  
  // Skip invisible elements
  if (!isElementVisible(el)) {
    return '';
  }
  
  // Collect text from child nodes
  const textParts: string[] = [];
  for (const child of Array.from(node.childNodes)) {
    const text = getVisibleTextFromNode(child);
    if (text) {
      textParts.push(text);
    }
  }
  
  return textParts.join(' ');
}

/**
 * Get clean visible text content from the page
 * Only extracts text that is actually visible to the user
 */
export function getCleanVisibleText(): string {
  // Walk the actual DOM and collect only visible text
  const textParts: string[] = [];
  
  function walkNode(node: Node): void {
    // Text node - check if parent is visible
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text && node.parentElement && isElementVisible(node.parentElement)) {
        textParts.push(text);
      }
      return;
    }
    
    // Not an element - skip
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    
    const el = node as Element;
    const tagName = el.tagName?.toLowerCase();
    
    // Skip excluded tags entirely
    if (tagName && EXCLUDED_TAGS.has(tagName)) {
      return;
    }
    
    // Skip invisible elements and their children
    if (!isElementVisible(el)) {
      return;
    }
    
    // Recurse into children
    for (const child of Array.from(node.childNodes)) {
      walkNode(child);
    }
  }
  
  // Start walking from body
  if (document.body) {
    walkNode(document.body);
  }
  
  let text = textParts.join(' ');
  
  // Clean up the text
  text = text
    .replace(/[\t\r]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
  
  return text;
}

/**
 * Minimum content length to consider innerText as "good enough"
 * Only use Shadow DOM extraction if innerText is nearly empty
 * This is a very conservative threshold - only sites like VirusTotal
 * that render entirely in Shadow DOM will trigger this
 */
const MIN_CONTENT_LENGTH_FOR_SHADOW_DOM = 50;

/**
 * Extract text from Shadow DOM for sites that use Web Components heavily
 * Recursively traverses all nested Shadow DOM trees
 * Only extracts visible text, excluding script, style, and other non-visible elements
 */
function extractTextFromShadowRootsOnly(): string {
  const textParts: string[] = [];
  const visitedRoots = new Set<ShadowRoot>();
  
  // Tags to skip when extracting text from Shadow DOM
  const SHADOW_EXCLUDED_TAGS = new Set([
    'script', 'style', 'noscript', 'template', 
    'video', 'audio', 'link', 'meta',
    'head', 'br', 'hr', 'img', 'svg',
  ]);
  
  // Extract visible text from a node, excluding non-visible elements
  function getVisibleText(node: Node): string {
    // Text node - return the text
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent?.trim() || '';
    }
    
    // Not an element node - skip
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    
    const el = node as Element;
    const tagName = el.tagName?.toLowerCase();
    
    // Skip excluded tags (script, style, etc.)
    if (tagName && SHADOW_EXCLUDED_TAGS.has(tagName)) {
      return '';
    }
    
    // Skip elements with type="text/javascript" or similar
    if (el.getAttribute('type')?.includes('javascript')) {
      return '';
    }
    
    // Skip hidden elements
    if ((el as HTMLElement).hidden || el.getAttribute('aria-hidden') === 'true') {
      return '';
    }
    
    // Collect text from child nodes
    const childTexts: string[] = [];
    for (const child of Array.from(node.childNodes)) {
      const text = getVisibleText(child);
      if (text) {
        childTexts.push(text);
      }
    }
    
    return childTexts.join(' ');
  }
  
  // Recursive function to extract text from a shadow root and its nested shadow roots
  function extractFromShadowRoot(shadowRoot: ShadowRoot): void {
    if (visitedRoots.has(shadowRoot)) return;
    visitedRoots.add(shadowRoot);
    
    // Get visible text content from this shadow root (filtering out script/style)
    const shadowText = getVisibleText(shadowRoot);
    if (shadowText.trim()) {
      textParts.push(shadowText);
    }
    
    // Find all elements inside this shadow root that might have their own shadow roots
    shadowRoot.querySelectorAll('*').forEach(el => {
      if (el.shadowRoot) {
        extractFromShadowRoot(el.shadowRoot);
      }
    });
  }
  
  // Start by finding all elements in the main DOM that have shadow roots
  document.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot) {
      extractFromShadowRoot(el.shadowRoot);
    }
  });
  
  return textParts.join(' ');
}

/**
 * Aggressively filter content to remove noise URLs and non-IOC patterns
 */
function filterContentAggressively(content: string): string {
  let filtered = content;
  
  // ============================================================================
  // URL Filtering - Remove common non-IOC URLs
  // ============================================================================
  
  // Remove all URLs from common domains that are never IOCs
  const nonIOCDomains = [
    'googleapis', 'gstatic', 'google\\.com', 'googleusercontent',
    'cloudflare', 'cloudflareinsights',
    'jsdelivr', 'unpkg', 'cdnjs', 'npmjs',
    'w3\\.org', 'schema\\.org',
    'getbootstrap', 'bootstrap',
    'github\\.com', 'githubusercontent',
    'gitlab\\.com',
    'stackoverflow\\.com',
    'virustotal\\.com', // The VT site itself is not an IOC
    'bazaar\\.abuse\\.ch', // Malware bazaar links are not IOCs themselves
    'tria\\.ge',
    'neiki\\.dev',
    'jaffacakes118\\.dev',
    'brighttalk\\.com',
    'fontawesome', 'fonts\\.googleapis',
    'jquery', 'reactjs', 'vuejs', 'angular',
    'twitter\\.com', 'x\\.com', 'facebook\\.com', 'linkedin\\.com',
    'youtube\\.com', 'instagram\\.com',
    'amazon\\.com', 'amazonaws\\.com', 'aws\\.amazon',
    'microsoft\\.com', 'azure\\.com', 'office\\.com',
    'apple\\.com', 'icloud\\.com',
    'slack\\.com', 'discord\\.com', 'telegram\\.org',
    'wikipedia\\.org', 'wikimedia\\.org',
    'archive\\.org', 'web\\.archive\\.org',
  ];
  const nonIOCPattern = new RegExp(
    `https?://[^\\s"'<>)]*(?:${nonIOCDomains.join('|')})[^\\s"'<>)]*`,
    'gi'
  );
  filtered = filtered.replace(nonIOCPattern, ' ');
  
  // Remove relative URLs and fragments
  filtered = filtered.replace(/\/gui\/[^\s"'<>)]+/gi, ' ');
  filtered = filtered.replace(/#[a-zA-Z][\w-]*/g, ' ');
  
  // Remove font file URLs
  filtered = filtered.replace(/https?:\/\/[^\s"'<>)]+\.(woff2?|ttf|eot|otf|svg)(\?[^\s"'<>)]*)?/gi, ' ');
  
  // Remove image URLs
  filtered = filtered.replace(/https?:\/\/[^\s"'<>)]+\.(png|jpg|jpeg|gif|webp|ico|bmp)(\?[^\s"'<>)]*)?/gi, ' ');
  
  // Remove CSS/JS asset URLs
  filtered = filtered.replace(/https?:\/\/[^\s"'<>)]+\.(css|js|mjs)(\?[^\s"'<>)]*)?/gi, ' ');
  
  // Remove data: URLs
  filtered = filtered.replace(/data:[^\s"'<>)]+/gi, ' ');
  
  // Remove blob: URLs
  filtered = filtered.replace(/blob:[^\s"'<>)]+/gi, ' ');
  
  // Remove mailto: and tel: links
  filtered = filtered.replace(/mailto:[^\s"'<>)]+/gi, ' ');
  filtered = filtered.replace(/tel:[^\s"'<>)]+/gi, ' ');
  
  // Remove javascript: pseudo-URLs
  filtered = filtered.replace(/javascript:[^\s"'<>)]+/gi, ' ');
  
  // ============================================================================
  // CSS/UI Pattern Filtering
  // ============================================================================
  
  // CSS class selectors (e.g., "form-control.is", "select.is-valid")
  filtered = filtered.replace(/\b[\w-]+(?:\.[\w-]+)*\.is(?:-[\w-]+)?\b/g, ' ');
  
  // CSS class chains (e.g., "input.form-control.is-valid")
  filtered = filtered.replace(/\b(?:input|textarea|select|button|div|span|form|a|label|ul|ol|li|table|tr|td|th|img|p|h[1-6])\.[\w.-]+/gi, ' ');
  
  // CSS pseudo-selectors (e.g., "::before", ":hover")
  filtered = filtered.replace(/\b[a-z]{1,10}::/gi, ' ');
  filtered = filtered.replace(/::[a-z-]+/gi, ' ');
  filtered = filtered.replace(/:[a-z-]+(?:\([^)]*\))?/gi, ' ');
  
  // URL-encoded fragments (e.g., "2Fwww.w3.org")
  filtered = filtered.replace(/[0-9][A-F][a-zA-Z0-9./-]+/g, ' ');
  
  // SVG path data
  filtered = filtered.replace(/\bd="[^"]+"/gi, ' ');
  filtered = filtered.replace(/\bM\d+[\s\d.LlHhVvCcSsQqTtAaZz,-]+/g, ' ');
  
  // Common UI text that's not useful
  filtered = filtered.replace(/\b(Sign in|Sign up|Log in|Log out|Subscribe|Close|Cancel|Submit|Search|Loading|More|Less|Show|Hide|View|Edit|Delete|Save|Copy|Share|Download|Upload|Next|Previous|Back|Forward|Home|Menu|Settings|Help|About|Contact|Privacy|Terms|Cookie|Accept|Decline|Dismiss|Read more|Learn more|See more|Click here|Get started)\b/gi, ' ');
  
  // ============================================================================
  // Final Cleanup
  // ============================================================================
  
  filtered = filtered
    .replace(/[\t\r]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
  
  return filtered;
}

/**
 * Collect text content from hidden elements to filter out later
 * This includes tooltips and screen-reader-only elements (like "Skip to content")
 */
function getHiddenTexts(): Set<string> {
  const hiddenTexts = new Set<string>();
  
  // Selectors for tooltips
  const tooltipSelectors = [
    '[role="tooltip"]',
    '[data-tooltip]',
    '.tooltip',
    '.popover',
    '[class*="tooltip"]',
    '[class*="popover"]',
  ];
  
  // Selectors for screen-reader-only / visually hidden elements
  // These are hidden visually but innerText still picks them up
  const srOnlySelectors = [
    '.sr-only',
    '.visually-hidden',
    '.screen-reader-text',
    '.screen-reader-only',
    '.skip-link',
    '.skip-to-content',
    '[class*="sr-only"]',
    '[class*="visually-hidden"]',
    '[class*="ScreenReader"]',
    // GitHub and common skip links
    '[class*="skip-to"]',
    '[class*="js-skip"]',
    '.js-skip-to-content',
    'a[href="#content"]',
    'a[href="#main-content"]',
    'a[href="#start-of-content"]',
    'a[href^="#"][class*="skip"]',
  ];
  
  const allSelectors = [...tooltipSelectors, ...srOnlySelectors];
  
  allSelectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => {
        const text = (el as HTMLElement).innerText?.trim();
        if (text && text.length > 2) { // Only filter meaningful text
          hiddenTexts.add(text);
        }
      });
    } catch { /* Skip invalid selectors */ }
  });
  
  return hiddenTexts;
}

/**
 * Get page content for scanning - extracts visible text for IOC/entity scanning
 * 
 * IMPORTANT: We prioritize innerText because it only returns visible text
 * and excludes script/style content. Shadow DOM extraction is ONLY used
 * as a last resort for sites like VirusTotal that render entirely in Shadow DOM.
 * 
 * Tooltip content is filtered out from the extracted text.
 */
export function getPageContentForScanning(): string {
  // Collect hidden texts to filter out (tooltips, screen-reader-only elements)
  const hiddenTexts = getHiddenTexts();
  
  // Add common skip link texts that are often hidden but picked up by innerText
  const commonSkipTexts = [
    'Skip to content',
    'Skip to main content',
    'Skip navigation',
    'Skip to navigation',
    'Jump to content',
    'Jump to main content',
  ];
  commonSkipTexts.forEach(text => hiddenTexts.add(text));
  
  // Get visible text using innerText (respects visibility, excludes script/style)
  let content = document.body?.innerText || '';
  
  // Remove hidden text from content
  hiddenTexts.forEach(hiddenText => {
    // Replace all occurrences of the hidden text
    content = content.split(hiddenText).join('');
  });
  
  // Only try Shadow DOM extraction if innerText is nearly empty
  // This handles sites like VirusTotal that render entirely in Shadow DOM
  // We use a very low threshold to avoid false positives on normal sites
  if (content.length < MIN_CONTENT_LENGTH_FOR_SHADOW_DOM) {
    const shadowContent = extractTextFromShadowRootsOnly();
    if (shadowContent.length > content.length) {
      // Shadow DOM has more content, use it (but still filter it)
      return filterContentAggressively(shadowContent);
    }
  }
  
  // Apply aggressive filtering to remove noise
  return filterContentAggressively(content);
}

// ============================================================================
// PDF Generation
// ============================================================================

/**
 * Generate PDF from article content using enhanced extraction
 */
export async function generateArticlePDF(): Promise<{ data: string; filename: string } | null> {
  try {
    const extractedContent = getFullExtractedContent();
    
    if (!extractedContent.content && !extractedContent.textContent) {
      log.warn(' No article content to generate PDF');
      return null;
    }
    
    log.debug(' Starting enhanced PDF generation, title:', extractedContent.title, 'images:', extractedContent.images.length);
    
    const result = await generatePDF(extractedContent, {
      includeImages: true,
      paperSize: 'a4',
      headerText: 'Filigran XTM Browser Extension',
    });
    
    if (result) {
      log.debug(' Enhanced PDF generated successfully, method:', result.method, 'size:', result.data.length);
      return {
        data: result.data,
        filename: result.filename,
      };
    }
    
    log.warn(' Enhanced PDF generation failed, falling back to basic method');
    return generateFallbackPDF(extractedContent);
  } catch (error) {
    log.error(' Failed to generate PDF:', error);
    return generateSimpleTextPDF();
  }
}

/**
 * Load image and convert to base64 data URL for PDF embedding
 */
async function loadImageAsBase64(imgElement: HTMLImageElement): Promise<{ data: string; width: number; height: number } | null> {
  try {
    let src = imgElement.src || imgElement.dataset.src || imgElement.getAttribute('data-lazy-src') || '';
    
    if (!src || src.startsWith('data:image/svg') || src.includes('placeholder') || src.includes('1x1')) {
      return null;
    }
    
    if (src.startsWith('/')) {
      src = window.location.origin + src;
    } else if (!src.startsWith('http') && !src.startsWith('data:')) {
      src = new URL(src, window.location.href).href;
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    return new Promise((resolve) => {
      img.onload = () => {
        const maxWidth = 800;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        if (width < 50 || height < 50) {
          resolve(null);
          return;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve({ data: dataUrl, width, height });
        } catch {
          resolve(null);
        }
      };
      
      img.onerror = () => resolve(null);
      setTimeout(() => resolve(null), 3000);
      img.src = src;
    });
  } catch {
    return null;
  }
}

/**
 * Fallback PDF generation when enhanced method fails
 */
async function generateFallbackPDF(article: { title: string; content: string; textContent: string }): Promise<{ data: string; filename: string } | null> {
  try {
    log.debug(' Starting fallback PDF generation, article title:', article.title);
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    const lineHeight = 5;
    let yPosition = margin;
    
    const checkPageBreak = (neededHeight: number) => {
      if (yPosition + neededHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };
    
    const addImageToPDF = async (imgElement: HTMLImageElement) => {
      const imageData = await loadImageAsBase64(imgElement);
      if (!imageData) return;
      
      const pxToMm = 0.264583;
      let imgWidthMm = imageData.width * pxToMm;
      let imgHeightMm = imageData.height * pxToMm;
      
      if (imgWidthMm > contentWidth) {
        const scale = contentWidth / imgWidthMm;
        imgWidthMm = contentWidth;
        imgHeightMm = imgHeightMm * scale;
      }
      
      checkPageBreak(imgHeightMm + 5);
      
      try {
        pdf.addImage(imageData.data, 'JPEG', margin, yPosition, imgWidthMm, imgHeightMm);
        yPosition += imgHeightMm + 5;
        
        const alt = imgElement.alt || imgElement.title;
        if (alt && alt.length > 5) {
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.setFont('helvetica', 'italic');
          const captionLines = pdf.splitTextToSize(alt, contentWidth);
          pdf.text(captionLines, margin, yPosition);
          yPosition += captionLines.length * 4 + 2;
        }
      } catch (e) {
        log.debug(' Failed to add image to PDF:', e);
      }
    };
    
    // Header
    pdf.setFillColor(0, 27, 218);
    pdf.rect(margin, margin, contentWidth, 0.5, 'F');
    yPosition += 5;
    
    pdf.setFontSize(10);
    pdf.setTextColor(0, 27, 218);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Filigran XTM Browser Extension', margin, yPosition);
    yPosition += 5;
    
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Captured on ${new Date().toLocaleDateString()}`, margin, yPosition);
    yPosition += 10;
    
    // Title
    pdf.setFontSize(18);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    const titleLines = pdf.splitTextToSize(article.title, contentWidth);
    checkPageBreak(titleLines.length * 7);
    pdf.text(titleLines, margin, yPosition);
    yPosition += titleLines.length * 7 + 3;
    
    // Source URL
    pdf.setFontSize(9);
    pdf.setTextColor(0, 100, 200);
    pdf.setFont('helvetica', 'normal');
    const truncatedUrl = window.location.href.length > 80 
      ? window.location.href.substring(0, 77) + '...' 
      : window.location.href;
    pdf.textWithLink(truncatedUrl, margin, yPosition, { url: window.location.href });
    yPosition += 8;
    
    // Divider
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;
    
    // Parse and render HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = article.content;
    
    const removeSelectors = ['script', 'style', 'iframe', 'noscript', 'button', 'input', 'form'];
    removeSelectors.forEach(sel => {
      tempDiv.querySelectorAll(sel).forEach(el => el.remove());
    });
    
    // Process content recursively
    const processNode = async (node: Node, isBold = false, isItalic = false, fontSize = 11) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          let fontStyle: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
          if (isBold && isItalic) fontStyle = 'bolditalic';
          else if (isBold) fontStyle = 'bold';
          else if (isItalic) fontStyle = 'italic';
          
          pdf.setFont('helvetica', fontStyle);
          pdf.setFontSize(fontSize);
          pdf.setTextColor(30, 30, 30);
          
          const lines = pdf.splitTextToSize(text, contentWidth);
          const neededHeight = lines.length * lineHeight;
          checkPageBreak(neededHeight);
          pdf.text(lines, margin, yPosition);
          yPosition += neededHeight;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        
        switch (tagName) {
          case 'h1':
            checkPageBreak(12);
            yPosition += 4;
            await processChildren(el, true, false, 16);
            yPosition += 4;
            break;
          case 'h2':
            checkPageBreak(10);
            yPosition += 3;
            await processChildren(el, true, false, 14);
            yPosition += 3;
            break;
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            checkPageBreak(8);
            yPosition += 2;
            await processChildren(el, true, false, 12);
            yPosition += 2;
            break;
          case 'p':
            checkPageBreak(lineHeight);
            await processChildren(el, isBold, isItalic, fontSize);
            yPosition += 3;
            break;
          case 'br':
            yPosition += lineHeight;
            break;
          case 'strong':
          case 'b':
            await processChildren(el, true, isItalic, fontSize);
            break;
          case 'em':
          case 'i':
            await processChildren(el, isBold, true, fontSize);
            break;
          case 'ul':
          case 'ol':
            yPosition += 2;
            const listItems = el.querySelectorAll(':scope > li');
            for (let idx = 0; idx < listItems.length; idx++) {
              const li = listItems[idx];
              checkPageBreak(lineHeight);
              const bullet = tagName === 'ul' ? '•' : `${idx + 1}.`;
              pdf.setFont('helvetica', 'normal');
              pdf.setFontSize(11);
              pdf.setTextColor(30, 30, 30);
              pdf.text(bullet, margin, yPosition);
              
              const liText = li.textContent?.trim() || '';
              const lines = pdf.splitTextToSize(liText, contentWidth - 8);
              pdf.text(lines, margin + 8, yPosition);
              yPosition += lines.length * lineHeight + 1;
            }
            yPosition += 2;
            break;
          case 'blockquote':
            checkPageBreak(lineHeight + 4);
            yPosition += 2;
            pdf.setDrawColor(0, 27, 218);
            pdf.setLineWidth(0.5);
            const quoteStartY = yPosition;
            await processChildren(el, false, true, 10);
            pdf.line(margin, quoteStartY - 2, margin, yPosition);
            yPosition += 4;
            break;
          case 'a':
            const href = el.getAttribute('href');
            const linkText = el.textContent?.trim() || '';
            if (linkText && href) {
              pdf.setTextColor(0, 100, 200);
              pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
              pdf.setFontSize(fontSize);
              const lines = pdf.splitTextToSize(linkText, contentWidth);
              checkPageBreak(lines.length * lineHeight);
              pdf.textWithLink(lines.join(' '), margin, yPosition, { url: href.startsWith('http') ? href : window.location.origin + href });
              yPosition += lines.length * lineHeight;
              pdf.setTextColor(30, 30, 30);
            }
            break;
          case 'img':
            await addImageToPDF(el as HTMLImageElement);
            break;
          case 'figure':
            const figImg = el.querySelector('img');
            if (figImg) {
              await addImageToPDF(figImg as HTMLImageElement);
            }
            const figCaption = el.querySelector('figcaption');
            if (figCaption) {
              pdf.setFontSize(9);
              pdf.setTextColor(100, 100, 100);
              pdf.setFont('helvetica', 'italic');
              const captionText = figCaption.textContent?.trim() || '';
              const captionLines = pdf.splitTextToSize(captionText, contentWidth);
              checkPageBreak(captionLines.length * 4);
              pdf.text(captionLines, margin, yPosition);
              yPosition += captionLines.length * 4 + 2;
            }
            break;
          case 'pre':
          case 'code':
            checkPageBreak(lineHeight);
            pdf.setFont('courier', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(50, 50, 50);
            const codeText = el.textContent?.trim() || '';
            const codeLines = pdf.splitTextToSize(codeText, contentWidth);
            pdf.text(codeLines, margin, yPosition);
            yPosition += codeLines.length * 4 + 2;
            pdf.setFont('helvetica', 'normal');
            break;
          case 'hr':
            checkPageBreak(6);
            yPosition += 3;
            pdf.setDrawColor(200, 200, 200);
            pdf.line(margin, yPosition, pageWidth - margin, yPosition);
            yPosition += 3;
            break;
          default:
            await processChildren(el, isBold, isItalic, fontSize);
            break;
        }
      }
    };
    
    const processChildren = async (el: HTMLElement, isBold: boolean, isItalic: boolean, fontSize: number) => {
      for (const child of Array.from(el.childNodes)) {
        await processNode(child, isBold, isItalic, fontSize);
      }
    };
    
    for (const child of Array.from(tempDiv.childNodes)) {
      await processNode(child);
    }
    
    // Footer
    const footerY = pageHeight - 10;
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    pdf.text(`Generated by Filigran XTM Browser Extension | ${window.location.hostname}`, margin, footerY);
    
    const filename = `${sanitizeFilename(article.title)}.pdf`;
    const pdfOutput = pdf.output('datauristring');
    const base64Data = pdfOutput.split(',')[1];
    
    log.debug(' Fallback PDF generated successfully, base64 length:', base64Data.length);
    
    return {
      data: base64Data,
      filename: filename,
    };
  } catch (error) {
    log.error(' Failed to generate fallback PDF:', error);
    return null;
  }
}

/**
 * Fallback: Generate simple text-based PDF
 */
async function generateSimpleTextPDF(): Promise<{ data: string; filename: string } | null> {
  try {
    const article = extractArticleContent();
    
    let textContent = article.textContent || '';
    if (!textContent && article.content) {
      const temp = document.createElement('div');
      temp.innerHTML = article.content;
      textContent = temp.textContent || temp.innerText || '';
    }
    
    textContent = textContent
      .replace(/[\t\r]/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ ]{2,}/g, ' ')
      .trim();
    
    if (!textContent || textContent.length < 50) {
      log.warn(' Text content too short for fallback PDF');
      return null;
    }
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;
    
    // Header
    pdf.setFillColor(0, 27, 218);
    pdf.rect(margin, margin, contentWidth, 0.5, 'F');
    yPosition += 5;
    
    pdf.setFontSize(10);
    pdf.setTextColor(0, 27, 218);
    pdf.text('XTM Browser Extension', margin, yPosition);
    yPosition += 5;
    
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Captured on ${new Date().toLocaleDateString()}`, margin, yPosition);
    yPosition += 10;
    
    // Title
    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0);
    const titleLines = pdf.splitTextToSize(article.title, contentWidth);
    pdf.text(titleLines, margin, yPosition);
    yPosition += (titleLines.length * 7) + 5;
    
    // Source
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    const sourceUrl = window.location.href;
    const truncatedUrl = sourceUrl.length > 80 ? sourceUrl.substring(0, 77) + '...' : sourceUrl;
    pdf.text(`Source: ${truncatedUrl}`, margin, yPosition);
    yPosition += 5;
    pdf.text(`Captured: ${new Date().toLocaleString()}`, margin, yPosition);
    yPosition += 3;
    
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
    
    // Content
    pdf.setFontSize(11);
    pdf.setTextColor(30, 30, 30);
    
    const paragraphs = textContent.split(/\n\n+/).filter(p => p.trim().length > 0);
    
    for (const paragraph of paragraphs) {
      const lines = pdf.splitTextToSize(paragraph.trim(), contentWidth);
      const textHeight = lines.length * 5;
      
      if (yPosition + textHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.text(lines, margin, yPosition);
      yPosition += textHeight + 5;
    }
    
    // Footer
    const footerY = pageHeight - 10;
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    pdf.text(`Generated by Filigran XTM Browser Extension | ${window.location.hostname}`, margin, footerY);
    
    const filename = `${sanitizeFilename(article.title)}.pdf`;
    const pdfOutput = pdf.output('datauristring');
    const base64Data = pdfOutput.split(',')[1];
    
    log.debug(' Fallback text PDF generated, base64 length:', base64Data.length);
    
    return {
      data: base64Data,
      filename: filename,
    };
  } catch (error) {
    log.error(' Fallback PDF generation failed:', error);
    return null;
  }
}

/**
 * Sanitize filename for PDF
 */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

