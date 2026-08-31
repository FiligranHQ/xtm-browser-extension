/**
 * Unit Tests for HTML Sanitization Helpers
 *
 * Tests that untrusted page HTML is stripped of scriptable content before it
 * reaches an innerHTML/insertAdjacentHTML sink.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeHtml,
  setSanitizedHtml,
  insertSanitizedHtml,
} from '../../src/shared/utils/sanitize';

describe('sanitizeHtml', () => {
  it('should keep article markup', () => {
    const html = '<h1>Title</h1><p>Body <a href="https://example.com">link</a></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('should keep images with their attributes', () => {
    const result = sanitizeHtml('<img src="https://example.com/a.png" alt="a" style="width:100%">');
    expect(result).toContain('src="https://example.com/a.png"');
    expect(result).toContain('alt="a"');
  });

  it('should remove script tags', () => {
    expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).toBe('<p>ok</p>');
  });

  it('should remove event handlers', () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain('onerror');
  });

  it('should remove javascript: links', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain('javascript:');
  });

  it('should keep video embeds', () => {
    const result = sanitizeHtml('<iframe src="https://www.youtube.com/embed/abc" allowfullscreen></iframe>');
    expect(result).toContain('<iframe');
    expect(result).toContain('youtube.com/embed/abc');
  });

  it('should handle empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});

describe('setSanitizedHtml', () => {
  it('should assign sanitized markup', () => {
    const div = document.createElement('div');
    setSanitizedHtml(div, '<p>text</p><script>alert(1)</script>');
    expect(div.querySelector('p')?.textContent).toBe('text');
    expect(div.querySelector('script')).toBeNull();
  });
});

describe('insertSanitizedHtml', () => {
  it('should insert sanitized markup at the given position', () => {
    const div = document.createElement('div');
    div.textContent = 'existing';
    insertSanitizedHtml(div, 'afterbegin', '<figure><img src="https://example.com/a.png" onerror="alert(1)"></figure>');
    expect(div.querySelector('figure img')?.getAttribute('onerror')).toBeNull();
    expect(div.firstElementChild?.tagName).toBe('FIGURE');
  });
});
