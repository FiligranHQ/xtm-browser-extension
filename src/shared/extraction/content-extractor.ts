/**
 * Enhanced Content Extractor
 * 
 * Provides clean article extraction with:
 * - Mozilla Readability as the primary extraction engine
 * - Minimal preprocessing to avoid breaking Readability's heuristics
 * - Smart image preservation (content images only, no icons)
 * - Reader-view generation for clean PDF output
 */

import { Readability } from '@mozilla/readability';
import { escapeHtml } from '../utils/formatters';
import { loggers } from '../utils/logger';

const log = loggers.extraction;

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

// Elements to remove ONLY during post-processing (after Readability)
// Keep this minimal to not interfere with Readability's content detection
const POST_PROCESS_REMOVE = [
  // Interactive elements that shouldn't be in article
  'script', 'style', 'noscript', 
  'form', 'input', 'button', 'select', 'textarea',
  'iframe:not([src*="youtube"]):not([src*="vimeo"]):not([src*="youtu.be"])',
  // Tracking and ads
  '[data-ad]', '.adsbygoogle',
];

// Selectors to try for finding article content (ordered by specificity)
const CONTENT_SELECTORS = [
  'article[class*="post"]',
  'article[class*="entry"]',
  'article[class*="content"]',
  'article',
  '[role="article"]',
  '[role="main"]',
  'main',
  '[itemprop="articleBody"]',
  '[class*="article-body"]',
  '[class*="article-content"]',
  '[class*="article__body"]',
  '[class*="article__content"]',
  '[class*="post-body"]',
  '[class*="post-content"]',
  '[class*="entry-content"]',
  '[class*="story-body"]',
  '[class*="blog-post"]',
  '[class*="post__content"]',
  '.prose',
  '#content',
  '.content',
];

/**
 * Extract clean article content from the current page
 * Handles various page types including React/SPA, Shadow DOM, and traditional sites
 */
export function extractContent(): ExtractedContent {
  log.debug('[ContentExtractor] Starting extraction for:', window.location.href);
  
  // Check if the page uses Shadow DOM heavily (like Notion, VirusTotal)
  const shadowDOMContent = extractFromShadowDOM();
  const hasShadowContent = shadowDOMContent && shadowDOMContent.textContent.length > 500;
  
  if (hasShadowContent) {
    log.debug('[ContentExtractor] Page uses Shadow DOM, extracted:', shadowDOMContent.textContent.length, 'chars');
  }
  
  // Try Readability first (it's quite good at finding content)
  let result = extractWithReadability();
  
  // If Readability fails or returns too little content, try fallback
  if (!result || result.textContent.length < 200) {
    log.debug('[ContentExtractor] Readability insufficient, trying fallback');
    const fallback = extractFallback();
    // Use fallback if it has more content
    if (!result || fallback.textContent.length > result.textContent.length) {
      result = fallback;
    }
  }
  
  // If still insufficient, try React/SPA-specific extraction
  if (result.textContent.length < 200) {
    log.debug('[ContentExtractor] Trying React/SPA extraction');
    const spaContent = extractFromReactSPA();
    if (spaContent && spaContent.textContent.length > result.textContent.length) {
      result = spaContent;
    }
  }
  
  // If Shadow DOM content is substantially more, use it instead
  if (hasShadowContent && shadowDOMContent!.textContent.length > result.textContent.length * 1.5) {
    log.debug('[ContentExtractor] Using Shadow DOM content (more complete)');
    result = shadowDOMContent!;
  }
  
  // Last resort: extract visible text from the page
  if (result.textContent.length < 100) {
    log.debug('[ContentExtractor] Using visible viewport extraction');
    const viewportContent = extractFromVisibleContent();
    if (viewportContent.textContent.length > result.textContent.length) {
      result = viewportContent;
    }
  }
  
  log.debug('[ContentExtractor] Final extraction:', result.title, 'text length:', result.textContent.length);
  return result;
}

/**
 * Extract content from Shadow DOM
 * Sites like Notion, VirusTotal render everything in Shadow DOM
 */
function extractFromShadowDOM(): ExtractedContent | null {
  try {
    const shadowRoots: ShadowRoot[] = [];
    
    // Find all shadow roots in the document
    function findShadowRoots(root: Document | ShadowRoot | Element): void {
      const elements = root.querySelectorAll('*');
      elements.forEach(el => {
        if (el.shadowRoot) {
          shadowRoots.push(el.shadowRoot);
          // Recursively check inside shadow roots
          findShadowRoots(el.shadowRoot);
        }
      });
    }
    
    findShadowRoots(document);
    
    if (shadowRoots.length === 0) {
      return null;
    }
    
    log.debug('[ContentExtractor] Found', shadowRoots.length, 'shadow roots');
    
    // Extract content from all shadow roots
    const contentParts: string[] = [];
    const htmlParts: string[] = [];
    const images: ExtractedImage[] = [];
    const seenImages = new Set<string>();
    
    for (const shadowRoot of shadowRoots) {
      // Get text content
      const visibleText = getVisibleTextFromShadowRoot(shadowRoot);
      if (visibleText.trim().length > 50) {
        contentParts.push(visibleText);
      }
      
      // Clone and clean the shadow root for HTML extraction
      const clonedContent = extractHtmlFromShadowRoot(shadowRoot);
      if (clonedContent.trim().length > 100) {
        htmlParts.push(clonedContent);
      }
      
      // Extract images from shadow root
      shadowRoot.querySelectorAll('img').forEach(img => {
        const imgEl = img as HTMLImageElement;
        const src = getImageSrc(imgEl);
        if (src && !seenImages.has(src) && isContentImage(src, imgEl)) {
          seenImages.add(src);
          images.push({
            src: makeAbsoluteUrl(src),
            alt: imgEl.alt || '',
            caption: getFigureCaption(imgEl),
            width: imgEl.naturalWidth || imgEl.width || 0,
            height: imgEl.naturalHeight || imgEl.height || 0,
          });
        }
      });
    }
    
    const textContent = cleanText(contentParts.join('\n\n'));
    const htmlContent = htmlParts.join('\n');
    
    if (textContent.length < 200) {
      return null;
    }
    
    return {
      title: extractTitle(),
      byline: extractByline(),
      excerpt: textContent.substring(0, 200).trim() + '...',
      content: htmlContent || `<div>${textContent.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>`,
      textContent,
      images,
      url: window.location.href,
      siteName: extractSiteName(),
      publishedDate: extractDate(),
      readingTime: estimateReadingTime(textContent),
    };
  } catch (error) {
    log.error('[ContentExtractor] Shadow DOM extraction failed:', error);
    return null;
  }
}

/**
 * Get visible text from a shadow root (respects visibility)
 */
function getVisibleTextFromShadowRoot(shadowRoot: ShadowRoot): string {
  const textParts: string[] = [];
  
  function walkNode(node: Node): void {
    // Text node
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text && text.length > 0) {
        // Check if parent is visible
        const parent = node.parentElement;
        if (parent && isElementVisible(parent)) {
          textParts.push(text);
        }
      }
      return;
    }
    
    // Element node
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName?.toLowerCase();
      
      // Skip non-content tags
      if (['script', 'style', 'noscript', 'template', 'svg', 'canvas'].includes(tagName)) {
        return;
      }
      
      // Skip invisible elements
      if (!isElementVisible(el)) {
        return;
      }
      
      // Recurse into children
      for (const child of Array.from(node.childNodes)) {
        walkNode(child);
      }
      
      // Add line breaks after block elements
      if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br', 'tr'].includes(tagName)) {
        textParts.push('\n');
      }
    }
  }
  
  walkNode(shadowRoot);
  
  return textParts.join(' ')
    .replace(/\n\s+\n/g, '\n\n')
    .replace(/ +/g, ' ')
    .trim();
}

/**
 * Extract clean HTML from shadow root
 */
function extractHtmlFromShadowRoot(shadowRoot: ShadowRoot): string {
  // Find main content areas within shadow root
  const contentSelectors = [
    'article', 'main', '[role="main"]', '[role="article"]',
    '.content', '.article', '.post', '.entry',
    '[class*="content"]', '[class*="article"]', '[class*="body"]',
  ];
  
  let contentElement: Element | null = null;
  for (const selector of contentSelectors) {
    try {
      contentElement = shadowRoot.querySelector(selector);
      if (contentElement && contentElement.textContent && contentElement.textContent.trim().length > 200) {
        break;
      }
    } catch { /* Skip */ }
  }
  
  // Clone and clean
  const tempDiv = document.createElement('div');
  
  // Manually copy content (can't use cloneNode on shadow root)
  function copyElement(source: Element, target: HTMLElement): void {
    for (const child of Array.from(source.children)) {
      const tagName = child.tagName.toLowerCase();
      
      // Skip non-content elements
      if (['script', 'style', 'noscript', 'template', 'nav', 'aside', 'footer', 'header'].includes(tagName)) {
        continue;
      }
      
      // Skip invisible elements
      if (!isElementVisible(child)) {
        continue;
      }
      
      const cloned = document.createElement(tagName);
      
      // Copy relevant attributes
      if (tagName === 'img') {
        const imgSrc = getImageSrc(child as HTMLImageElement);
        if (imgSrc) {
          cloned.setAttribute('src', makeAbsoluteUrl(imgSrc));
          cloned.setAttribute('alt', (child as HTMLImageElement).alt || '');
          cloned.setAttribute('style', 'max-width: 100%; height: auto;');
        }
      } else if (tagName === 'a') {
        const href = (child as HTMLAnchorElement).href;
        if (href) {
          cloned.setAttribute('href', href);
        }
      }
      
      // Copy text content or recurse
      if (child.children.length === 0) {
        const text = child.textContent?.trim();
        if (text) {
          cloned.textContent = text;
        }
      } else {
        copyElement(child, cloned);
      }
      
      // Only add if has content
      if (cloned.innerHTML || cloned.textContent?.trim()) {
        target.appendChild(cloned);
      }
    }
  }
  
  if (contentElement) {
    copyElement(contentElement, tempDiv);
  } else {
    // For shadow root, iterate children
    const container = shadowRoot.querySelector('*');
    if (container) {
      copyElement(container.parentElement || container as Element, tempDiv);
    }
  }
  
  return tempDiv.innerHTML;
}

/**
 * Check if element is visible
 */
function isElementVisible(el: Element): boolean {
  const htmlEl = el as HTMLElement;
  
  // Check dimensions
  try {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return false;
    }
  } catch { /* Continue */ }
  
  // Check styles
  try {
    const style = window.getComputedStyle(htmlEl);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
  } catch { /* Continue */ }
  
  // Check hidden attribute
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
 * Extract using Mozilla Readability with minimal preprocessing
 */
function extractWithReadability(): ExtractedContent | null {
  try {
    // First, find hero/featured image BEFORE cloning (from live DOM)
    const heroImage = findHeroImage();
    
    // Clone the entire document
    const clone = document.cloneNode(true) as Document;
    
    // Minimal preprocessing: only remove scripts and styles that could cause issues
    // Do NOT remove content elements - let Readability decide what's important
    clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    
    // IMPORTANT: Fix lazy-loaded images BEFORE Readability processes them
    // This ensures Readability can properly score content with images
    clone.querySelectorAll('img').forEach(img => {
      fixImageSourceInClone(img);
    });
    
    // Create Readability instance with generous settings
    const reader = new Readability(clone, {
      debug: false,
      charThreshold: 25, // Lower threshold to capture more content
      nbTopCandidates: 10, // Consider more candidates
    });
    
    const article = reader.parse();
    
    if (!article || !article.content) {
      log.debug('[ContentExtractor] Readability returned no content');
      return null;
    }
    
    // Check minimum content threshold
    const textLength = article.textContent?.length || 0;
    if (textLength < 100) {
      log.debug('[ContentExtractor] Readability content too short:', textLength);
      return null;
    }
    
    log.debug('[ContentExtractor] Readability extracted:', article.title, 'length:', textLength);
    
    // Post-process the extracted HTML
    const processedContent = postProcessContent(article.content);
    
    // Prepend hero image if found and not already in content
    let finalHtml = processedContent.html;
    if (heroImage) {
      const contentHasHero = processedContent.element.querySelector(`img[src="${heroImage.src}"]`) ||
                            processedContent.html.includes(heroImage.src);
      if (!contentHasHero) {
        log.debug('[ContentExtractor] Adding hero image:', heroImage.src);
        const heroHtml = createHeroImageHtml(heroImage);
        finalHtml = heroHtml + finalHtml;
        // Re-create element with hero for image extraction
        processedContent.element.insertAdjacentHTML('afterbegin', heroHtml);
      }
    }
    
    const images = extractImages(processedContent.element);
    
    return {
      title: article.title || document.title,
      byline: article.byline || extractByline(),
      excerpt: article.excerpt || (article.textContent?.substring(0, 200).trim() + '...') || '',
      content: finalHtml,
      textContent: cleanText(article.textContent || ''),
      images,
      url: window.location.href,
      siteName: article.siteName || extractSiteName(),
      publishedDate: extractDate(),
      readingTime: estimateReadingTime(article.textContent || ''),
    };
  } catch (error) {
    log.error('[ContentExtractor] Readability failed:', error);
    return null;
  }
}

/**
 * Find hero/featured image from the page
 * These are often outside the main article content
 * Note: We skip og:image as it's often a social sharing card, not actual content
 */
function findHeroImage(): ExtractedImage | null {
  // Selectors for actual hero/featured images in the DOM (NOT meta tags)
  // Meta tags like og:image are often branded social cards, not article images
  const heroSelectors = [
    // Structured data (usually actual content)
    'article [itemprop="image"] img',
    '[itemprop="image"]:not(meta)',
    // Common hero image patterns - be specific
    '.hero-image img',
    '.featured-image img',
    '.post-thumbnail img',
    '.entry-thumbnail img', 
    '.article-hero img',
    '.article-featured-image img',
    '.blog-hero img',
    '.post-hero img',
    '.post-featured-image img',
    // Article-specific image containers
    'article header figure img',
    'article header .image img',
    'article > figure:first-of-type img',
    '.post header figure img',
    '.entry header figure img',
    // First figure in article (common pattern)
    'article figure:first-of-type img',
    '.post-content > figure:first-of-type img',
    '.entry-content > figure:first-of-type img',
    '.article-body > figure:first-of-type img',
  ];
  
  for (const selector of heroSelectors) {
    try {
      const element = document.querySelector(selector);
      if (!element) continue;
      
      // Get the img element
      const img = element.tagName === 'IMG' ? element as HTMLImageElement : element.querySelector('img');
      if (!img) continue;
      
      const src = getImageSrc(img);
      if (!src) continue;
      
      // Validate: skip logos, icons, and tracking images
      if (!isContentImage(src, img)) continue;
      
      log.debug('[ContentExtractor] Found hero image via selector:', selector, src);
      return {
        src: makeAbsoluteUrl(src),
        alt: img.alt || '',
        caption: getFigureCaption(img),
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
      };
    } catch { /* Skip invalid selectors */ }
  }
  
  // Fallback: Look for first substantial image in main content area
  const mainContent = document.querySelector('article, main, [role="main"], .post, .entry');
  if (mainContent) {
    const images = mainContent.querySelectorAll('img');
    for (const img of images) {
      const src = getImageSrc(img as HTMLImageElement);
      if (src && isContentImage(src, img as HTMLImageElement)) {
        log.debug('[ContentExtractor] Found hero via main content scan:', src);
        return {
          src: makeAbsoluteUrl(src),
          alt: (img as HTMLImageElement).alt || '',
          caption: getFigureCaption(img as HTMLImageElement),
          width: (img as HTMLImageElement).naturalWidth || (img as HTMLImageElement).width || 0,
          height: (img as HTMLImageElement).naturalHeight || (img as HTMLImageElement).height || 0,
        };
      }
    }
  }
  
  log.debug('[ContentExtractor] No hero image found');
  return null;
}

/**
 * Check if image is likely actual content (not logo, icon, tracking, or social card)
 */
function isContentImage(src: string, img: HTMLImageElement): boolean {
  const srcLower = src.toLowerCase();
  
  // Skip tracking pixels and analytics
  if (/pixel|track|beacon|analytics|doubleclick|facebook\.com\/tr|\.gif\?/.test(srcLower)) {
    return false;
  }
  
  // Skip common logo/branding patterns
  if (/logo|brand|icon|favicon|sprite|badge|button|avatar|profile/i.test(srcLower)) {
    return false;
  }
  
  // Skip social media share images (often branded cards)
  if (/share|social|og-image|twitter-card|card-image|meta-image/i.test(srcLower)) {
    return false;
  }
  
  // Check alt/class for logo hints
  const alt = (img.alt || '').toLowerCase();
  const className = (img.className || '').toLowerCase();
  if (/logo|icon|brand|avatar/i.test(alt + ' ' + className)) {
    return false;
  }
  
  // Check dimensions - skip very small images
  const width = img.naturalWidth || img.width || parseInt(img.getAttribute('width') || '0');
  const height = img.naturalHeight || img.height || parseInt(img.getAttribute('height') || '0');
  
  // If we have dimensions, require reasonable size
  if (width > 0 && height > 0) {
    // Skip tiny images (icons, bullets)
    if (width < 100 && height < 100) return false;
    
    // Skip very wide/short images (likely banners/ads)
    const ratio = width / height;
    if (ratio > 5 || ratio < 0.15) return false;
  }
  
  return true;
}

/**
 * Get caption from figure element if present
 */
function getFigureCaption(img: HTMLImageElement): string {
  const figure = img.closest('figure');
  if (figure) {
    const figcaption = figure.querySelector('figcaption');
    return figcaption?.textContent?.trim() || '';
  }
  return '';
}

/**
 * Get the best available src from an image element
 */
function getImageSrc(img: HTMLImageElement): string {
  // Try regular src first
  let src = img.src;
  
  // Check if it's a placeholder
  if (!src || src.startsWith('data:') || src.includes('placeholder') || src.includes('blank')) {
    // Try lazy loading attributes
    const lazyAttrs = ['data-src', 'data-lazy-src', 'data-original', 'data-srcset'];
    for (const attr of lazyAttrs) {
      const lazySrc = img.getAttribute(attr);
      if (lazySrc && !lazySrc.startsWith('data:')) {
        src = lazySrc.split(',')[0].trim().split(' ')[0];
        break;
      }
    }
  }
  
  // Try srcset for high-res version
  const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
  if (srcset) {
    const parts = srcset.split(',')
      .map(s => s.trim().split(' '))
      .filter(p => p[0] && !p[0].startsWith('data:'))
      .sort((a, b) => parseInt(b[1] || '0') - parseInt(a[1] || '0'));
    if (parts.length > 0 && parts[0][0]) {
      src = parts[0][0];
    }
  }
  
  return src;
}


/**
 * Create HTML for hero image
 */
function createHeroImageHtml(image: ExtractedImage): string {
  const altAttr = image.alt ? ` alt="${escapeHtmlAttr(image.alt)}"` : '';
  return `<figure class="hero-image"><img src="${escapeHtmlAttr(image.src)}"${altAttr} style="max-width:100%;height:auto;display:block;margin:0 auto 24px;"></figure>`;
}

/**
 * Escape HTML attribute value
 */
function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Fallback extraction using content container detection
 */
function extractFallback(): ExtractedContent {
  log.debug('[ContentExtractor] Using fallback extraction');
  
  const title = extractTitle();
  const byline = extractByline();
  const publishedDate = extractDate();
  
  // Find hero image first
  const heroImage = findHeroImage();
  
  // Find the best content container
  const contentElement = findContentElement();
  
  if (!contentElement) {
    log.debug('[ContentExtractor] No content container found, using body');
    return createEmptyResult(title);
  }
  
  // Clone and clean the content
  const clone = contentElement.cloneNode(true) as HTMLElement;
  
  // Fix images before cleaning
  clone.querySelectorAll('img').forEach(img => {
    fixImageSourceInClone(img);
  });
  
  cleanFallbackContent(clone);
  
  // Prepend hero image if not already in content
  let finalHtml = clone.innerHTML;
  if (heroImage) {
    const contentHasHero = clone.querySelector(`img[src="${heroImage.src}"]`) ||
                          clone.innerHTML.includes(heroImage.src);
    if (!contentHasHero) {
      log.debug('[ContentExtractor] Adding hero image to fallback:', heroImage.src);
      const heroHtml = createHeroImageHtml(heroImage);
      finalHtml = heroHtml + finalHtml;
      clone.insertAdjacentHTML('afterbegin', heroHtml);
    }
  }
  
  const textContent = cleanText(clone.textContent || '');
  const images = extractImages(clone);
  
  log.debug('[ContentExtractor] Fallback extracted:', textContent.length, 'chars', images.length, 'images');
  
  return {
    title,
    byline,
    excerpt: textContent.substring(0, 200).trim() + '...',
    content: finalHtml,
    textContent,
    images,
    url: window.location.href,
    siteName: extractSiteName(),
    publishedDate,
    readingTime: estimateReadingTime(textContent),
  };
}

/**
 * Post-process Readability output - minimal cleaning and image fixing
 */
function postProcessContent(html: string): { html: string; element: HTMLElement } {
  const div = document.createElement('div');
  div.innerHTML = html;
  
  // Remove only clearly problematic elements
  POST_PROCESS_REMOVE.forEach(selector => {
    try {
      div.querySelectorAll(selector).forEach(el => el.remove());
    } catch { /* Skip invalid selectors */ }
  });
  
  // Clean up empty elements (but keep structure)
  div.querySelectorAll('div, span').forEach(el => {
    if (!el.textContent?.trim() && !el.querySelector('img, video, iframe, svg, pre, code, figure')) {
      el.remove();
    }
  });
  
  // Fix ALL images - handle lazy loading and ensure absolute URLs
  div.querySelectorAll('img').forEach(img => {
    fixImageSource(img);
  });
  
  // Also fix images inside picture elements
  div.querySelectorAll('picture source').forEach(source => {
    const srcset = source.getAttribute('srcset') || source.getAttribute('data-srcset');
    if (srcset) {
      source.setAttribute('srcset', makeAbsoluteUrl(srcset.split(',')[0].trim().split(' ')[0]));
    }
  });
  
  return { html: div.innerHTML, element: div };
}

/**
 * Fix image source - handle lazy loading and convert to absolute URL
 */
function fixImageSource(img: HTMLImageElement): void {
  // Common lazy-loading attributes (ordered by priority)
  const lazyAttrs = [
    'data-src',
    'data-lazy-src', 
    'data-original',
    'data-lazy',
    'data-srcset',
    'data-original-src',
    'data-hi-res-src',
    'data-full-src',
    'data-image',
    'data-url',
    'loading-src',
  ];
  
  let finalSrc = img.src;
  
  // Check if current src is invalid or a placeholder
  const isInvalidSrc = !finalSrc || 
                       finalSrc.startsWith('data:') || 
                       finalSrc.includes('placeholder') ||
                       finalSrc.includes('blank.gif') ||
                       finalSrc.includes('loading') ||
                       finalSrc.includes('spacer') ||
                       finalSrc.endsWith('.svg') && img.getAttribute('data-src'); // SVG placeholder
  
  if (isInvalidSrc) {
    // Try each lazy attribute
    for (const attr of lazyAttrs) {
      const lazySrc = img.getAttribute(attr);
      if (lazySrc && !lazySrc.startsWith('data:')) {
        // Handle srcset format (take first URL)
        finalSrc = lazySrc.split(',')[0].trim().split(' ')[0];
        break;
      }
    }
  }
  
  // Also check srcset for better resolution
  const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
  if (srcset && !finalSrc) {
    const srcsetParts = srcset.split(',');
    // Get the largest image from srcset
    const bestSrc = srcsetParts
      .map(s => s.trim().split(' '))
      .sort((a, b) => {
        const sizeA = parseInt(a[1] || '0');
        const sizeB = parseInt(b[1] || '0');
        return sizeB - sizeA;
      })[0];
    if (bestSrc) {
      finalSrc = bestSrc[0];
    }
  }
  
  // Convert to absolute URL
  if (finalSrc) {
    finalSrc = makeAbsoluteUrl(finalSrc);
    img.src = finalSrc;
    // Also set srcset to the same (prevents broken images)
    img.removeAttribute('srcset');
    img.removeAttribute('data-srcset');
  }
  
  // Ensure responsive styling
  img.style.maxWidth = '100%';
  img.style.height = 'auto';
  img.removeAttribute('loading'); // Remove lazy loading attr
}

/**
 * Convert relative URL to absolute
 */
function makeAbsoluteUrl(url: string): string {
  if (!url) return url;
  
  // Already absolute
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Protocol-relative
  if (url.startsWith('//')) {
    return window.location.protocol + url;
  }
  
  // Relative to root
  if (url.startsWith('/')) {
    return window.location.origin + url;
  }
  
  // Relative to current path
  const base = window.location.href.replace(/\/[^/]*$/, '/');
  return base + url;
}

/**
 * Fix image source in cloned document (before Readability)
 * Similar to fixImageSource but works without live DOM access
 */
function fixImageSourceInClone(img: HTMLImageElement): void {
  const lazyAttrs = [
    'data-src',
    'data-lazy-src', 
    'data-original',
    'data-lazy',
    'data-srcset',
    'data-original-src',
    'data-hi-res-src',
    'data-full-src',
    'data-image',
    'data-url',
  ];
  
  let currentSrc = img.getAttribute('src') || '';
  
  // Check if src is invalid
  const isInvalidSrc = !currentSrc || 
                       currentSrc.startsWith('data:') || 
                       currentSrc.includes('placeholder') ||
                       currentSrc.includes('blank') ||
                       currentSrc.includes('loading') ||
                       currentSrc.includes('spacer');
  
  if (isInvalidSrc) {
    for (const attr of lazyAttrs) {
      const lazySrc = img.getAttribute(attr);
      if (lazySrc && !lazySrc.startsWith('data:')) {
        currentSrc = lazySrc.split(',')[0].trim().split(' ')[0];
        break;
      }
    }
  }
  
  // Check srcset for better image
  const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
  if (srcset) {
    const srcsetParts = srcset.split(',');
    const bestSrc = srcsetParts
      .map(s => s.trim().split(' '))
      .filter(parts => parts[0] && !parts[0].startsWith('data:'))
      .sort((a, b) => parseInt(b[1] || '0') - parseInt(a[1] || '0'))[0];
    if (bestSrc && bestSrc[0]) {
      currentSrc = bestSrc[0];
    }
  }
  
  // Set absolute URL
  if (currentSrc) {
    img.setAttribute('src', makeAbsoluteUrl(currentSrc));
  }
}

/**
 * Find the best content container element
 */
function findContentElement(): HTMLElement | null {
  // Try specific content selectors first
  for (const selector of CONTENT_SELECTORS) {
    try {
      const element = document.querySelector(selector) as HTMLElement;
      if (element && hasSubstantialContent(element)) {
        log.debug('[ContentExtractor] Found content via selector:', selector);
        return element;
      }
    } catch { /* Skip invalid selectors */ }
  }
  
  // Score-based fallback
  const candidates = Array.from(document.querySelectorAll('article, section, div, main'));
  let bestElement: HTMLElement | null = null;
  let bestScore = 0;
  
  for (const el of candidates) {
    const element = el as HTMLElement;
    const score = scoreElement(element);
    if (score > bestScore) {
      bestScore = score;
      bestElement = element;
    }
  }
  
  if (bestElement && bestScore > 50) {
    log.debug('[ContentExtractor] Found content via scoring, score:', bestScore);
    return bestElement;
  }
  
  return null;
}

/**
 * Check if element has substantial content
 */
function hasSubstantialContent(element: HTMLElement): boolean {
  const text = element.textContent || '';
  const paragraphs = element.querySelectorAll('p');
  return text.length > 500 || paragraphs.length > 3;
}

/**
 * Score an element's likelihood of being main content
 */
function scoreElement(element: HTMLElement): number {
  let score = 0;
  const text = element.textContent || '';
  const html = element.innerHTML || '';
  
  // Text density (text / html ratio)
  const textDensity = html.length > 0 ? text.length / html.length : 0;
  if (textDensity > 0.25) score += 20;
  
  // Text length
  score += Math.min(text.length / 50, 30);
  
  // Paragraph count
  const paragraphs = element.querySelectorAll('p');
  score += Math.min(paragraphs.length * 5, 25);
  
  // Heading presence
  const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
  score += Math.min(headings.length * 3, 15);
  
  // Code blocks (technical articles)
  const codeBlocks = element.querySelectorAll('pre, code');
  score += Math.min(codeBlocks.length * 2, 10);
  
  // Negative: high link density (navigation)
  const links = element.querySelectorAll('a');
  const linkText = Array.from(links).reduce((sum, a) => sum + (a.textContent?.length || 0), 0);
  const linkDensity = text.length > 0 ? linkText / text.length : 1;
  if (linkDensity > 0.4) score -= 40;
  
  // Negative: class/id hints
  const classId = (element.className + ' ' + element.id).toLowerCase();
  if (/nav|menu|sidebar|footer|header|comment|ad|share|social/.test(classId)) {
    score -= 30;
  }
  if (/article|content|post|story|entry|main|body/.test(classId)) {
    score += 20;
  }
  
  return score;
}

/**
 * Clean fallback content (more aggressive than Readability post-processing)
 */
function cleanFallbackContent(element: HTMLElement): void {
  // Remove common non-content elements
  const toRemove = [
    'script', 'style', 'noscript', 'nav', 'aside',
    'header:not(article header)', 'footer:not(article footer)',
    'form', 'input', 'button', 'select', 'textarea',
    '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
    '[class*="sidebar"]', '[class*="widget"]', '[class*="ad-"]',
    '[class*="share"]', '[class*="social"]', '[class*="comment"]',
    '[class*="related"]', '[class*="recommended"]',
  ];
  
  toRemove.forEach(selector => {
    try {
      element.querySelectorAll(selector).forEach(el => el.remove());
    } catch { /* Skip */ }
  });
  
  // Remove event handlers
  element.querySelectorAll('*').forEach(el => {
    ['onclick', 'onload', 'onerror', 'onmouseover'].forEach(attr => {
      el.removeAttribute(attr);
    });
  });
}

/**
 * Extract images from content element
 */
function extractImages(element: HTMLElement): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const seen = new Set<string>();
  
  element.querySelectorAll('img').forEach(img => {
    // Get the best available source (already fixed by postProcessContent)
    let src = img.src;
    
    // Also try lazy-loading attributes if src is empty
    if (!src || src.startsWith('data:')) {
      const lazyAttrs = ['data-src', 'data-lazy-src', 'data-original', 'data-lazy'];
      for (const attr of lazyAttrs) {
        const lazySrc = img.getAttribute(attr);
        if (lazySrc && !lazySrc.startsWith('data:')) {
          src = makeAbsoluteUrl(lazySrc);
          break;
        }
      }
    }
    
    // Skip if no valid source
    if (!src || src.startsWith('data:')) return;
    
    // Normalize and deduplicate
    src = makeAbsoluteUrl(src);
    if (seen.has(src)) return;
    seen.add(src);
    
    // Skip obvious tracking/ad patterns
    const srcLower = src.toLowerCase();
    if (/pixel\.|track\.|beacon\.|analytics\.|doubleclick\.|facebook\.com\/tr|\.gif\?/.test(srcLower)) {
      return;
    }
    
    // Get dimensions (may be 0 for lazy-loaded images, that's OK)
    const width = img.naturalWidth || img.width || parseInt(img.getAttribute('width') || '0');
    const height = img.naturalHeight || img.height || parseInt(img.getAttribute('height') || '0');
    
    // Only filter by size if we have valid dimensions AND they're tiny
    // Many lazy-loaded images will have 0 dimensions until loaded
    if (width > 0 && height > 0 && width < 50 && height < 50) {
      return; // Skip tiny icons
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
  
  log.debug('[ContentExtractor] Extracted', images.length, 'images');
  return images;
}

/**
 * Extract article title
 */
function extractTitle(): string {
  // Try semantic selectors
  const selectors = [
    'h1[class*="title"]',
    'h1[class*="headline"]',
    '[class*="article-title"]',
    '[class*="post-title"]',
    '[itemprop="headline"]',
    'article h1',
    'main h1',
    'h1',
  ];
  
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      const text = el?.textContent?.trim();
      if (text && text.length > 5 && text.length < 300) {
        return text;
      }
    } catch { /* Skip */ }
  }
  
  // Try meta tags
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
  if (ogTitle) return ogTitle;
  
  return document.title || 'Untitled';
}

/**
 * Extract author/byline
 */
function extractByline(): string {
  const selectors = [
    '[rel="author"]',
    '[class*="author"]',
    '[class*="byline"]',
    '[itemprop="author"]',
    'address',
  ];
  
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      const text = el?.textContent?.trim();
      if (text && text.length > 2 && text.length < 100) {
        return text;
      }
    } catch { /* Skip */ }
  }
  
  const metaAuthor = document.querySelector('meta[name="author"]')?.getAttribute('content');
  return metaAuthor || '';
}

/**
 * Extract publication date
 */
function extractDate(): string | null {
  // Try time element with datetime
  const timeEl = document.querySelector('time[datetime]');
  if (timeEl) {
    return timeEl.getAttribute('datetime') || timeEl.textContent?.trim() || null;
  }
  
  // Try meta tags
  const metaDate = document.querySelector('meta[property="article:published_time"]')?.getAttribute('content')
    || document.querySelector('meta[name="date"]')?.getAttribute('content')
    || document.querySelector('meta[name="DC.date"]')?.getAttribute('content');
  
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
 * Clean text content
 */
function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/\t/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/**
 * Create empty result with title only
 */
function createEmptyResult(title: string): ExtractedContent {
  return {
    title,
    byline: '',
    excerpt: '',
    content: '',
    textContent: '',
    images: [],
    url: window.location.href,
    siteName: extractSiteName(),
    publishedDate: null,
    readingTime: 0,
  };
}

/**
 * Extract content from React/SPA rendered pages
 * These pages often render content dynamically via JavaScript
 */
function extractFromReactSPA(): ExtractedContent | null {
  try {
    log.debug('[ContentExtractor] Attempting React/SPA extraction');
    
    // Common React app root selectors
    const reactRoots = ['#root', '#app', '#__next', '#__nuxt', '[data-reactroot]', '[data-react-root]'];
    
    let contentContainer: Element | null = null;
    
    // Try to find the React root
    for (const selector of reactRoots) {
      const root = document.querySelector(selector);
      if (root && root.textContent && root.textContent.trim().length > 200) {
        contentContainer = root;
        break;
      }
    }
    
    if (!contentContainer) {
      // Try body as fallback for SPA
      if (document.body.textContent && document.body.textContent.trim().length > 200) {
        contentContainer = document.body;
      }
    }
    
    if (!contentContainer) {
      return null;
    }
    
    // Find the largest content block within the container
    const allDivs = contentContainer.querySelectorAll('div, article, section, main');
    let bestContainer: Element | null = null;
    let bestScore = 0;
    
    for (const div of allDivs) {
      const text = div.textContent || '';
      const paragraphs = div.querySelectorAll('p');
      const score = text.length + (paragraphs.length * 100);
      
      // Skip if it's a navigation or sidebar element
      const className = (div.className || '').toLowerCase();
      const id = (div.id || '').toLowerCase();
      if (/nav|sidebar|footer|header|menu|toolbar|modal|popup|overlay/i.test(className + ' ' + id)) {
        continue;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestContainer = div;
      }
    }
    
    if (!bestContainer || bestScore < 500) {
      // Use the whole container
      bestContainer = contentContainer;
    }
    
    // Clone and clean
    const clone = bestContainer.cloneNode(true) as HTMLElement;
    
    // Remove non-content elements
    clone.querySelectorAll('script, style, noscript, nav, footer, header, [role="navigation"], [role="banner"], [class*="nav"], [class*="menu"], [class*="sidebar"]').forEach(el => el.remove());
    
    // Fix images
    clone.querySelectorAll('img').forEach(img => {
      fixImageSource(img as HTMLImageElement);
    });
    
    const textContent = cleanText(clone.textContent || '');
    const images = extractImages(clone);
    
    if (textContent.length < 100) {
      return null;
    }
    
    log.debug('[ContentExtractor] React/SPA extraction got:', textContent.length, 'chars');
    
    return {
      title: extractTitle(),
      byline: extractByline(),
      excerpt: textContent.substring(0, 200).trim() + '...',
      content: clone.innerHTML,
      textContent,
      images,
      url: window.location.href,
      siteName: extractSiteName(),
      publishedDate: extractDate(),
      readingTime: estimateReadingTime(textContent),
    };
  } catch (error) {
    log.error('[ContentExtractor] React/SPA extraction failed:', error);
    return null;
  }
}

/**
 * Extract visible content directly from the DOM
 * This is a last resort when other methods fail
 */
function extractFromVisibleContent(): ExtractedContent {
  log.debug('[ContentExtractor] Extracting visible content');
  
  const title = extractTitle();
  const textParts: string[] = [];
  const htmlParts: string[] = [];
  const images: ExtractedImage[] = [];
  const seenImages = new Set<string>();
  
  // Walk through all visible elements
  function processElement(element: Element): void {
    // Skip invisible elements
    if (!isElementVisible(element)) {
      return;
    }
    
    const tagName = element.tagName.toLowerCase();
    
    // Skip non-content elements
    if (['script', 'style', 'noscript', 'nav', 'footer', 'header', 'aside', 'svg', 'canvas', 'video', 'audio', 'iframe'].includes(tagName)) {
      return;
    }
    
    // Skip elements that are likely navigation/chrome
    const className = (element.className || '').toLowerCase();
    const id = (element.id || '').toLowerCase();
    if (/nav|menu|sidebar|toolbar|modal|popup|overlay|cookie|consent|banner/i.test(className + ' ' + id)) {
      return;
    }
    
    // Handle images
    if (tagName === 'img') {
      const imgEl = element as HTMLImageElement;
      const src = getImageSrc(imgEl);
      if (src && !seenImages.has(src) && isContentImage(src, imgEl)) {
        seenImages.add(src);
        images.push({
          src: makeAbsoluteUrl(src),
          alt: imgEl.alt || '',
          caption: getFigureCaption(imgEl),
          width: imgEl.naturalWidth || imgEl.width || 0,
          height: imgEl.naturalHeight || imgEl.height || 0,
        });
      }
      return;
    }
    
    // Handle text-containing elements
    if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 'blockquote', 'pre', 'code'].includes(tagName)) {
      const text = element.textContent?.trim();
      if (text && text.length > 10) {
        textParts.push(text);
        
        // Clone for HTML
        const clone = element.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style').forEach(el => el.remove());
        htmlParts.push(clone.outerHTML);
      }
      return;
    }
    
    // Recurse into children for container elements
    for (const child of element.children) {
      processElement(child);
    }
  }
  
  // Start from body
  processElement(document.body);
  
  const textContent = cleanText(textParts.join('\n\n'));
  const htmlContent = htmlParts.join('\n');
  
  log.debug('[ContentExtractor] Visible content extraction got:', textContent.length, 'chars,', images.length, 'images');
  
  return {
    title,
    byline: extractByline(),
    excerpt: textContent.substring(0, 200).trim() + (textContent.length > 200 ? '...' : ''),
    content: htmlContent || `<div>${textContent.split('\n\n').map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>`,
    textContent,
    images,
    url: window.location.href,
    siteName: extractSiteName(),
    publishedDate: extractDate(),
    readingTime: estimateReadingTime(textContent),
  };
}

/**
 * Generate a clean reader-view HTML document
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
    
    .reader-content pre {
      font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 14px;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 24px 0;
    }
    
    .reader-content code {
      font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 14px;
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
    }
    
    .reader-content pre code {
      padding: 0;
      background: none;
      color: inherit;
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
      body { background: white; }
      .reader-container { max-width: none; padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="reader-container">
    <header class="reader-header">
      <div class="reader-meta">
        <span><strong>${escapeHtml(content.siteName)}</strong></span>
        ${content.publishedDate ? `<span>${escapeHtml(content.publishedDate)}</span>` : ''}
        <span>${content.readingTime} min read</span>
      </div>
      <h1 class="reader-title">${escapeHtml(content.title)}</h1>
      ${content.byline ? `<div class="reader-byline">${escapeHtml(content.byline)}</div>` : ''}
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

// escapeHtml is imported from shared/utils/formatters

/**
 * Convert extracted content to HTML blob for PDF generation
 */
export function contentToHtmlBlob(content: ExtractedContent): Blob {
  const html = generateReaderView(content);
  return new Blob([html], { type: 'text/html' });
}
