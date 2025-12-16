/**
 * Content Script
 * 
 * Injected into web pages to scan for observables and provide highlighting.
 */

import { loggers } from '../shared/utils/logger';

const log = loggers.content;

import type {
  DetectedObservable,
  DetectedSDO,
  ScanResultPayload,
} from '../shared/types';
import { getTextNodes } from '../shared/detection/detector';
import {
  parsePrefixedType,
  isNonDefaultPlatformEntity,
  getPlatformFromEntity,
  getDisplayType,
  createPrefixedType,
  PLATFORM_REGISTRY,
  type PlatformType,
} from '../shared/platform';
import { jsPDF } from 'jspdf';
import { 
  extractContent, 
  generateReaderView,
  generatePDF as generateEnhancedPDF,
  type ExtractedContent 
} from '../shared/extraction';

// ============================================================================
// Article Extraction & PDF Generation Utilities
// ============================================================================

/**
 * Extract clean article content using the enhanced extraction module
 * This extracts just the main article content, removing menus, sidebars, etc.
 * Uses print-mode optimization and multiple heuristics for best results.
 */
function extractArticleContent(): { title: string; content: string; textContent: string; excerpt: string; byline: string } {
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
function getFullExtractedContent(): ExtractedContent {
  return extractContent();
}

/**
 * Fallback content extraction when Readability fails - returns HTML
 * Thoroughly cleans overlays, modals, popups, and non-content elements
 */
function getFallbackContent(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  
  // Comprehensive list of elements to remove
  const selectorsToRemove = [
    // Core non-content elements
    'script', 'style', 'noscript', 'iframe', 'svg', 'canvas', 'video', 'audio',
    'object', 'embed', 'applet', 'form', 'input', 'button', 'select', 'textarea',
    // Navigation and structural
    'nav', 'header', 'footer', 'aside', 'menu', 'menuitem',
    // Common overlay/modal patterns
    '[class*="overlay"]', '[class*="modal"]', '[class*="popup"]', '[class*="dialog"]',
    '[class*="lightbox"]', '[class*="drawer"]', '[class*="sheet"]', '[class*="backdrop"]',
    '[id*="overlay"]', '[id*="modal"]', '[id*="popup"]', '[id*="dialog"]',
    // Cookie/consent banners
    '[class*="cookie"]', '[class*="consent"]', '[class*="gdpr"]', '[class*="privacy-"]',
    '[class*="banner"]', '[class*="notice"]', '[class*="alert"]',
    '[id*="cookie"]', '[id*="consent"]', '[id*="gdpr"]', '[id*="banner"]',
    // Sticky/fixed elements
    '[class*="sticky"]', '[class*="fixed"]', '[class*="floating"]',
    '[class*="toolbar"]', '[class*="toast"]', '[class*="snackbar"]',
    // Ads and promotions
    '[class*="ad-"]', '[class*="advert"]', '[class*="advertisement"]', '[class*="sponsor"]',
    '[class*="promo"]', '[class*="promotion"]', '[class*="cta"]',
    '[id*="ad-"]', '[id*="advert"]', '[id*="sponsor"]',
    // Social and sharing
    '[class*="share"]', '[class*="social"]', '[class*="follow"]', '[class*="like"]',
    // Comments and related content
    '[class*="comment"]', '[class*="related"]', '[class*="recommended"]', '[class*="suggested"]',
    '[class*="sidebar"]', '[class*="widget"]',
    // Newsletter and subscription
    '[class*="newsletter"]', '[class*="subscribe"]', '[class*="signup"]', '[class*="login"]',
    '[class*="paywall"]', '[class*="subscription"]', '[class*="premium"]',
    // Navigation elements
    '[class*="breadcrumb"]', '[class*="pagination"]', '[class*="nav-"]', '[class*="menu-"]',
    // ARIA roles for non-content
    '[role="navigation"]', '[role="banner"]', '[role="complementary"]', '[role="contentinfo"]',
    '[role="search"]', '[role="form"]', '[role="menu"]', '[role="menubar"]', '[role="dialog"]',
    '[role="alertdialog"]', '[role="tooltip"]', '[role="status"]', '[role="alert"]',
    // Hidden elements
    '[hidden]', '[aria-hidden="true"]',
    // Common framework overlays
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
    // Also check computed style for fixed elements
    try {
      const computed = window.getComputedStyle(el as HTMLElement);
      if (computed.position === 'fixed' || computed.position === 'sticky') {
        el.remove();
        return;
      }
      // Remove elements with very high z-index (likely overlays)
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
 * Clean HTML content from Readability output - removes overlays, modals, and problematic elements
 * This ensures the content field doesn't have elements that prevent text selection
 * Note: Preserves CSS styling (style tags, inline styles, classes) for proper rendering
 */
function cleanArticleHtml(html: string): string {
  if (!html) return '';
  
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Remove problematic elements that interfere with content display
  // Note: We keep 'style' tags and inline styles to preserve CSS styling
  const selectorsToRemove = [
    // Scripts and interactive elements (should be gone, but double-check)
    'script', 'noscript', 'iframe', 'object', 'embed',
    'form', 'input', 'button', 'select', 'textarea',
    // Overlay patterns
    '[class*="overlay"]', '[class*="modal"]', '[class*="popup"]', '[class*="dialog"]',
    '[class*="backdrop"]', '[class*="lightbox"]',
    '[id*="overlay"]', '[id*="modal"]', '[id*="popup"]',
    // Cookie/banner patterns
    '[class*="cookie"]', '[class*="consent"]', '[class*="banner"]', '[class*="notice"]',
    '[id*="cookie"]', '[id*="consent"]', '[id*="banner"]',
    // Fixed/sticky elements that may interfere
    '[class*="sticky"]', '[class*="fixed"]', '[class*="floating"]',
    '[class*="toolbar"]', '[class*="toast"]',
    // Ads
    '[class*="ad-"]', '[class*="advert"]', '[class*="sponsor"]', '[class*="promo"]',
    // Social/share widgets
    '[class*="share"]', '[class*="social"]',
    // Newsletter/subscription
    '[class*="newsletter"]', '[class*="subscribe"]', '[class*="paywall"]',
    // Navigation elements
    '[class*="breadcrumb"]', '[class*="pagination"]',
    // ARIA roles for overlays
    '[role="dialog"]', '[role="alertdialog"]', '[role="tooltip"]',
    // Hidden elements
    '[hidden]', '[aria-hidden="true"]',
    // Framework overlays
    '.MuiModal-root', '.MuiBackdrop-root', '.MuiDialog-root',
    '.ReactModal__Overlay', '.ReactModal__Content',
  ];
  
  selectorsToRemove.forEach(selector => {
    try {
      temp.querySelectorAll(selector).forEach(el => el.remove());
    } catch { /* Skip invalid selectors */ }
  });
  
  // Remove only event handlers and problematic data attributes (preserve styling)
  temp.querySelectorAll('*').forEach(el => {
    // Remove JavaScript event handlers
    el.removeAttribute('onclick');
    el.removeAttribute('onload');
    el.removeAttribute('onerror');
    el.removeAttribute('onmouseover');
    el.removeAttribute('onmouseout');
    el.removeAttribute('onfocus');
    el.removeAttribute('onblur');
    el.removeAttribute('onsubmit');
    el.removeAttribute('onchange');
    el.removeAttribute('onkeydown');
    el.removeAttribute('onkeyup');
    el.removeAttribute('onkeypress');
    // Remove problematic data attributes
    el.removeAttribute('data-scroll-lock');
    el.removeAttribute('data-overlay');
    el.removeAttribute('data-modal');
    // Note: We intentionally keep style, class, and id attributes for proper styling
  });
  
  // Remove empty wrapper elements (but preserve structural elements with styling)
  temp.querySelectorAll('div, span').forEach(el => {
    const hasText = el.textContent?.trim();
    const hasContent = el.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, li, table, img, figure, blockquote, pre, code, a');
    const hasStyle = el.hasAttribute('style') || el.hasAttribute('class');
    // Only remove if no text, no content children, and no styling
    if (!hasText && !hasContent && !hasStyle) {
      el.remove();
    }
  });
  
  return temp.innerHTML;
}

/**
 * Clean article text by removing paywall/subscription messages and other boilerplate
 * This function handles common patterns from news sites (Le Monde, NYT, WSJ, etc.)
 */
function cleanArticleText(text: string): string {
  if (!text) return '';
  
  // Common paywall/subscription patterns to remove (multiple languages)
  const patternsToRemove = [
    // French patterns (Le Monde, Le Figaro, etc.)
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
    
    // English patterns (NYT, WSJ, Guardian, etc.)
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
    
    // Common UI elements that slip through
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
    
    // Social media prompts
    /Share on Facebook/gi,
    /Share on Twitter/gi,
    /Share on LinkedIn/gi,
    /Partager sur Facebook/gi,
    /Partager sur Twitter/gi,
    
    // Cookie/GDPR notices that might slip through
    /Nous utilisons des cookies/gi,
    /We use cookies/gi,
    /Accepter et continuer/gi,
    /Accept and continue/gi,
  ];
  
  let cleanedText = text;
  
  // Apply all pattern removals
  for (const pattern of patternsToRemove) {
    cleanedText = cleanedText.replace(pattern, '');
  }
  
  // Clean up whitespace artifacts left by removals
  cleanedText = cleanedText
    .replace(/\n{3,}/g, '\n\n')  // Multiple newlines to double
    .replace(/[ \t]{2,}/g, ' ')  // Multiple spaces to single
    .replace(/^\s+/gm, '')       // Leading whitespace on lines
    .replace(/\s+$/gm, '')       // Trailing whitespace on lines
    .replace(/\n\s*\n\s*\n/g, '\n\n')  // Clean up empty lines
    .trim();
  
  return cleanedText;
}

/**
 * Fallback text content extraction - returns clean text
 */
function getFallbackTextContent(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  
  // Remove non-content elements
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
  
  // Get and clean text
  let text = clone.textContent || clone.innerText || '';
  text = text
    .replace(/[\t\r]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
  
  // Apply article text cleaning to remove paywall messages
  return cleanArticleText(text);
}

/**
 * Extract the first meaningful paragraph from article text for description
 */
function extractFirstParagraph(textContent: string, maxLength = 500): string {
  if (!textContent) return '';
  
  // First, apply text cleaning to remove any remaining boilerplate
  const cleanedContent = cleanArticleText(textContent);
  
  // Split by double newlines to get paragraphs
  const paragraphs = cleanedContent
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => {
      // Skip short fragments (likely navigation or section labels)
      if (p.length < 80) return false;
      
      // Skip paragraphs that look like navigation or labels
      const lowerP = p.toLowerCase();
      if (/^(économie|politique|international|culture|sport|sciences|société|monde|france|europe|opinion|idées|environnement|planète|afrique|amérique|asie|style|immobilier|emploi|argent)\b/i.test(p)) {
        return false;
      }
      
      // Skip paragraphs that are mostly capitalized (likely headers/labels)
      const words = p.split(/\s+/);
      const capitalizedWords = words.filter(w => w.length > 1 && w === w.toUpperCase());
      if (capitalizedWords.length > words.length * 0.5) {
        return false;
      }
      
      // Skip if paragraph is just a date/byline
      if (/^(publié|published|par |by |le \d|on \d|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i.test(p)) {
        return false;
      }
      
      return true;
    });
  
  if (paragraphs.length === 0) {
    // Fall back to first chunk of cleaned text
    const text = cleanedContent.replace(/\s+/g, ' ').trim();
    if (text.length < 80) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
  
  // Get first paragraph or combine first few short ones
  let description = paragraphs[0];
  
  // If first paragraph is short, try to combine with next
  if (description.length < 200 && paragraphs.length > 1) {
    description = paragraphs.slice(0, 2).join(' ');
  }
  
  // Truncate if needed
  if (description.length > maxLength) {
    // Try to cut at sentence boundary
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

/**
 * Load image and convert to base64 data URL for PDF embedding
 */
async function loadImageAsBase64(imgElement: HTMLImageElement): Promise<{ data: string; width: number; height: number } | null> {
  try {
    // Get the image source
    let src = imgElement.src || imgElement.dataset.src || imgElement.getAttribute('data-lazy-src') || '';
    
    // Skip if no valid source, placeholder, or data URI that's too small
    if (!src || src.startsWith('data:image/svg') || src.includes('placeholder') || src.includes('1x1')) {
      return null;
    }
    
    // For relative URLs, make them absolute
    if (src.startsWith('/')) {
      src = window.location.origin + src;
    } else if (!src.startsWith('http') && !src.startsWith('data:')) {
      src = new URL(src, window.location.href).href;
    }
    
    // Create a canvas to draw the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Create a new image to load (handles CORS)
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    return new Promise((resolve) => {
      img.onload = () => {
        // Limit image size for PDF (max 800px width)
        const maxWidth = 800;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        // Skip very small images (likely icons/buttons)
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
          // CORS error - try without crossOrigin
          resolve(null);
        }
      };
      
      img.onerror = () => {
        resolve(null);
      };
      
      // Timeout after 3 seconds
      setTimeout(() => resolve(null), 3000);
      
      img.src = src;
    });
  } catch {
    return null;
  }
}

/**
 * Generate PDF from article content using enhanced extraction
 * Uses the new extraction module for cleaner content and better image handling
 * Returns base64 encoded PDF data
 */
async function generateArticlePDF(): Promise<{ data: string; filename: string } | null> {
  try {
    // Use the enhanced extractor for better content
    const extractedContent = getFullExtractedContent();
    
    if (!extractedContent.content && !extractedContent.textContent) {
      log.warn(' No article content to generate PDF');
      return null;
    }
    
    log.debug(' Starting enhanced PDF generation, title:', extractedContent.title, 'images:', extractedContent.images.length);
    
    // Use the enhanced PDF generator
    const result = await generateEnhancedPDF(extractedContent, {
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
    
    // Fallback to legacy generation if enhanced fails
    log.warn(' Enhanced PDF generation failed, falling back to legacy method');
    return generateLegacyPDF(extractedContent);
  } catch (error) {
    log.error(' Failed to generate PDF:', error);
    return generateSimpleTextPDF();
  }
}

/**
 * Legacy PDF generation for fallback (preserved from original implementation)
 */
async function generateLegacyPDF(article: { title: string; content: string; textContent: string }): Promise<{ data: string; filename: string } | null> {
  try {
    log.debug(' Starting legacy PDF generation, article title:', article.title);
    
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
    
    // Helper to check if we need a new page
    const checkPageBreak = (neededHeight: number) => {
      if (yPosition + neededHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };
    
    // Helper to add image to PDF
    const addImageToPDF = async (imgElement: HTMLImageElement) => {
      const imageData = await loadImageAsBase64(imgElement);
      if (!imageData) return;
      
      // Convert pixels to mm (assuming 96 DPI)
      const pxToMm = 0.264583;
      let imgWidthMm = imageData.width * pxToMm;
      let imgHeightMm = imageData.height * pxToMm;
      
      // Scale to fit content width if needed
      if (imgWidthMm > contentWidth) {
        const scale = contentWidth / imgWidthMm;
        imgWidthMm = contentWidth;
        imgHeightMm = imgHeightMm * scale;
      }
      
      // Check if we need a new page
      checkPageBreak(imgHeightMm + 5);
      
      try {
        pdf.addImage(imageData.data, 'JPEG', margin, yPosition, imgWidthMm, imgHeightMm);
        yPosition += imgHeightMm + 5;
        
        // Add caption if available
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
    
    // Header - blue line
    pdf.setFillColor(0, 27, 218);
    pdf.rect(margin, margin, contentWidth, 0.5, 'F');
    yPosition += 5;
    
    // Header text
    pdf.setFontSize(10);
    pdf.setTextColor(0, 27, 218);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Filigran XTM Browser Extension', margin, yPosition);
    yPosition += 5;
    
    // Date
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
    
    // Parse and render HTML content with formatting
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = article.content;
    
    // Remove only truly non-content elements (keep most content)
    const removeSelectors = ['script', 'style', 'iframe', 'noscript', 'button', 'input', 'form'];
    removeSelectors.forEach(sel => {
      tempDiv.querySelectorAll(sel).forEach(el => el.remove());
    });
    
    // Collect all images for processing
    const images = Array.from(tempDiv.querySelectorAll('img'));
    const imagePromises: Map<HTMLImageElement, Promise<{ data: string; width: number; height: number } | null>> = new Map();
    
    // Pre-load images in parallel
    for (const img of images) {
      imagePromises.set(img, loadImageAsBase64(img));
    }
    
    // Process content recursively (now async to handle images)
    const processNode = async (node: Node, isBold = false, isItalic = false, fontSize = 11) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          // Set font style
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
        
        // Handle different elements
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
            // Render links with URL
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
            // Add image to PDF
            await addImageToPDF(el as HTMLImageElement);
            break;
          case 'figure':
            // Process figure (typically contains img and figcaption)
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
          case 'div':
          case 'section':
          case 'article':
          case 'span':
          case 'figcaption':
          case 'picture':
          case 'source':
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
    
    // Process all content
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
    
    // Generate filename
    const filename = `${sanitizeFilename(article.title)}.pdf`;
    
    // Get PDF as base64
    const pdfOutput = pdf.output('datauristring');
    const base64Data = pdfOutput.split(',')[1];
    
    log.debug(' Legacy PDF generated successfully, base64 length:', base64Data.length);
    
    return {
      data: base64Data,
      filename: filename,
    };
  } catch (error) {
    log.error(' Failed to generate legacy PDF:', error);
    return null;
  }
}

/**
 * Fallback: Generate simple text-based PDF when HTML rendering fails
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
    
    // Clean the text content
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
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Convert Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Remove the data URL prefix to get just the base64 data
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Sanitize filename for PDF
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 100); // Limit length
}

// ============================================================================
// Global State
// ============================================================================

let scanResults: ScanResultPayload | null = null;
let highlights: HTMLElement[] = [];
let panelFrame: HTMLIFrameElement | null = null;
let panelOverlay: HTMLDivElement | null = null;
let selectedEntity: DetectedObservable | DetectedSDO | null = null;
let selectedForImport: Set<string> = new Set(); // Track selected items for bulk import
let highlightClickInProgress = false; // Prevent panel close during highlight navigation
// Track current mode to control highlight behavior
// 'scan' = highlights persist when panel closes, clicking highlight re-opens panel
// 'atomic' | 'scenario' | 'investigation' | null = highlights cleared when panel closes
let currentScanMode: 'scan' | 'atomic' | 'scenario' | 'investigation' | null = null;
// Store last scan data for re-opening panel from highlight clicks
let lastScanData: ScanResultPayload | null = null;

// ============================================================================
// Panel Communication Utility (with ready-state queuing)
// ============================================================================

// Track panel ready state and queue messages until ready
let isPanelReady = false;
const panelMessageQueue: Array<{ type: string; payload?: unknown }> = [];

/**
 * Send a message to the panel iframe.
 * If the panel is not ready yet, the message is queued and will be sent when the panel signals ready.
 * This prevents race conditions where scan results are lost if sent before the panel loads.
 */
function sendPanelMessage(type: string, payload?: unknown): void {
  if (!panelFrame?.contentWindow) {
    log.debug(`Cannot send panel message '${type}': panel not available`);
    return;
  }
  
  if (!isPanelReady) {
    // Queue the message until panel is ready
    log.debug(` sendPanelMessage: Panel not ready, queuing '${type}'`);
    panelMessageQueue.push({ type, payload });
    return;
  }
  
  log.debug(` sendPanelMessage: Sending '${type}' to panel iframe`);
  panelFrame.contentWindow.postMessage({ type, payload }, '*');
}

/**
 * Flush all queued messages to the panel.
 * Called when the panel signals it's ready.
 */
function flushPanelMessageQueue(): void {
  if (!panelFrame?.contentWindow) {
    log.warn('Cannot flush panel queue: panel not available');
    return;
  }
  
  log.debug(` Flushing ${panelMessageQueue.length} queued panel messages`);
  while (panelMessageQueue.length > 0) {
    const msg = panelMessageQueue.shift();
    if (msg) {
      log.debug(` sendPanelMessage: Sending queued '${msg.type}' to panel iframe`);
      panelFrame.contentWindow.postMessage(msg, '*');
    }
  }
}

// ============================================================================
// CSS Styles
// ============================================================================

const HIGHLIGHT_STYLES = `
  /* ========================================
     BASE HIGHLIGHT STYLES - BULLETPROOF
     Force full borders visible above ALL page elements
     ======================================== */
  .xtm-highlight {
    /* Use inline-block to ensure borders are fully rendered */
    display: inline-block !important;
    position: relative !important;
    
    /* Maximum z-index to be above everything except our own UI */
    z-index: 2147483640 !important;
    
    /* Visual styling */
    border-radius: 4px !important;
    padding: 3px 24px 3px 8px !important;
    margin: 2px 2px !important;
    cursor: pointer !important;
    text-decoration: none !important;
    vertical-align: middle !important;
    line-height: 1.4 !important;
    box-sizing: border-box !important;
    
    /* Inherit text properties */
    font-size: inherit !important;
    font-family: inherit !important;
    font-weight: inherit !important;
    color: inherit !important;
    
    /* Border styling - explicit */
    border-width: 2px !important;
    border-style: solid !important;
    border-color: currentColor !important;
    
    /* Multi-line support - ensure borders wrap with text */
    box-decoration-break: clone !important;
    -webkit-box-decoration-break: clone !important;
    
    /* FORCE VISIBILITY */
    visibility: visible !important;
    opacity: 1 !important;
    overflow: visible !important;
    clip: auto !important;
    clip-path: none !important;
    -webkit-clip-path: none !important;
    
    /* Prevent parent overflow from clipping borders */
    transform: translateZ(0) !important;
    -webkit-transform: translateZ(0) !important;
    
    /* Ensure proper stacking */
    isolation: isolate !important;
    
    /* Pointer events */
    pointer-events: auto !important;
    
    /* White space handling to prevent breaks */
    white-space: normal !important;
    word-wrap: break-word !important;
    overflow-wrap: break-word !important;
  }
  
  /* Ensure text content is present before showing icons */
  .xtm-highlight:empty {
    display: none !important;
  }
  
  /* Force visibility on highlight and children */
  .xtm-highlight,
  .xtm-highlight * {
    visibility: visible !important;
    opacity: 1 !important;
    cursor: pointer !important;
  }
  
  /* CRITICAL: Force parent elements to NOT clip highlights
     This is necessary because many websites have overflow:hidden on containers */
  *:has(> .xtm-highlight) {
    overflow: visible !important;
    clip: auto !important;
    clip-path: none !important;
    -webkit-clip-path: none !important;
  }
  
  /* Ensure clickable cursor on all interactive highlights */
  .xtm-highlight:not(.xtm-atomic-testing):not(.xtm-scenario):hover {
    cursor: pointer !important;
  }

  /* ========================================
     FOUND IN PLATFORM - Green with check icon on RIGHT
     ======================================== */
  .xtm-highlight.xtm-found {
    background: rgba(0, 200, 83, 0.25) !important;
    border: 2px solid #4caf50 !important;
    border-color: #4caf50 !important;
  }
  
  /* Check icon on RIGHT for found */
  .xtm-highlight.xtm-found::after {
    content: '' !important;
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 14px !important;
    height: 14px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300c853'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-found:hover {
    background: rgba(0, 200, 83, 0.4) !important;
    border-color: #2e7d32 !important;
    box-shadow: 0 0 8px rgba(0, 200, 83, 0.5) !important;
  }

  /* ========================================
     NOT FOUND - Amber with checkbox on LEFT, info icon on RIGHT
     ======================================== */
  .xtm-highlight.xtm-not-found {
    background: rgba(255, 167, 38, 0.25) !important;
    border: 2px solid #ffa726 !important;
    border-color: #ffa726 !important;
    padding: 4px 26px 4px 30px !important;  /* Extra space on left for checkbox */
  }
  
  /* Unchecked checkbox on LEFT */
  .xtm-highlight.xtm-not-found::before {
    content: '' !important;
    position: absolute !important;
    left: 10px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 12px !important;
    height: 12px !important;
    border: 2px solid rgba(255, 167, 38, 0.9) !important;
    border-radius: 2px !important;
    background: transparent !important;
    box-sizing: border-box !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  /* Info icon on RIGHT */
  .xtm-highlight.xtm-not-found::after {
    content: '' !important;
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 14px !important;
    height: 14px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffa726'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-not-found:hover {
    background: rgba(255, 167, 38, 0.4) !important;
    border-color: #f57c00 !important;
    box-shadow: 0 0 8px rgba(255, 167, 38, 0.5) !important;
  }

  /* ========================================
     SELECTED FOR BULK IMPORT - Checked checkbox
     ======================================== */
  .xtm-highlight.xtm-selected {
    border-color: #0fbcff !important;
    box-shadow: 0 0 8px rgba(15, 188, 255, 0.5) !important;
  }
  
  /* Checked checkbox on LEFT when selected */
  .xtm-highlight.xtm-not-found.xtm-selected::before {
    background: #0fbcff !important;
    border-color: #0fbcff !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 10px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }

  /* ========================================
     SDO NOT ADDABLE - Gray style for CVEs and other SDOs that cannot be added
     Shows detected but not in platform, without add option
     ======================================== */
  .xtm-highlight.xtm-sdo-not-addable {
    background: rgba(158, 158, 158, 0.2) !important;
    border: 2px solid #9e9e9e !important;
    border-color: #9e9e9e !important;
    padding: 2px 22px 2px 6px !important;
    cursor: default !important;  /* Not clickable */
  }
  
  /* Info icon on RIGHT for SDO not addable */
  .xtm-highlight.xtm-sdo-not-addable::after {
    content: '' !important;
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 14px !important;
    height: 14px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239e9e9e'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-sdo-not-addable:hover {
    background: rgba(158, 158, 158, 0.35) !important;
    border-color: #757575 !important;
    box-shadow: 0 0 8px rgba(158, 158, 158, 0.4) !important;
  }

  /* ========================================
     NON-DEFAULT PLATFORM ENTITIES (OpenAEV, OpenGRC, etc.)
     Uses same green color as OpenCTI for consistency
     ======================================== */
  
  /* Generic platform entity found - green style (consistent with OpenCTI) */
  .xtm-highlight.xtm-platform-found {
    background: rgba(0, 200, 83, 0.25) !important;
    border: 2px solid #4caf50 !important;
    border-color: #4caf50 !important;
  }
  
  .xtm-highlight.xtm-platform-found::after {
    content: '' !important;
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 14px !important;
    height: 14px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300c853'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-platform-found:hover {
    background: rgba(0, 200, 83, 0.4) !important;
    border-color: #2e7d32 !important;
    box-shadow: 0 0 8px rgba(0, 200, 83, 0.5) !important;
  }
  
  /* OpenAEV entity found highlight - green (consistent with OpenCTI) */
  .xtm-highlight.xtm-oaev-found {
    background: rgba(0, 200, 83, 0.25) !important;
    border: 2px solid #4caf50 !important;
    border-color: #4caf50 !important;
  }
  
  .xtm-highlight.xtm-oaev-found::after {
    content: '' !important;
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 14px !important;
    height: 14px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300c853'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-oaev-found:hover {
    background: rgba(0, 200, 83, 0.4) !important;
    border-color: #2e7d32 !important;
    box-shadow: 0 0 8px rgba(0, 200, 83, 0.5) !important;
  }

  /* ========================================
     AI DISCOVERED - Purple theme for entities discovered by AI
     Shows checkbox on left for selection, AI icon on right
     Colors from OpenCTI ThemeDark: main=#9575cd, light=#d1c4e9, dark=#673ab7
     ======================================== */
  .xtm-highlight.xtm-ai-discovered {
    background: rgba(149, 117, 205, 0.25) !important;
    border: 2px solid #9575cd !important;
    border-color: #9575cd !important;
    padding: 4px 26px 4px 30px !important;  /* Extra space on left for checkbox */
  }
  
  /* Unchecked checkbox on LEFT */
  .xtm-highlight.xtm-ai-discovered::before {
    content: '' !important;
    position: absolute !important;
    left: 10px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 12px !important;
    height: 12px !important;
    border: 2px solid #9575cd !important;
    border-radius: 3px !important;
    background: transparent !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  /* AI sparkle icon on RIGHT */
  .xtm-highlight.xtm-ai-discovered::after {
    content: '' !important;
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 14px !important;
    height: 14px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239575cd'%3E%3Cpath d='M19,8L20.5,11.5L24,13L20.5,14.5L19,18L17.5,14.5L14,13L17.5,11.5L19,8M11.1,5L13.6,10.4L19,12.9L13.6,15.4L11.1,20.8L8.6,15.4L3.2,12.9L8.6,10.4L11.1,5Z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-ai-discovered:hover {
    background: rgba(149, 117, 205, 0.4) !important;
    border-color: #673ab7 !important;
    box-shadow: 0 0 8px rgba(149, 117, 205, 0.5) !important;
  }
  
  /* Checked checkbox when AI-discovered entity is selected */
  .xtm-highlight.xtm-ai-discovered.xtm-selected::before {
    background: #9575cd !important;
    border-color: #9575cd !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 10px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }

  /* ========================================
     MIXED STATE - Not found in OpenCTI but FOUND in another platform
     Orange base with checkbox on left, green indicator on right showing found
     ======================================== */
  .xtm-highlight.xtm-mixed {
    background: linear-gradient(to right, rgba(255, 167, 38, 0.25) 70%, rgba(0, 200, 83, 0.25) 70%) !important;
    border: 2px solid !important;
    border-image: linear-gradient(to right, #ffa726 70%, #4caf50 30%) 1 !important;
    padding: 4px 40px 4px 30px !important;  /* Extra space for both icons */
  }
  
  /* Unchecked checkbox on LEFT (same as not-found) */
  .xtm-highlight.xtm-mixed::before {
    content: '' !important;
    position: absolute !important;
    left: 10px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 12px !important;
    height: 12px !important;
    border: 2px solid #ffa726 !important;
    border-radius: 2px !important;
    background: transparent !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  /* Green check icon on RIGHT for found in other platform */
  .xtm-highlight.xtm-mixed::after {
    content: '' !important;
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 28px !important;
    height: 14px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='14' viewBox='0 0 28 14'%3E%3Cpath d='M6 1h16a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5H6a5 5 0 0 1-5-5V6a5 5 0 0 1 5-5z' fill='%2300c853' fill-opacity='0.9'/%3E%3Cpath d='M11 4l-3 3-1.5-1.5-.7.7 2.2 2.3 3.7-3.8z' fill='white'/%3E%3Ctext x='16' y='10' font-size='6' fill='white' font-family='Arial'>VIEW</text%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
    cursor: pointer !important;
  }
  
  .xtm-highlight.xtm-mixed:hover {
    background: linear-gradient(to right, rgba(255, 167, 38, 0.4) 70%, rgba(0, 200, 83, 0.4) 70%) !important;
    box-shadow: 0 0 8px rgba(0, 200, 83, 0.5) !important;
  }
  
  /* Selected state for mixed */
  .xtm-highlight.xtm-mixed.xtm-selected::before {
    background: #0fbcff !important;
    border-color: #0fbcff !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 10px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }

  /* ========================================
     INVESTIGATION MODE - Purple style with checkbox on LEFT
     ======================================== */
  .xtm-highlight.xtm-investigation {
    background: rgba(103, 58, 183, 0.25) !important;
    border: 2px solid #7c4dff !important;
    border-color: #7c4dff !important;
    padding: 4px 8px 4px 30px !important;  /* Extra space on left for checkbox */
    cursor: pointer !important;
  }
  
  /* Unchecked checkbox on LEFT for investigation */
  .xtm-highlight.xtm-investigation::before {
    content: '' !important;
    position: absolute !important;
    left: 10px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 12px !important;
    height: 12px !important;
    border: 2px solid #7c4dff !important;
    border-radius: 2px !important;
    background: transparent !important;
    box-sizing: border-box !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-investigation:hover {
    background: rgba(103, 58, 183, 0.4) !important;
    border-color: #651fff !important;
    box-shadow: 0 0 8px rgba(103, 58, 183, 0.5) !important;
  }
  
  /* Selected state for investigation */
  .xtm-highlight.xtm-investigation.xtm-selected {
    background: rgba(103, 58, 183, 0.35) !important;
    border-color: #651fff !important;
    box-shadow: 0 0 8px rgba(103, 58, 183, 0.6) !important;
  }
  
  .xtm-highlight.xtm-investigation.xtm-selected::before {
    background: #7c4dff !important;
    border-color: #7c4dff !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: 8px !important;
    background-repeat: no-repeat !important;
    background-position: center !important;
  }

  /* ========================================
     ATOMIC TESTING MODE - Visual-only highlights (non-clickable)
     Colors match the panel: yellow/lime for attack patterns, teal for domains
     ======================================== */
  .xtm-highlight.xtm-atomic-testing {
    background: rgba(212, 225, 87, 0.25) !important;
    border: 2px solid #d4e157 !important;
    border-color: #d4e157 !important;
    padding: 2px 6px !important;  /* Simple padding, no extra space for icons */
    cursor: default !important;  /* Not clickable */
    pointer-events: none !important;  /* Disable all mouse events */
    border-radius: 4px !important;
  }
  
  /* No pseudo-elements for atomic testing - keep it clean */
  .xtm-highlight.xtm-atomic-testing::before,
  .xtm-highlight.xtm-atomic-testing::after {
    display: none !important;
    content: none !important;
  }
  
  /* Domain/hostname variant - cyan/teal color */
  .xtm-highlight.xtm-atomic-testing.xtm-atomic-domain {
    background: rgba(0, 188, 212, 0.25) !important;
    border-color: #00bcd4 !important;
  }
  
  /* Attack pattern variant - lime/yellow color (matches panel) */
  .xtm-highlight.xtm-atomic-testing.xtm-atomic-attack-pattern {
    background: rgba(212, 225, 87, 0.25) !important;
    border-color: #d4e157 !important;
  }

  /* ========================================
     SCENARIO MODE - Visual-only highlights (non-clickable)
     Uses same lime/yellow color as atomic testing for attack patterns
     ======================================== */
  .xtm-highlight.xtm-scenario {
    background: rgba(212, 225, 87, 0.25) !important;
    border: 2px solid #d4e157 !important;
    border-color: #d4e157 !important;
    padding: 2px 6px !important;
    cursor: default !important;
    pointer-events: none !important;
    border-radius: 4px !important;
  }
  
  /* No pseudo-elements for scenario - keep it clean */
  .xtm-highlight.xtm-scenario::before,
  .xtm-highlight.xtm-scenario::after {
    display: none !important;
    content: none !important;
  }

  /* ========================================
     TOOLTIP
     ======================================== */
  .xtm-tooltip {
    position: fixed;
    background: #070d19;
    color: rgba(255, 255, 255, 0.9);
    padding: 12px 16px;
    border-radius: 4px;
    font-size: 13px;
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 2147483647;
    pointer-events: none;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    max-width: 320px;
    opacity: 0;
    transition: opacity 0.2s ease;
  }
  
  .xtm-tooltip.visible {
    opacity: 1;
  }
  
  .xtm-tooltip-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  
  .xtm-tooltip-type {
    color: #0fbcff;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.5px;
    background: rgba(15, 188, 255, 0.15);
    padding: 2px 8px;
    border-radius: 4px;
  }
  
  .xtm-tooltip-value {
    word-break: break-all;
    margin-bottom: 8px;
    font-weight: 500;
  }
  
  .xtm-tooltip-status {
    font-size: 12px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  .xtm-tooltip-status.found {
    color: #00c853;
  }
  
  .xtm-tooltip-status.not-found {
    color: #ffa726;
  }
  
  .xtm-tooltip-action {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 6px;
  }
  
  /* ========================================
     SCAN OVERLAY
     ======================================== */
  .xtm-scan-overlay {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #070d19 0%, #09101e 100%);
    color: rgba(255, 255, 255, 0.9);
    padding: 16px 24px;
    border-radius: 8px;
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 2147483647;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .xtm-scan-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(15, 188, 255, 0.3);
    border-top-color: #0fbcff;
    border-radius: 50%;
    animation: xtm-spin 0.8s linear infinite;
  }
  
  @keyframes xtm-spin {
    to { transform: rotate(360deg); }
  }
  
  .xtm-scan-scroll-btn {
    background: #0fbcff;
    color: #001e3c;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s;
    font-family: inherit;
    margin-left: 8px;
  }
  
  .xtm-scan-scroll-btn:hover {
    background: #40caff;
    transform: translateY(-1px);
  }
  
  .xtm-scan-scroll-btn:active {
    transform: translateY(0);
  }
  
  /* Flash animation for scroll-to highlight */
  @keyframes xtm-flash {
    0%, 100% { box-shadow: 0 0 0 0 rgba(15, 188, 255, 0); }
    25%, 75% { box-shadow: 0 0 20px 8px rgba(15, 188, 255, 0.6); }
    50% { box-shadow: 0 0 30px 12px rgba(15, 188, 255, 0.8); }
  }
  
  .xtm-highlight.xtm-flash {
    animation: xtm-flash 1.5s ease-out;
  }
  
  /* ========================================
     SIDE PANEL FRAME
     ======================================== */
  .xtm-panel-frame {
    position: fixed;
    top: 0;
    right: 0;
    width: 560px;
    height: 100vh;
    border: none;
    z-index: 2147483646;
    box-shadow: -4px 0 32px rgba(0, 0, 0, 0.4);
    transition: transform 0.3s ease;
    background: #070d19;
  }
  
  .xtm-panel-frame.hidden {
    transform: translateX(100%);
  }
  
  /* Panel overlay - purely visual, pointer-events none so highlights remain clickable */
  .xtm-panel-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 560px;
    bottom: 0;
    z-index: 2147483635; /* Well below highlights (2147483640) */
    background: transparent;
    pointer-events: none; /* CRITICAL: Allow clicks to pass through to highlights */
  }
  
  .xtm-panel-overlay.hidden {
    display: none;
  }

`;

// ============================================================================
// Initialization
// ============================================================================

function injectStyles(): boolean {
  // Check if we're on a valid HTML page
  if (!document.head) {
    log.debug(' Not a valid HTML page, skipping initialization');
    return false;
  }
  
  const style = document.createElement('style');
  style.id = 'xtm-styles';
  style.textContent = HIGHLIGHT_STYLES;
  document.head.appendChild(style);
  return true;
}

function createTooltip(): HTMLElement | null {
  // Check if we're on a valid HTML page
  if (!document.body) {
    return null;
  }
  
  const tooltip = document.createElement('div');
  tooltip.className = 'xtm-tooltip';
  tooltip.id = 'xtm-tooltip';
  document.body.appendChild(tooltip);
  return tooltip;
}



function initialize(): void {
  // Check if we're on a valid HTML page
  if (!document.head || !document.body) {
    log.debug(' Not a valid HTML page, skipping initialization');
    return;
  }
  
  // Check if already initialized
  if (document.getElementById('xtm-styles')) {
    return;
  }
  
  if (!injectStyles()) {
    return;
  }
  
  createTooltip();
  
  // Listen for messages from the panel iframe
  window.addEventListener('message', async (event) => {
    if (event.data?.type === 'XTM_PANEL_READY') {
      // Panel has loaded and is ready to receive messages
      log.debug(' Panel signaled ready, flushing message queue');
      isPanelReady = true;
      flushPanelMessageQueue();
    } else if (event.data?.type === 'XTM_CLOSE_PANEL') {
      // Only clear highlights if NOT in scan mode
      // In scan mode, highlights persist and clicking them re-opens the panel
      if (currentScanMode !== 'scan') {
        clearHighlights();
        currentScanMode = null;
      }
      hidePanel();
    } else if (event.data?.type === 'XTM_CLEAR_HIGHLIGHTS') {
      // Explicit request to clear highlights (e.g., when starting a new scan from panel)
      clearHighlights();
      currentScanMode = null;
      lastScanData = null;
    } else if (event.data?.type === 'XTM_COPY_TO_CLIPBOARD' && event.data.text) {
      // Handle clipboard copy from iframe
      try {
        await navigator.clipboard.writeText(event.data.text);
      } catch {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = event.data.text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } else if (event.data?.type === 'XTM_TOGGLE_SELECTION' && event.data.value) {
      // Toggle selection from panel checkbox
      const value = event.data.value;
      const highlightEl = document.querySelector(`.xtm-highlight[data-value="${CSS.escape(value)}"]`) as HTMLElement;
      if (highlightEl) {
        toggleSelection(highlightEl, value);
      } else {
        // No highlight found, but we can still add to selection
        if (selectedForImport.has(value)) {
          selectedForImport.delete(value);
        } else {
          selectedForImport.add(value);
        }
        // Notify panel about selection change
        sendPanelMessage('SELECTION_UPDATED', {
          selectedCount: selectedForImport.size,
          selectedItems: Array.from(selectedForImport),
        });
      }
    } else if (event.data?.type === 'XTM_SELECT_ALL' && event.data.values) {
      // Select all items from panel
      const values = event.data.values as string[];
      values.forEach(value => {
        if (!selectedForImport.has(value)) {
          selectedForImport.add(value);
          // Update highlights if they exist
          document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
            el.classList.add('xtm-selected');
          });
        }
      });
      // Notify panel about selection change
      sendPanelMessage('SELECTION_UPDATED', {
        selectedCount: selectedForImport.size,
        selectedItems: Array.from(selectedForImport),
      });
    } else if (event.data?.type === 'XTM_DESELECT_ALL') {
      // Deselect all items
      selectedForImport.forEach(value => {
        document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
          el.classList.remove('xtm-selected');
        });
      });
      selectedForImport.clear();
      // Notify panel about selection change
      sendPanelMessage('SELECTION_UPDATED', {
        selectedCount: 0,
        selectedItems: [],
      });
    } else if (event.data?.type === 'XTM_DESELECT_ITEM' && event.data.value) {
      // Deselect a single item (called from preview when trash icon is clicked)
      const value = event.data.value;
      // Always remove from selectedForImport and update highlights
      selectedForImport.delete(value);
      // Update highlights if they exist
      document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
        el.classList.remove('xtm-selected');
      });
      // Notify panel about selection change
      sendPanelMessage('SELECTION_UPDATED', {
        selectedCount: selectedForImport.size,
        selectedItems: Array.from(selectedForImport),
      });
    } else if (event.data?.type === 'XTM_HIGHLIGHT_AI_ENTITIES' && event.data.entities) {
      // Highlight AI-discovered entities on the page
      const entities = event.data.entities as Array<{ type: string; value: string; name: string }>;
      log.debug(' Highlighting AI-discovered entities:', entities.length);
      
      // Get all text nodes in the document
      const textNodes = getTextNodes(document.body);
      let highlightedCount = 0;
      
      for (const entity of entities) {
        const searchValue = entity.value || entity.name;
        if (!searchValue) continue;
        
        // Find and highlight occurrences of this entity value
        for (const node of textNodes) {
          const text = node.textContent || '';
          const lowerText = text.toLowerCase();
          const lowerSearch = searchValue.toLowerCase();
          
          // Find all occurrences in this text node
          let searchIndex = 0;
          while (true) {
            const index = lowerText.indexOf(lowerSearch, searchIndex);
            if (index === -1) break;
            
            // Check if already highlighted
            const parent = node.parentElement;
            if (parent?.classList.contains('xtm-highlight')) {
              searchIndex = index + lowerSearch.length;
              continue;
            }
            
            // Create highlight span
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + searchValue.length);
            
            const highlightSpan = document.createElement('span');
            highlightSpan.className = 'xtm-highlight xtm-ai-discovered';
            highlightSpan.setAttribute('data-type', entity.type);
            highlightSpan.setAttribute('data-value', searchValue);
            highlightSpan.setAttribute('data-ai-discovered', 'true');
            highlightSpan.setAttribute('title', `AI Discovered: ${entity.type.replace(/-/g, ' ')}`);
            
            try {
              range.surroundContents(highlightSpan);
              highlightedCount++;
              
              // Add click handler for selection toggle
              highlightSpan.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSelection(highlightSpan, searchValue);
              });
            } catch (error) {
              // Range may cross element boundaries, skip
              log.debug(' Could not highlight AI entity (range issue):', searchValue);
            }
            
            break; // Move to next text node after highlighting one occurrence
          }
        }
      }
      
      log.info(` AI entity highlighting complete: ${highlightedCount} highlights created for ${entities.length} entities`);
    }
  });
  
  log.debug(' Content script initialized');
}

// ============================================================================
// Scanning
// ============================================================================

function showScanOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'xtm-scan-overlay';
  overlay.id = 'xtm-scan-overlay';
  overlay.innerHTML = `
    <div class="xtm-scan-spinner"></div>
    <span>Scanning page for threats...</span>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function hideScanOverlay(): void {
  const overlay = document.getElementById('xtm-scan-overlay');
  if (overlay) {
    overlay.remove();
  }
}

function updateScanOverlay(text: string, showScrollButton: boolean = false): void {
  const overlay = document.getElementById('xtm-scan-overlay');
  if (overlay) {
    const scrollButtonHtml = showScrollButton ? `
      <button class="xtm-scan-scroll-btn" id="xtm-scroll-to-first">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="16"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        Scroll to first
      </button>
    ` : '';
    
    overlay.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>${text}</span>
      ${scrollButtonHtml}
    `;
    
    // Add click handler for scroll button
    if (showScrollButton) {
      const scrollBtn = document.getElementById('xtm-scroll-to-first');
      if (scrollBtn) {
        scrollBtn.addEventListener('click', scrollToFirstHighlight);
      }
      // Keep overlay visible longer when there's a scroll button
      setTimeout(hideScanOverlay, 8000);
    } else {
      setTimeout(hideScanOverlay, 3000);
    }
  }
}

function scrollToFirstHighlight(event?: MouseEvent): void {
  // Stop event propagation to prevent any interference
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  // Close the notification overlay immediately
  hideScanOverlay();
  
  const firstHighlight = document.querySelector('.xtm-highlight') as HTMLElement;
  if (firstHighlight) {
    // Use scrollIntoView as the primary method - most reliable across different page structures
    // Small delay to ensure overlay is gone and DOM is ready
    setTimeout(() => {
      // Primary method: scrollIntoView with center alignment
      firstHighlight.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'nearest'
      });
      
      // Fallback: If scrollIntoView doesn't work well (some SPAs), try direct scroll
      setTimeout(() => {
        const rect = firstHighlight.getBoundingClientRect();
        // Check if element is still not in viewport center
        const viewportCenter = window.innerHeight / 2;
        const elementCenter = rect.top + rect.height / 2;
        
        if (Math.abs(elementCenter - viewportCenter) > 100) {
          // Element is not centered, try window scroll
          const absoluteTop = window.scrollY + rect.top;
          const scrollTarget = Math.max(0, absoluteTop - viewportCenter + (rect.height / 2));
          window.scrollTo({
            top: scrollTarget,
            behavior: 'smooth'
          });
        }
      }, 300);
      
      // Add flash effect to highlight the element
      setTimeout(() => {
        firstHighlight.classList.add('xtm-flash');
        setTimeout(() => {
          firstHighlight.classList.remove('xtm-flash');
        }, 1500);
      }, 500);
    }, 50);
  }
}

async function scanPage(): Promise<void> {
  showScanOverlay();
  
  // Set scan mode - highlights will persist when panel closes
  currentScanMode = 'scan';
  
  try {
    // Clear existing highlights and selections first
    clearHighlights();
    selectedForImport.clear();
    
    // Get page content
    const content = document.body.innerText;
    const url = window.location.href;
    
    // Send to background for scanning
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_PAGE',
      payload: { content, url },
    });
    
    if (response.success && response.data) {
      const data = response.data;
      scanResults = data;
      lastScanData = data; // Store for re-opening panel from highlight clicks
      
      // Highlight results
      highlightResults(data);
      
      const totalFound = [
        ...data.observables.filter((o: DetectedObservable) => o.found),
        ...data.sdos.filter((s: DetectedSDO) => s.found),
        ...(data.cves || []).filter((c: DetectedSDO) => c.found),
        ...(data.platformEntities || []).filter((e: any) => e.found),
      ].length;
      
      const totalDetected =
        data.observables.length + data.sdos.length + (data.cves?.length || 0) + (data.platformEntities?.length || 0);
      
      const oaevCount = data.platformEntities?.length || 0;
      
      if (totalDetected === 0) {
        // Show notification when nothing is found
        updateScanOverlay('No entities or observables detected on this page', false);
      } else {
        // Build result message
        let message = `Found ${totalDetected} items`;
        const parts: string[] = [];
        if (totalFound > oaevCount) parts.push(`${totalFound - oaevCount} in OpenCTI`);
        if (oaevCount > 0) parts.push(`${oaevCount} in OpenAEV`);
        if (parts.length > 0) message += ` (${parts.join(', ')})`;
        
        // Show results with scroll button
        updateScanOverlay(message, true);
        
        // Send results to panel and open it
        ensurePanelElements();
        showPanelElements();
        // Message will be queued if panel not ready yet, sent when panel signals ready
        sendPanelMessage('SCAN_RESULTS', data);
        // Send current selection state to sync with panel (important when re-opening panel)
        sendPanelMessage('SELECTION_UPDATED', {
          selectedCount: selectedForImport.size,
          selectedItems: Array.from(selectedForImport),
        });
      }
    } else {
      updateScanOverlay('Scan failed: ' + response.error);
    }
  } catch (error) {
    log.error(' Scan error:', error);
    updateScanOverlay('Scan failed');
  }
}

/**
 * Scan page for OpenAEV entities ONLY (no OpenCTI)
 * This is triggered when user clicks "Assets" in the popup
 * Uses SAME approach as scanPage() for consistency with OpenCTI highlighting
 */
async function scanPageForOAEV(): Promise<void> {
  showScanOverlay();
  
  try {
    // Clear existing highlights first
    clearHighlights();
    selectedForImport.clear();
    
    // Get page content - use innerText just like OpenCTI's scanPage()
    const content = document.body.innerText;
    const url = window.location.href;
    
    log.debug(' Starting OpenAEV scan...');
    log.debug(` Content length: ${content.length}`);
    
    // Send to background for OpenAEV-only scanning
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_OAEV',
      payload: { content, url },
    });
    
    log.debug(' SCAN_OAEV response:', response);
    
    if (response.success && response.data) {
      const data = response.data;
      const entities = data.platformEntities || [];
      
      log.debug(`Found ${entities.length} OpenAEV entities to highlight`);
      
      // Store results (OpenAEV only)
      scanResults = {
        observables: [],
        sdos: [],
        cves: [],
        platformEntities: entities,
        scanTime: data.scanTime || 0,
        url: data.url || url,
      };
      
      // Highlight using the same method as OpenCTI (highlightResults handles platformEntities)
      if (entities.length > 0) {
        highlightResults(scanResults);
      }
      
      const totalFound = entities.length;
      
      if (totalFound === 0) {
        updateScanOverlay('No OpenAEV assets found on this page', false);
      } else {
        updateScanOverlay(`Found ${totalFound} OpenAEV asset${totalFound !== 1 ? 's' : ''}`, true);
        
        // Send results to panel and open it
        ensurePanelElements();
        showPanelElements();
        // Message will be queued if panel not ready yet, sent when panel signals ready
        sendPanelMessage('SCAN_RESULTS', scanResults);
        // Send current selection state to sync with panel (important when re-opening panel)
        sendPanelMessage('SELECTION_UPDATED', {
          selectedCount: selectedForImport.size,
          selectedItems: Array.from(selectedForImport),
        });
      }
    } else {
      log.error(' SCAN_OAEV failed:', response?.error);
      updateScanOverlay('OpenAEV scan failed: ' + (response?.error || 'Unknown error'), false);
    }
  } catch (error) {
    log.error(' SCAN_OAEV exception:', error);
    updateScanOverlay('OpenAEV scan error: ' + (error instanceof Error ? error.message : 'Unknown'), false);
  }
}

// ============================================================================
// Unified Scanning (ALL platforms - OpenCTI + OpenAEV)
// ============================================================================

/**
 * Scan page across ALL platforms (OpenCTI and OpenAEV)
 * Highlights entities from both platforms and handles duplicates
 */
async function scanAllPlatforms(): Promise<void> {
  showScanOverlay();
  
  // Set scan mode - highlights will persist when panel closes
  currentScanMode = 'scan';
  
  try {
    // Clear existing highlights first
    clearHighlights();
    selectedForImport.clear();
    
    // Get page content
    const content = document.body.innerText;
    const url = window.location.href;
    
    log.debug(' Starting unified scan across all platforms...');
    log.debug(` Content length: ${content.length}`);
    
    // Send to background for unified scanning
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_ALL',
      payload: { content, url },
    });
    
    log.debug(' SCAN_ALL response:', response);
    
    if (response.success && response.data) {
      const data = response.data;
      scanResults = data;
      lastScanData = data; // Store for re-opening panel from highlight clicks
      
      // Highlight results (highlightResults already handles both OpenCTI and OpenAEV entities)
      highlightResults(data);
      
      // Count total findings
      const octiFound = [
        ...data.observables.filter((o: { found?: boolean }) => o.found),
        ...data.sdos.filter((s: { found?: boolean }) => s.found),
      ].length;
      const oaevFound = data.platformEntities?.length || 0;
      const totalFound = octiFound + oaevFound;
      
      if (totalFound === 0) {
        updateScanOverlay('No entities found on this page', false);
      } else {
        // Build detailed message
        const parts: string[] = [];
        if (octiFound > 0) parts.push(`${octiFound} in OpenCTI`);
        if (oaevFound > 0) parts.push(`${oaevFound} in OpenAEV`);
        updateScanOverlay(`Found ${totalFound} entit${totalFound !== 1 ? 'ies' : 'y'} (${parts.join(', ')})`, true);
        
        // Send results to panel and open it
        ensurePanelElements();
        showPanelElements();
        // Message will be queued if panel not ready yet, sent when panel signals ready
        sendPanelMessage('SCAN_RESULTS', data);
        // Send current selection state to sync with panel (important when re-opening panel)
        sendPanelMessage('SELECTION_UPDATED', {
          selectedCount: selectedForImport.size,
          selectedItems: Array.from(selectedForImport),
        });
      }
    } else {
      log.error(' SCAN_ALL failed:', response?.error);
      updateScanOverlay('Scan failed: ' + (response?.error || 'Unknown error'), false);
    }
  } catch (error) {
    log.error(' SCAN_ALL exception:', error);
    updateScanOverlay('Scan error: ' + (error instanceof Error ? error.message : 'Unknown'), false);
  }
}

// ============================================================================
// Atomic Testing Scanning (OpenAEV)
// ============================================================================

// Track selected atomic testing target (only ONE can be selected)
let atomicTestingTarget: { value: string; type: string; data: any } | null = null;

/**
 * Scan page for atomic testing targets
 * Uses the same approach as regular scanning for attack patterns and domains
 * Shows results in the right panel like regular scan results
 */
async function scanPageForAtomicTesting(): Promise<void> {
  showScanOverlay();
  
  // Set mode - highlights will be cleared when panel closes
  currentScanMode = 'atomic';
  
  try {
    // Clear existing highlights first
    clearHighlights();
    selectedForImport.clear();
    atomicTestingTarget = null;
    
    // Get page content - use innerText just like OpenCTI's scanPage()
    const content = document.body.innerText;
    const url = window.location.href;
    const pageTitle = document.title;
    
    log.debug(' Starting atomic testing scan...');
    log.debug(`Page content length: ${content.length} chars`);
    
    // Request attack patterns from OpenAEV cache
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_OAEV',
      payload: { content, url, includeAttackPatterns: true },
    });
    
    log.debug(' Atomic testing scan response:', response);
    
    // Collect all atomic testing targets
    const atomicTargets: Array<{
      type: 'attack-pattern' | 'Domain-Name' | 'Hostname';
      value: string;
      name: string;
      entityId?: string;
      platformId?: string;
      data: any;
    }> = [];
    
    // Add attack patterns from OpenAEV (only those that were actually found in the content)
    if (response?.success && response?.data?.platformEntities) {
      const attackPatterns = (response.data.platformEntities || [])
        .filter((e: any) => e.type === 'AttackPattern');
      
      for (const ap of attackPatterns) {
        atomicTargets.push({
          type: 'attack-pattern',
          value: ap.name,
          name: ap.name,
          entityId: ap.entityId || ap.attack_pattern_id,
          platformId: ap.platformId,
          data: ap,
        });
      }
    }
    
    // Also detect domains and hostnames using the same regex as regular scanning
    // but only highlight those that are actually in the page
    const domainMatches = detectDomainsAndHostnamesForAtomicTesting(content);
    for (const match of domainMatches) {
      atomicTargets.push({
        type: match.type as 'Domain-Name' | 'Hostname',
        value: match.value,
        name: match.value,
        data: { type: match.type, value: match.value },
      });
    }
    
    log.debug(`Found ${atomicTargets.length} atomic testing targets`);
    
    if (atomicTargets.length === 0) {
      updateScanOverlay('No attack patterns or domains found on this page', false);
      // Still open panel to show empty state
      ensurePanelElements();
      showPanelElements();
      const theme = await getCurrentTheme();
      // Message will be queued if panel not ready yet, sent when panel signals ready
      sendPanelMessage('ATOMIC_TESTING_SCAN_RESULTS', {
        targets: [],
        pageTitle,
        pageUrl: url,
        theme,
      });
      return;
    }
    
    // Create node map for highlighting (same approach as regular scan in highlightResults)
    const textNodes = getTextNodes(document.body);
    
    // Build fullText by joining text nodes with space (same as highlightResults)
    const fullText = textNodes.map((n) => n.textContent).join(' ');
    
    // Create node map with +1 offset for space between nodes (same as highlightResults)
    let offset = 0;
    const nodeMap: Array<{ node: Text; start: number; end: number }> = [];
    
    textNodes.forEach((node) => {
      const text = node.textContent || '';
      nodeMap.push({ node, start: offset, end: offset + text.length });
      offset += text.length + 1; // +1 for space between nodes
    });
    
    // Highlight atomic testing targets using proper exact match
    // For attack patterns, also highlight by external ID (e.g., T1059)
    for (const target of atomicTargets) {
      highlightForAtomicTesting(fullText, target.value, nodeMap, target);
      // Also highlight by external ID if available
      const externalId = target.data?.attack_pattern_external_id || target.data?.externalId;
      if (target.type === 'attack-pattern' && externalId && externalId !== target.value) {
        highlightForAtomicTesting(fullText, externalId, nodeMap, target);
      }
    }
    
    updateScanOverlay(`Found ${atomicTargets.length} target${atomicTargets.length !== 1 ? 's' : ''} for atomic testing`, false);
    
    // Open the panel with scan results (like regular scanning)
    ensurePanelElements();
    showPanelElements();
    
    // Get current theme to pass to panel
    const theme = await getCurrentTheme();
    
    // Message will be queued if panel not ready yet, sent when panel signals ready
    sendPanelMessage('ATOMIC_TESTING_SCAN_RESULTS', {
      targets: atomicTargets,
      pageTitle,
      pageUrl: url,
      theme,
    });
    
  } catch (error) {
    log.error(' Atomic testing scan error:', error);
    updateScanOverlay('Atomic testing scan error: ' + (error instanceof Error ? error.message : 'Unknown'), false);
  }
}

/**
 * Detect domains and hostnames for atomic testing
 * Uses regex to find domains/hostnames in the content
 */
function detectDomainsAndHostnamesForAtomicTesting(content: string): Array<{ type: string; value: string }> {
  const results: Array<{ type: string; value: string }> = [];
  const seen = new Set<string>();
  
  // Domain/hostname pattern (common TLDs including security/hacking-related ones)
  const domainPattern = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|org|net|io|co|gov|edu|mil|int|info|biz|name|pro|aero|museum|xyz|online|site|tech|dev|app|cloud|ai|sh|me|cc|tv|ws|fm|am|to|li|ms|la|gg|im|pw|so|sx|tk|ml|ga|cf|gq|ru|cn|uk|de|fr|jp|kr|br|in|au|nl|it|es|se|no|fi|dk|pl|cz|at|ch|be|pt|hu|ro|bg|sk|si|hr|rs|ua|tr|il|ae|sa|za|ng|ke|eg|ma|tn|dz|ly|jo|kw|qa|om|bh|lb|sy|iq|ir|pk|bd|vn|th|my|sg|ph|id|tw|hk|mo|eu|ca|mx|ar|cl|pe|ve|ec|uy|py|bo|cr|pa|gt|hn|sv|ni|cu|do|pr|nz|ph|ie|gr|cz|is|lu|mc|ee|lv|lt|mt|cy)\b/gi;
  
  let match;
  while ((match = domainPattern.exec(content)) !== null) {
    const value = match[0].toLowerCase();
    if (!seen.has(value) && value.length >= 4 && !value.startsWith('.')) {
      seen.add(value);
      // Determine if it's likely a hostname (has subdomain) or just a domain
      const parts = value.split('.');
      const type = parts.length > 2 ? 'Hostname' : 'Domain-Name';
      results.push({ type, value });
    }
  }
  
  return results;
}

/**
 * Check if a character is a valid word boundary for entity matching.
 * Matches the SAME logic as SCAN_OAEV in background script.
 * A character is a valid boundary if it's:
 * - whitespace, punctuation, or special characters
 * - OR not alphanumeric (allows matching words separated by hyphens, underscores, etc.)
 */
function isValidWordBoundary(char: string | undefined): boolean {
  if (!char || char === '') return true; // Start/end of string is a boundary
  // Valid boundary: whitespace, punctuation, or special characters
  if (/[\s,;:!?()[\]"'<>\/\\@#$%^&*+=|`~\n\r\t.]/.test(char)) return true;
  // Also valid if NOT alphanumeric (this handles hyphens, underscores at word boundaries)
  return !/[a-zA-Z0-9]/.test(char);
}

/**
 * Highlight text for atomic testing mode using exact WHOLE WORD match approach
 * Similar to regular highlightInText but with atomic testing specific styling
 * Only matches complete words/phrases, not partial matches
 */
function highlightForAtomicTesting(
  fullText: string,
  searchValue: string,
  nodeMap: Array<{ node: Text; start: number; end: number }>,
  target: { type: string; value: string; name: string; entityId?: string; platformId?: string; data: any }
): void {
  // Skip if search value is too short or empty
  if (!searchValue || searchValue.length < 2) return;
  
  // Find all occurrences with word boundary check
  const searchLower = searchValue.toLowerCase();
  const fullTextLower = fullText.toLowerCase();
  let pos = 0;
  let highlightedCount = 0;
  const maxHighlightsPerValue = 5; // Highlight multiple occurrences to show all origins
  
  while ((pos = fullTextLower.indexOf(searchLower, pos)) !== -1 && highlightedCount < maxHighlightsPerValue) {
    const endPos = pos + searchValue.length;
    
    // Check for word boundaries - only match whole words/phrases
    const charBefore = pos > 0 ? fullText[pos - 1] : undefined;
    const charAfter = endPos < fullText.length ? fullText[endPos] : undefined;
    
    if (!isValidWordBoundary(charBefore) || !isValidWordBoundary(charAfter)) {
      // Not a whole word match, skip to next position
      pos++;
      continue;
    }
    
    // Find the text node containing this position
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        // Check if this node is already inside a highlight
        if (node.parentElement?.closest('.xtm-highlight')) {
          break; // Skip - already highlighted
        }
        
        const nodeText = node.textContent || '';
        const localStart = pos - start;
        const localEnd = Math.min(localStart + searchValue.length, nodeText.length);
        
        // Validate the text matches what we're looking for
        const textToHighlight = nodeText.substring(localStart, localEnd);
        if (!textToHighlight || textToHighlight.toLowerCase() !== searchLower.substring(0, textToHighlight.length)) {
          break;
        }
        
        if (localEnd <= nodeText.length && textToHighlight.length > 0) {
          try {
            // Create highlight span
            const range = document.createRange();
            range.setStart(node, localStart);
            range.setEnd(node, localEnd);
            
            // Double-check range content is not empty
            if (range.toString().trim().length === 0) {
              break;
            }
            
            const highlight = document.createElement('span');
            // Visual-only highlighting - add type-specific class for different colors
            const typeClass = target.type === 'attack-pattern' 
              ? 'xtm-atomic-attack-pattern' 
              : 'xtm-atomic-domain';
            highlight.className = `xtm-highlight xtm-atomic-testing ${typeClass}`;
            highlight.dataset.value = target.value;
            highlight.dataset.type = target.type;
            // No click handlers - visual only for showing origin on the page
            
            range.surroundContents(highlight);
            highlights.push(highlight);
            highlightedCount++;
          } catch (e) {
            // Range might cross node boundaries, skip
          }
        }
        break;
      }
    }
    
    pos = endPos;
  }
}

// ============================================================================
// Scenario Creation Scanning (OpenAEV)
// ============================================================================

/**
 * Scan page for scenario creation
 * Scans for attack patterns and sends them to the panel for scenario creation
 * Uses SAME matching logic as atomic testing for consistency
 */
async function scanPageForScenario(): Promise<void> {
  showScanOverlay();
  
  // Set mode - highlights will be cleared when panel closes
  currentScanMode = 'scenario';
  
  try {
    // Clear existing highlights first
    clearHighlights();
    selectedForImport.clear();
    
    // Get page content - use innerText just like atomic testing and OpenCTI scanning
    const content = document.body.innerText;
    const url = window.location.href;
    const pageTitle = document.title;
    
    log.debug(' Starting scenario scan...');
    log.debug(` Page content length: ${content.length} chars`);
    
    // Request attack patterns from OpenAEV cache - SAME call as atomic testing
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_OAEV',
      payload: { content, url, includeAttackPatterns: true },
    });
    
    log.debug(' Scenario scan response:', response);
    log.debug(' Scenario scan response success:', response?.success);
    log.debug(' Scenario scan response platformEntities count:', response?.data?.platformEntities?.length || 0);
    
    // Extract attack patterns - SAME logic as atomic testing (scanPageForAtomicTesting)
    const attackPatterns: Array<{
      id: string;
      entityId: string;
      name: string;
      externalId?: string;
      description?: string;
      killChainPhases?: string[];
      platformId?: string;
    }> = [];
    
    // Use exact same extraction logic as atomic testing
    if (response?.success && response?.data?.platformEntities) {
      const foundPatterns = (response.data.platformEntities || [])
        .filter((e: any) => e.type === 'AttackPattern');
      
      log.debug(` Found ${foundPatterns.length} AttackPattern entities in response`);
      
      for (const ap of foundPatterns) {
        // Extract data from entityData if available (has aliases for externalId)
        const entityData = ap.entityData || {};
        const aliases = entityData.aliases || [];
        
        attackPatterns.push({
          id: ap.entityId || ap.id,
          entityId: ap.entityId || ap.id,
          name: ap.name,
          externalId: aliases[0], // First alias is typically the external ID (e.g., T1059)
          platformId: ap.platformId,
        });
        
        log.debug(` Added attack pattern: ${ap.name} (${ap.entityId}) from platform ${ap.platformId}`);
      }
    } else {
      log.warn(' Scenario scan: No platformEntities in response or response failed');
      log.warn(' Response details:', { success: response?.success, hasData: !!response?.data, hasPlatformEntities: !!response?.data?.platformEntities });
    }
    
    log.debug(`Found ${attackPatterns.length} attack patterns for scenario`);
    
    // Generate description from page content
    const pageDescription = generateCleanDescription(content);
    
    // Highlight attack patterns on the page (optional, for visual feedback)
    if (attackPatterns.length > 0) {
      highlightScenarioAttackPatterns(attackPatterns);
    }
    
    const foundMessage = attackPatterns.length > 0 
      ? `Found ${attackPatterns.length} attack pattern${attackPatterns.length !== 1 ? 's' : ''} for scenario`
      : 'No attack patterns found - you can create an empty scenario';
    updateScanOverlay(foundMessage, false);
    
    // Open the scenario panel
    ensurePanelElements();
    showPanelElements();
    
    // Get current theme to pass to panel
    const theme = await getCurrentTheme();
    
    // Message will be queued if panel not ready yet, sent when panel signals ready
    sendPanelMessage('SHOW_SCENARIO_PANEL', {
      attackPatterns,
      pageTitle,
      pageUrl: url,
      pageDescription,
      platformId: attackPatterns[0]?.platformId,
      theme,
    });
    
  } catch (error) {
    log.error(' Scenario scan error:', error);
    updateScanOverlay('Scenario scan error: ' + (error instanceof Error ? error.message : 'Unknown'), false);
  }
}

/**
 * Generate a clean description from page content
 */
function generateCleanDescription(content: string, maxLength = 500): string {
  // Take first portion of content
  let description = content.substring(0, maxLength * 2);
  
  // Remove extra whitespace
  description = description.replace(/\s+/g, ' ').trim();
  
  // Truncate to maxLength
  if (description.length > maxLength) {
    description = description.substring(0, maxLength);
    // Try to end at a sentence boundary
    const lastPeriod = description.lastIndexOf('.');
    if (lastPeriod > maxLength * 0.7) {
      description = description.substring(0, lastPeriod + 1);
    } else {
      description += '...';
    }
  }
  
  return description;
}

/**
 * Highlight attack patterns found for scenario creation (visual feedback)
 * Highlights both attack pattern names AND external IDs (like T1059)
 */
function highlightScenarioAttackPatterns(attackPatterns: Array<{ id: string; name: string; externalId?: string }>): void {
  const textNodes = getTextNodes(document.body);
  
  // Build fullText by joining text nodes with space (same as highlightResults)
  const fullText = textNodes.map((n) => n.textContent).join(' ');
  
  // Create a map of text node positions with +1 offset for space between nodes
  let offset = 0;
  const nodeMap: Array<{ node: Text; start: number; end: number }> = [];
  
  textNodes.forEach((node) => {
    const text = node.textContent || '';
    nodeMap.push({ node, start: offset, end: offset + text.length });
    offset += text.length + 1; // +1 for space between nodes
  });
  
  for (const ap of attackPatterns) {
    // Highlight by name
    highlightInTextForScenario(fullText, ap.name, nodeMap, ap);
    // Also highlight by external ID (e.g., T1059) if available
    if (ap.externalId && ap.externalId !== ap.name) {
      highlightInTextForScenario(fullText, ap.externalId, nodeMap, ap);
    }
  }
}

/**
 * Highlight text for scenario mode using WHOLE WORD matching
 * Uses same approach as highlightForAtomicTesting for consistency
 * Only matches complete attack pattern names, not partial matches
 */
function highlightInTextForScenario(
  fullText: string,
  searchValue: string,
  nodeMap: Array<{ node: Text; start: number; end: number }>,
  attackPattern: { id: string; name: string }
): void {
  // Skip if search value is too short or empty
  if (!searchValue || searchValue.length < 2) return;
  
  // Find all occurrences with word boundary check
  const searchLower = searchValue.toLowerCase();
  const fullTextLower = fullText.toLowerCase();
  let pos = 0;
  let highlightedCount = 0;
  const maxHighlightsPerValue = 5; // Highlight multiple occurrences
  
  while ((pos = fullTextLower.indexOf(searchLower, pos)) !== -1 && highlightedCount < maxHighlightsPerValue) {
    const endPos = pos + searchValue.length;
    
    // Check for word boundaries - only match whole words/phrases
    const charBefore = pos > 0 ? fullText[pos - 1] : undefined;
    const charAfter = endPos < fullText.length ? fullText[endPos] : undefined;
    
    if (!isValidWordBoundary(charBefore) || !isValidWordBoundary(charAfter)) {
      // Not a whole word match, skip to next position
      pos++;
      continue;
    }
    
    // Find the text node containing this position
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        // Check if this node is already inside a highlight
        if (node.parentElement?.closest('.xtm-highlight')) {
          break; // Skip - already highlighted
        }
        
        const nodeText = node.textContent || '';
        const localStart = pos - start;
        const localEnd = Math.min(localStart + searchValue.length, nodeText.length);
        
        // Validate the text matches what we're looking for
        const textToHighlight = nodeText.substring(localStart, localEnd);
        if (!textToHighlight || textToHighlight.toLowerCase() !== searchLower.substring(0, textToHighlight.length)) {
          break;
        }
        
        if (localEnd <= nodeText.length && textToHighlight.length > 0) {
          try {
            // Create highlight span
            const range = document.createRange();
            range.setStart(node, localStart);
            range.setEnd(node, localEnd);
            
            // Double-check range content is not empty
            if (range.toString().trim().length === 0) {
              break;
            }
            
            const highlight = document.createElement('span');
            // Use CSS classes for styling (defined in HIGHLIGHT_STYLES)
            highlight.className = 'xtm-highlight xtm-scenario';
            highlight.dataset.value = attackPattern.name;
            highlight.dataset.type = 'attack-pattern';
            highlight.dataset.entityId = attackPattern.id;
            // No click handlers - visual only
            
            range.surroundContents(highlight);
            highlights.push(highlight); // Add to highlights array for proper cleanup
            highlightedCount++;
          } catch (e) {
            // Range might cross node boundaries, skip
          }
        }
        break;
      }
    }
    
    pos = endPos;
  }
}


/**
 * Scan page for investigation mode
 * Only highlights entities that EXIST in the specified OpenCTI platform (found=true)
 * Sends results to panel for selection
 * @param platformId - Optional platform ID to filter entities (for multi-platform support)
 */
async function scanPageForInvestigation(platformId?: string): Promise<void> {
  showScanOverlay();
  
  // Set mode - highlights will be cleared when panel closes
  currentScanMode = 'investigation';
  
  try {
    // Clear existing highlights first
    clearHighlights();
    selectedForImport.clear();
    
    // Get page content
    const content = document.body.innerText;
    const url = window.location.href;
    
    // Send to background for scanning
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_PAGE',
      payload: { content, url },
    });
    
    if (response.success && response.data) {
      const data = response.data;
      
      // Filter to only entities that EXIST in the platform (found=true)
      // If platformId is provided, also filter by platform
      const foundObservables = (data.observables || []).filter((o: DetectedObservable) => {
        if (!o.found) return false;
        if (platformId) {
          const entityPlatformId = o.platformId || (o as any)._platformId;
          return entityPlatformId === platformId;
        }
        return true;
      });
      
      const foundSDOs = (data.sdos || []).filter((s: DetectedSDO) => {
        if (!s.found) return false;
        if (platformId) {
          const entityPlatformId = s.platformId || (s as any)._platformId;
          return entityPlatformId === platformId;
        }
        return true;
      });
      
      // Note: CVEs are not included in investigation (they're info-only)
      // OpenAEV entities are also filtered by platform if specified
      const foundOAEV = (data.platformEntities || []).filter((e: any) => {
        if (!e.found) return false;
        // Non-default platform entities have their own platform IDs
        // Only include if no platformId filter or if the filter matches the entity's platform
        if (platformId) {
          const entityPlatformDef = getPlatformFromEntity(`${e.type}`);
          // Don't include non-default platform entities when filtering for default platform
          if (entityPlatformDef.type === 'opencti') {
            return false;
          }
        }
        return true;
      });
      
      // Only highlight found entities for investigation
      const investigationResults: ScanResultPayload = {
        observables: foundObservables,
        sdos: foundSDOs,
        cves: [], // Don't include CVEs
        platformEntities: foundOAEV,
        scanTime: data.scanTime,
        url: data.url,
      };
      
      // Highlight only found entities
      highlightResultsForInvestigation(investigationResults);
      
      // Collect all found entities for the panel
      const allFoundEntities = [
        ...foundObservables.map((o: DetectedObservable) => ({
          id: o.entityId,
          type: o.type,
          name: o.value,
          value: o.value,
          platformId: o.platformId || (o as any)._platformId,
        })),
        ...foundSDOs.map((s: DetectedSDO) => ({
          id: s.entityId,
          type: s.type,
          name: s.name,
          value: s.name,
          platformId: s.platformId || (s as any)._platformId,
        })),
        ...foundOAEV.map((e: any) => ({
          id: e.entityId,
          type: e.type,
          name: e.name,
          value: e.value || e.name,
          platformId: e.platformId,
        })),
      ].filter(e => e.id); // Only include entities with valid IDs
      
      // Send results to panel
      sendPanelMessage('INVESTIGATION_SCAN_RESULTS', { entities: allFoundEntities });
      
      const totalFound = allFoundEntities.length;
      
      if (totalFound === 0) {
        updateScanOverlay('No existing entities found on this page', false);
      } else {
        // Don't show scroll button for investigation (panel is already open)
        updateScanOverlay(`Found ${totalFound} existing entities for investigation`, false);
      }
    } else {
      updateScanOverlay('Scan failed: ' + response.error);
      // Send empty results to panel
      sendPanelMessage('INVESTIGATION_SCAN_RESULTS', { entities: [] });
    }
  } catch (error) {
    log.error(' Investigation scan error:', error);
    updateScanOverlay('Scan failed');
    sendPanelMessage('INVESTIGATION_SCAN_RESULTS', { entities: [] });
  }
}

// ============================================================================
// Highlighting
// ============================================================================

function clearHighlights(): void {
  highlights.forEach((el) => {
    const parent = el.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent || ''), el);
      parent.normalize();
    }
  });
  highlights = [];
}

// Investigation highlighting functions
function highlightResultsForInvestigation(results: ScanResultPayload): void {
  const textNodes = getTextNodes(document.body);
  let offset = 0;
  const nodeMap: Array<{ node: Text; start: number; end: number }> = [];
  textNodes.forEach((node) => {
    const text = node.textContent || '';
    nodeMap.push({ node, start: offset, end: offset + text.length });
    offset += text.length + 1;
  });
  const fullText = textNodes.map((n) => n.textContent).join(' ');
  
  for (const obs of results.observables) {
    highlightForInvestigation(fullText, obs.value, nodeMap, obs.type, obs.entityId, obs.platformId || (obs as any)._platformId);
  }
  for (const sdo of results.sdos) {
    highlightForInvestigation(fullText, sdo.name, nodeMap, sdo.type, sdo.entityId, sdo.platformId || (sdo as any)._platformId);
  }
  if (results.platformEntities) {
    for (const e of results.platformEntities) {
      // Use createPrefixedType for platform entity types
      const prefixedType = createPrefixedType(e.type, 'openaev');
      highlightForInvestigation(fullText, e.name, nodeMap, prefixedType, e.entityId, e.platformId);
    }
  }
}

function highlightForInvestigation(fullText: string, searchValue: string, nodeMap: Array<{ node: Text; start: number; end: number }>, entityType: string, entityId?: string, platformId?: string): void {
  if (!searchValue || searchValue.length < 2) return;
  const searchLower = searchValue.toLowerCase();
  const pos = fullText.toLowerCase().indexOf(searchLower);
  if (pos === -1) return;
  
  for (const { node, start, end } of nodeMap) {
    if (pos >= start && pos < end) {
      if (node.parentElement?.closest('.xtm-highlight')) break;
      const nodeText = node.textContent || '';
      const localStart = pos - start;
      const localEnd = Math.min(localStart + searchValue.length, nodeText.length);
      if (localEnd > nodeText.length) break;
      
      try {
        const range = document.createRange();
        range.setStart(node, localStart);
        range.setEnd(node, localEnd);
        if (range.toString().trim().length === 0) break;
        
        const highlight = document.createElement('span');
        highlight.className = 'xtm-highlight xtm-investigation';
        highlight.dataset.entityId = entityId || '';
        highlight.dataset.platformId = platformId || '';
        highlight.dataset.entityType = entityType;
        highlight.dataset.entityValue = searchValue;
        
        highlight.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          // Set flag to prevent panel close
          highlightClickInProgress = true;
          setTimeout(() => { highlightClickInProgress = false; }, 500);
          
          // Ensure panel stays open / re-opens when clicking on investigation highlights
          if (panelFrame?.classList.contains('hidden')) {
            showPanelElements();
          }
          
          const isNowSelected = !highlight.classList.contains('xtm-selected');
          highlight.classList.toggle('xtm-selected');
          
          // Sync with panel - send toggle message
          sendPanelMessage('INVESTIGATION_TOGGLE_ENTITY', { 
            entityId: highlight.dataset.entityId,
            selected: isNowSelected,
          });
        });
        
        range.surroundContents(highlight);
        highlights.push(highlight);
      } catch (e) { /* ignore */ }
      break;
    }
  }
}

function highlightResults(results: ScanResultPayload): void {
  const textNodes = getTextNodes(document.body);
  
  // Create a map of text node positions
  let offset = 0;
  const nodeMap: Array<{ node: Text; start: number; end: number }> = [];
  
  textNodes.forEach((node) => {
    const text = node.textContent || '';
    nodeMap.push({
      node,
      start: offset,
      end: offset + text.length,
    });
    offset += text.length + 1; // +1 for space between nodes
  });
  
  // Full text for matching
  const fullText = textNodes.map((n) => n.textContent).join(' ');
  
  // Build a map of values to their platform findings
  // This helps detect when same text is in multiple platforms (mixed state or multi-platform)
  const valueToPlatformEntities: Map<string, {
    platformType: string;
    type: string;
    found: boolean;
    data: any;
  }[]> = new Map();
  
  // First, collect OpenCTI observables by value
  for (const obs of results.observables) {
    if (obs.found) {
      const valueLower = obs.value.toLowerCase();
      if (!valueToPlatformEntities.has(valueLower)) {
        valueToPlatformEntities.set(valueLower, []);
      }
      valueToPlatformEntities.get(valueLower)!.push({
        platformType: 'opencti',
        type: obs.type,
        found: true,
        data: obs,
      });
    }
  }
  
  // Collect OpenCTI SDOs by name
  for (const sdo of results.sdos) {
    if (sdo.found) {
      const valueLower = sdo.name.toLowerCase();
      if (!valueToPlatformEntities.has(valueLower)) {
        valueToPlatformEntities.set(valueLower, []);
      }
      valueToPlatformEntities.get(valueLower)!.push({
        platformType: 'opencti',
        type: sdo.type,
        found: true,
        data: sdo,
      });
    }
  }
  
  // Collect platform entities (OpenAEV, etc.) by value
  if (results.platformEntities) {
    for (const entity of results.platformEntities) {
      const valueLower = entity.name.toLowerCase();
      if (!valueToPlatformEntities.has(valueLower)) {
        valueToPlatformEntities.set(valueLower, []);
      }
      const platformType = (entity.platformType || 'openaev') as PlatformType;
      valueToPlatformEntities.get(valueLower)!.push({
        platformType,
        type: createPrefixedType(entity.type, platformType),
        found: entity.found,
        data: entity,
      });
    }
  }
  
  // Helper function to find platform matches including substring/superstring relationships
  // This handles cases like: IP "68.183.68.83" not found in OpenCTI, but Finding "68.183.68.83:443" exists in OpenAEV
  const findPlatformMatchesWithSubstrings = (valueLower: string): Array<{
    platformType: string;
    type: string;
    found: boolean;
    data: any;
  }> => {
    const matches: Array<{ platformType: string; type: string; found: boolean; data: any }> = [];
    
    // First, check for exact matches
    const exactMatches = valueToPlatformEntities.get(valueLower);
    if (exactMatches) {
      matches.push(...exactMatches.filter(p => p.platformType !== 'opencti' && p.found));
    }
    
    // Then check for platform entities that contain this value (superstrings)
    // This handles cases like IP being a substring of IP:port
    for (const [key, entities] of valueToPlatformEntities) {
      if (key !== valueLower && key.includes(valueLower)) {
        // This platform entity value contains our value
        matches.push(...entities.filter(p => p.platformType !== 'opencti' && p.found));
      }
    }
    
    // Also check for platform entities that are contained in this value (substrings)
    // Less common but could be useful for partial matches
    for (const [key, entities] of valueToPlatformEntities) {
      if (key !== valueLower && valueLower.includes(key) && key.length >= 4) {
        // Our value contains this platform entity value (only for reasonably long substrings)
        matches.push(...entities.filter(p => p.platformType !== 'opencti' && p.found));
      }
    }
    
    return matches;
  };
  
  // Find and highlight observables (with multi-platform check)
  for (const obs of results.observables) {
    const valueLower = obs.value.toLowerCase();
    // Get other platforms where this entity (or related entity) is found
    const otherPlatformMatches = findPlatformMatchesWithSubstrings(valueLower);
    
    highlightInText(fullText, obs.value, nodeMap, {
      type: obs.type,
      found: obs.found,
      data: obs,
      // Pass other platforms if entity is found there (whether or not found in OpenCTI)
      foundInPlatforms: otherPlatformMatches.length > 0 ? otherPlatformMatches : undefined,
    });
  }
  
  // Find and highlight SDOs (with multi-platform check)
  for (const sdo of results.sdos) {
    // Use matchedValue (the actual matched text) if available, otherwise use name
    // This is important when entities are matched via x_mitre_id or aliases
    // e.g., "T1098.001" matched -> name is "Additional Cloud Credentials", matchedValue is "T1098.001"
    const textToHighlight = (sdo as any).matchedValue || sdo.name;
    const valueLower = sdo.name.toLowerCase();
    // Get other platforms where this entity (or related entity) is found
    const otherPlatformMatches = findPlatformMatchesWithSubstrings(valueLower);
    
    highlightInText(fullText, textToHighlight, nodeMap, {
      type: sdo.type,
      found: sdo.found,
      data: sdo,
      // Pass other platforms if entity is found there (whether or not found in OpenCTI)
      foundInPlatforms: otherPlatformMatches.length > 0 ? otherPlatformMatches : undefined,
    });
  }
  
  // Find and highlight CVEs (Vulnerabilities)
  if (results.cves) {
    for (const cve of results.cves) {
      // Use matchedValue (the actual matched text) if available, otherwise use name
      // This is important when CVEs contain special dash characters (non-breaking hyphens, en dashes)
      // e.g., "CVE‑2024‑7954" (with non-breaking hyphens) -> name is "CVE-2024-7954" (normalized)
      const textToHighlight = (cve as any).matchedValue || cve.name;
      highlightInText(fullText, textToHighlight, nodeMap, {
        type: cve.type, // 'Vulnerability'
        found: cve.found,
        data: cve,
      });
    }
  }
  
  // Find and highlight platform entities that weren't already highlighted via observables/SDOs
  if (results.platformEntities) {
    for (const entity of results.platformEntities) {
      const entityPlatformType = (entity.platformType || 'openaev') as PlatformType;
      const prefixedType = createPrefixedType(entity.type, entityPlatformType);
      // Use entity.value (the actual matched text) if available, otherwise use entity.name
      // This is important when entities are matched via x_mitre_id or aliases (e.g., "T1098.001" -> "Additional Cloud Credentials")
      const textToHighlight = entity.value || entity.name;
      highlightInText(fullText, textToHighlight, nodeMap, {
        type: prefixedType,
        found: entity.found,
        data: entity as unknown as DetectedSDO,
      });
    }
  }
}

function highlightInText(
  fullText: string,
  searchValue: string,
  nodeMap: Array<{ node: Text; start: number; end: number }>,
  meta: {
    type: string;
    found: boolean;
    data: DetectedObservable | DetectedSDO;
    // For mixed state: not found in primary platform but found in other platforms
    foundInPlatforms?: Array<{
      platformType: string;
      type: string;
      found: boolean;
      data: any;
    }>;
  }
): void {
  // Skip if search value is too short or empty
  if (!searchValue || searchValue.length < 2) return;
  
  // Find all occurrences
  const searchLower = searchValue.toLowerCase();
  let pos = 0;
  let highlightedCount = 0;
  const maxHighlightsPerValue = 1; // Only highlight first occurrence
  
  while ((pos = fullText.toLowerCase().indexOf(searchLower, pos)) !== -1 && highlightedCount < maxHighlightsPerValue) {
    const endPos = pos + searchValue.length;
    
    // Find the text node containing this position
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        // Check if this node is already inside a highlight
        if (node.parentElement?.closest('.xtm-highlight')) {
          break; // Skip - already highlighted
        }
        
        const nodeText = node.textContent || '';
        const localStart = pos - start;
        const localEnd = Math.min(localStart + searchValue.length, nodeText.length);
        
        // Validate the text matches what we're looking for
        const textToHighlight = nodeText.substring(localStart, localEnd);
        if (!textToHighlight || textToHighlight.toLowerCase() !== searchLower.substring(0, textToHighlight.length)) {
          break;
        }
        
        if (localEnd <= nodeText.length && textToHighlight.length > 0) {
          try {
            // Create highlight span
            const range = document.createRange();
            range.setStart(node, localStart);
            range.setEnd(node, localEnd);
            
            // Double-check range content is not empty
            if (range.toString().trim().length === 0) {
              break;
            }
            
            const highlight = document.createElement('span');
            highlight.className = 'xtm-highlight';
            
            // Apply appropriate styling based on status
            // Green for found (all platforms), orange for not found
            // MIXED: not found in OpenCTI but found in another platform (orange+green)
            // MULTI-PLATFORM: found in OpenCTI AND another platform (green, tooltip shows all)
            // Gray for SDOs that cannot be added
            const isNonDefaultPlatform = isNonDefaultPlatformEntity(meta.type);
            const hasMixedState = !meta.found && meta.foundInPlatforms && meta.foundInPlatforms.length > 0;
            const hasMultiPlatform = meta.found && meta.foundInPlatforms && meta.foundInPlatforms.length > 0;
            
            if (hasMixedState) {
              // Mixed state: not found in OpenCTI but found in another platform
              highlight.classList.add('xtm-mixed');
              // Store the platform entity data for the right-side click action
              highlight.dataset.platformEntities = JSON.stringify(meta.foundInPlatforms);
            } else if (isNonDefaultPlatform && meta.found) {
              // Non-default platform entity found - use platform-found class
              highlight.classList.add('xtm-platform-found');
            } else if (meta.found) {
              // OpenCTI entity found - green style
              highlight.classList.add('xtm-found');
              // If also found in other platforms, store that info for tooltip and panel navigation
              if (hasMultiPlatform) {
                highlight.dataset.platformEntities = JSON.stringify(meta.foundInPlatforms);
                highlight.dataset.multiPlatform = 'true';
              }
            } else if (meta.type === 'Vulnerability') {
              // CVEs cannot be added manually - show as gray "not addable"
              highlight.classList.add('xtm-sdo-not-addable');
            } else {
              highlight.classList.add('xtm-not-found');
            }
            
            highlight.dataset.type = meta.type;
            highlight.dataset.value = searchValue;
            highlight.dataset.found = String(meta.found);
            highlight.dataset.entity = JSON.stringify(meta.data);
            // For mixed state, also mark if found in other platforms
            if (hasMixedState) {
              highlight.dataset.mixedState = 'true';
            }
            
            // Add event listeners - use capture phase to intercept before any other handlers
            highlight.addEventListener('mouseenter', handleHighlightHover);
            highlight.addEventListener('mouseleave', handleHighlightLeave);
            highlight.addEventListener('click', handleHighlightClick, { capture: true });
            // Also prevent mousedown and mouseup from triggering other handlers
            // Set flag on mousedown to prevent panel close before click handler runs
            highlight.addEventListener('mousedown', (e) => { 
              e.stopPropagation(); 
              highlightClickInProgress = true;
              // Reset flag after 500ms if click doesn't happen
              setTimeout(() => { highlightClickInProgress = false; }, 500);
            }, { capture: true });
            highlight.addEventListener('mouseup', (e) => { e.stopPropagation(); }, { capture: true });
            highlight.addEventListener('contextmenu', handleHighlightRightClick);
            
            range.surroundContents(highlight);
            highlights.push(highlight);
            highlightedCount++;
          } catch (e) {
            // Range might cross node boundaries, skip
          }
        }
        break;
      }
    }
    
    pos = endPos;
  }
}

// ============================================================================
// Tooltip Handling
// ============================================================================

function handleHighlightHover(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const tooltip = document.getElementById('xtm-tooltip');
  if (!tooltip) return;
  
  const rawType = target.dataset.type || 'Unknown';
  const value = target.dataset.value || '';
  const found = target.dataset.found === 'true';
  const isSelected = selectedForImport.has(value);
  const isSdoNotAddable = target.classList.contains('xtm-sdo-not-addable');
  const isMixedState = target.dataset.mixedState === 'true';
  const isMultiPlatform = target.dataset.multiPlatform === 'true';
  
  // Use platform registry to get platform name and display type
  const platformDef = getPlatformFromEntity(rawType);
  const platformName = platformDef.name;
  // Display clean type name (strip platform prefix for non-default platform entities)
  const displayType = getDisplayType(rawType);
  
  // Different status icons based on state
  let statusIcon: string;
  let statusText: string;
  let actionText: string;
  let additionalInfo = '';
  
  if (isMixedState) {
    // Mixed state: not in OpenCTI but found in another platform
    try {
      const platformEntities = JSON.parse(target.dataset.platformEntities || '[]');
      const platformNames = platformEntities.map((p: any) => {
        const def = getPlatformFromEntity(p.type);
        return def.name;
      }).filter((n: string, i: number, arr: string[]) => arr.indexOf(n) === i); // Unique names
      
      statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#ffa726"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
      statusText = `Not in ${platformName}`;
      actionText = isSelected 
        ? 'Click to deselect • Right-click to add'
        : 'Click to select for import';
      
      // Show found in other platforms
      additionalInfo = `
        <div class="xtm-tooltip-status found" style="margin-top: 4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#00c853"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
          Found in ${platformNames.join(', ')}
        </div>
        <div class="xtm-tooltip-action" style="color: #00c853;">
          Click green badge to view in ${platformNames[0]}
        </div>
      `;
    } catch {
      statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#ffa726"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
      statusText = 'Not in platform';
      actionText = 'Click to select for import';
    }
  } else if (found) {
    statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#00c853"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
    
    // Check if found in multiple platforms
    if (isMultiPlatform) {
      try {
        const otherPlatformEntities = JSON.parse(target.dataset.platformEntities || '[]');
        const otherPlatformNames = otherPlatformEntities.map((p: any) => {
          const def = getPlatformFromEntity(p.type);
          return def.name;
        }).filter((n: string, i: number, arr: string[]) => arr.indexOf(n) === i); // Unique names
        
        // Combine primary platform with other platforms
        const allPlatformNames = [platformName, ...otherPlatformNames];
        statusText = `Found in ${allPlatformNames.join(' and ')}`;
        actionText = 'Click to view details • Use arrows to navigate platforms';
      } catch {
        statusText = `Found in ${platformName}`;
        actionText = 'Click to view details';
      }
    } else {
      statusText = `Found in ${platformName}`;
      actionText = 'Click to view details';
    }
  } else if (isSdoNotAddable) {
    // CVE/Vulnerability not in platform - cannot be added
    statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#9e9e9e"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
    statusText = 'Not in platform';
    actionText = `CVE detected but not found in ${platformName}`;
  } else {
    // Observable not found - can be added
    statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#ffa726"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
    statusText = 'Not in platform';
    actionText = isSelected 
      ? 'Click to deselect • Right-click to add now'
      : 'Click to select for import • Right-click to add now';
  }
  
  tooltip.innerHTML = `
    <div class="xtm-tooltip-header">
      <span class="xtm-tooltip-type">${displayType}</span>
    </div>
    <div class="xtm-tooltip-value">${escapeHtml(value)}</div>
    <div class="xtm-tooltip-status ${found ? 'found' : 'not-found'}">
      ${statusIcon}
      ${statusText}
    </div>
    <div class="xtm-tooltip-action">
      ${actionText}
    </div>
    ${additionalInfo}
  `;
  
  const rect = target.getBoundingClientRect();
  tooltip.style.left = `${rect.left}px`;
  tooltip.style.top = `${rect.bottom + 8}px`;
  tooltip.classList.add('visible');
}

function handleHighlightLeave(): void {
  const tooltip = document.getElementById('xtm-tooltip');
  if (tooltip) {
    tooltip.classList.remove('visible');
  }
}

function handleHighlightClick(event: MouseEvent): void {
  // CRITICAL: Prevent all default behavior and navigation IMMEDIATELY
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  
  // Set flag to prevent panel close during navigation between highlights
  // Flag is already set on mousedown, but ensure it's set here too for safety
  highlightClickInProgress = true;
  // Keep flag set for 500ms to ensure overlay click handler doesn't close panel
  setTimeout(() => { highlightClickInProgress = false; }, 500);
  
  // Return false to prevent default (older browsers)
  if (event.returnValue !== undefined) {
    event.returnValue = false;
  }
  
  // In scan mode, if panel is closed, re-open it with scan results
  // This allows user to close panel, keep highlights, and click to re-open
  if (currentScanMode === 'scan' && panelFrame?.classList.contains('hidden') && lastScanData) {
    ensurePanelElements();
    showPanelElements();
    // Send scan results back to panel (will be queued if panel not ready)
    sendPanelMessage('SCAN_RESULTS', lastScanData);
    // Send current selection state to sync with panel (important when re-opening panel)
    sendPanelMessage('SELECTION_UPDATED', {
      selectedCount: selectedForImport.size,
      selectedItems: Array.from(selectedForImport),
    });
    // Continue to process the highlight click - the panel will show entity when ready
  }
  
  // Find and block any parent anchor tags from navigating
  let parent: HTMLElement | null = (event.target as HTMLElement).parentElement;
  while (parent && parent !== document.body) {
    if (parent.tagName === 'A') {
      // Remove href temporarily to prevent navigation
      const href = parent.getAttribute('href');
      const anchorElement = parent;
      anchorElement.removeAttribute('href');
      // Restore it after a micro-task
      setTimeout(() => {
        if (href) anchorElement.setAttribute('href', href);
      }, 0);
      break;
    }
    parent = parent.parentElement;
  }
  
  const target = event.target as HTMLElement;
  const entityData = target.dataset.entity;
  const value = target.dataset.value || '';
  const found = target.dataset.found === 'true';
  const isSdoNotAddable = target.classList.contains('xtm-sdo-not-addable');
  const isMixedState = target.dataset.mixedState === 'true';
  const isMultiPlatform = target.dataset.multiPlatform === 'true';
  // Get the type from dataset (includes oaev- prefix for OpenAEV entities)
  const highlightType = target.dataset.type || '';
  
  // For mixed state, check if click is on the right side (green badge area)
  if (isMixedState) {
    const rect = target.getBoundingClientRect();
    const clickX = event.clientX;
    const rightAreaStart = rect.right - 45; // Green badge is about 40px wide
    
    if (clickX >= rightAreaStart) {
      // Click on green badge - open panel for the platform entity (e.g., OpenAEV Finding)
      try {
        const platformEntities = JSON.parse(target.dataset.platformEntities || '[]');
        if (platformEntities.length > 0) {
          const platformEntity = platformEntities[0];
          // platformEntity.data has structure: { platformType, type, name, value, entityId, platformId, entityData, ... }
          // entityData is the minimal cache data: { id, name, type, platformId }
          const rawData = platformEntity.data || {};
          const entityType = rawData.type || platformEntity.type || 'Unknown';
          const platformType = rawData.platformType || platformEntity.platformType || 'openaev';
          
          // Construct a properly formatted entity for the panel
          // Prefix the type with platform prefix (e.g., 'oaev-Finding')
          // Don't double-prefix if already has 'oaev-' prefix
          const prefixedType = entityType.startsWith('oaev-') ? entityType :
            (platformType === 'openaev' ? `oaev-${entityType}` : entityType);
          const platformId = rawData.platformId || rawData._platformId || '';
          
          // Get entity ID from the entityId field (primary) or from entityData (fallback)
          const cacheData = rawData.entityData || {};
          const entityId = rawData.entityId || rawData.id || cacheData.id || '';
          
          // Get entity name - use rawData.name (which is already the matched name from cache)
          const entityName = rawData.name || cacheData.name || value;
          
          const entity = {
            ...rawData,
            ...cacheData, // Include any additional fields from cache data
            id: entityId,
            entityId: entityId,
            name: entityName,
            type: prefixedType,
            entity_type: prefixedType,
            value: value,
            existsInPlatform: true,
            found: true,
            platformId: platformId,
            _platformId: platformId,
            _platformType: platformType,
            _isNonDefaultPlatform: true,
            entityData: cacheData, // Pass the minimal cache data for entity details fetch
          };
          
          selectedEntity = entity;
          
          // Build platformMatches for multi-platform navigation
          // Include all platform entities for navigation with proper type info
          // Filter duplicates by platformId
          const seenPlatformIds = new Set<string>();
          const platformMatches = platformEntities
            .map((pe: any) => {
              const peData = pe.data || {};
              const peCacheData = peData.entityData || {};
              const peType = pe.type || peData.type || peCacheData.type || '';
              const peCleanType = peType.replace(/^oaev-/, '');
              const pePlatformType = peType.startsWith('oaev-') ? 'openaev' : 'opencti';
              const peId = peData.entityId || peData.id || peCacheData.id || '';
              const pePlatformId = peData.platformId || peCacheData.platformId || '';
              return {
                platformId: pePlatformId,
                platformType: pePlatformType,
                entityId: peId,
                type: peType,
                entityData: {
                  ...peCacheData,
                  type: peType,
                  entity_type: peCleanType,
                },
              };
            })
            .filter((match: { platformId: string }) => {
              if (seenPlatformIds.has(match.platformId)) return false;
              seenPlatformIds.add(match.platformId);
              return true;
            });
          
          chrome.runtime.sendMessage({
            type: 'SHOW_ENTITY_PANEL',
            payload: {
              ...entity,
              platformMatches,
            },
          });
          
          showPanel(entity, platformMatches);
          return;
        }
      } catch (e) {
        log.error(' Failed to parse platform entities for mixed state:', e);
        // Fall through to normal click handling
      }
    }
    // Click on left side - handle as normal not-found (toggle selection)
  }
  
  if (entityData) {
    try {
      const entity = JSON.parse(entityData);
      
      // IMPORTANT: Use the type from the highlight dataset, which includes the 'oaev-' prefix
      // for OpenAEV entities. This ensures the panel correctly identifies it as OpenAEV.
      if (highlightType) {
        entity.type = highlightType;
      }
      
      selectedEntity = entity;
      
      if (found) {
        // Build platformMatches for multi-platform navigation
        // IMPORTANT: Include platformType and type for proper navigation in the panel
        let platformMatches: Array<{ platformId: string; platformType: string; entityId: string; type: string; entityData?: any }> | undefined;
        
        if (isMultiPlatform) {
          try {
            const otherPlatformEntities = JSON.parse(target.dataset.platformEntities || '[]');
            // Determine primary entity's platform type
            const primaryPlatformType = entity.type?.startsWith('oaev-') ? 'openaev' : 'opencti';
            const primaryType = entity.type || '';
            const primaryCleanType = primaryType.replace(/^oaev-/, '');
            const primaryPlatformId = entity.platformId || 'primary';
            
            // Track seen platform IDs to avoid duplicates
            const seenPlatformIds = new Set<string>();
            seenPlatformIds.add(primaryPlatformId);
            
            // Start with the primary entity
            platformMatches = [
              {
                platformId: primaryPlatformId,
                platformType: primaryPlatformType,
                entityId: entity.entityId || entity.id,
                type: primaryType,
                entityData: {
                  ...(entity.entityData || entity),
                  entity_type: primaryCleanType,
                },
              },
            ];
            
            // Add other platforms (skip duplicates)
            for (const p of otherPlatformEntities) {
              const pData = p.data || {};
              const pType = p.type || pData.type || '';
              const cleanType = pType.replace(/^oaev-/, '');
              const pPlatformType = pType.startsWith('oaev-') ? 'openaev' : 'opencti';
              const pPlatformId = pData.platformId || 'unknown';
              
              // Skip if we already have this platform
              if (seenPlatformIds.has(pPlatformId)) continue;
              seenPlatformIds.add(pPlatformId);
              
              // For OpenAEV entities, extract ID using type-specific field names
              let pEntityId = pData.entityId || pData.id;
              if (!pEntityId && cleanType) {
                const typeToIdField: Record<string, string> = {
                  'AttackPattern': 'attack_pattern_id',
                  'Attack-Pattern': 'attack_pattern_id',
                  'Finding': 'finding_id',
                  'Asset': 'endpoint_id',
                  'AssetGroup': 'asset_group_id',
                  'Team': 'team_id',
                  'Player': 'user_id',
                  'User': 'user_id',
                  'Scenario': 'scenario_id',
                  'Exercise': 'exercise_id',
                  'Organization': 'organization_id',
                };
                const idField = typeToIdField[cleanType];
                if (idField && pData[idField]) {
                  pEntityId = pData[idField];
                }
              }
              platformMatches.push({
                platformId: pPlatformId,
                platformType: pPlatformType,
                entityId: pEntityId || '',
                type: pType,
                entityData: {
                  ...pData,
                  type: pType,
                  entity_type: cleanType,
                },
              });
            }
          } catch {
            platformMatches = undefined;
          }
        }
        
        // Found entity - open side panel with entity details
        // Spread entity into payload for consistent structure with SHOW_ENTITY
        chrome.runtime.sendMessage({
          type: 'SHOW_ENTITY_PANEL',
          payload: {
            ...entity,
            entityType: entity.type?.includes('-') && !entity.name ? 'observable' : 'sdo',
            existsInPlatform: true,
            platformMatches, // Include platform matches for navigation
          },
        });
        
        // Open side panel if available (passes entity and platformMatches to iframe panel)
        showPanel(entity, platformMatches);
      } else if (isSdoNotAddable) {
        // SDO not addable (like CVE) - do nothing, just detected for info
        // No panel, no selection - CVEs cannot be added manually
        return;
      } else {
        // Not found observable - toggle selection for bulk import
        toggleSelection(target, value);
      }
    } catch (e) {
      log.error(' Failed to parse entity data:', e);
    }
  }
}

function handleHighlightRightClick(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  
  const target = event.target as HTMLElement;
  const entityData = target.dataset.entity;
  const found = target.dataset.found === 'true';
  const isSdoNotAddable = target.classList.contains('xtm-sdo-not-addable');
  
  // Only allow right-click add for observables (not for CVEs/SDOs that can't be added)
  if (entityData && !found && !isSdoNotAddable) {
    try {
      const entity = JSON.parse(entityData);
      selectedEntity = entity;
      
      // Open panel for immediate add with preview
      showAddPanel(entity);
    } catch (e) {
      log.error(' Failed to parse entity data:', e);
    }
  }
}

function toggleSelection(element: HTMLElement, value: string): void {
  if (selectedForImport.has(value)) {
    // Deselect
    selectedForImport.delete(value);
    // Update all highlights with same value
    document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
      el.classList.remove('xtm-selected');
    });
  } else {
    // Select
    selectedForImport.add(value);
    // Update all highlights with same value
    document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
      el.classList.add('xtm-selected');
    });
  }
  
  // Notify panel about selection change (sync with right panel checkboxes)
  sendPanelMessage('SELECTION_UPDATED', {
    selectedCount: selectedForImport.size,
    selectedItems: Array.from(selectedForImport),
  });
  
  // Notify background about selection change
  chrome.runtime.sendMessage({
    type: 'SELECTION_CHANGED',
    payload: {
      selectedCount: selectedForImport.size,
      selectedItems: Array.from(selectedForImport),
    },
  });
}

// ============================================================================
// Panel Management
// ============================================================================

async function showPanel(
  entity: DetectedObservable | DetectedSDO,
  platformMatches?: Array<{ platformId: string; entityId: string; entityData?: any }>
): Promise<void> {
  ensurePanelElements();
  showPanelElements();
  
  // Get current theme to pass to panel
  const theme = await getCurrentTheme();
  
  // Send entity data to panel with existsInPlatform flag based on 'found'
  // Message will be queued if panel not ready yet
  sendPanelMessage('SHOW_ENTITY', { 
    ...entity, 
    existsInPlatform: entity.found ?? false, 
    theme,
    platformMatches, // Include platform matches for multi-platform navigation
  });
}

function hidePanel(): void {
  if (panelFrame) {
    panelFrame.classList.add('hidden');
  }
  if (panelOverlay) {
    panelOverlay.classList.add('hidden');
  }
}

// ============================================================================
// Add Panel (for adding non-existing entities)
// ============================================================================

// Track if document click handler is installed
let documentClickHandlerInstalled = false;

// Document click handler for closing panel when clicking outside
function handleDocumentClickForPanel(e: MouseEvent): void {
  // If panel is hidden, do nothing
  if (panelFrame?.classList.contains('hidden')) {
    return;
  }
  
  // Don't close if highlight click is in progress
  if (highlightClickInProgress) {
    return;
  }
  
  const target = e.target as HTMLElement;
  
  // Don't close if clicked on the panel itself
  if (panelFrame && (target === panelFrame || panelFrame.contains(target))) {
    return;
  }
  
  // Don't close if clicked on a highlight - let highlight handler deal with it
  if (target.closest('.xtm-highlight')) {
    return;
  }
  
  // Don't close if clicked on xtm UI elements (tooltip, selection panel, etc.)
  if (target.closest('[class*="xtm-"]')) {
    return;
  }
  
  // Check if click position is over the panel area (right 560px of viewport)
  const panelAreaStart = window.innerWidth - 560;
  if (e.clientX >= panelAreaStart) {
    return; // Click is in panel area
  }
  
  // Click was outside panel and not on a highlight - close panel
  hidePanel();
}

function ensurePanelElements(): void {
  // Create overlay (purely visual indicator, no click handling)
  if (!panelOverlay) {
    panelOverlay = document.createElement('div');
    panelOverlay.className = 'xtm-panel-overlay hidden';
    document.body.appendChild(panelOverlay);
  }
  
  // Create inline panel
  if (!panelFrame) {
    // Reset ready state when creating a new panel - it needs to load
    isPanelReady = false;
    panelMessageQueue.length = 0; // Clear any stale messages
    
    panelFrame = document.createElement('iframe');
    panelFrame.className = 'xtm-panel-frame hidden';
    panelFrame.src = chrome.runtime.getURL('panel/index.html');
    document.body.appendChild(panelFrame);
  }
  
  // Install document click handler for click-outside dismissal (only once)
  if (!documentClickHandlerInstalled) {
    // Use capture phase to catch clicks before they're stopped by other handlers
    document.addEventListener('click', handleDocumentClickForPanel, true);
    documentClickHandlerInstalled = true;
  }
}

function showPanelElements(): void {
  panelOverlay?.classList.remove('hidden');
  panelFrame?.classList.remove('hidden');
}

function showAddPanel(entity: DetectedObservable | DetectedSDO): void {
  ensurePanelElements();
  showPanelElements();
  
  // Send entity data to panel in add mode (will be queued if panel not ready)
  sendPanelMessage('SHOW_ADD_ENTITY', entity);
}

// Helper to get current theme from background - strictly from configuration
async function getCurrentTheme(): Promise<'dark' | 'light'> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_PLATFORM_THEME' }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          resolve('dark'); // Default to dark
          return;
        }
        // Theme is strictly configuration-based - no auto detection
        resolve(response.data === 'light' ? 'light' : 'dark');
      });
    } else {
      resolve('dark');
    }
  });
}

async function showPreviewPanel(): Promise<void> {
  // Gather all selected entities
  const selectedEntities: Array<DetectedObservable | DetectedSDO> = [];
  
  selectedForImport.forEach(value => {
    const highlight = document.querySelector(`.xtm-highlight[data-value="${CSS.escape(value)}"]`);
    if (highlight) {
      const entityData = (highlight as HTMLElement).dataset.entity;
      if (entityData) {
        try {
          selectedEntities.push(JSON.parse(entityData));
        } catch (e) {
          // Skip invalid data
        }
      }
    }
  });
  
  ensurePanelElements();
  showPanelElements();
  
  // Extract clean article content
  const article = extractArticleContent();
  const description = extractFirstParagraph(article.textContent);
  
  // Get current theme to pass to panel
  const theme = await getCurrentTheme();
  
  log.debug(' showPreviewPanel - title:', article.title, 'textContent length:', article.textContent?.length);
  
  // Message will be queued if panel not ready yet
  sendPanelMessage('SHOW_PREVIEW', { 
    entities: selectedEntities, 
    pageUrl: window.location.href, 
    pageTitle: article.title,
    pageContent: article.textContent, // Use clean text content instead of HTML
    pageHtmlContent: article.content, // Also pass HTML for content field
    pageDescription: description, // Pre-computed description
    pageExcerpt: article.excerpt,
    theme: theme,
  });
}

async function showContainerPanel(): Promise<void> {
  ensurePanelElements();
  showPanelElements();
  
  // Extract clean article content
  const article = extractArticleContent();
  const description = extractFirstParagraph(article.textContent);
  
  // Get current theme to pass to panel
  const theme = await getCurrentTheme();
  
  log.debug(' showContainerPanel - title:', article.title, 'textContent length:', article.textContent?.length);
  
  // Message will be queued if panel not ready yet
  sendPanelMessage('SHOW_CREATE_CONTAINER', { 
    pageUrl: window.location.href, 
    pageTitle: article.title,
    pageContent: article.textContent, // Use clean text content instead of HTML
    pageHtmlContent: article.content, // Also pass HTML for content field
    pageDescription: description, // Pre-computed description
    pageExcerpt: article.excerpt,
    theme: theme,
  });
}

async function showInvestigationPanel(): Promise<void> {
  // Show the panel first with investigation view
  // The panel will handle platform selection (if multi-platform) and trigger scan
  ensurePanelElements();
  showPanelElements();
  
  // Get current theme to pass to panel
  const theme = await getCurrentTheme();
  
  // Message will be queued if panel not ready yet
  sendPanelMessage('SHOW_INVESTIGATION_PANEL', { theme });
  
  // Note: We don't auto-scan here anymore
  // For single platform, the panel will send SCAN_FOR_INVESTIGATION message
  // For multi-platform, the panel shows platform selection first, then triggers scan
}

async function showSearchPanel(): Promise<void> {
  ensurePanelElements();
  showPanelElements();
  
  // Get current theme to pass to panel
  const theme = await getCurrentTheme();
  
  // Message will be queued if panel not ready yet
  sendPanelMessage('SHOW_SEARCH_PANEL', { theme });
}

async function showOAEVSearchPanel(): Promise<void> {
  ensurePanelElements();
  showPanelElements();
  
  // Get current theme to pass to panel
  const theme = await getCurrentTheme();
  
  // Message will be queued if panel not ready yet
  sendPanelMessage('SHOW_OAEV_SEARCH_PANEL', { theme });
}

async function showUnifiedSearchPanel(): Promise<void> {
  ensurePanelElements();
  showPanelElements();
  
  // Get current theme to pass to panel
  const theme = await getCurrentTheme();
  
  // Message will be queued if panel not ready yet
  sendPanelMessage('SHOW_UNIFIED_SEARCH_PANEL', { theme });
}

// ============================================================================
// Message Handling
// ============================================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'PING':
      // Simple ping to check if content script is loaded
      sendResponse({ success: true, loaded: true });
      break;
      
    case 'SCAN_PAGE':
    case 'AUTO_SCAN_PAGE':
      // For auto-scan, scan silently without opening panels
      scanPage().then(() => sendResponse({ success: true }));
      return true;
    
    case 'SCAN_OAEV':
      // OpenAEV-only scanning
      scanPageForOAEV().then(() => sendResponse({ success: true }));
      return true;
    
    case 'SCAN_ALL':
      // Unified scanning across ALL platforms (OpenCTI + OpenAEV)
      scanAllPlatforms().then(() => sendResponse({ success: true }));
      return true;
    
    case 'SCAN_ATOMIC_TESTING':
      // Atomic testing scan (attack patterns + domains/hostnames)
      scanPageForAtomicTesting().then(() => sendResponse({ success: true }));
      return true;
    
    case 'CREATE_SCENARIO_FROM_PAGE':
      // Scenario creation - scan for attack patterns and open scenario panel
      scanPageForScenario().then(() => sendResponse({ success: true }));
      return true;
      
    case 'CLEAR_HIGHLIGHTS':
      clearHighlights();
      selectedForImport.clear();
      sendResponse({ success: true });
      break;
      
    case 'SCAN_FOR_INVESTIGATION': {
      const { platformId } = message.payload || {};
      scanPageForInvestigation(platformId).then(() => sendResponse({ success: true }));
      return true;
    }
      
    case 'INVESTIGATION_SYNC_SELECTION': {
      // Sync single entity selection from panel to page
      const { entityId, selected } = message.payload || {};
      if (entityId) {
        const highlight = document.querySelector(`.xtm-highlight.xtm-investigation[data-entity-id="${entityId}"]`);
        if (highlight) {
          if (selected) {
            highlight.classList.add('xtm-selected');
          } else {
            highlight.classList.remove('xtm-selected');
          }
        }
      }
      sendResponse({ success: true });
      break;
    }
    
    case 'INVESTIGATION_SYNC_ALL': {
      // Sync multiple entity selections from panel to page
      const { entityIds, selected } = message.payload || {};
      if (entityIds && Array.isArray(entityIds)) {
        for (const entityId of entityIds) {
          const highlight = document.querySelector(`.xtm-highlight.xtm-investigation[data-entity-id="${entityId}"]`);
          if (highlight) {
            if (selected) {
              highlight.classList.add('xtm-selected');
            } else {
              highlight.classList.remove('xtm-selected');
            }
          }
        }
      }
      sendResponse({ success: true });
      break;
    }
      
    case 'HIDE_PANEL':
      hidePanel();
      sendResponse({ success: true });
      break;
      
    case 'GET_PAGE_CONTENT': {
      // Use Readability to extract clean article content
      const articleData = extractArticleContent();
      const description = extractFirstParagraph(articleData.textContent);
      
      sendResponse({
        success: true,
        data: {
          url: window.location.href,
          title: articleData.title,
          content: articleData.textContent, // Clean text content
          html: articleData.content, // Clean HTML content from Readability
          description: description, // First paragraph for container description
          excerpt: articleData.excerpt,
          byline: articleData.byline,
        },
      });
      break;
    }
    
    case 'GET_ARTICLE_CONTENT': {
      // Get structured article data with Readability
      const article = extractArticleContent();
      const firstParagraph = extractFirstParagraph(article.textContent);
      
      sendResponse({
        success: true,
        data: {
          url: window.location.href,
          title: article.title,
          textContent: article.textContent,
          htmlContent: article.content,
          description: firstParagraph,
          excerpt: article.excerpt,
          byline: article.byline,
        },
      });
      break;
    }
      
    case 'CREATE_CONTAINER_FROM_PAGE':
      showContainerPanel();
      sendResponse({ success: true });
      break;
      
    case 'PREVIEW_SELECTION':
      showPreviewPanel();
      sendResponse({ success: true });
      break;
      
    case 'CREATE_INVESTIGATION':
      showInvestigationPanel();
      sendResponse({ success: true });
      break;
    
    case 'OPEN_SEARCH_PANEL':
      showSearchPanel();
      sendResponse({ success: true });
      break;
    
    case 'OPEN_OAEV_SEARCH_PANEL':
      showOAEVSearchPanel();
      sendResponse({ success: true });
      break;
    
    case 'OPEN_UNIFIED_SEARCH_PANEL':
      showUnifiedSearchPanel();
      sendResponse({ success: true });
      break;
    
    case 'GENERATE_PDF':
      generateArticlePDF().then(result => {
        if (result) {
          sendResponse({ success: true, data: result });
        } else {
          sendResponse({ success: false, error: 'Failed to generate PDF' });
        }
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep channel open for async response
      
    case 'GET_SELECTION':
      sendResponse({
        success: true,
        data: {
          selectedCount: selectedForImport.size,
          selectedItems: Array.from(selectedForImport),
        },
      });
      break;
      
    case 'CLEAR_SELECTION':
      selectedForImport.clear();
      document.querySelectorAll('.xtm-highlight.xtm-selected').forEach(el => {
        el.classList.remove('xtm-selected');
      });
      sendResponse({ success: true });
      break;
      
    case 'ENTITY_ADDED':
      // Update highlights when an entity is successfully added
      const value = message.payload?.value;
      if (value) {
        document.querySelectorAll(`.xtm-highlight[data-value="${CSS.escape(value)}"]`).forEach(el => {
          el.classList.remove('xtm-not-found', 'xtm-selected');
          el.classList.add('xtm-found');
          (el as HTMLElement).dataset.found = 'true';
        });
        selectedForImport.delete(value);
      }
      sendResponse({ success: true });
      break;
  }
});

// ============================================================================
// Initialize
// ============================================================================

initialize();

