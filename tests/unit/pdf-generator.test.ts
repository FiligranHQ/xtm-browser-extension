/**
 * Unit Tests for PDF Generator Utilities
 *
 * Tests pure utility functions exported from pdf-generator.ts.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock dependencies that are not relevant for utility function tests
vi.mock('jspdf', () => ({ jsPDF: vi.fn() }));
vi.mock('../../src/shared/extraction/cjk-font', () => ({
  needsCJKFont: vi.fn(),
  registerCJKFont: vi.fn(),
  CJK_FONT_FAMILY: 'NotoSansCJK',
}));
vi.mock('../../src/shared/utils/logger', () => ({
  loggers: { extraction: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
}));

import { sanitizeFilename } from '../../src/shared/extraction/pdf-generator';

describe('sanitizeFilename', () => {
  it.each([
    ['removes invalid chars', 'file<>:"/\\|?*name', 'filename'],
    ['replaces spaces with underscores', 'hello world test', 'hello_world_test'],
    ['collapses multiple underscores', 'a___b___c', 'a_b_c'],
    ['trims leading/trailing underscores', '___hello___', 'hello'],
    ['truncates to 100 chars', 'a'.repeat(150), 'a'.repeat(100)],
    ['handles combined transforms', '  My <Report> 2024  ', 'My_Report_2024'],
    ['returns empty for all-invalid chars', '<>:"/\\|?*', ''],
    ['preserves normal filenames', 'article-title_2024', 'article-title_2024'],
    ['handles CJK filenames', '日本語の記事タイトル', '日本語の記事タイトル'],
  ])('%s: "%s" → "%s"', (_label, input, expected) => {
    expect(sanitizeFilename(input)).toBe(expected);
  });
});
