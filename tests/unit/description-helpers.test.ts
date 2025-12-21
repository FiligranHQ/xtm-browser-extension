/**
 * Unit Tests for Description Helper Functions
 * 
 * Tests utilities for generating and cleaning descriptions from HTML content.
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import {
  generateDescription,
  cleanHtmlContent,
} from '../../src/panel/utils/description-helpers';

// ============================================================================
// generateDescription Tests
// ============================================================================

describe('generateDescription', () => {
  describe('Basic functionality', () => {
    it('should extract text from simple HTML', () => {
      const html = '<p>This is a simple paragraph with some content.</p>';
      const result = generateDescription(html);
      
      expect(result).toContain('This is a simple paragraph');
    });

    it('should handle empty HTML', () => {
      expect(generateDescription('')).toBe('');
    });

    it('should handle HTML with only whitespace', () => {
      const html = '<p>   </p>';
      const result = generateDescription(html);
      
      expect(result.trim()).toBe('');
    });

    it('should preserve meaningful content', () => {
      const html = '<article><h1>Title</h1><p>This is a meaningful article about cybersecurity threats.</p></article>';
      const result = generateDescription(html);
      
      expect(result).toContain('cybersecurity threats');
    });
  });

  describe('Non-content element removal', () => {
    it('should remove script elements', () => {
      const html = '<p>Content</p><script>alert("malicious")</script>';
      const result = generateDescription(html);
      
      expect(result).not.toContain('malicious');
      expect(result).not.toContain('alert');
    });

    it('should remove style elements', () => {
      const html = '<p>Visible content here.</p><style>.hidden{display:none}</style>';
      const result = generateDescription(html);
      
      expect(result).not.toContain('display');
      expect(result).not.toContain('hidden');
    });

    it('should remove navigation elements', () => {
      const html = '<nav>Home About Contact</nav><p>Article content about security topics.</p>';
      const result = generateDescription(html);
      
      expect(result).toContain('Article content');
      expect(result).not.toContain('Home About');
    });

    it('should remove footer elements', () => {
      const html = '<p>Main article content goes here with enough text.</p><footer>Copyright 2024</footer>';
      const result = generateDescription(html);
      
      expect(result).not.toContain('Copyright');
    });

    it('should remove sidebar elements', () => {
      const html = '<div class="sidebar">Related posts</div><p>Main content about malware analysis.</p>';
      const result = generateDescription(html);
      
      expect(result).not.toContain('Related posts');
    });

    it('should remove social share elements', () => {
      const html = '<div class="share-buttons">Share this</div><p>This is the main article content here.</p>';
      const result = generateDescription(html);
      
      expect(result).not.toContain('Share this');
    });

    it('should remove comment sections', () => {
      const html = '<p>Article about threat intelligence analysis.</p><div class="comments">User comment here</div>';
      const result = generateDescription(html);
      
      expect(result).not.toContain('User comment');
    });

    it('should remove advertisement elements', () => {
      const html = '<div class="advertisement">Buy now!</div><p>This is the actual content here.</p>';
      const result = generateDescription(html);
      
      expect(result).not.toContain('Buy now');
    });

    it('should remove form elements', () => {
      const html = '<p>Article content here with enough text.</p><form><input type="text"><button>Submit</button></form>';
      const result = generateDescription(html);
      
      expect(result).not.toContain('Submit');
    });

    it('should remove elements by role', () => {
      const html = '<div role="navigation">Nav items</div><p>Main content about threat analysis.</p>';
      const result = generateDescription(html);
      
      expect(result).not.toContain('Nav items');
    });
  });

  describe('Whitespace handling', () => {
    it('should collapse multiple spaces', () => {
      const html = '<p>Multiple    spaces    in    text.</p>';
      const result = generateDescription(html);
      
      expect(result).not.toContain('    ');
    });

    it('should collapse multiple newlines', () => {
      const html = '<p>Line one</p><p></p><p></p><p></p><p>Line two</p>';
      const result = generateDescription(html);
      
      expect(result).not.toMatch(/\n{3,}/);
    });

    it('should replace tabs with spaces', () => {
      const html = '<p>Tab\tseparated\tcontent here.</p>';
      const result = generateDescription(html);
      
      expect(result).not.toContain('\t');
    });

    it('should trim leading and trailing whitespace', () => {
      const html = '   <p>Content with surrounding whitespace.</p>   ';
      const result = generateDescription(html);
      
      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });
  });

  describe('Length handling', () => {
    it('should truncate long content', () => {
      const longContent = '<p>' + 'A'.repeat(1000) + '</p>';
      const result = generateDescription(longContent);
      
      expect(result.length).toBeLessThanOrEqual(503); // 500 + "..."
    });

    it('should use default max length of 500', () => {
      const longContent = '<p>' + 'Word. '.repeat(200) + '</p>';
      const result = generateDescription(longContent);
      
      expect(result.length).toBeLessThanOrEqual(503);
    });

    it('should respect custom max length', () => {
      const longContent = '<p>' + 'Word '.repeat(100) + '</p>';
      const result = generateDescription(longContent, 100);
      
      expect(result.length).toBeLessThanOrEqual(103);
    });

    it('should add ellipsis when truncated', () => {
      const longContent = '<p>' + 'Word '.repeat(200) + '</p>';
      const result = generateDescription(longContent, 100);
      
      expect(result.endsWith('...')).toBe(true);
    });

    it('should not add ellipsis for short content', () => {
      const html = '<p>This is short content that fits within limits.</p>';
      const result = generateDescription(html);
      
      expect(result.endsWith('...')).toBe(false);
    });

    it('should try to cut at sentence boundary', () => {
      const html = '<p>First sentence here. Second sentence here. Third sentence is quite long and should be cut off at some point to fit within the limit of max characters allowed in the description field which is quite common in many applications.</p>';
      const result = generateDescription(html, 100);
      
      // Should end with period + ellipsis or just ellipsis after a word
      expect(result).toMatch(/\.{3}$|\.\.\.$/);
    });

    it('should try to cut at word boundary', () => {
      const html = '<p>' + 'Verylongwordwithoutspaces'.repeat(50) + '</p>';
      const result = generateDescription(html, 100);
      
      // Even without spaces, should truncate
      expect(result.length).toBeLessThanOrEqual(103);
    });
  });

  describe('Line filtering', () => {
    it('should skip very short lines', () => {
      const html = '<p>Hi</p><p>OK</p><p>This is a meaningful sentence with actual content.</p>';
      const result = generateDescription(html);
      
      expect(result).toContain('This is a meaningful');
      expect(result).not.toBe('Hi');
    });

    it('should use first few meaningful paragraphs', () => {
      const html = `
        <p>First meaningful paragraph with enough content here.</p>
        <p>Second meaningful paragraph with enough content here.</p>
        <p>Third meaningful paragraph with enough content here.</p>
        <p>Fourth meaningful paragraph with enough content here.</p>
        <p>Fifth meaningful paragraph with enough content here.</p>
        <p>Sixth meaningful paragraph with enough content here.</p>
      `;
      const result = generateDescription(html);
      
      expect(result).toContain('First');
      // Should include content from multiple paragraphs but not all
    });
  });
});

// ============================================================================
// cleanHtmlContent Tests
// ============================================================================

describe('cleanHtmlContent', () => {
  describe('Basic functionality', () => {
    it('should return cleaned HTML', () => {
      const html = '<p>Simple content</p>';
      const result = cleanHtmlContent(html);
      
      expect(result).toContain('<p>');
      expect(result).toContain('Simple content');
    });

    it('should handle empty HTML', () => {
      expect(cleanHtmlContent('')).toBe('');
    });
  });

  describe('Script and style removal', () => {
    it('should remove script elements', () => {
      const html = '<p>Content</p><script>alert("xss")</script>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should remove style elements', () => {
      const html = '<p>Content</p><style>.malicious { color: red; }</style>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('<style>');
      expect(result).not.toContain('malicious');
    });

    it('should remove noscript elements', () => {
      const html = '<p>Content</p><noscript>Enable JS</noscript>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('<noscript>');
    });
  });

  describe('Interactive element removal', () => {
    it('should remove iframe elements', () => {
      const html = '<p>Content</p><iframe src="evil.com"></iframe>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('<iframe');
    });

    it('should remove object elements', () => {
      const html = '<p>Content</p><object data="plugin.swf"></object>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('<object');
    });

    it('should remove embed elements', () => {
      const html = '<p>Content</p><embed src="flash.swf">';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('<embed');
    });
  });

  describe('Form element removal', () => {
    it('should remove input elements', () => {
      const html = '<p>Content</p><input type="text" value="test">';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('<input');
    });

    it('should remove button elements', () => {
      const html = '<p>Content</p><button>Click me</button>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('<button');
    });

    it('should remove select elements', () => {
      const html = '<p>Content</p><select><option>Option</option></select>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('<select');
    });

    it('should remove textarea elements', () => {
      const html = '<p>Content</p><textarea>User input</textarea>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('<textarea');
    });
  });

  describe('Event handler removal', () => {
    it('should remove onclick handlers', () => {
      const html = '<p onclick="malicious()">Content</p>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('onclick');
      expect(result).toContain('Content');
    });

    it('should remove onload handlers', () => {
      const html = '<img onload="malicious()" src="image.jpg">';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('onload');
    });

    it('should remove onerror handlers', () => {
      const html = '<img onerror="malicious()" src="nonexistent.jpg">';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('onerror');
    });

    it('should remove onmouseover handlers', () => {
      const html = '<p onmouseover="malicious()">Hover me</p>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('onmouseover');
    });

    it('should remove onfocus handlers', () => {
      const html = '<div onfocus="malicious()">Focus</div>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('onfocus');
    });
  });

  describe('Hidden element removal', () => {
    it('should remove hidden elements', () => {
      const html = '<p>Visible</p><div hidden>Hidden</div>';
      const result = cleanHtmlContent(html);
      
      expect(result).toContain('Visible');
      expect(result).not.toContain('hidden>');
    });

    it('should remove aria-hidden elements', () => {
      const html = '<p>Visible</p><div aria-hidden="true">Assistive hidden</div>';
      const result = cleanHtmlContent(html);
      
      expect(result).toContain('Visible');
      expect(result).not.toContain('aria-hidden');
    });
  });

  describe('Content preservation', () => {
    it('should preserve paragraph elements', () => {
      const html = '<p>Content paragraph</p>';
      const result = cleanHtmlContent(html);
      
      expect(result).toContain('<p>');
      expect(result).toContain('</p>');
    });

    it('should preserve heading elements', () => {
      const html = '<h1>Title</h1><h2>Subtitle</h2>';
      const result = cleanHtmlContent(html);
      
      expect(result).toContain('<h1>');
      expect(result).toContain('<h2>');
    });

    it('should preserve list elements', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const result = cleanHtmlContent(html);
      
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>');
    });

    it('should preserve link elements', () => {
      const html = '<a href="https://example.com">Link text</a>';
      const result = cleanHtmlContent(html);
      
      expect(result).toContain('<a');
      expect(result).toContain('href');
    });

    it('should preserve image elements', () => {
      const html = '<img src="image.jpg" alt="Description">';
      const result = cleanHtmlContent(html);
      
      expect(result).toContain('<img');
      expect(result).toContain('src=');
    });

    it('should preserve table elements', () => {
      const html = '<table><tr><td>Cell</td></tr></table>';
      const result = cleanHtmlContent(html);
      
      expect(result).toContain('<table>');
      expect(result).toContain('<td>');
    });

    it('should preserve inline styles', () => {
      const html = '<p style="color: blue;">Styled text</p>';
      const result = cleanHtmlContent(html);
      
      expect(result).toContain('style=');
    });

    it('should preserve class attributes', () => {
      const html = '<div class="article-content">Content</div>';
      const result = cleanHtmlContent(html);
      
      expect(result).toContain('class=');
    });
  });

  describe('Modal framework removal', () => {
    it('should remove MUI modal elements', () => {
      const html = '<p>Content</p><div class="MuiModal-root">Modal content</div>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('MuiModal-root');
    });

    it('should remove MUI backdrop elements', () => {
      const html = '<p>Content</p><div class="MuiBackdrop-root"></div>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('MuiBackdrop-root');
    });

    it('should remove ReactModal elements', () => {
      const html = '<p>Content</p><div class="ReactModal__Overlay">Overlay</div>';
      const result = cleanHtmlContent(html);
      
      expect(result).not.toContain('ReactModal__Overlay');
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('generateDescription should handle nested content removal', () => {
    const html = '<nav><div><p>Nested nav content</p></div></nav><p>Main content here that is meaningful.</p>';
    const result = generateDescription(html);
    
    expect(result).not.toContain('Nested nav content');
    expect(result).toContain('Main content');
  });

  it('cleanHtmlContent should handle deeply nested event handlers', () => {
    const html = '<div><div><p onclick="evil()">Content</p></div></div>';
    const result = cleanHtmlContent(html);
    
    expect(result).not.toContain('onclick');
    expect(result).toContain('Content');
  });

  it('generateDescription should handle unicode content', () => {
    const html = '<p>这是中文内容，用于测试国际化功能。</p>';
    const result = generateDescription(html);
    
    expect(result).toContain('这是中文内容');
  });

  it('cleanHtmlContent should handle multiple event handlers on same element', () => {
    const html = '<div onclick="a()" onmouseover="b()" onfocus="c()">Content</div>';
    const result = cleanHtmlContent(html);
    
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onmouseover');
    expect(result).not.toContain('onfocus');
    expect(result).toContain('Content');
  });

  it('generateDescription should handle SVG elements', () => {
    const html = '<svg><circle cx="50" cy="50" r="40"/></svg><p>Main text content here.</p>';
    const result = generateDescription(html);
    
    expect(result).not.toContain('circle');
    expect(result).not.toContain('cx=');
  });

  it('generateDescription should handle canvas elements', () => {
    const html = '<canvas>Canvas fallback</canvas><p>Article content here.</p>';
    const result = generateDescription(html);
    
    expect(result).not.toContain('Canvas fallback');
  });
});

