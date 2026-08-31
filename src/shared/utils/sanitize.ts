/**
 * HTML sanitization helpers
 *
 * Page content reaches us from arbitrary sites, so every string that ends up in
 * an `innerHTML`/`insertAdjacentHTML` sink goes through DOMPurify first.
 */

import DOMPurify from 'dompurify';

// Readability keeps video embeds, and the extractors filter those by selector
// afterwards, so iframes survive sanitization here (DOMPurify still drops
// javascript:/data: sources and srcdoc).
const CONFIG = {
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target'],
};

/**
 * Sanitize an untrusted HTML string.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, CONFIG);
}

/**
 * Assign untrusted HTML to an element.
 */
export function setSanitizedHtml(element: Element, html: string): void {
  element.innerHTML = sanitizeHtml(html);
}

/**
 * Insert untrusted HTML at a position relative to an element.
 */
export function insertSanitizedHtml(
  element: Element,
  position: InsertPosition,
  html: string
): void {
  element.insertAdjacentHTML(position, sanitizeHtml(html));
}
