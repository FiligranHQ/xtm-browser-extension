/**
 * Content Helpers
 * Utility functions for content processing in the panel
 */

import DOMPurify from 'dompurify';

/**
 * Clean and sanitize HTML content for display/storage
 */
export const cleanHtmlContent = (html: string): string => {
  if (!html) return '';
  
  // Use DOMPurify to sanitize HTML
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'div',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target'],
  });
  
  return clean;
};

/**
 * Generate a description from page content (first ~500 chars, clean)
 */
export const generateDescription = (content: string, maxLength = 500): string => {
  if (!content) return '';
  
  // Remove extra whitespace
  const cleaned = content.replace(/\s+/g, ' ').trim();
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  // Find a good break point (end of sentence or word)
  let breakPoint = cleaned.lastIndexOf('. ', maxLength);
  if (breakPoint === -1 || breakPoint < maxLength / 2) {
    breakPoint = cleaned.lastIndexOf(' ', maxLength);
  }
  if (breakPoint === -1) {
    breakPoint = maxLength;
  }
  
  return cleaned.substring(0, breakPoint) + '...';
};

/**
 * Extract text content from HTML
 */
export const extractTextFromHtml = (html: string): string => {
  if (!html) return '';
  
  // Create a temporary element to parse HTML
  const div = document.createElement('div');
  div.innerHTML = html;
  
  return div.textContent || div.innerText || '';
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Format bytes to human-readable size
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Check if a string is a valid URL
 */
export const isValidUrl = (str: string): boolean => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

/**
 * Extract domain from URL
 */
export const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
};

