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

  it('should drop target attributes', () => {
    expect(sanitizeHtml('<a href="https://e.com" target="_blank">l</a>')).not.toContain('target');
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

// The extractors read these back off the sanitized DOM (lazy-load fixing,
// picture/source handling, hero dedupe), so sanitization must not strip them.
describe('sanitizeHtml preserves what the extractors read', () => {
  it.each([
    ['data-src', '<img data-src="https://e.com/a.png">'],
    ['data-srcset', '<img data-srcset="https://e.com/a.png 1x">'],
    ['data-lazy-src', '<img data-lazy-src="https://e.com/a.png">'],
    ['srcset', '<img srcset="https://e.com/a.png 1x, https://e.com/b.png 2x">'],
    ['picture/source', '<picture><source srcset="https://e.com/a.webp"><img src="https://e.com/a.png"></picture>'],
    ['figure/figcaption', '<figure><img src="https://e.com/a.png"><figcaption>Cap</figcaption></figure>'],
    ['style attribute', '<img src="https://e.com/a.png" style="max-width:100%">'],
    ['class attribute', '<div class="hero-image">x</div>'],
    ['relative src', '<img src="/img/a.png">'],
    ['protocol-relative src', '<img src="//e.com/a.png">'],
    ['data: image src', '<img src="data:image/png;base64,iVBORw0KGgo=">'],
    ['pre/code', '<pre><code>x = 1</code></pre>'],
    ['blockquote', '<blockquote>q</blockquote>'],
    ['headings', '<h1>a</h1><h2>b</h2><h3>c</h3>'],
  ])('should keep %s unchanged', (_label, html) => {
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('should keep table cells, allowing for tbody normalization', () => {
    expect(sanitizeHtml('<table><tr><td>a</td></tr></table>')).toContain('<td>a</td>');
  });
});
