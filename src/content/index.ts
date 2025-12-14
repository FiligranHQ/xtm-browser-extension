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
import { Readability } from '@mozilla/readability';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// ============================================================================
// Article Extraction & PDF Generation Utilities
// ============================================================================

/**
 * Extract clean article content using Mozilla Readability
 * This extracts just the main article content, removing menus, sidebars, etc.
 */
function extractArticleContent(): { title: string; content: string; textContent: string; excerpt: string; byline: string } {
  try {
    // Clone the document to avoid modifying the original
    const documentClone = document.cloneNode(true) as Document;
    
    // Pre-clean: remove obvious non-content elements from the clone
    const selectorsToRemove = [
      // Paywall/subscription elements (common class names)
      '[class*="paywall"]', '[class*="subscribe"]', '[class*="subscription"]',
      '[class*="premium"]', '[class*="teaser"]', '[class*="restricted"]',
      '[class*="locked"]', '[class*="meter"]', '[class*="regwall"]',
      '[id*="paywall"]', '[id*="subscribe"]', '[id*="subscription"]',
      // Le Monde specific
      '[class*="article__status"]', '[class*="article__wrapper--premium"]',
      '.article__content-paywall', '.paywall', '.subscriber-only',
      // Generic ads and promotions
      '[class*="promo"]', '[class*="newsletter"]', '[class*="signup"]',
      '[class*="cta-"]', '[class*="call-to-action"]',
    ];
    
    selectorsToRemove.forEach(selector => {
      try {
        documentClone.querySelectorAll(selector).forEach(el => el.remove());
      } catch { /* Skip invalid selectors */ }
    });
    
    // Create a Readability instance and parse the article
    const reader = new Readability(documentClone, {
      debug: false,
      charThreshold: 100,
    });
    
    const article = reader.parse();
    
    if (article) {
      // Apply additional text cleaning to remove paywall messages
      const cleanedTextContent = cleanArticleText(article.textContent || '');
      
      log.debug(' Readability extracted article:', article.title, 'raw length:', article.textContent?.length, 'cleaned length:', cleanedTextContent.length);
      return {
        title: article.title || document.title,
        content: article.content || '',
        textContent: cleanedTextContent,
        excerpt: cleanArticleText(article.excerpt || ''),
        byline: article.byline || '',
      };
    }
  } catch (error) {
    log.warn(' Failed to extract article with Readability:', error);
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
 * Fallback content extraction when Readability fails - returns HTML
 */
function getFallbackContent(): string {
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
    '[class*="share"]', '[class*="social"]', '[class*="comment"]', '[class*="sidebar"]',
    '[class*="advert"]', '[class*="cookie"]', '[class*="newsletter"]', '[class*="popup"]',
    '[id*="share"]', '[id*="social"]', '[id*="comment"]', '[id*="sidebar"]',
  ];
  
  selectorsToRemove.forEach(selector => {
    try {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    } catch { /* Skip invalid selectors */ }
  });
  
  // Clean attributes
  clone.querySelectorAll('*').forEach(el => {
    el.removeAttribute('style');
    el.removeAttribute('onclick');
    el.removeAttribute('onload');
    el.removeAttribute('onerror');
  });
  
  return clone.innerHTML;
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
 * Convert image to base64 data URL to avoid CORS issues
 */
async function imageToBase64(imgElement: HTMLImageElement): Promise<string | null> {
  try {
    // If already a data URL, return as-is
    if (imgElement.src.startsWith('data:')) {
      return imgElement.src;
    }
    
    // Try to fetch the image and convert to base64
    const response = await fetch(imgElement.src, { mode: 'cors' });
    if (!response.ok) return null;
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    // CORS error or other issue - try canvas approach
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imgElement.naturalWidth || imgElement.width || 300;
      canvas.height = imgElement.naturalHeight || imgElement.height || 200;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(imgElement, 0, 0);
        return canvas.toDataURL('image/png');
      }
    } catch {
      // Canvas is tainted, skip this image
    }
    return null;
  }
}

/**
 * Clean HTML content for PDF rendering - remove unwanted elements and fix images
 */
async function prepareHtmlForPdf(htmlContent: string, title: string): Promise<HTMLElement> {
  // Create a container for the PDF content
  const container = document.createElement('div');
  container.id = 'xtm-pdf-container';
  
  // Apply styles for clean PDF rendering
  container.style.cssText = `
    width: 595px;
    padding: 40px;
    background: white;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 12px;
    line-height: 1.6;
    color: #1a1a1a;
    box-sizing: border-box;
  `;
  
  // Build the PDF content with header, article, and footer
  const sourceUrl = window.location.href;
  const truncatedUrl = sourceUrl.length > 70 ? sourceUrl.substring(0, 67) + '...' : sourceUrl;
  
  container.innerHTML = `
    <style>
      #xtm-pdf-container * {
        box-sizing: border-box;
      }
      #xtm-pdf-container h1, #xtm-pdf-container h2, #xtm-pdf-container h3, 
      #xtm-pdf-container h4, #xtm-pdf-container h5, #xtm-pdf-container h6 {
        color: #1a1a1a;
        margin-top: 16px;
        margin-bottom: 8px;
        line-height: 1.3;
      }
      #xtm-pdf-container h1 { font-size: 22px; }
      #xtm-pdf-container h2 { font-size: 18px; }
      #xtm-pdf-container h3 { font-size: 16px; }
      #xtm-pdf-container p {
        margin: 0 0 12px 0;
        text-align: justify;
      }
      #xtm-pdf-container strong, #xtm-pdf-container b {
        font-weight: 700;
      }
      #xtm-pdf-container em, #xtm-pdf-container i {
        font-style: italic;
      }
      #xtm-pdf-container ul, #xtm-pdf-container ol {
        margin: 8px 0 12px 20px;
        padding-left: 20px;
      }
      #xtm-pdf-container li {
        margin-bottom: 4px;
      }
      #xtm-pdf-container blockquote {
        margin: 12px 0;
        padding: 10px 20px;
        border-left: 4px solid #001bda;
        background: #f5f5f5;
        font-style: italic;
      }
      #xtm-pdf-container img {
        max-width: 100%;
        height: auto;
        margin: 12px 0;
        display: block;
      }
      #xtm-pdf-container a {
        color: #001bda;
        text-decoration: none;
      }
      #xtm-pdf-container figure {
        margin: 12px 0;
      }
      #xtm-pdf-container figcaption {
        font-size: 10px;
        color: #666;
        text-align: center;
        margin-top: 4px;
      }
      #xtm-pdf-container pre, #xtm-pdf-container code {
        background: #f5f5f5;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 11px;
        padding: 2px 4px;
        border-radius: 2px;
      }
      #xtm-pdf-container pre {
        padding: 12px;
        overflow-x: auto;
        margin: 12px 0;
      }
      #xtm-pdf-container table {
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0;
      }
      #xtm-pdf-container th, #xtm-pdf-container td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
      #xtm-pdf-container th {
        background: #f5f5f5;
        font-weight: 600;
      }
      .xtm-pdf-header {
        border-bottom: 2px solid #001bda;
        padding-bottom: 12px;
        margin-bottom: 20px;
      }
      .xtm-pdf-header-title {
        color: #001bda;
        font-size: 11px;
        font-weight: 600;
        margin: 0 0 4px 0;
      }
      .xtm-pdf-header-date {
        color: #666;
        font-size: 10px;
        margin: 0;
      }
      .xtm-pdf-article-title {
        font-size: 24px;
        font-weight: 700;
        color: #1a1a1a;
        margin: 0 0 12px 0;
        line-height: 1.2;
      }
      .xtm-pdf-meta {
        color: #666;
        font-size: 10px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e0e0e0;
      }
      .xtm-pdf-content {
        margin-bottom: 30px;
      }
      .xtm-pdf-footer {
        border-top: 1px solid #e0e0e0;
        padding-top: 12px;
        margin-top: 20px;
        color: #999;
        font-size: 9px;
        text-align: center;
      }
    </style>
    
    <div class="xtm-pdf-header">
      <p class="xtm-pdf-header-title">Filigran XTM Browser Extension</p>
      <p class="xtm-pdf-header-date">Captured on ${new Date().toLocaleDateString()}</p>
    </div>
    
    <h1 class="xtm-pdf-article-title">${escapeHtml(title)}</h1>
    
    <div class="xtm-pdf-meta">
      <div>Source: ${escapeHtml(truncatedUrl)}</div>
      <div>Captured: ${new Date().toLocaleString()}</div>
    </div>
    
    <div class="xtm-pdf-content">
      ${htmlContent}
    </div>
    
    <div class="xtm-pdf-footer">
      Generated by Filigran XTM Browser Extension | ${window.location.hostname}
    </div>
  `;
  
  // Clean up the content section - remove scripts, iframes, etc.
  const contentDiv = container.querySelector('.xtm-pdf-content');
  if (contentDiv) {
    // Remove unwanted elements
    const toRemove = contentDiv.querySelectorAll('script, iframe, noscript, object, embed, video, audio, svg, canvas, form, input, button, [style*="display: none"], [style*="display:none"], [hidden]');
    toRemove.forEach(el => el.remove());
    
    // Remove empty elements
    contentDiv.querySelectorAll('p, div, span').forEach(el => {
      if (!el.textContent?.trim() && !el.querySelector('img')) {
        el.remove();
      }
    });
  }
  
  // Process images - convert to base64 to avoid CORS issues
  const images = container.querySelectorAll('img');
  for (const img of images) {
    try {
      const base64 = await imageToBase64(img as HTMLImageElement);
      if (base64) {
        img.src = base64;
        // Ensure reasonable size for PDF
        const imgEl = img as HTMLImageElement;
        if (imgEl.naturalWidth > 500 || !imgEl.style.maxWidth) {
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
        }
      } else {
        // Remove images that couldn't be converted (CORS issues)
        img.remove();
      }
    } catch {
      img.remove();
    }
  }
  
  return container;
}

/**
 * Generate PDF from article content using jsPDF with html2canvas
 * Preserves text formatting (bold, italic, headings) and includes images
 * Returns base64 encoded PDF data
 */
async function generateArticlePDF(): Promise<{ data: string; filename: string } | null> {
  try {
    // Extract article content
    const article = extractArticleContent();
    
    if (!article.content && !article.textContent) {
      log.warn(' No article content to generate PDF');
      return null;
    }
    
    log.debug(' Starting PDF generation with HTML rendering, article title:', article.title);
    log.debug(' HTML content length:', article.content?.length || 0);
    
    // Prepare the HTML content for PDF rendering
    const container = await prepareHtmlForPdf(article.content, article.title);
    
    // Temporarily add container to DOM for rendering (hidden)
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);
    
    try {
      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Use html2canvas to capture the styled content
      const canvas = await html2canvas(container, {
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        width: 595, // A4 width in pixels at 72 DPI
        windowWidth: 595,
      });
      
      // Calculate how to fit the content on PDF pages
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      
      // Add image to PDF, handling multiple pages if needed
      let heightLeft = imgHeight;
      let position = 0;
      
      // Add first page
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        0,
        position,
        imgWidth,
        imgHeight
      );
      heightLeft -= pageHeight;
      
      // Add additional pages if content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight; // Negative offset for subsequent pages
        pdf.addPage();
        pdf.addImage(
          canvas.toDataURL('image/jpeg', 0.95),
          'JPEG',
          0,
          position,
          imgWidth,
          imgHeight
        );
        heightLeft -= pageHeight;
      }
      
      // Generate filename
      const filename = `${sanitizeFilename(article.title)}.pdf`;
      
      // Get PDF as base64
      const pdfOutput = pdf.output('datauristring');
      const base64Data = pdfOutput.split(',')[1];
      
      log.debug(' PDF generated successfully with HTML rendering, base64 length:', base64Data.length);
      
      return {
        data: base64Data,
        filename: filename,
      };
    } finally {
      // Always remove the temporary container
      document.body.removeChild(container);
    }
  } catch (error) {
    log.error(' Failed to generate PDF with HTML rendering:', error);
    // Fallback to simple text-based PDF
    return generateSimpleTextPDF();
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
    
    textContent = cleanArticleText(textContent)
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
  }
  
  /* CRITICAL: Force parent elements to NOT clip highlights
     This is necessary because many websites have overflow:hidden on containers */
  *:has(> .xtm-highlight) {
    overflow: visible !important;
    clip: auto !important;
    clip-path: none !important;
    -webkit-clip-path: none !important;
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
     OPENAEV ENTITY - Cyan/teal style for OpenAEV assets, teams, players
     ======================================== */
  .xtm-highlight.xtm-oaev-found {
    background: rgba(0, 188, 212, 0.25) !important;
    border: 2px solid #00bcd4 !important;
    border-color: #00bcd4 !important;
  }
  
  /* Check icon on RIGHT for OpenAEV found */
  .xtm-highlight.xtm-oaev-found::after {
    content: '' !important;
    position: absolute !important;
    right: 6px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 14px !important;
    height: 14px !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300bcd4'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z'/%3E%3C/svg%3E") !important;
    background-size: contain !important;
    background-repeat: no-repeat !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-oaev-found:hover {
    background: rgba(0, 188, 212, 0.4) !important;
    border-color: #0097a7 !important;
    box-shadow: 0 0 8px rgba(0, 188, 212, 0.5) !important;
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
     ATOMIC TESTING MODE - Red/Orange style for test triggers
     ======================================== */
  .xtm-highlight.xtm-atomic-testing {
    background: rgba(244, 67, 54, 0.25) !important;
    border: 2px solid #f44336 !important;
    border-color: #f44336 !important;
    padding: 4px 8px 4px 30px !important;  /* Extra space on left for radio */
    cursor: pointer !important;
  }
  
  /* Radio button on LEFT for atomic testing (single selection) */
  .xtm-highlight.xtm-atomic-testing::before {
    content: '' !important;
    position: absolute !important;
    left: 10px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 12px !important;
    height: 12px !important;
    border: 2px solid #f44336 !important;
    border-radius: 50% !important;  /* Circle for radio button */
    background: transparent !important;
    box-sizing: border-box !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 2147483641 !important;
  }
  
  .xtm-highlight.xtm-atomic-testing:hover {
    background: rgba(244, 67, 54, 0.4) !important;
    border-color: #d32f2f !important;
    box-shadow: 0 0 8px rgba(244, 67, 54, 0.5) !important;
  }
  
  /* Selected state for atomic testing */
  .xtm-highlight.xtm-atomic-testing.xtm-selected {
    background: rgba(244, 67, 54, 0.35) !important;
    border-color: #d32f2f !important;
    box-shadow: 0 0 8px rgba(244, 67, 54, 0.6) !important;
  }
  
  .xtm-highlight.xtm-atomic-testing.xtm-selected::before {
    background: #f44336 !important;
    border-color: #f44336 !important;
    /* Filled circle for selected radio */
    box-shadow: inset 0 0 0 3px #f44336 !important;
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
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #070d19 0%, #09101e 100%);
    color: rgba(255, 255, 255, 0.9);
    padding: 16px 24px;
    border-radius: 4px;
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
  
  /* Panel overlay for click-outside dismissal */
  .xtm-panel-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 560px;
    bottom: 0;
    z-index: 2147483639; /* Below highlights (2147483640) so highlights are still clickable */
    background: transparent;
    cursor: pointer;
  }
  
  .xtm-panel-overlay.hidden {
    display: none;
  }

  /* ========================================
     BOTTOM SELECTION PANEL
     ======================================== */
  .xtm-selection-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #070d19 0%, #09101e 100%);
    color: rgba(255, 255, 255, 0.9);
    padding: 16px 24px;
    font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 2147483645;
    box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.5);
    border-top: 1px solid rgba(15, 188, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }
  
  .xtm-selection-panel.visible {
    transform: translateY(0);
  }
  
  .xtm-selection-info {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .xtm-selection-count {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .xtm-selection-count-badge {
    background: #0fbcff;
    color: #001e3c;
    font-weight: 700;
    font-size: 16px;
    min-width: 32px;
    height: 32px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
  }
  
  .xtm-selection-count-text {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
  }
  
  .xtm-selection-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .xtm-selection-btn {
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    font-family: inherit;
  }
  
  .xtm-selection-btn-primary {
    background: linear-gradient(135deg, #0fbcff 0%, #0ca8e6 100%);
    color: #001e3c;
  }
  
  .xtm-selection-btn-primary:hover {
    background: linear-gradient(135deg, #3dcaff 0%, #0fbcff 100%);
    box-shadow: 0 4px 16px rgba(15, 188, 255, 0.4);
    color: #001e3c;
  }
  
  .xtm-selection-btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .xtm-selection-btn-secondary:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.3);
  }
  
  .xtm-selection-btn-clear {
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    padding: 10px 12px;
  }
  
  .xtm-selection-btn-clear:hover {
    color: #f44336;
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

function createSelectionPanel(): HTMLElement | null {
  // Check if we're on a valid HTML page
  if (!document.body) {
    return null;
  }
  
  const panel = document.createElement('div');
  panel.className = 'xtm-selection-panel';
  panel.id = 'xtm-selection-panel';
  panel.innerHTML = `
    <div class="xtm-selection-info">
      <div class="xtm-selection-count">
        <span class="xtm-selection-count-badge" id="xtm-selection-count">0</span>
        <span class="xtm-selection-count-text">observables selected</span>
      </div>
    </div>
    <div class="xtm-selection-actions">
      <button class="xtm-selection-btn xtm-selection-btn-clear" id="xtm-clear-selection" title="Clear selection">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <button class="xtm-selection-btn xtm-selection-btn-secondary" id="xtm-select-all">Select All New</button>
      <button class="xtm-selection-btn xtm-selection-btn-primary" id="xtm-preview-selection" style="display: flex; align-items: center; justify-content: center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; flex-shrink: 0;">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        Preview
      </button>
    </div>
  `;
  document.body.appendChild(panel);
  
  // Add event listeners
  document.getElementById('xtm-clear-selection')?.addEventListener('click', clearAllSelections);
  document.getElementById('xtm-select-all')?.addEventListener('click', selectAllNotFound);
  document.getElementById('xtm-preview-selection')?.addEventListener('click', openPreviewPanel);
  
  return panel;
}

function updateSelectionPanel(): void {
  const panel = document.getElementById('xtm-selection-panel');
  const countBadge = document.getElementById('xtm-selection-count');
  
  if (!panel || !countBadge) return;
  
  const count = selectedForImport.size;
  countBadge.textContent = String(count);
  
  if (count > 0) {
    panel.classList.add('visible');
  } else {
    panel.classList.remove('visible');
  }
}

function clearAllSelections(): void {
  selectedForImport.clear();
  document.querySelectorAll('.xtm-highlight.xtm-selected').forEach(el => {
    el.classList.remove('xtm-selected');
  });
  updateSelectionPanel();
}

function selectAllNotFound(): void {
  // Only select observables that can be added (not SDOs like CVEs)
  document.querySelectorAll('.xtm-highlight.xtm-not-found').forEach(el => {
    const value = (el as HTMLElement).dataset.value;
    // Skip if it's a non-addable SDO type
    if ((el as HTMLElement).classList.contains('xtm-sdo-not-addable')) return;
    if (value && !selectedForImport.has(value)) {
      selectedForImport.add(value);
      el.classList.add('xtm-selected');
    }
  });
  updateSelectionPanel();
}

function openPreviewPanel(): void {
  showPreviewPanel();
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
  createSelectionPanel();
  
  // Listen for messages from the panel iframe
  window.addEventListener('message', async (event) => {
    if (event.data?.type === 'XTM_CLOSE_PANEL') {
      hidePanel();
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
    // Get the element's position relative to the document
    const rect = firstHighlight.getBoundingClientRect();
    const absoluteTop = window.scrollY + rect.top;
    const scrollTarget = Math.max(0, absoluteTop - (window.innerHeight / 2) + (rect.height / 2));
    
    // Force scroll using multiple methods for compatibility
    try {
      // Method 1: window.scrollTo with behavior
      window.scrollTo({
        top: scrollTarget,
        behavior: 'smooth'
      });
    } catch {
      // Method 2: Fallback for older browsers
      window.scrollTo(0, scrollTarget);
    }
    
    // Also try scrollIntoView as backup after a short delay
    setTimeout(() => {
      if (firstHighlight) {
        firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
    
    // Add a brief flash effect to make it more visible after scroll
    setTimeout(() => {
      firstHighlight.classList.add('xtm-flash');
      setTimeout(() => {
        firstHighlight.classList.remove('xtm-flash');
      }, 1500);
    }, 600); // Wait for scroll to complete
  }
}

async function scanPage(): Promise<void> {
  showScanOverlay();
  
  try {
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
      
      // Highlight results
      clearHighlights();
      highlightResults(data);
      
      const totalFound = [
        ...data.observables.filter((o: DetectedObservable) => o.found),
        ...data.sdos.filter((s: DetectedSDO) => s.found),
        ...(data.cves || []).filter((c: DetectedSDO) => c.found),
        ...(data.oaevEntities || []).filter((e: any) => e.found),
      ].length;
      
      const totalDetected =
        data.observables.length + data.sdos.length + (data.cves?.length || 0) + (data.oaevEntities?.length || 0);
      
      const oaevCount = data.oaevEntities?.length || 0;
      
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
 */
async function scanPageForOAEV(): Promise<void> {
  showScanOverlay();
  
  try {
    // Clear existing highlights first
    clearHighlights();
    selectedForImport.clear();
    
    // Get page content - build from text nodes for consistency with highlighting
    const textNodes = getTextNodes(document.body);
    let content = '';
    textNodes.forEach((node) => {
      content += node.textContent || '';
    });
    const url = window.location.href;
    
    log.debug(' Starting OpenAEV scan...');
    
    // Send to background for OpenAEV-only scanning
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_OAEV',
      payload: { content, url },
    });
    
    log.debug(' SCAN_OAEV response:', response);
    
    if (response.success && response.data) {
      const data = response.data;
      const entities = data.oaevEntities || [];
      
      log.debug(`Found ${entities.length} OpenAEV entities to highlight`);
      
      // Store results (OpenAEV only)
      scanResults = {
        observables: [],
        sdos: [],
        cves: [],
        oaevEntities: entities,
        scanTime: data.scanTime || 0,
        url: data.url || url,
      };
      
      // Highlight OpenAEV entities
      if (entities.length > 0) {
        highlightOAEVResults(entities);
      }
      
      const totalFound = entities.length;
      
      if (totalFound === 0) {
        updateScanOverlay('No OpenAEV assets found on this page', false);
      } else {
        updateScanOverlay(`Found ${totalFound} OpenAEV asset${totalFound !== 1 ? 's' : ''}`, true);
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

/**
 * Highlight only OpenAEV entities
 */
function highlightOAEVResults(oaevEntities: any[]): void {
  log.debug(`highlightOAEVResults called with ${oaevEntities.length} entities`);
  
  if (oaevEntities.length === 0) return;
  
  const textNodes = getTextNodes(document.body);
  
  // Build fullText from actual text nodes (not innerText which has different whitespace)
  const nodeMap: Array<{ node: Text; start: number; end: number }> = [];
  let fullText = '';
  let offset = 0;
  
  textNodes.forEach((node) => {
    const text = node.textContent || '';
    nodeMap.push({ node, start: offset, end: offset + text.length });
    fullText += text;
    offset += text.length;
  });
  
  log.debug(`Got ${textNodes.length} text nodes, built fullText length: ${fullText.length}`);
  
  let highlightedCount = 0;
  for (const entity of oaevEntities) {
    log.debug(`Attempting to highlight: "${entity.name}" (${entity.type}), value: "${entity.value}"`);
    
    // Use value (the matched text) if available, otherwise name
    const searchValue = entity.value || entity.name;
    
    highlightInText(fullText, searchValue, nodeMap, {
      type: `oaev-${entity.type}`,
      found: true,
      data: entity as unknown as DetectedSDO,
    });
    highlightedCount++;
  }
  
  log.debug(`Highlighting complete, processed ${highlightedCount} entities`);
}

// ============================================================================
// Atomic Testing Scanning (OpenAEV)
// ============================================================================

// Track selected atomic testing target (only ONE can be selected)
let atomicTestingTarget: { value: string; type: string; data: any } | null = null;

/**
 * Scan page for atomic testing targets
 * Scans for: attack patterns (from OpenAEV cache) and domain/hostname observables (regex)
 */
async function scanPageForAtomicTesting(): Promise<void> {
  showScanOverlay();
  
  try {
    // Clear existing highlights first
    clearHighlights();
    selectedForImport.clear();
    atomicTestingTarget = null;
    
    // Get page content - build from text nodes for consistency with highlighting
    const textNodes = getTextNodes(document.body);
    let content = '';
    textNodes.forEach((node) => {
      content += node.textContent || '';
    });
    const url = window.location.href;
    
    log.debug(' Starting atomic testing scan...');
    log.debug(`Page content length: ${content.length} chars`);
    
    // Request attack patterns from OpenAEV cache + detect domains/hostnames
    const response = await chrome.runtime.sendMessage({
      type: 'SCAN_OAEV',
      payload: { content, url, includeAttackPatterns: true },
    });
    
    // Also do regex detection for domains/hostnames
    const domainHostnameMatches = detectDomainsAndHostnames(content);
    
    log.debug(' Atomic testing scan response:', response);
    log.debug(' Domain/hostname matches:', domainHostnameMatches.length);
    
    // Collect all atomic testing targets
    const atomicTargets: Array<{
      type: 'attack-pattern' | 'domain' | 'hostname';
      value: string;
      name: string;
      data: any;
    }> = [];
    
    // Add attack patterns from OpenAEV
    if (response?.success && response?.data?.oaevEntities) {
      const attackPatterns = (response.data.oaevEntities || [])
        .filter((e: any) => e.type === 'AttackPattern');
      
      for (const ap of attackPatterns) {
        atomicTargets.push({
          type: 'attack-pattern',
          value: ap.name,
          name: ap.name,
          data: ap,
        });
      }
    }
    
    // Add domain/hostname matches
    for (const match of domainHostnameMatches) {
      atomicTargets.push({
        type: match.type as 'domain' | 'hostname',
        value: match.value,
        name: match.value,
        data: { type: match.type, value: match.value },
      });
    }
    
    log.debug(`Found ${atomicTargets.length} atomic testing targets`);
    
    if (atomicTargets.length === 0) {
      updateScanOverlay('No attack patterns or domains found on this page', false);
      return;
    }
    
    // Highlight atomic testing targets
    highlightAtomicTestingTargets(atomicTargets);
    
    updateScanOverlay(`Found ${atomicTargets.length} target${atomicTargets.length !== 1 ? 's' : ''} for atomic testing`, false);
    
    // Open the atomic testing panel
    showAtomicTestingPanel(atomicTargets);
    
  } catch (error) {
    log.error(' Atomic testing scan error:', error);
    updateScanOverlay('Atomic testing scan error: ' + (error instanceof Error ? error.message : 'Unknown'), false);
  }
}

/**
 * Detect domains and hostnames using regex
 */
function detectDomainsAndHostnames(content: string): Array<{ type: string; value: string }> {
  const results: Array<{ type: string; value: string }> = [];
  const seen = new Set<string>();
  
  // Domain/hostname pattern (simplified for common TLDs)
  const domainPattern = /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|org|net|io|co|gov|edu|mil|int|info|biz|name|pro|aero|museum|xyz|online|site|tech|dev|app|cloud|ai|ru|cn|uk|de|fr|jp|kr|br|in|au|nl|it|es|se|no|fi|dk|pl|cz|at|ch|be|pt|hu|ro|bg|sk|si|hr|rs|ua|tr|il|ae|sa|za|ng|ke|eg|ma|tn|dz|ly|jo|kw|qa|om|bh|lb|sy|iq|ir|pk|bd|vn|th|my|sg|ph|id|tw|hk|mo)\b/gi;
  
  let match;
  while ((match = domainPattern.exec(content)) !== null) {
    const value = match[0].toLowerCase();
    if (!seen.has(value) && value.length >= 4 && !value.startsWith('.')) {
      seen.add(value);
      // Determine if it's likely a hostname (has subdomain) or just a domain
      const parts = value.split('.');
      const type = parts.length > 2 ? 'hostname' : 'domain';
      results.push({ type, value });
    }
  }
  
  return results;
}

/**
 * Highlight atomic testing targets with radio-button style (single selection)
 */
function highlightAtomicTestingTargets(targets: Array<{ type: string; value: string; name: string; data: any }>): void {
  const textNodes = getTextNodes(document.body);
  const fullText = document.body.innerText;
  
  // Create a map of text node positions
  let offset = 0;
  const nodeMap: Array<{ node: Text; start: number; end: number }> = [];
  
  textNodes.forEach((node) => {
    const text = node.textContent || '';
    nodeMap.push({ node, start: offset, end: offset + text.length });
    offset += text.length;
  });
  
  for (const target of targets) {
    highlightInTextForAtomicTesting(fullText, target.value, nodeMap, target);
  }
}

/**
 * Highlight text for atomic testing mode
 */
function highlightInTextForAtomicTesting(
  fullText: string,
  searchValue: string,
  nodeMap: Array<{ node: Text; start: number; end: number }>,
  target: { type: string; value: string; name: string; data: any }
): void {
  if (!searchValue || searchValue.length < 3) return;
  
  const searchLower = searchValue.toLowerCase();
  const fullTextLower = fullText.toLowerCase();
  let pos = 0;
  let occurrenceCount = 0;
  const maxOccurrences = 10;
  
  while ((pos = fullTextLower.indexOf(searchLower, pos)) !== -1 && occurrenceCount < maxOccurrences) {
    const endPos = pos + searchValue.length;
    
    // Find which nodes contain this position
    for (const { node, start, end } of nodeMap) {
      if (pos >= start && pos < end) {
        const localStart = pos - start;
        const localEnd = Math.min(end, endPos) - start;
        
        const text = node.textContent || '';
        if (localStart >= 0 && localEnd <= text.length) {
          try {
            const range = document.createRange();
            range.setStart(node, localStart);
            range.setEnd(node, localEnd);
            
            const span = document.createElement('span');
            span.className = 'xtm-highlight xtm-atomic-testing';
            span.dataset.value = target.value;
            span.dataset.type = target.type;
            span.dataset.entity = JSON.stringify(target);
            
            // Add click handler for single selection
            span.addEventListener('click', (e) => handleAtomicTestingClick(e, span, target));
            
            range.surroundContents(span);
            occurrenceCount++;
          } catch (e) {
            // Skip invalid ranges
          }
        }
        break;
      }
    }
    pos++;
  }
}

/**
 * Handle click on atomic testing highlight (single selection)
 */
function handleAtomicTestingClick(e: Event, element: HTMLSpanElement, target: { type: string; value: string; name: string; data: any }): void {
  e.preventDefault();
  e.stopPropagation();
  
  // Clear previous selection
  document.querySelectorAll('.xtm-highlight.xtm-atomic-testing.xtm-selected').forEach(el => {
    el.classList.remove('xtm-selected');
  });
  
  // Select this one
  element.classList.add('xtm-selected');
  atomicTestingTarget = target;
  
  // Update panel with selected target
  panelFrame?.contentWindow?.postMessage(
    { type: 'ATOMIC_TESTING_SELECT', payload: target },
    '*'
  );
}

/**
 * Show the atomic testing panel
 */
async function showAtomicTestingPanel(targets: Array<{ type: string; value: string; name: string; data: any }>): Promise<void> {
  ensurePanelElements();
  showPanelElements();
  
  const theme = await getCurrentTheme();
  
  setTimeout(() => {
    panelFrame?.contentWindow?.postMessage(
      { 
        type: 'SHOW_ATOMIC_TESTING_PANEL',
        payload: { targets, theme }
      },
      '*'
    );
  }, 100);
}

/**
 * Scan page for investigation mode
 * Only highlights entities that EXIST in the specified OpenCTI platform (found=true)
 * Sends results to panel for selection
 * @param platformId - Optional platform ID to filter entities (for multi-platform support)
 */
async function scanPageForInvestigation(platformId?: string): Promise<void> {
  showScanOverlay();
  
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
      const foundOAEV = (data.oaevEntities || []).filter((e: any) => {
        if (!e.found) return false;
        // OpenAEV entities have their own platform IDs, don't mix with OpenCTI
        // Only include if no platformId filter or if it's not an OpenCTI platform filter
        if (platformId && !platformId.startsWith('oaev-')) {
          return false; // Don't include OpenAEV entities when filtering for OpenCTI platform
        }
        return true;
      });
      
      // Only highlight found entities for investigation
      const investigationResults: ScanResultPayload = {
        observables: foundObservables,
        sdos: foundSDOs,
        cves: [], // Don't include CVEs
        oaevEntities: foundOAEV,
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
      panelFrame?.contentWindow?.postMessage({
        type: 'INVESTIGATION_SCAN_RESULTS',
        payload: { entities: allFoundEntities },
      }, '*');
      
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
      panelFrame?.contentWindow?.postMessage({
        type: 'INVESTIGATION_SCAN_RESULTS',
        payload: { entities: [] },
      }, '*');
    }
  } catch (error) {
    log.error(' Investigation scan error:', error);
    updateScanOverlay('Scan failed');
    panelFrame?.contentWindow?.postMessage({
      type: 'INVESTIGATION_SCAN_RESULTS',
      payload: { entities: [] },
    }, '*');
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
  if (results.oaevEntities) {
    for (const e of results.oaevEntities) {
      highlightForInvestigation(fullText, e.name, nodeMap, `oaev-${e.type}`, e.entityId, e.platformId);
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
          const isNowSelected = !highlight.classList.contains('xtm-selected');
          highlight.classList.toggle('xtm-selected');
          
          // Sync with panel - send toggle message
          panelFrame?.contentWindow?.postMessage({
            type: 'INVESTIGATION_TOGGLE_ENTITY',
            payload: { 
              entityId: highlight.dataset.entityId,
              selected: isNowSelected,
            },
          }, '*');
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
  
  // Find and highlight observables
  for (const obs of results.observables) {
    highlightInText(fullText, obs.value, nodeMap, {
      type: obs.type,
      found: obs.found,
      data: obs,
    });
  }
  
  // Find and highlight SDOs
  for (const sdo of results.sdos) {
    highlightInText(fullText, sdo.name, nodeMap, {
      type: sdo.type,
      found: sdo.found,
      data: sdo,
    });
  }
  
  // Find and highlight CVEs (Vulnerabilities)
  if (results.cves) {
    for (const cve of results.cves) {
      highlightInText(fullText, cve.name, nodeMap, {
        type: cve.type, // 'Vulnerability'
        found: cve.found,
        data: cve,
      });
    }
  }
  
  // Find and highlight OpenAEV entities
  if (results.oaevEntities) {
    for (const oaevEntity of results.oaevEntities) {
      highlightInText(fullText, oaevEntity.name, nodeMap, {
        type: `oaev-${oaevEntity.type}`, // Prefix to distinguish from OpenCTI types
        found: oaevEntity.found,
        data: oaevEntity as unknown as DetectedSDO, // Type coercion for compatibility
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
            // Green for found (OpenCTI), cyan for OpenAEV, orange for not found, gray for SDOs that cannot be added
            const isOpenAEVType = meta.type.startsWith('oaev-');
            if (isOpenAEVType && meta.found) {
              // OpenAEV entity found - cyan style
              highlight.classList.add('xtm-oaev-found');
            } else if (meta.found) {
              // OpenCTI entity found - green style
              highlight.classList.add('xtm-found');
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
            
            // Add event listeners - use capture phase to intercept before any other handlers
            highlight.addEventListener('mouseenter', handleHighlightHover);
            highlight.addEventListener('mouseleave', handleHighlightLeave);
            highlight.addEventListener('click', handleHighlightClick, { capture: true });
            // Also prevent mousedown and mouseup from triggering other handlers
            highlight.addEventListener('mousedown', (e) => { e.stopPropagation(); }, { capture: true });
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
  
  const type = target.dataset.type || 'Unknown';
  const value = target.dataset.value || '';
  const found = target.dataset.found === 'true';
  const isSelected = selectedForImport.has(value);
  const isSdoNotAddable = target.classList.contains('xtm-sdo-not-addable');
  
  // Different status icons based on state
  let statusIcon: string;
  let statusText: string;
  let actionText: string;
  
  if (found) {
    statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#00c853"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
    statusText = 'Found in OpenCTI';
    actionText = 'Click to view details';
  } else if (isSdoNotAddable) {
    // CVE/Vulnerability not in platform - cannot be added
    statusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="#9e9e9e"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
    statusText = 'Not in platform';
    actionText = 'CVE detected but not found in OpenCTI';
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
      <span class="xtm-tooltip-type">${type}</span>
    </div>
    <div class="xtm-tooltip-value">${escapeHtml(value)}</div>
    <div class="xtm-tooltip-status ${found ? 'found' : 'not-found'}">
      ${statusIcon}
      ${statusText}
    </div>
    <div class="xtm-tooltip-action">
      ${actionText}
    </div>
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
  highlightClickInProgress = true;
  setTimeout(() => { highlightClickInProgress = false; }, 100);
  
  // Return false to prevent default (older browsers)
  if (event.returnValue !== undefined) {
    event.returnValue = false;
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
  
  if (entityData) {
    try {
      const entity = JSON.parse(entityData);
      selectedEntity = entity;
      
      if (found) {
        // Found entity - open side panel with entity details
        chrome.runtime.sendMessage({
          type: 'SHOW_ENTITY_PANEL',
          payload: {
            entityType: entity.type?.includes('-') && !entity.name ? 'observable' : 'sdo',
            entity,
          },
        });
        
        // Open side panel if available
        showPanel(entity);
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
  
  // Update the bottom selection panel
  updateSelectionPanel();
  
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

async function showPanel(entity: DetectedObservable | DetectedSDO): Promise<void> {
  ensurePanelElements();
  showPanelElements();
  
  // Get current theme to pass to panel
  const theme = await getCurrentTheme();
  
  // Send entity data to panel with existsInPlatform flag based on 'found'
  setTimeout(() => {
    panelFrame?.contentWindow?.postMessage(
      { type: 'SHOW_ENTITY', payload: { ...entity, existsInPlatform: entity.found ?? false, theme } },
      '*'
    );
  }, 100);
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

function ensurePanelElements(): void {
  // Create overlay for click-outside dismissal
  if (!panelOverlay) {
    panelOverlay = document.createElement('div');
    panelOverlay.className = 'xtm-panel-overlay hidden';
    panelOverlay.addEventListener('click', (e) => {
      // Only close if click is directly on overlay, not during highlight navigation
      if (highlightClickInProgress) {
        return; // Don't close - user clicked a highlight
      }
      const target = e.target as HTMLElement;
      if (target.classList.contains('xtm-panel-overlay')) {
        hidePanel();
      }
    });
    document.body.appendChild(panelOverlay);
  }
  
  // Create inline panel
  if (!panelFrame) {
    panelFrame = document.createElement('iframe');
    panelFrame.className = 'xtm-panel-frame hidden';
    panelFrame.src = chrome.runtime.getURL('panel/index.html');
    document.body.appendChild(panelFrame);
  }
}

function showPanelElements(): void {
  panelOverlay?.classList.remove('hidden');
  panelFrame?.classList.remove('hidden');
}

function showAddPanel(entity: DetectedObservable | DetectedSDO): void {
  ensurePanelElements();
  showPanelElements();
  
  // Send entity data to panel in add mode
  setTimeout(() => {
    panelFrame?.contentWindow?.postMessage(
      { type: 'SHOW_ADD_ENTITY', payload: entity },
      '*'
    );
  }, 100);
}

// Helper to get current theme from background
async function getCurrentTheme(): Promise<'dark' | 'light'> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_PLATFORM_THEME' }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          resolve('dark'); // Default to dark
          return;
        }
        let theme = response.data;
        if (theme === 'auto') {
          theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        resolve(theme);
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
  
  setTimeout(() => {
    panelFrame?.contentWindow?.postMessage(
      { 
        type: 'SHOW_PREVIEW', 
        payload: { 
          entities: selectedEntities, 
          pageUrl: window.location.href, 
          pageTitle: article.title,
          pageContent: article.textContent, // Use clean text content instead of HTML
          pageHtmlContent: article.content, // Also pass HTML for content field
          pageDescription: description, // Pre-computed description
          pageExcerpt: article.excerpt,
          theme: theme,
        } 
      },
      '*'
    );
  }, 100);
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
  
  setTimeout(() => {
    panelFrame?.contentWindow?.postMessage(
      { 
        type: 'SHOW_CREATE_CONTAINER', 
        payload: { 
          pageUrl: window.location.href, 
          pageTitle: article.title,
          pageContent: article.textContent, // Use clean text content instead of HTML
          pageHtmlContent: article.content, // Also pass HTML for content field
          pageDescription: description, // Pre-computed description
          pageExcerpt: article.excerpt,
          theme: theme,
        } 
      },
      '*'
    );
  }, 100);
}

async function showInvestigationPanel(): Promise<void> {
  // Show the panel first with investigation view
  // The panel will handle platform selection (if multi-platform) and trigger scan
  ensurePanelElements();
  showPanelElements();
  
  // Get current theme to pass to panel
  const theme = await getCurrentTheme();
  
  setTimeout(() => {
    panelFrame?.contentWindow?.postMessage(
      { type: 'SHOW_INVESTIGATION_PANEL', payload: { theme } },
      '*'
    );
  }, 100);
  
  // Note: We don't auto-scan here anymore
  // For single platform, the panel will send SCAN_FOR_INVESTIGATION message
  // For multi-platform, the panel shows platform selection first, then triggers scan
}

async function showSearchPanel(): Promise<void> {
  ensurePanelElements();
  showPanelElements();
  
  // Get current theme to pass to panel
  const theme = await getCurrentTheme();
  
  setTimeout(() => {
    panelFrame?.contentWindow?.postMessage(
      { type: 'SHOW_SEARCH_PANEL', payload: { theme } },
      '*'
    );
  }, 100);
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
    
    case 'SCAN_ATOMIC_TESTING':
      // Atomic testing scan (attack patterns + domains/hostnames)
      scanPageForAtomicTesting().then(() => sendResponse({ success: true }));
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

