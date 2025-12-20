/**
 * Enhanced PDF Generator
 * 
 * Generates high-quality PDFs using:
 * 1. Chrome's native print-to-PDF (via Debugger API) - Best quality
 * 2. Reader-view rendering with jsPDF - Fallback with selectable text
 * 3. html2canvas capture - Last resort for complex layouts
 */

import { jsPDF } from 'jspdf';
import type { ExtractedContent, ExtractedImage } from './content-extractor';
import { loggers } from '../utils/logger';

const log = loggers.extraction;

export interface PDFGenerationResult {
  data: string; // Base64 encoded PDF
  filename: string;
  method: 'native' | 'jspdf' | 'canvas';
}

export interface PDFOptions {
  /** Include images in PDF */
  includeImages?: boolean;
  /** Paper size */
  paperSize?: 'a4' | 'letter' | 'legal';
  /** Print background colors/images */
  printBackground?: boolean;
  /** Header text */
  headerText?: string;
  /** Footer text */
  footerText?: string;
}

const DEFAULT_OPTIONS: PDFOptions = {
  includeImages: true,
  paperSize: 'a4',
  printBackground: false,
  headerText: 'Filigran XTM Browser Extension',
  footerText: '',
};

// Paper dimensions in mm
const PAPER_SIZES = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
};

/**
 * Generate PDF from extracted content
 * Tries native print first, falls back to jsPDF
 */
export async function generatePDF(
  content: ExtractedContent,
  options: PDFOptions = {}
): Promise<PDFGenerationResult | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Try jsPDF generation (most reliable for extensions)
  const jspdfResult = await generateWithJsPDF(content, opts);
  if (jspdfResult) {
    return jspdfResult;
  }
  
  log.error('[PDFGenerator] All PDF generation methods failed');
  return null;
}

/**
 * Request native PDF generation from background script
 * This uses Chrome's Debugger API for best quality
 */
export async function requestNativePDF(tabId: number): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'GENERATE_NATIVE_PDF', tabId },
      (response) => {
        if (response?.success && response.data) {
          resolve(response.data);
        } else {
          log.debug('[PDFGenerator] Native PDF generation failed:', response?.error);
          resolve(null);
        }
      }
    );
  });
}

/**
 * Generate PDF using jsPDF with clean formatting
 */
async function generateWithJsPDF(
  content: ExtractedContent,
  options: PDFOptions
): Promise<PDFGenerationResult | null> {
  try {
    const paperSize = PAPER_SIZES[options.paperSize || 'a4'];
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [paperSize.width, paperSize.height],
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;
    
    // Helper: Check and add new page if needed
    const checkPageBreak = (neededHeight: number): void => {
      if (yPosition + neededHeight > pageHeight - margin - 15) {
        addFooter();
        pdf.addPage();
        yPosition = margin;
        addHeader();
      }
    };
    
    // Helper: Add header
    const addHeader = (): void => {
      if (options.headerText) {
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.setFont('helvetica', 'normal');
        pdf.text(options.headerText, margin, 10);
        pdf.setDrawColor(230, 230, 230);
        pdf.line(margin, 12, pageWidth - margin, 12);
      }
    };
    
    // Helper: Add footer
    const addFooter = (): void => {
      const footerY = pageHeight - 8;
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.setFont('helvetica', 'normal');
      
      const pageNum = pdf.getNumberOfPages();
      pdf.text(`Page ${pageNum}`, pageWidth - margin - 15, footerY);
      
      pdf.setDrawColor(230, 230, 230);
      pdf.line(margin, footerY - 3, pageWidth - margin, footerY - 3);
      
      const hostname = new URL(content.url).hostname;
      pdf.text(hostname, margin, footerY);
    };
    
    // Helper: Add image to PDF
    const addImage = async (img: ExtractedImage): Promise<void> => {
      try {
        log.debug('[PDFGenerator] Adding image to PDF:', img.src);
        const imageData = await loadImageAsDataUrl(img.src);
        if (!imageData) {
          log.warn('[PDFGenerator] Could not load image:', img.src);
          return;
        }
        
        // Detect image format from data URL
        let imageFormat: 'JPEG' | 'PNG' | 'GIF' | 'WEBP' = 'PNG';
        if (imageData.includes('data:image/jpeg') || imageData.includes('data:image/jpg')) {
          imageFormat = 'JPEG';
        } else if (imageData.includes('data:image/gif')) {
          imageFormat = 'GIF';
        } else if (imageData.includes('data:image/webp')) {
          imageFormat = 'WEBP';
        }
        log.debug('[PDFGenerator] Detected image format:', imageFormat);
        
        // Get actual dimensions from the data URL
        const actualDims = await getImageDimensions(imageData);
        if (!actualDims) {
          log.warn('[PDFGenerator] Could not get image dimensions:', img.src);
          return;
        }
        
        let imgWidth = actualDims.width;
        let imgHeight = actualDims.height;
        log.debug('[PDFGenerator] Image dimensions:', imgWidth, 'x', imgHeight);
        
        // Scale to fit content width (170mm max = ~642px at 3.78 px/mm)
        const maxWidthPx = contentWidth * 3.78;
        if (imgWidth > maxWidthPx) {
          const scale = maxWidthPx / imgWidth;
          imgWidth = maxWidthPx;
          imgHeight = imgHeight * scale;
        }
        
        // Also limit height
        const maxHeightPx = (pageHeight - margin * 2 - 30) * 3.78; // Leave room for header/footer
        if (imgHeight > maxHeightPx) {
          const scale = maxHeightPx / imgHeight;
          imgHeight = maxHeightPx;
          imgWidth = imgWidth * scale;
        }
        
        // Convert to mm
        const imgWidthMm = imgWidth / 3.78;
        const imgHeightMm = imgHeight / 3.78;
        
        // Ensure minimum size (sometimes images come through too small)
        if (imgWidthMm < 10 || imgHeightMm < 10) {
          log.warn('[PDFGenerator] Image too small, skipping:', imgWidthMm, 'x', imgHeightMm);
          return;
        }
        
        // Check page break
        checkPageBreak(imgHeightMm + 15);
        
        // Center the image
        const imgX = margin + (contentWidth - imgWidthMm) / 2;
        
        log.debug('[PDFGenerator] Rendering image at:', imgX, yPosition, 'size:', imgWidthMm, 'x', imgHeightMm, 'format:', imageFormat);
        
        try {
          // Use addImage with explicit format
          pdf.addImage(imageData, imageFormat, imgX, yPosition, imgWidthMm, imgHeightMm);
          yPosition += imgHeightMm + 3;
          log.debug('[PDFGenerator] Image added successfully, new yPosition:', yPosition);
        } catch (imgError) {
          log.error('[PDFGenerator] jsPDF addImage error:', imgError);
          // Try with auto-detect (passing data URL without format)
          try {
            pdf.addImage(imageData, imgX, yPosition, imgWidthMm, imgHeightMm);
            yPosition += imgHeightMm + 3;
            log.debug('[PDFGenerator] Image added with auto-detect, new yPosition:', yPosition);
          } catch (autoError) {
            log.error('[PDFGenerator] jsPDF addImage auto-detect also failed:', autoError);
            return;
          }
        }
        
        // Add caption if present
        if (img.caption || img.alt) {
          pdf.setFontSize(9);
          pdf.setTextColor(100, 100, 100);
          pdf.setFont('helvetica', 'italic');
          const caption = img.caption || img.alt;
          const captionLines = pdf.splitTextToSize(caption, contentWidth);
          pdf.text(captionLines, margin, yPosition);
          yPosition += captionLines.length * 4 + 3;
        }
        
        yPosition += 5;
      } catch (e) {
        log.error('[PDFGenerator] Failed to add image:', img.src, e);
      }
    };
    
    // Helper: Get image dimensions from data URL
    const getImageDimensions = (dataUrl: string): Promise<{width: number; height: number} | null> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      });
    };
    
    // Start building the PDF
    addHeader();
    yPosition = margin + 5;
    
    // === Brand header ===
    pdf.setFillColor(0, 27, 218); // Filigran blue
    pdf.rect(margin, yPosition, contentWidth, 0.5, 'F');
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
    yPosition += 8;
    
    // === Article title ===
    pdf.setFontSize(20);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    const titleLines = pdf.splitTextToSize(content.title, contentWidth);
    checkPageBreak(titleLines.length * 8);
    pdf.text(titleLines, margin, yPosition);
    yPosition += titleLines.length * 8 + 3;
    
    // === Byline ===
    if (content.byline) {
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      pdf.setFont('helvetica', 'italic');
      pdf.text(content.byline, margin, yPosition);
      yPosition += 5;
    }
    
    // === Metadata ===
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont('helvetica', 'normal');
    
    const metaParts = [content.siteName];
    if (content.publishedDate) metaParts.push(content.publishedDate);
    metaParts.push(`${content.readingTime} min read`);
    pdf.text(metaParts.join(' • '), margin, yPosition);
    yPosition += 5;
    
    // === Source URL ===
    pdf.setTextColor(0, 100, 200);
    const truncatedUrl = content.url.length > 70 
      ? content.url.substring(0, 67) + '...' 
      : content.url;
    pdf.textWithLink(truncatedUrl, margin, yPosition, { url: content.url });
    yPosition += 5;
    
    // Separator
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;
    
    // === Content ===
    // Parse the HTML content and render it
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content.content;
    
    // Track images to add after their context (for deferred rendering)
    const imagesToAdd: ExtractedImage[] = [];
    
    // Track all added image sources to avoid duplicates
    const addedImageSrcs = new Set<string>();
    
    // Process each element
    const processElement = async (element: Element): Promise<void> => {
      const tagName = element.tagName.toLowerCase();
      
      switch (tagName) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6': {
          const fontSize = { h1: 18, h2: 16, h3: 14, h4: 13, h5: 12, h6: 11 }[tagName] || 14;
          const text = element.textContent?.trim() || '';
          if (!text) break;
          
          yPosition += 5;
          checkPageBreak(fontSize + 5);
          
          pdf.setFontSize(fontSize);
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'bold');
          const lines = pdf.splitTextToSize(text, contentWidth);
          pdf.text(lines, margin, yPosition);
          yPosition += lines.length * (fontSize * 0.4) + 3;
          break;
        }
        
        case 'p': {
          const text = element.textContent?.trim() || '';
          if (!text) break;
          
          checkPageBreak(15);
          
          pdf.setFontSize(11);
          pdf.setTextColor(30, 30, 30);
          pdf.setFont('helvetica', 'normal');
          const lines = pdf.splitTextToSize(text, contentWidth);
          pdf.text(lines, margin, yPosition);
          yPosition += lines.length * 5 + 4;
          break;
        }
        
        case 'blockquote': {
          const text = element.textContent?.trim() || '';
          if (!text) break;
          
          checkPageBreak(20);
          
          // Draw quote bar
          pdf.setDrawColor(0, 27, 218);
          pdf.setLineWidth(0.8);
          const quoteStartY = yPosition - 2;
          
          pdf.setFontSize(11);
          pdf.setTextColor(60, 60, 60);
          pdf.setFont('helvetica', 'italic');
          const lines = pdf.splitTextToSize(text, contentWidth - 10);
          pdf.text(lines, margin + 8, yPosition);
          yPosition += lines.length * 5 + 2;
          
          pdf.line(margin + 2, quoteStartY, margin + 2, yPosition);
          yPosition += 4;
          break;
        }
        
        case 'ul':
        case 'ol': {
          const items = element.querySelectorAll(':scope > li');
          let itemNum = 1;
          
          for (const li of items) {
            const text = li.textContent?.trim() || '';
            if (!text) continue;
            
            checkPageBreak(10);
            
            const bullet = tagName === 'ol' ? `${itemNum}.` : '•';
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(11);
            pdf.setTextColor(30, 30, 30);
            pdf.text(bullet, margin, yPosition);
            
            const lines = pdf.splitTextToSize(text, contentWidth - 10);
            pdf.text(lines, margin + 8, yPosition);
            yPosition += lines.length * 5 + 2;
            
            itemNum++;
          }
          yPosition += 3;
          break;
        }
        
        case 'pre':
        case 'code': {
          const text = element.textContent?.trim() || '';
          if (!text) break;
          
          checkPageBreak(15);
          
          pdf.setFont('courier', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(50, 50, 50);
          
          // Background for code
          pdf.setFillColor(245, 245, 245);
          const lines = pdf.splitTextToSize(text, contentWidth - 8);
          const codeHeight = lines.length * 4 + 6;
          pdf.rect(margin, yPosition - 3, contentWidth, codeHeight, 'F');
          
          pdf.text(lines, margin + 4, yPosition);
          yPosition += codeHeight + 3;
          
          pdf.setFont('helvetica', 'normal');
          break;
        }
        
        case 'img': {
          if (options.includeImages) {
            const imgEl = element as HTMLImageElement;
            const src = imgEl.src || imgEl.getAttribute('data-src') || '';
            if (src && !addedImageSrcs.has(src)) {
              const img: ExtractedImage = {
                src: src,
                alt: imgEl.alt || '',
                caption: '',
                width: imgEl.naturalWidth || imgEl.width || 400,
                height: imgEl.naturalHeight || imgEl.height || 300,
              };
              await addImage(img);
              addedImageSrcs.add(src);
            }
          }
          break;
        }
        
        case 'figure': {
          if (options.includeImages) {
            const imgEl = element.querySelector('img') as HTMLImageElement;
            const figcaption = element.querySelector('figcaption');
            if (imgEl) {
              const src = imgEl.src || imgEl.getAttribute('data-src') || '';
              if (src && !addedImageSrcs.has(src)) {
                const img: ExtractedImage = {
                  src: src,
                  alt: imgEl.alt || '',
                  caption: figcaption?.textContent?.trim() || '',
                  width: imgEl.naturalWidth || imgEl.width || 400,
                  height: imgEl.naturalHeight || imgEl.height || 300,
                };
                await addImage(img);
                addedImageSrcs.add(src);
              }
            }
          }
          break;
        }
        
        case 'hr': {
          yPosition += 3;
          pdf.setDrawColor(200, 200, 200);
          pdf.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 6;
          break;
        }
        
        case 'a': {
          // Process links (usually within paragraphs, handled there)
          break;
        }
        
        case 'table': {
          // Simple table rendering
          const rows = element.querySelectorAll('tr');
          if (rows.length === 0) break;
          
          checkPageBreak(rows.length * 8 + 10);
          
          pdf.setFontSize(10);
          let isHeader = true;
          
          for (const row of rows) {
            const cells = row.querySelectorAll('th, td');
            const cellWidth = contentWidth / cells.length;
            let x = margin;
            
            for (const cell of cells) {
              const text = cell.textContent?.trim() || '';
              
              if (isHeader || cell.tagName === 'TH') {
                pdf.setFont('helvetica', 'bold');
                pdf.setFillColor(245, 245, 245);
                pdf.rect(x, yPosition - 4, cellWidth, 8, 'F');
              } else {
                pdf.setFont('helvetica', 'normal');
              }
              
              pdf.setTextColor(30, 30, 30);
              const truncated = text.length > 30 ? text.substring(0, 27) + '...' : text;
              pdf.text(truncated, x + 2, yPosition);
              
              // Cell border
              pdf.setDrawColor(220, 220, 220);
              pdf.rect(x, yPosition - 4, cellWidth, 8);
              
              x += cellWidth;
            }
            
            yPosition += 8;
            isHeader = false;
          }
          yPosition += 4;
          break;
        }
        
        default: {
          // For divs, sections, etc., process children
          if (element.children.length > 0) {
            for (const child of element.children) {
              await processElement(child);
            }
          } else {
            // Text node fallback
            const text = element.textContent?.trim();
            if (text && text.length > 20) {
              pdf.setFontSize(11);
              pdf.setTextColor(30, 30, 30);
              pdf.setFont('helvetica', 'normal');
              const lines = pdf.splitTextToSize(text, contentWidth);
              checkPageBreak(lines.length * 5);
              pdf.text(lines, margin, yPosition);
              yPosition += lines.length * 5 + 3;
            }
          }
        }
      }
    };
    
    // First pass: collect image positions from the HTML to understand their context
    // This helps us render images at their proper location in the document
    const imagePositions = new Map<string, number>();
    let elementIndex = 0;
    
    function collectImagePositions(element: Element): void {
      const tagName = element.tagName.toLowerCase();
      elementIndex++;
      
      if (tagName === 'img') {
        const imgEl = element as HTMLImageElement;
        const src = imgEl.src || imgEl.getAttribute('data-src') || '';
        if (src && !src.includes('data:image/svg')) {
          imagePositions.set(src, elementIndex);
        }
      } else if (tagName === 'figure') {
        const imgEl = element.querySelector('img') as HTMLImageElement;
        if (imgEl) {
          const src = imgEl.src || imgEl.getAttribute('data-src') || '';
          if (src && !src.includes('data:image/svg')) {
            imagePositions.set(src, elementIndex);
          }
        }
      }
      
      // Recurse into children
      for (const child of element.children) {
        collectImagePositions(child);
      }
    }
    
    // Collect positions
    for (const child of tempDiv.children) {
      collectImagePositions(child);
    }
    
    log.debug('[PDFGenerator] Found images with positions:', imagePositions.size);
    
    // Process all top-level elements - images are rendered INLINE where they appear
    for (const child of tempDiv.children) {
      await processElement(child);
    }
    
    // Only add hero/featured images from extraction if they weren't in HTML
    // These are images that were found separately (e.g., og:image, hero banners)
    // and should be added at the beginning if not already present
    if (options.includeImages && content.images.length > 0) {
      // Only the first image from extraction might be a hero - add it only if not already rendered
      const heroImage = content.images[0];
      if (heroImage && !addedImageSrcs.has(heroImage.src) && !imagePositions.has(heroImage.src)) {
        log.debug('[PDFGenerator] Hero image not in HTML content, was likely added at the top already');
        // Hero images are typically added to the HTML by content-extractor, so skip
      }
    }
    
    log.debug('[PDFGenerator] Total images added to PDF:', addedImageSrcs.size);
    
    // Final footer
    addFooter();
    
    // Generate filename
    const filename = sanitizeFilename(content.title) + '.pdf';
    
    // Get PDF as base64
    const pdfOutput = pdf.output('datauristring');
    const base64Data = pdfOutput.split(',')[1];
    
    log.debug('[PDFGenerator] jsPDF generation complete, size:', base64Data.length);
    
    return {
      data: base64Data,
      filename,
      method: 'jspdf',
    };
  } catch (error) {
    log.error('[PDFGenerator] jsPDF generation failed:', error);
    return null;
  }
}

/**
 * Load image as data URL for embedding in PDF
 * Tries multiple methods to handle CORS issues
 */
async function loadImageAsDataUrl(src: string): Promise<string | null> {
  if (!src) return null;
  
  log.debug('[PDFGenerator] Loading image:', src);
  
  // Method 1: Try via background script (bypasses CORS completely)
  try {
    const dataUrl = await fetchImageViaBackground(src);
    if (dataUrl) {
      log.debug('[PDFGenerator] Loaded via background script:', src);
      return await resizeImageDataUrl(dataUrl);
    }
  } catch (e) {
    log.debug('[PDFGenerator] Background fetch failed:', src, e);
  }
  
  // Method 2: Try using fetch directly (works for same-origin or CORS-enabled)
  try {
    const response = await fetch(src, { 
      mode: 'cors',
      credentials: 'omit',
    });
    
    if (response.ok) {
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrl) {
        log.debug('[PDFGenerator] Loaded via direct fetch:', src);
        return await resizeImageDataUrl(dataUrl);
      }
    }
  } catch (e) {
    log.debug('[PDFGenerator] Direct fetch failed:', src, e);
  }
  
  // Method 3: Try loading as Image without CORS (may work for same-origin)
  try {
    const dataUrl = await loadImageViaCanvas(src, false);
    if (dataUrl) {
      log.debug('[PDFGenerator] Loaded via canvas (no CORS):', src);
      return dataUrl;
    }
  } catch (e) {
    log.debug('[PDFGenerator] Canvas (no CORS) failed:', src, e);
  }
  
  // Method 4: Try with CORS attribute
  try {
    const dataUrl = await loadImageViaCanvas(src, true);
    if (dataUrl) {
      log.debug('[PDFGenerator] Loaded via canvas (CORS):', src);
      return dataUrl;
    }
  } catch (e) {
    log.debug('[PDFGenerator] Canvas (CORS) failed:', src, e);
  }
  
  log.warn('[PDFGenerator] All methods failed for image:', src);
  return null;
}

/**
 * Fetch image via background script (bypasses CORS)
 */
async function fetchImageViaBackground(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    // Set timeout in case background script doesn't respond
    const timeoutId = setTimeout(() => {
      log.debug('[PDFGenerator] Background fetch timeout:', src);
      resolve(null);
    }, 15000);
    
    try {
      chrome.runtime.sendMessage(
        { type: 'FETCH_IMAGE_AS_DATA_URL', payload: { url: src } },
        (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            log.debug('[PDFGenerator] Background message error:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          
          if (response?.success && response?.dataUrl) {
            resolve(response.dataUrl);
          } else {
            log.debug('[PDFGenerator] Background fetch failed:', response?.error);
            resolve(null);
          }
        }
      );
    } catch (e) {
      clearTimeout(timeoutId);
      log.debug('[PDFGenerator] Background message exception:', e);
      resolve(null);
    }
  });
}

/**
 * Convert blob to data URL
 */
function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

/**
 * Resize image data URL if needed
 */
async function resizeImageDataUrl(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl); // Return original if can't resize
          return;
        }
        
        // Limit size for PDF
        const maxWidth = 800;
        const maxHeight = 1000;
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        
        // Scale down if too large
        if (width > maxWidth) {
          const scale = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * scale);
        }
        if (height > maxHeight) {
          const scale = maxHeight / height;
          height = maxHeight;
          width = Math.round(width * scale);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // White background for transparency
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } catch (e) {
        log.debug('[PDFGenerator] Resize failed, using original');
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Load image via canvas approach
 */
function loadImageViaCanvas(src: string, useCors: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (useCors) {
      img.crossOrigin = 'anonymous';
    }
    
    const timeoutId = setTimeout(() => {
      log.debug('[PDFGenerator] Image load timeout:', src);
      resolve(null);
    }, 10000); // 10 second timeout
    
    img.onload = () => {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        
        // Limit size
        const maxWidth = 800;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        
        if (width > maxWidth) {
          const scale = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * scale);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      } catch (e) {
        // Canvas tainted - CORS issue
        log.debug('[PDFGenerator] Canvas tainted:', src, e);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeoutId);
      log.debug('[PDFGenerator] Image load error:', src);
      resolve(null);
    };
    
    img.src = src;
  });
}

/**
 * Sanitize filename for PDF
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Collapse multiple underscores
    .substring(0, 100) // Limit length
    .replace(/^_|_$/g, ''); // Trim leading/trailing underscores
}

