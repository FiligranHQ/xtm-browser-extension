/**
 * Text manipulation utilities for detection
 */

/**
 * Extract clean text from HTML
 */
export function extractTextFromHTML(html: string): string {
    // Create a temporary element to parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove script and style elements
    const scripts = doc.querySelectorAll('script, style, noscript');
    scripts.forEach((el) => el.remove());

    // Get text content
    return doc.body.textContent || '';
}

/**
 * Get text nodes from a DOM element for highlighting
 */
export function getTextNodes(element: Node): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                // Skip empty nodes and nodes in scripts/styles
                if (!node.textContent?.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }
                const parent = node.parentElement;
                if (
                    parent &&
                    ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(
                        parent.tagName
                    )
                ) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        }
    );

    let node;
    while ((node = walker.nextNode())) {
        textNodes.push(node as Text);
    }

    return textNodes;
}

/**
 * Normalize whitespace in text for matching
 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

