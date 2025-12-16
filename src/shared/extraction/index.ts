/**
 * Content Extraction Module
 * 
 * Provides clean article extraction and PDF generation for the XTM browser extension.
 * 
 * Usage:
 *   import { extractContent, generatePDF, generateReaderView } from '../shared/extraction';
 */

export {
  extractContent,
  generateReaderView,
  contentToHtmlBlob,
  type ExtractedContent,
  type ExtractedImage,
} from './content-extractor';

export {
  generatePDF,
  requestNativePDF,
  type PDFGenerationResult,
  type PDFOptions,
} from './pdf-generator';

export {
  generateNativePDF,
  generatePDFFromHtml,
  isNativePDFAvailable,
  type NativePDFOptions,
} from './native-pdf';

