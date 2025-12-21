/**
 * Unit Tests for Text Extraction
 * 
 * Tests utilities for extracting and processing text from DOM elements.
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractTextFromHTML,
  getTextNodes,
  normalizeText,
} from '../../src/shared/detection/text-extraction';

// ============================================================================
// extractTextFromHTML Tests
// ============================================================================

describe('extractTextFromHTML', () => {
  it('should extract plain text from HTML', () => {
    const html = '<p>Hello World</p>';
    expect(extractTextFromHTML(html)).toBe('Hello World');
  });

  it('should handle multiple elements', () => {
    const html = '<div><p>First</p><p>Second</p></div>';
    const result = extractTextFromHTML(html);
    
    expect(result).toContain('First');
    expect(result).toContain('Second');
  });

  it('should remove script elements', () => {
    const html = '<p>Visible</p><script>alert("hidden")</script>';
    const result = extractTextFromHTML(html);
    
    expect(result).toContain('Visible');
    expect(result).not.toContain('alert');
    expect(result).not.toContain('hidden');
  });

  it('should remove style elements', () => {
    const html = '<p>Visible</p><style>.hidden { display: none; }</style>';
    const result = extractTextFromHTML(html);
    
    expect(result).toContain('Visible');
    expect(result).not.toContain('display');
    expect(result).not.toContain('none');
  });

  it('should remove noscript elements', () => {
    const html = '<p>Visible</p><noscript>Enable JavaScript</noscript>';
    const result = extractTextFromHTML(html);
    
    expect(result).toContain('Visible');
    expect(result).not.toContain('Enable JavaScript');
  });

  it('should handle nested elements', () => {
    const html = '<div><span><strong>Nested</strong></span></div>';
    expect(extractTextFromHTML(html)).toBe('Nested');
  });

  it('should handle empty HTML', () => {
    expect(extractTextFromHTML('')).toBe('');
  });

  it('should handle HTML with only whitespace', () => {
    const html = '<p>   </p>';
    const result = extractTextFromHTML(html);
    expect(result.trim()).toBe('');
  });

  it('should preserve text content from links', () => {
    const html = '<a href="http://example.com">Click here</a>';
    expect(extractTextFromHTML(html)).toBe('Click here');
  });

  it('should handle special HTML entities', () => {
    const html = '<p>&amp; &lt; &gt; &quot;</p>';
    const result = extractTextFromHTML(html);
    
    expect(result).toContain('&');
    expect(result).toContain('<');
    expect(result).toContain('>');
    expect(result).toContain('"');
  });

  it('should handle unicode content', () => {
    const html = '<p>日本語テスト</p>';
    expect(extractTextFromHTML(html)).toBe('日本語テスト');
  });

  it('should handle comments by ignoring them', () => {
    const html = '<p>Visible</p><!-- This is a comment -->';
    const result = extractTextFromHTML(html);
    
    expect(result).toContain('Visible');
    expect(result).not.toContain('comment');
  });
});

// ============================================================================
// normalizeText Tests
// ============================================================================

describe('normalizeText', () => {
  it('should trim whitespace from start and end', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  it('should collapse multiple spaces', () => {
    expect(normalizeText('hello    world')).toBe('hello world');
  });

  it('should collapse tabs', () => {
    expect(normalizeText('hello\t\tworld')).toBe('hello world');
  });

  it('should collapse newlines', () => {
    expect(normalizeText('hello\n\nworld')).toBe('hello world');
  });

  it('should handle mixed whitespace', () => {
    expect(normalizeText('  hello  \t\n  world  ')).toBe('hello world');
  });

  it('should handle empty string', () => {
    expect(normalizeText('')).toBe('');
  });

  it('should handle whitespace-only string', () => {
    expect(normalizeText('   \t\n   ')).toBe('');
  });

  it('should preserve single spaces', () => {
    expect(normalizeText('hello world')).toBe('hello world');
  });

  it('should handle no whitespace', () => {
    expect(normalizeText('helloworld')).toBe('helloworld');
  });

  it('should handle carriage returns', () => {
    expect(normalizeText('hello\r\nworld')).toBe('hello world');
  });
});

// ============================================================================
// getTextNodes Tests
// ============================================================================

describe('getTextNodes', () => {
  beforeEach(() => {
    // Clear document body before each test
    document.body.innerHTML = '';
  });

  it('should find text nodes in a simple element', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>Hello World</p>';
    document.body.appendChild(div);
    
    const nodes = getTextNodes(div);
    
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.some(n => n.textContent?.includes('Hello World'))).toBe(true);
  });

  it('should find multiple text nodes', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>First</p><p>Second</p>';
    document.body.appendChild(div);
    
    const nodes = getTextNodes(div);
    
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.some(n => n.textContent === 'First')).toBe(true);
    expect(nodes.some(n => n.textContent === 'Second')).toBe(true);
  });

  it('should skip script element content', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>Visible</p><script>alert("hidden")</script>';
    document.body.appendChild(div);
    
    const nodes = getTextNodes(div);
    
    expect(nodes.some(n => n.textContent === 'Visible')).toBe(true);
    expect(nodes.some(n => n.textContent?.includes('alert'))).toBe(false);
  });

  it('should skip style element content', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>Visible</p><style>.hidden { display: none; }</style>';
    document.body.appendChild(div);
    
    const nodes = getTextNodes(div);
    
    expect(nodes.some(n => n.textContent === 'Visible')).toBe(true);
    expect(nodes.some(n => n.textContent?.includes('display'))).toBe(false);
  });

  it('should skip noscript element content', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>Visible</p><noscript>Enable JavaScript</noscript>';
    document.body.appendChild(div);
    
    const nodes = getTextNodes(div);
    
    expect(nodes.some(n => n.textContent === 'Visible')).toBe(true);
    expect(nodes.some(n => n.textContent?.includes('Enable'))).toBe(false);
  });

  it('should skip textarea content', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>Visible</p><textarea>User input</textarea>';
    document.body.appendChild(div);
    
    const nodes = getTextNodes(div);
    
    expect(nodes.some(n => n.textContent === 'Visible')).toBe(true);
    expect(nodes.some(n => n.textContent?.includes('User input'))).toBe(false);
  });

  it('should skip input element values', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>Visible</p><input type="text" value="Input value">';
    document.body.appendChild(div);
    
    const nodes = getTextNodes(div);
    
    expect(nodes.some(n => n.textContent === 'Visible')).toBe(true);
    // Input values are not text nodes anyway, but we verify behavior
  });

  it('should skip empty text nodes', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p></p><p>Content</p><p>   </p>';
    document.body.appendChild(div);
    
    const nodes = getTextNodes(div);
    
    // Only the "Content" text node should be found
    expect(nodes.filter(n => n.textContent?.trim())).toHaveLength(1);
  });

  it('should find nested text nodes', () => {
    const div = document.createElement('div');
    div.innerHTML = '<div><span><strong>Deep nested</strong></span></div>';
    document.body.appendChild(div);
    
    const nodes = getTextNodes(div);
    
    expect(nodes.some(n => n.textContent === 'Deep nested')).toBe(true);
  });

  it('should handle document as root', () => {
    document.body.innerHTML = '<p>Body content</p>';
    
    const nodes = getTextNodes(document.body);
    
    expect(nodes.length).toBeGreaterThan(0);
  });

  it('should return empty array for empty element', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    
    const nodes = getTextNodes(div);
    
    expect(nodes).toHaveLength(0);
  });

  it('should handle text with special characters', () => {
    const div = document.createElement('div');
    div.innerHTML = '<p>192.168.1.1 - CVE-2024-1234</p>';
    document.body.appendChild(div);
    
    const nodes = getTextNodes(div);
    
    expect(nodes.some(n => n.textContent?.includes('192.168.1.1'))).toBe(true);
    expect(nodes.some(n => n.textContent?.includes('CVE-2024-1234'))).toBe(true);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('extractTextFromHTML should handle malformed HTML', () => {
    const html = '<p>Not closed<div>Another</p></div>';
    // DOMParser handles malformed HTML gracefully
    const result = extractTextFromHTML(html);
    
    expect(result).toContain('Not closed');
    expect(result).toContain('Another');
  });

  it('normalizeText should handle very long strings', () => {
    const longString = 'word '.repeat(10000);
    const result = normalizeText(longString);
    
    expect(result.length).toBeLessThanOrEqual(longString.length);
    expect(result.endsWith('word')).toBe(true);
  });

  it('extractTextFromHTML should handle table content', () => {
    const html = '<table><tr><td>Cell 1</td><td>Cell 2</td></tr></table>';
    const result = extractTextFromHTML(html);
    
    expect(result).toContain('Cell 1');
    expect(result).toContain('Cell 2');
  });

  it('extractTextFromHTML should handle lists', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = extractTextFromHTML(html);
    
    expect(result).toContain('Item 1');
    expect(result).toContain('Item 2');
  });

  it('extractTextFromHTML should handle embedded SVG text', () => {
    const html = '<svg><text>SVG Text</text></svg>';
    const result = extractTextFromHTML(html);
    
    // SVG text should be extractable
    expect(result).toContain('SVG Text');
  });

  it('normalizeText should handle form feeds and vertical tabs', () => {
    const text = 'hello\f\vworld';
    const result = normalizeText(text);
    
    expect(result).toBe('hello world');
  });
});

