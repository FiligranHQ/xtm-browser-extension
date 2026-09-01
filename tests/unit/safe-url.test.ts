/**
 * Unit Tests for Safe URL Helpers
 *
 * Tests the scheme allowlist that guards navigation and fetch sinks.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { isSafeUrl, openExternalUrl, resolveSafeUrl } from '../../src/shared/utils/safe-url';

describe('isSafeUrl', () => {
  it('should accept http and https', () => {
    expect(isSafeUrl('http://example.com/a')).toBe(true);
    expect(isSafeUrl('https://opencti.example.com/dashboard/id/abc')).toBe(true);
  });

  // Resolving a relative path would mean the extension's own origin in a panel
  // and the visited page's in a content script, so callers pass absolute URLs.
  it('should reject relative URLs', () => {
    expect(isSafeUrl('/dashboard/id/abc')).toBe(false);
    expect(isSafeUrl('dashboard/id/abc')).toBe(false);
  });

  it('should reject javascript: and data: URLs', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('should reject file: and blob: unless explicitly allowed', () => {
    expect(isSafeUrl('file:///tmp/a.pdf')).toBe(false);
    expect(isSafeUrl('file:///tmp/a.pdf', ['file:'])).toBe(true);
    expect(isSafeUrl('blob:https://example.com/abc', ['blob:'])).toBe(true);
  });

  it('should reject empty and malformed input', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl('http://')).toBe(false);
  });
});

describe('resolveSafeUrl', () => {
  it('should return the parsed URL for allowed schemes', () => {
    expect(resolveSafeUrl('https://example.com')).toBe('https://example.com/');
    expect(resolveSafeUrl('file:///tmp/a b.pdf', ['file:'])).toBe('file:///tmp/a%20b.pdf');
  });

  it('should return null for anything disallowed', () => {
    expect(resolveSafeUrl('javascript:alert(1)')).toBeNull();
    expect(resolveSafeUrl('file:///tmp/a.pdf')).toBeNull();
    expect(resolveSafeUrl('')).toBeNull();
    expect(resolveSafeUrl('not a url')).toBeNull();
  });
});

describe('openExternalUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should open allowed URLs in a new tab', () => {
    const create = vi.fn();
    (globalThis as any).chrome.tabs.create = create;
    expect(openExternalUrl('https://example.com/dashboard')).toBe(true);
    expect(create).toHaveBeenCalledWith({ url: 'https://example.com/dashboard' });
  });

  it('should pass the resolved URL to the sink', () => {
    const create = vi.fn();
    (globalThis as any).chrome.tabs.create = create;
    openExternalUrl('https://example.com/a%20b');
    expect(create).toHaveBeenCalledWith({ url: 'https://example.com/a%20b' });
  });

  it('should not open disallowed schemes', () => {
    const create = vi.fn();
    (globalThis as any).chrome.tabs.create = create;
    expect(openExternalUrl('javascript:alert(1)')).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});
