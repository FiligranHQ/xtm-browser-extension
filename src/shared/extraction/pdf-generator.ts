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
  
  console.error('[PDFGenerator] All PDF generation methods failed');
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
          console.debug('[PDFGenerator] Native PDF generation failed:', response?.error);
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
        const imageData = await loadImageAsDataUrl(img.src);
        if (!imageData) return;
        
        // Calculate dimensions to fit within content width
        let imgWidth = Math.min(img.width || 400, contentWidth * 3.78); // Convert mm to approximate pixels
        let imgHeight = img.height || 300;
        
        // Scale to fit content width
        if (imgWidth > contentWidth * 3.78) {
          const scale = (contentWidth * 3.78) / imgWidth;
          imgWidth *= scale;
          imgHeight *= scale;
        }
        
        // Convert to mm
        const imgWidthMm = imgWidth / 3.78;
        const imgHeightMm = imgHeight / 3.78;
        
        // Check page break
        checkPageBreak(imgHeightMm + 10);
        
        // Center the image
        const imgX = margin + (contentWidth - imgWidthMm) / 2;
        
        pdf.addImage(imageData, 'JPEG', imgX, yPosition, imgWidthMm, imgHeightMm);
        yPosition += imgHeightMm + 3;
        
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
        console.debug('[PDFGenerator] Failed to add image:', e);
      }
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
    
    // Track images to add after their context
    const imagesToAdd: ExtractedImage[] = [];
    
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
            const img: ExtractedImage = {
              src: imgEl.src,
              alt: imgEl.alt || '',
              caption: '',
              width: imgEl.naturalWidth || imgEl.width || 400,
              height: imgEl.naturalHeight || imgEl.height || 300,
            };
            imagesToAdd.push(img);
          }
          break;
        }
        
        case 'figure': {
          if (options.includeImages) {
            const imgEl = element.querySelector('img') as HTMLImageElement;
            const figcaption = element.querySelector('figcaption');
            if (imgEl) {
              const img: ExtractedImage = {
                src: imgEl.src,
                alt: imgEl.alt || '',
                caption: figcaption?.textContent?.trim() || '',
                width: imgEl.naturalWidth || imgEl.width || 400,
                height: imgEl.naturalHeight || imgEl.height || 300,
              };
              imagesToAdd.push(img);
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
    
    // Process all top-level elements
    for (const child of tempDiv.children) {
      await processElement(child);
      
      // Add any queued images after their context
      if (options.includeImages && imagesToAdd.length > 0) {
        for (const img of imagesToAdd) {
          await addImage(img);
        }
        imagesToAdd.length = 0;
      }
    }
    
    // If we have remaining images from the extraction, add them at the end
    if (options.includeImages && content.images.length > 0) {
      yPosition += 5;
      checkPageBreak(20);
      
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Images', margin, yPosition);
      yPosition += 8;
      
      // Add only images not already in content
      const addedSrcs = new Set(imagesToAdd.map(i => i.src));
      for (const img of content.images) {
        if (!addedSrcs.has(img.src)) {
          await addImage(img);
        }
      }
    }
    
    // Final footer
    addFooter();
    
    // Generate filename
    const filename = sanitizeFilename(content.title) + '.pdf';
    
    // Get PDF as base64
    const pdfOutput = pdf.output('datauristring');
    const base64Data = pdfOutput.split(',')[1];
    
    console.debug('[PDFGenerator] jsPDF generation complete, size:', base64Data.length);
    
    return {
      data: base64Data,
      filename,
      method: 'jspdf',
    };
  } catch (error) {
    console.error('[PDFGenerator] jsPDF generation failed:', error);
    return null;
  }
}

/**
 * Load image as data URL for embedding in PDF
 */
async function loadImageAsDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        
        // Limit size for PDF (max 1200px width)
        const maxWidth = 1200;
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        
        if (width > maxWidth) {
          const scale = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * scale);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw with white background (for transparency)
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      } catch (e) {
        console.debug('[PDFGenerator] Failed to convert image:', e);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      console.debug('[PDFGenerator] Failed to load image:', src);
      resolve(null);
    };
    
    // Set timeout for slow loading images
    setTimeout(() => resolve(null), 5000);
    
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

