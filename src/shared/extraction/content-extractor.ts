/**
 * Enhanced Content Extractor
 * 
 * Provides clean article extraction with:
 * - Print-mode optimization (leverages @media print styles)
 * - Reader-view generation (Firefox/Safari-style clean view)
 * - Smart image preservation (content images only, no icons)
 * - Multiple content detection heuristics
 * - Clean text extraction for AI/search
 */

import { Readability } from '@mozilla/readability';

export interface ExtractedContent {
  title: string;
  byline: string;
  excerpt: string;
  /** Clean HTML content suitable for display */
  content: string;
  /** Plain text content for AI/search */
  textContent: string;
  /** Preserved images with metadata */
  images: ExtractedImage[];
  /** Source URL */
  url: string;
  /** Site name */
  siteName: string;
  /** Publication date if found */
  publishedDate: string | null;
  /** Estimated reading time in minutes */
  readingTime: number;
}

export interface ExtractedImage {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  /** Base64 data URL if embedded */
  dataUrl?: string;
}

// Minimum dimensions for content images (skip tiny icons)
const MIN_IMAGE_WIDTH = 100;
const MIN_IMAGE_HEIGHT = 100;
const MIN_IMAGE_AREA = 15000; // 100x150 or similar

// Selectors for elements that should NEVER be in article content
const SELECTORS_TO_REMOVE = [
  // Scripts and metadata
  'script', 'style', 'noscript', 'link[rel="stylesheet"]', 'meta',
  
  // Navigation and structure
  'nav', 'header:not(article header)', 'footer:not(article footer)', 
  'aside', 'menu', 'menuitem',
  
  // Interactive elements
  'form', 'input', 'button', 'select', 'textarea', 'label',
  'iframe:not([src*="youtube"]):not([src*="vimeo"])', // Keep video embeds
  
  // Ads and promotions
  '[class*="ad-"]', '[class*="advert"]', '[class*="advertisement"]',
  '[class*="sponsor"]', '[class*="promo"]', '[class*="banner"]',
  '[id*="ad-"]', '[id*="advert"]', '[id*="sponsor"]',
  '[data-ad]', '[data-advertisement]', '.ad', '.ads', '.adsbygoogle',
  
  // Social and sharing
  '[class*="share"]', '[class*="social"]', '[class*="follow"]',
  '[class*="like-button"]', '[class*="tweet"]', '[class*="facebook"]',
  
  // Comments
  '[class*="comment"]', '[id*="comment"]', '#disqus_thread',
  '[class*="discussion"]', '[class*="responses"]',
  
  // Related content
  '[class*="related"]', '[class*="recommended"]', '[class*="suggested"]',
  '[class*="more-from"]', '[class*="you-may-like"]', '[class*="trending"]',
  
  // Subscription/paywall
  '[class*="paywall"]', '[class*="subscribe"]', '[class*="subscription"]',
  '[class*="newsletter"]', '[class*="signup"]', '[class*="premium"]',
  '[class*="member"]', '[class*="login"]', '[class*="register"]',
  
  // Cookie/consent
  '[class*="cookie"]', '[class*="consent"]', '[class*="gdpr"]',
  '[class*="privacy-banner"]', '[class*="notice-banner"]',
  
  // Navigation elements
  '[class*="breadcrumb"]', '[class*="pagination"]', '[class*="nav-"]',
  '[class*="menu-"]', '[class*="sidebar"]', '[class*="widget"]',
  '[class*="toc"]', '[class*="table-of-contents"]',
  
  // Overlays and modals
  '[class*="overlay"]', '[class*="modal"]', '[class*="popup"]',
  '[class*="dialog"]', '[class*="lightbox"]', '[class*="drawer"]',
  '[class*="backdrop"]', '[class*="toast"]', '[class*="snackbar"]',
  
  // Fixed/sticky elements
  '[class*="sticky"]', '[class*="fixed"]', '[class*="floating"]',
  '[class*="toolbar"]', '[class*="topbar"]', '[class*="bottom-bar"]',
  
  // Hidden elements
  '[hidden]', '[aria-hidden="true"]', '[style*="display: none"]',
  '[style*="display:none"]', '[style*="visibility: hidden"]',
  
  // ARIA roles for non-content
  '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
  '[role="contentinfo"]', '[role="search"]', '[role="form"]',
  '[role="menu"]', '[role="menubar"]', '[role="dialog"]',
  '[role="alertdialog"]', '[role="alert"]', '[role="status"]',
  
  // Framework-specific
  '.MuiModal-root', '.MuiBackdrop-root', '.MuiDrawer-root',
  '.chakra-modal', '.ant-modal', '.ant-drawer',
  '.ReactModal__Overlay', '[class*="__overlay"]',
];

// Selectors for likely main content areas
const CONTENT_SELECTORS = [
  'article',
  '[role="article"]',
  '[role="main"]',
  'main',
  '[class*="article-body"]',
  '[class*="article-content"]',
  '[class*="article__body"]',
  '[class*="article__content"]',
  '[class*="post-body"]',
  '[class*="post-content"]',
  '[class*="entry-content"]',
  '[class*="story-body"]',
  '[class*="story-content"]',
  '[class*="content-body"]',
  '[itemprop="articleBody"]',
  '[data-article-body]',
  '.prose',
  '.content',
  '#content',
  '.post',
  '.entry',
];

// Selectors for extracting metadata
const TITLE_SELECTORS = [
  'h1[class*="title"]',
  'h1[class*="headline"]',
  '[class*="article-title"]',
  '[class*="post-title"]',
  '[class*="entry-title"]',
  '[itemprop="headline"]',
  'article h1',
  'main h1',
  'h1',
];

const BYLINE_SELECTORS = [
  '[rel="author"]',
  '[class*="author"]',
  '[class*="byline"]',
  '[itemprop="author"]',
  '[class*="writer"]',
  'address',
];

const DATE_SELECTORS = [
  'time[datetime]',
  '[class*="date"]',
  '[class*="published"]',
  '[itemprop="datePublished"]',
  '[class*="timestamp"]',
];

/**
 * Extract clean article content from the current page
 */
export function extractContent(): ExtractedContent {
  // Try extraction in order of quality
  const content = extractWithPrintMode() 
    || extractWithReadability() 
    || extractFallback();
  
  return content;
}

/**
 * Apply print media styles and extract content
 * This often produces cleaner results as sites hide navigation in print
 */
function extractWithPrintMode(): ExtractedContent | null {
  try {
    // Clone document
    const clone = document.cloneNode(true) as Document;
    
    // Force print media evaluation by modifying stylesheets
    applyPrintStyles(clone);
    
    // Remove elements hidden by print styles
    removeHiddenElements(clone);
    
    // Now extract with Readability
    return extractFromDocument(clone, 'print-mode');
  } catch (error) {
    console.debug('[ContentExtractor] Print mode extraction failed:', error);
    return null;
  }
}

/**
 * Standard Readability extraction with enhanced preprocessing
 */
function extractWithReadability(): ExtractedContent | null {
  try {
    const clone = document.cloneNode(true) as Document;
    return extractFromDocument(clone, 'readability');
  } catch (error) {
    console.debug('[ContentExtractor] Readability extraction failed:', error);
    return null;
  }
}

/**
 * Fallback extraction using content heuristics
 */
function extractFallback(): ExtractedContent {
  const title = extractTitle(document);
  const byline = extractByline(document);
  const publishedDate = extractDate(document);
  
  // Find the best content container
  const contentElement = findContentElement(document);
  const clone = contentElement.cloneNode(true) as HTMLElement;
  
  // Clean the content
  cleanElement(clone);
  
  const textContent = cleanText(clone.textContent || '');
  const images = extractImages(clone);
  
  return {
    title,
    byline,
    excerpt: textContent.substring(0, 200).trim() + '...',
    content: clone.innerHTML,
    textContent,
    images,
    url: window.location.href,
    siteName: extractSiteName(),
    publishedDate,
    readingTime: estimateReadingTime(textContent),
  };
}

/**
 * Extract content from a prepared document clone
 */
function extractFromDocument(doc: Document, method: string): ExtractedContent | null {
  // Pre-clean the document
  SELECTORS_TO_REMOVE.forEach(selector => {
    try {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    } catch { /* Skip invalid selectors */ }
  });
  
  // Use Readability
  const reader = new Readability(doc, {
    debug: false,
    charThreshold: 50,
    keepClasses: false, // Remove all classes for cleaner output
  });
  
  const article = reader.parse();
  
  if (!article || !article.content || article.textContent.length < 100) {
    return null;
  }
  
  // Post-process the extracted content
  const contentDiv = document.createElement('div');
  contentDiv.innerHTML = article.content;
  
  // Clean the extracted content
  cleanElement(contentDiv);
  
  // Extract images before they're processed
  const images = extractImages(contentDiv);
  
  // Clean and enhance images in content
  enhanceImages(contentDiv);
  
  const textContent = cleanText(article.textContent);
  
  console.debug(`[ContentExtractor] ${method}: extracted ${textContent.length} chars, ${images.length} images`);
  
  return {
    title: article.title || document.title,
    byline: article.byline || extractByline(document),
    excerpt: article.excerpt || textContent.substring(0, 200).trim() + '...',
    content: contentDiv.innerHTML,
    textContent,
    images,
    url: window.location.href,
    siteName: article.siteName || extractSiteName(),
    publishedDate: extractDate(document),
    readingTime: estimateReadingTime(textContent),
  };
}

/**
 * Apply print stylesheet rules to document
 */
function applyPrintStyles(doc: Document): void {
  // Find all stylesheets and check for print media rules
  const styleSheets = Array.from(doc.styleSheets);
  
  styleSheets.forEach(sheet => {
    try {
      const rules = Array.from(sheet.cssRules || []);
      rules.forEach(rule => {
        if (rule instanceof CSSMediaRule && rule.conditionText?.includes('print')) {
          // Extract print rules and apply them as regular styles
          const printRules = Array.from(rule.cssRules);
          printRules.forEach(printRule => {
            if (printRule instanceof CSSStyleRule) {
              // Apply the print style
              const elements = doc.querySelectorAll(printRule.selectorText);
              elements.forEach(el => {
                (el as HTMLElement).style.cssText += printRule.style.cssText;
              });
            }
          });
        }
      });
    } catch { /* CORS or other stylesheet access issues */ }
  });
  
  // Add a print media query to force print mode detection
  const printStyle = doc.createElement('style');
  printStyle.textContent = `
    @media all {
      /* Hide common navigation elements in print mode */
      nav, header, footer, aside, 
      [class*="nav"], [class*="menu"], [class*="sidebar"],
      [class*="header"]:not(.article-header), 
      [class*="footer"]:not(.article-footer),
      [class*="social"], [class*="share"], [class*="comment"],
      [class*="related"], [class*="ad"], [class*="promo"] {
        display: none !important;
      }
      
      /* Show main content */
      article, main, [role="main"], [class*="content"], [class*="article"] {
        display: block !important;
        visibility: visible !important;
      }
    }
  `;
  doc.head.appendChild(printStyle);
}

/**
 * Remove elements that are hidden (display:none, visibility:hidden, etc.)
 */
function removeHiddenElements(doc: Document): void {
  const allElements = doc.querySelectorAll('*');
  
  allElements.forEach(el => {
    const element = el as HTMLElement;
    
    try {
      const style = element.style;
      const computedStyle = window.getComputedStyle(element);
      
      // Check inline styles
      if (style.display === 'none' || style.visibility === 'hidden') {
        element.remove();
        return;
      }
      
      // Check computed styles
      if (computedStyle.display === 'none' || 
          computedStyle.visibility === 'hidden' ||
          computedStyle.opacity === '0') {
        element.remove();
        return;
      }
      
      // Check for zero dimensions (often hidden elements)
      if (computedStyle.width === '0px' && computedStyle.height === '0px') {
        element.remove();
        return;
      }
      
      // Remove fixed/sticky elements (usually navigation/overlays)
      if (computedStyle.position === 'fixed' || computedStyle.position === 'sticky') {
        // Keep if it's likely content (like a reading progress bar)
        if (!element.closest('article, main, [role="main"]')) {
          element.remove();
          return;
        }
      }
      
      // Remove high z-index elements (likely overlays)
      const zIndex = parseInt(computedStyle.zIndex);
      if (!isNaN(zIndex) && zIndex > 9000 && !element.closest('article')) {
        element.remove();
      }
    } catch { /* Skip if styles can't be read */ }
  });
}

/**
 * Find the best content container using heuristics
 */
function findContentElement(doc: Document): HTMLElement {
  // Try content selectors in order
  for (const selector of CONTENT_SELECTORS) {
    const element = doc.querySelector(selector) as HTMLElement;
    if (element && getTextDensity(element) > 0.3) {
      return element;
    }
  }
  
  // Find by content density analysis
  const candidates = Array.from(doc.querySelectorAll('div, section, article'));
  let bestCandidate: HTMLElement = doc.body;
  let bestScore = 0;
  
  candidates.forEach(el => {
    const element = el as HTMLElement;
    const score = scoreContentElement(element);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = element;
    }
  });
  
  return bestCandidate;
}

/**
 * Score an element's likelihood of being the main content
 */
function scoreContentElement(element: HTMLElement): number {
  let score = 0;
  
  // Text length (more text = likely content)
  const text = element.textContent || '';
  score += Math.min(text.length / 100, 50);
  
  // Paragraph density
  const paragraphs = element.querySelectorAll('p');
  score += paragraphs.length * 3;
  
  // Heading presence
  const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
  score += headings.length * 2;
  
  // Image presence (content usually has images)
  const images = element.querySelectorAll('img');
  score += images.length * 2;
  
  // Link density (too many links = navigation)
  const links = element.querySelectorAll('a');
  const linkText = Array.from(links).reduce((sum, a) => sum + (a.textContent?.length || 0), 0);
  const linkDensity = text.length > 0 ? linkText / text.length : 1;
  if (linkDensity > 0.3) {
    score -= 30;
  }
  
  // Class name hints
  const className = element.className.toLowerCase();
  if (/article|content|post|story|entry|prose/.test(className)) {
    score += 20;
  }
  if (/nav|menu|sidebar|footer|header|comment|ad/.test(className)) {
    score -= 30;
  }
  
  // ID hints
  const id = element.id.toLowerCase();
  if (/article|content|post|story|entry|main/.test(id)) {
    score += 20;
  }
  
  return score;
}

/**
 * Calculate text density (text chars / total element length)
 */
function getTextDensity(element: HTMLElement): number {
  const text = element.textContent || '';
  const html = element.innerHTML;
  return html.length > 0 ? text.length / html.length : 0;
}

/**
 * Clean an element by removing unwanted children and attributes
 */
function cleanElement(element: HTMLElement): void {
  // Remove unwanted elements
  SELECTORS_TO_REMOVE.forEach(selector => {
    try {
      element.querySelectorAll(selector).forEach(el => el.remove());
    } catch { /* Skip */ }
  });
  
  // Clean all remaining elements
  element.querySelectorAll('*').forEach(el => {
    const htmlEl = el as HTMLElement;
    
    // Remove event handlers
    const eventAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout',
      'onfocus', 'onblur', 'onsubmit', 'onchange', 'onkeydown', 'onkeyup'];
    eventAttrs.forEach(attr => htmlEl.removeAttribute(attr));
    
    // Remove data attributes (except useful ones)
    Array.from(htmlEl.attributes)
      .filter(attr => attr.name.startsWith('data-') && 
        !['data-src', 'data-srcset', 'data-lazy-src'].includes(attr.name))
      .forEach(attr => htmlEl.removeAttribute(attr.name));
    
    // Remove class and id (for clean output)
    htmlEl.removeAttribute('class');
    htmlEl.removeAttribute('id');
    
    // Remove style (will be re-styled in reader view)
    htmlEl.removeAttribute('style');
  });
  
  // Remove empty elements
  element.querySelectorAll('div, span, p').forEach(el => {
    if (!el.textContent?.trim() && !el.querySelector('img, video, iframe, svg')) {
      el.remove();
    }
  });
}

/**
 * Extract and process images from content
 */
function extractImages(element: HTMLElement): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const seen = new Set<string>();
  
  element.querySelectorAll('img').forEach(img => {
    const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
    
    if (!src || seen.has(src)) return;
    seen.add(src);
    
    // Get dimensions
    const width = img.naturalWidth || img.width || parseInt(img.getAttribute('width') || '0');
    const height = img.naturalHeight || img.height || parseInt(img.getAttribute('height') || '0');
    
    // Skip small images (likely icons, avatars, etc.)
    if (width > 0 && height > 0) {
      if (width < MIN_IMAGE_WIDTH || height < MIN_IMAGE_HEIGHT) return;
      if (width * height < MIN_IMAGE_AREA) return;
    }
    
    // Skip tracking pixels and common non-content patterns
    const srcLower = src.toLowerCase();
    if (/pixel|track|beacon|analytics|ad[sx]?[\/\.]|doubleclick|facebook\.com\/tr/.test(srcLower)) {
      return;
    }
    
    // Skip common icon patterns
    if (/icon|logo|avatar|badge|button|sprite/.test(srcLower) && width < 200 && height < 200) {
      return;
    }
    
    // Get caption from figure or alt
    let caption = '';
    const figure = img.closest('figure');
    if (figure) {
      const figcaption = figure.querySelector('figcaption');
      caption = figcaption?.textContent?.trim() || '';
    }
    
    images.push({
      src,
      alt: img.alt || '',
      caption,
      width,
      height,
    });
  });
  
  return images;
}

/**
 * Enhance images in content element (lazy loading, captions)
 */
function enhanceImages(element: HTMLElement): void {
  element.querySelectorAll('img').forEach(img => {
    // Handle lazy-loaded images
    const lazySrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
    if (lazySrc && (!img.src || img.src.includes('placeholder') || img.src.includes('data:'))) {
      img.src = lazySrc;
    }
    
    // Handle srcset
    const lazySrcset = img.getAttribute('data-srcset');
    if (lazySrcset) {
      img.setAttribute('srcset', lazySrcset);
    }
    
    // Ensure images are responsive
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    
    // Remove tiny images
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (width > 0 && height > 0 && width < MIN_IMAGE_WIDTH && height < MIN_IMAGE_HEIGHT) {
      img.remove();
    }
  });
}

/**
 * Extract article title
 */
function extractTitle(doc: Document): string {
  for (const selector of TITLE_SELECTORS) {
    const el = doc.querySelector(selector);
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  }
  
  // Try meta tags
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  if (ogTitle) return ogTitle;
  
  const twitterTitle = doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
  if (twitterTitle) return twitterTitle;
  
  return doc.title || 'Untitled';
}

/**
 * Extract author/byline
 */
function extractByline(doc: Document): string {
  for (const selector of BYLINE_SELECTORS) {
    const el = doc.querySelector(selector);
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  }
  
  const metaAuthor = doc.querySelector('meta[name="author"]')?.getAttribute('content');
  return metaAuthor || '';
}

/**
 * Extract publication date
 */
function extractDate(doc: Document): string | null {
  for (const selector of DATE_SELECTORS) {
    const el = doc.querySelector(selector);
    if (el) {
      // Prefer datetime attribute
      const datetime = el.getAttribute('datetime');
      if (datetime) return datetime;
      
      // Fall back to text content
      const text = el.textContent?.trim();
      if (text) return text;
    }
  }
  
  // Try meta tags
  const metaDate = doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content')
    || doc.querySelector('meta[name="date"]')?.getAttribute('content')
    || doc.querySelector('meta[name="DC.date"]')?.getAttribute('content');
  
  return metaDate || null;
}

/**
 * Extract site name
 */
function extractSiteName(): string {
  const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
  if (ogSiteName) return ogSiteName;
  
  // Extract from hostname
  const hostname = window.location.hostname;
  return hostname.replace(/^www\./, '').split('.')[0];
}

/**
 * Estimate reading time in minutes
 */
function estimateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

/**
 * Clean text by removing common boilerplate patterns
 */
function cleanText(text: string): string {
  if (!text) return '';
  
  let cleaned = text;
  
  // Paywall/subscription patterns
  const patternsToRemove = [
    // French
    /Cet article (vous est offert|est réservé|est accessible)[^.]*\./gi,
    /réservé aux abonnés/gi,
    /Abonnez-vous/gi,
    /S['']abonner/gi,
    /Déjà abonné \?/gi,
    /Connectez-vous/gi,
    /Accédez à l['']intégralité[^.]*\./gi,
    
    // English
    /This article is for subscribers/gi,
    /Subscribe to continue reading/gi,
    /Already a subscriber\?/gi,
    /Sign in to read/gi,
    /Subscribe now/gi,
    /Get unlimited access/gi,
    /Start your free trial/gi,
    /You['']ve reached your limit of free articles/gi,
    
    // Generic
    /Share this article/gi,
    /Related articles/gi,
    /Advertisement/gi,
    /Sponsored content/gi,
    /More from [^\n]+/gi,
    /Follow us on [^\n]+/gi,
    /Read more:/gi,
    /See also:/gi,
    
    // Newsletter
    /Sign up for our newsletter/gi,
    /Get the latest news/gi,
    /Enter your email/gi,
    
    // Social
    /Share on (Twitter|Facebook|LinkedIn|WhatsApp)/gi,
    /Tweet this/gi,
  ];
  
  patternsToRemove.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Clean up whitespace
  cleaned = cleaned
    .replace(/\t/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
  
  return cleaned;
}

/**
 * Generate a clean reader-view HTML document
 * This creates a self-contained HTML that looks like Firefox/Safari reader mode
 */
export function generateReaderView(content: ExtractedContent): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(content.title)}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1.8;
      color: #1a1a1a;
      background: #fafafa;
      padding: 0;
      margin: 0;
    }
    
    .reader-container {
      max-width: 680px;
      margin: 0 auto;
      padding: 40px 24px 80px;
      background: white;
      min-height: 100vh;
    }
    
    .reader-header {
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .reader-meta {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      color: #666;
      margin-bottom: 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    
    .reader-meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .reader-title {
      font-size: 32px;
      font-weight: 700;
      line-height: 1.3;
      color: #000;
      margin-bottom: 12px;
    }
    
    .reader-byline {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #444;
    }
    
    .reader-excerpt {
      font-size: 18px;
      color: #555;
      font-style: italic;
      margin-top: 16px;
      padding-left: 16px;
      border-left: 3px solid #001bda;
    }
    
    .reader-content {
      font-size: 18px;
    }
    
    .reader-content p {
      margin-bottom: 1.5em;
    }
    
    .reader-content h1, .reader-content h2, .reader-content h3,
    .reader-content h4, .reader-content h5, .reader-content h6 {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin-top: 2em;
      margin-bottom: 0.5em;
      line-height: 1.3;
      color: #000;
    }
    
    .reader-content h2 { font-size: 24px; }
    .reader-content h3 { font-size: 20px; }
    .reader-content h4 { font-size: 18px; }
    
    .reader-content a {
      color: #001bda;
      text-decoration: none;
    }
    
    .reader-content a:hover {
      text-decoration: underline;
    }
    
    .reader-content img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 24px auto;
      border-radius: 4px;
    }
    
    .reader-content figure {
      margin: 32px 0;
    }
    
    .reader-content figcaption {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #666;
      text-align: center;
      margin-top: 8px;
      font-style: italic;
    }
    
    .reader-content blockquote {
      margin: 24px 0;
      padding: 16px 24px;
      border-left: 4px solid #001bda;
      background: #f5f5f5;
      font-style: italic;
    }
    
    .reader-content pre, .reader-content code {
      font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 14px;
      background: #f5f5f5;
      border-radius: 4px;
    }
    
    .reader-content pre {
      padding: 16px;
      overflow-x: auto;
      margin: 24px 0;
    }
    
    .reader-content code {
      padding: 2px 6px;
    }
    
    .reader-content pre code {
      padding: 0;
      background: none;
    }
    
    .reader-content ul, .reader-content ol {
      margin: 16px 0;
      padding-left: 32px;
    }
    
    .reader-content li {
      margin-bottom: 8px;
    }
    
    .reader-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
      font-size: 16px;
    }
    
    .reader-content th, .reader-content td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    
    .reader-content th {
      background: #f5f5f5;
      font-weight: 600;
    }
    
    .reader-footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid #e0e0e0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      color: #888;
    }
    
    .reader-source {
      word-break: break-all;
    }
    
    @media print {
      body {
        background: white;
      }
      
      .reader-container {
        max-width: none;
        padding: 20px;
      }
      
      .reader-content a {
        color: #000;
        text-decoration: underline;
      }
      
      .reader-content a::after {
        content: " (" attr(href) ")";
        font-size: 12px;
        color: #666;
      }
    }
  </style>
</head>
<body>
  <div class="reader-container">
    <header class="reader-header">
      <div class="reader-meta">
        <span class="reader-meta-item">
          <strong>${escapeHtml(content.siteName)}</strong>
        </span>
        ${content.publishedDate ? `<span class="reader-meta-item">${escapeHtml(content.publishedDate)}</span>` : ''}
        <span class="reader-meta-item">${content.readingTime} min read</span>
      </div>
      <h1 class="reader-title">${escapeHtml(content.title)}</h1>
      ${content.byline ? `<div class="reader-byline">${escapeHtml(content.byline)}</div>` : ''}
      ${content.excerpt && content.excerpt !== content.textContent.substring(0, 200).trim() + '...' 
        ? `<p class="reader-excerpt">${escapeHtml(content.excerpt)}</p>` 
        : ''}
    </header>
    
    <article class="reader-content">
      ${content.content}
    </article>
    
    <footer class="reader-footer">
      <p>Captured by Filigran XTM Browser Extension</p>
      <p class="reader-source">Source: <a href="${escapeHtml(content.url)}">${escapeHtml(content.url)}</a></p>
      <p>Generated: ${new Date().toLocaleString()}</p>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Convert the extracted content to a Blob for PDF generation
 * Returns an HTML blob that can be printed to PDF
 */
export function contentToHtmlBlob(content: ExtractedContent): Blob {
  const html = generateReaderView(content);
  return new Blob([html], { type: 'text/html' });
}

