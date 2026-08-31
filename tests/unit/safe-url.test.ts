/**
 * Unit Tests for Safe URL Helpers
 *
 * Tests the scheme allowlist that guards navigation and fetch sinks.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { isSafeUrl, openExternalUrl } from '../../src/shared/utils/safe-url';

describe('isSafeUrl', () => {
  it('should accept http and https', () => {
    expect(isSafeUrl('http://example.com/a')).toBe(true);
    expect(isSafeUrl('https://opencti.example.com/dashboard/id/abc')).toBe(true);
  });

  it('should accept relative URLs resolved against the page', () => {
    expect(isSafeUrl('/dashboard/id/abc')).toBe(true);
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

describe('openExternalUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should open allowed URLs in a new tab without window access', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(openExternalUrl('https://example.com')).toBe(true);
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
  });

  it('should not open disallowed schemes', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(openExternalUrl('javascript:alert(1)')).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});
