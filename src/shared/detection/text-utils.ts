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
 * Also traverses Shadow DOM trees for sites like VirusTotal
 */
export function getTextNodes(element: Node): Text[] {
    const textNodes: Text[] = [];
    
    // Helper to check if a node should be accepted
    const shouldAcceptNode = (node: Node): boolean => {
        if (!node.textContent?.trim()) {
            return false;
        }
        const parent = node.parentElement;
        if (
            parent &&
            ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(
                parent.tagName
            )
        ) {
            return false;
        }
        return true;
    };
    
    // Helper to walk a tree (regular DOM or Shadow DOM)
    const walkTree = (root: Node) => {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) => {
                    // For text nodes, apply our filter
                    if (node.nodeType === Node.TEXT_NODE) {
                        return shouldAcceptNode(node) 
                            ? NodeFilter.FILTER_ACCEPT 
                            : NodeFilter.FILTER_REJECT;
                    }
                    // For elements, always accept to traverse children
                    return NodeFilter.FILTER_SKIP;
                },
            }
        );

        let node;
        while ((node = walker.nextNode())) {
            if (node.nodeType === Node.TEXT_NODE) {
                textNodes.push(node as Text);
            }
        }
    };
    
    // Walk the main tree
    walkTree(element);
    
    // Recursively walk Shadow DOM trees
    const visitedRoots = new Set<ShadowRoot>();
    
    const walkShadowRoot = (shadowRoot: ShadowRoot) => {
        if (visitedRoots.has(shadowRoot)) return;
        visitedRoots.add(shadowRoot);
        
        // Walk text nodes in this shadow root
        walkTree(shadowRoot);
        
        // Find nested shadow roots inside this one
        shadowRoot.querySelectorAll('*').forEach(nestedEl => {
            if (nestedEl.shadowRoot) {
                walkShadowRoot(nestedEl.shadowRoot);
            }
        });
    };
    
    // Start with elements in the main DOM
    const elements = element.nodeType === Node.ELEMENT_NODE 
        ? (element as Element).querySelectorAll('*')
        : document.querySelectorAll('*');
    
    elements.forEach(el => {
        if (el.shadowRoot) {
            walkShadowRoot(el.shadowRoot);
        }
    });

    return textNodes;
}

/**
 * Normalize whitespace in text for matching
 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

