/**
 * Test for highlighting multiple observables in a list
 * Regression test for: https://github.com/FiligranHQ/xtm-browser-extension/issues/XXX
 * 
 * Issue: When multiple defanged observables appeared in a list (e.g., IOCs section),
 * only some of them were highlighted despite all being detected.
 * 
 * Root cause: The skipHighlighted logic used `break` instead of `continue` when
 * encountering an already-highlighted node, preventing other occurrences from being found.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  findMatchPositionsWithBoundaries,
  collectRegexMatches,
  type NodeMapEntry,
} from '../../src/content/utils/highlight';

describe('Highlighting multiple observables in a list', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    // Create a fresh DOM for each test
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    global.document = document as unknown as Document;
  });

  /**
   * Helper to build a node map from text nodes
   */
  function buildNodeMap(textNodes: Text[]): { nodeMap: NodeMapEntry[]; fullText: string } {
    let offset = 0;
    const nodeMap: NodeMapEntry[] = [];
    
    textNodes.forEach((node) => {
      const text = node.textContent || '';
      nodeMap.push({ node, start: offset, end: offset + text.length });
      offset += text.length;
    });
    
    const fullText = textNodes.map((n) => n.textContent).join('');
    return { nodeMap, fullText };
  }

  /**
   * Helper to get all text nodes from an element
   */
  function getTextNodes(element: Node): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      element,
      4, // NodeFilter.SHOW_TEXT = 4 (use numeric value for JSDOM compatibility)
      {
        acceptNode: (node) => {
          return node.textContent?.trim() ? 1 : 2; // FILTER_ACCEPT = 1, FILTER_REJECT = 2
        },
      }
    );
    
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }
    
    return textNodes;
  }

  it('should find all defanged domains in a list, not just the first one', () => {
    // Create HTML similar to the IOCs section in the bug report
    const container = document.createElement('div');
    container.innerHTML = `
      <p>Known domains:</p>
      <p>sopatrasoftware[.]net</p>
      <p>setimgfont[.]com</p>
      <p>ageyeboo[.]com</p>
    `;
    document.body.appendChild(container);

    const textNodes = getTextNodes(container);
    const { nodeMap, fullText } = buildNodeMap(textNodes);

    // Search for each domain
    const domain1Matches = findMatchPositionsWithBoundaries(
      fullText,
      'sopatrasoftware[.]net',
      nodeMap,
      { caseSensitive: false, skipHighlighted: true, checkBoundaries: false }
    );

    const domain2Matches = findMatchPositionsWithBoundaries(
      fullText,
      'setimgfont[.]com',
      nodeMap,
      { caseSensitive: false, skipHighlighted: true, checkBoundaries: false }
    );

    const domain3Matches = findMatchPositionsWithBoundaries(
      fullText,
      'ageyeboo[.]com',
      nodeMap,
      { caseSensitive: false, skipHighlighted: true, checkBoundaries: false }
    );

    // All three domains should be found
    expect(domain1Matches.length).toBeGreaterThan(0);
    expect(domain2Matches.length).toBeGreaterThan(0);
    expect(domain3Matches.length).toBeGreaterThan(0);
  });

  it('should find all URLs in a list, even after first one is highlighted', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <p>Known redirector URLs:</p>
      <p>hxxps://admin[.]artemood[.]com/vendor/plugx/*.php</p>
      <p>hxxps://mittalcpa[.]com/wp-content/plugins/bungs/*.php</p>
      <p>hxxps://esclerosemultiplario[.]com[.]br/wp-content/plugins/areada/*.php</p>
    `;
    document.body.appendChild(container);

    let textNodes = getTextNodes(container);
    let { nodeMap, fullText } = buildNodeMap(textNodes);

    // Find first URL
    const url1Matches = findMatchPositionsWithBoundaries(
      fullText,
      'hxxps://admin[.]artemood[.]com/vendor/plugx/*.php',
      nodeMap,
      { caseSensitive: false, skipHighlighted: true, checkBoundaries: false }
    );

    expect(url1Matches.length).toBeGreaterThan(0);

    // Simulate highlighting the first URL
    const firstMatch = url1Matches[0];
    const node = firstMatch.node;
    const textContent = node.textContent || '';
    const beforeText = textContent.substring(0, firstMatch.localStart);
    const matchText = textContent.substring(firstMatch.localStart, firstMatch.localEnd);
    const afterText = textContent.substring(firstMatch.localEnd);

    const parent = node.parentNode!;
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'xtm-highlight';
    highlightSpan.textContent = matchText;

    if (beforeText) {
      parent.insertBefore(document.createTextNode(beforeText), node);
    }
    parent.insertBefore(highlightSpan, node);
    if (afterText) {
      parent.insertBefore(document.createTextNode(afterText), node);
    }
    parent.removeChild(node);

    // Rebuild node map after highlighting
    textNodes = getTextNodes(container);
    ({ nodeMap, fullText } = buildNodeMap(textNodes));

    // Try to find second URL - this should still work!
    const url2Matches = findMatchPositionsWithBoundaries(
      fullText,
      'hxxps://mittalcpa[.]com/wp-content/plugins/bungs/*.php',
      nodeMap,
      { caseSensitive: false, skipHighlighted: true, checkBoundaries: false }
    );

    expect(url2Matches.length).toBeGreaterThan(0);

    // Try to find third URL
    const url3Matches = findMatchPositionsWithBoundaries(
      fullText,
      'hxxps://esclerosemultiplario[.]com[.]br/wp-content/plugins/areada/*.php',
      nodeMap,
      { caseSensitive: false, skipHighlighted: true, checkBoundaries: false }
    );

    expect(url3Matches.length).toBeGreaterThan(0);
  });

  it('should handle regex matches for multiple items in a list', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <p>CVE-2021-1234</p>
      <p>CVE-2021-5678</p>
      <p>CVE-2022-9999</p>
    `;
    document.body.appendChild(container);

    const textNodes = getTextNodes(container);
    const { nodeMap, fullText } = buildNodeMap(textNodes);

    // Use a regex pattern to find all CVEs
    const cvePattern = /CVE-\d{4}-\d{4,7}/gi;
    
    const matches = collectRegexMatches(fullText, cvePattern, nodeMap, true);

    // Should find all three CVEs
    expect(matches.length).toBe(3);
  });

  it('should not re-highlight already highlighted text when skipHighlighted is true', () => {
    const container = document.createElement('div');
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'xtm-highlight';
    highlightSpan.textContent = 'example[.]com';
    container.appendChild(highlightSpan);
    
    container.appendChild(document.createTextNode(' and '));
    container.appendChild(document.createTextNode('another[.]com'));
    
    document.body.appendChild(container);

    const textNodes = getTextNodes(container);
    const { nodeMap, fullText } = buildNodeMap(textNodes);

    // Try to find the already-highlighted domain
    const matches = findMatchPositionsWithBoundaries(
      fullText,
      'example[.]com',
      nodeMap,
      { caseSensitive: false, skipHighlighted: true, checkBoundaries: false }
    );

    // Should not find the already-highlighted text
    expect(matches.length).toBe(0);

    // But should still find the other domain
    const otherMatches = findMatchPositionsWithBoundaries(
      fullText,
      'another[.]com',
      nodeMap,
      { caseSensitive: false, skipHighlighted: true, checkBoundaries: false }
    );

    expect(otherMatches.length).toBeGreaterThan(0);
  });
});
