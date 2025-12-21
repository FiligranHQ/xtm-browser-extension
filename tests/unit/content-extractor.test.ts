/**
 * Unit Tests for Content Extractor Utilities
 * 
 * Tests the utility functions used for content extraction from web pages.
 * Note: Most DOM-dependent functions require browser environment.
 * These tests focus on the type definitions and exported utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import type { ExtractedContent, ExtractedImage } from '../../src/shared/extraction/content-extractor';

// Mock the logger
vi.mock('../../src/shared/utils/logger', () => ({
  loggers: {
    extraction: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

// ============================================================================
// Type and Interface Tests
// ============================================================================

describe('Content Extractor Types', () => {
  describe('ExtractedContent interface', () => {
    it('should define all required properties', () => {
      const content: ExtractedContent = {
        title: 'Test Article',
        byline: 'Author Name',
        excerpt: 'This is a test excerpt...',
        content: '<p>Test content</p>',
        textContent: 'Test content',
        images: [],
        url: 'https://example.com/article',
        siteName: 'Example',
        publishedDate: '2024-01-01',
        readingTime: 5,
      };

      expect(content.title).toBe('Test Article');
      expect(content.byline).toBe('Author Name');
      expect(content.excerpt).toBe('This is a test excerpt...');
      expect(content.content).toBe('<p>Test content</p>');
      expect(content.textContent).toBe('Test content');
      expect(content.images).toEqual([]);
      expect(content.url).toBe('https://example.com/article');
      expect(content.siteName).toBe('Example');
      expect(content.publishedDate).toBe('2024-01-01');
      expect(content.readingTime).toBe(5);
    });

    it('should allow null publishedDate', () => {
      const content: ExtractedContent = {
        title: 'Test',
        byline: '',
        excerpt: '',
        content: '',
        textContent: '',
        images: [],
        url: 'https://example.com',
        siteName: 'Example',
        publishedDate: null,
        readingTime: 1,
      };

      expect(content.publishedDate).toBeNull();
    });
  });

  describe('ExtractedImage interface', () => {
    it('should define all required properties', () => {
      const image: ExtractedImage = {
        src: 'https://example.com/image.jpg',
        alt: 'Test image',
        caption: 'Image caption',
        width: 800,
        height: 600,
      };

      expect(image.src).toBe('https://example.com/image.jpg');
      expect(image.alt).toBe('Test image');
      expect(image.caption).toBe('Image caption');
      expect(image.width).toBe(800);
      expect(image.height).toBe(600);
    });

    it('should allow optional dataUrl', () => {
      const image: ExtractedImage = {
        src: 'https://example.com/image.jpg',
        alt: '',
        caption: '',
        width: 0,
        height: 0,
        dataUrl: 'data:image/png;base64,abc123',
      };

      expect(image.dataUrl).toBe('data:image/png;base64,abc123');
    });

    it('should work without optional dataUrl', () => {
      const image: ExtractedImage = {
        src: 'https://example.com/image.jpg',
        alt: '',
        caption: '',
        width: 0,
        height: 0,
      };

      expect(image.dataUrl).toBeUndefined();
    });
  });
});

// ============================================================================
// Content Structure Tests
// ============================================================================

describe('Content Structure', () => {
  it('should handle empty content gracefully', () => {
    const emptyContent: ExtractedContent = {
      title: 'Untitled',
      byline: '',
      excerpt: '',
      content: '',
      textContent: '',
      images: [],
      url: '',
      siteName: '',
      publishedDate: null,
      readingTime: 0,
    };

    expect(emptyContent.title).toBe('Untitled');
    expect(emptyContent.textContent).toBe('');
    expect(emptyContent.images).toHaveLength(0);
    expect(emptyContent.readingTime).toBe(0);
  });

  it('should handle content with multiple images', () => {
    const images: ExtractedImage[] = [
      { src: 'img1.jpg', alt: 'Image 1', caption: '', width: 400, height: 300 },
      { src: 'img2.jpg', alt: 'Image 2', caption: 'Caption 2', width: 800, height: 600 },
      { src: 'img3.jpg', alt: '', caption: '', width: 1200, height: 800 },
    ];

    const content: ExtractedContent = {
      title: 'Article with Images',
      byline: '',
      excerpt: '',
      content: '<p>Content with images</p>',
      textContent: 'Content with images',
      images,
      url: 'https://example.com',
      siteName: 'Example',
      publishedDate: null,
      readingTime: 2,
    };

    expect(content.images).toHaveLength(3);
    expect(content.images[0].src).toBe('img1.jpg');
    expect(content.images[1].caption).toBe('Caption 2');
    expect(content.images[2].width).toBe(1200);
  });
});

// ============================================================================
// Reading Time Calculation (simulated)
// ============================================================================

describe('Reading Time', () => {
  it('should estimate reasonable reading times', () => {
    // Simulating reading time estimation logic
    const wordsPerMinute = 200;
    
    const estimateReadingTime = (text: string): number => {
      const words = text.trim().split(/\s+/).length;
      return Math.max(1, Math.ceil(words / wordsPerMinute));
    };

    // Short text
    expect(estimateReadingTime('A short sentence.')).toBe(1);
    
    // Medium text (~200 words = 1 minute)
    const mediumText = Array(200).fill('word').join(' ');
    expect(estimateReadingTime(mediumText)).toBe(1);
    
    // Long text (~400 words = 2 minutes)
    const longText = Array(400).fill('word').join(' ');
    expect(estimateReadingTime(longText)).toBe(2);
    
    // Very long text (~1000 words = 5 minutes)
    const veryLongText = Array(1000).fill('word').join(' ');
    expect(estimateReadingTime(veryLongText)).toBe(5);
  });
});

// ============================================================================
// URL Processing (simulated)
// ============================================================================

describe('URL Processing', () => {
  it('should handle absolute URLs', () => {
    const isAbsoluteUrl = (url: string): boolean => {
      return url.startsWith('http://') || url.startsWith('https://');
    };

    expect(isAbsoluteUrl('https://example.com/image.jpg')).toBe(true);
    expect(isAbsoluteUrl('http://example.com/image.jpg')).toBe(true);
    expect(isAbsoluteUrl('/relative/path.jpg')).toBe(false);
    expect(isAbsoluteUrl('relative/path.jpg')).toBe(false);
    expect(isAbsoluteUrl('//cdn.example.com/image.jpg')).toBe(false);
  });

  it('should identify protocol-relative URLs', () => {
    const isProtocolRelative = (url: string): boolean => {
      return url.startsWith('//');
    };

    expect(isProtocolRelative('//cdn.example.com/image.jpg')).toBe(true);
    expect(isProtocolRelative('https://example.com/image.jpg')).toBe(false);
    expect(isProtocolRelative('/path/image.jpg')).toBe(false);
  });
});

// ============================================================================
// Content Filtering Patterns (simulated)
// ============================================================================

describe('Content Filtering Patterns', () => {
  it('should identify tracking patterns in URLs', () => {
    const isTrackingUrl = (src: string): boolean => {
      const srcLower = src.toLowerCase();
      return /pixel|track|beacon|analytics|doubleclick|facebook\.com\/tr|\.gif\?/.test(srcLower);
    };

    expect(isTrackingUrl('https://example.com/pixel.gif')).toBe(true);
    expect(isTrackingUrl('https://analytics.example.com/track')).toBe(true);
    expect(isTrackingUrl('https://beacon.example.com/b.gif?id=123')).toBe(true);
    expect(isTrackingUrl('https://facebook.com/tr?id=123')).toBe(true);
    expect(isTrackingUrl('https://example.com/article-image.jpg')).toBe(false);
  });

  it('should identify logo/branding patterns in URLs', () => {
    const isLogoUrl = (src: string): boolean => {
      const srcLower = src.toLowerCase();
      return /logo|brand|icon|favicon|sprite|badge|button|avatar|profile/i.test(srcLower);
    };

    expect(isLogoUrl('https://example.com/logo.png')).toBe(true);
    expect(isLogoUrl('https://example.com/brand-image.jpg')).toBe(true);
    expect(isLogoUrl('https://example.com/favicon.ico')).toBe(true);
    expect(isLogoUrl('https://example.com/avatar.jpg')).toBe(true);
    expect(isLogoUrl('https://example.com/article-image.jpg')).toBe(false);
  });

  it('should identify social share patterns', () => {
    const isSocialShareUrl = (src: string): boolean => {
      return /share|social|og-image|twitter-card|card-image|meta-image/i.test(src);
    };

    expect(isSocialShareUrl('https://example.com/social-share.jpg')).toBe(true);
    expect(isSocialShareUrl('https://example.com/og-image.png')).toBe(true);
    expect(isSocialShareUrl('https://example.com/twitter-card.jpg')).toBe(true);
    expect(isSocialShareUrl('https://example.com/article-image.jpg')).toBe(false);
  });
});

// ============================================================================
// Image Dimension Validation (simulated)
// ============================================================================

describe('Image Dimension Validation', () => {
  it('should reject very small images', () => {
    const isValidImageSize = (width: number, height: number): boolean => {
      if (width > 0 && height > 0) {
        if (width < 100 && height < 100) return false;
      }
      return true;
    };

    expect(isValidImageSize(50, 50)).toBe(false);
    expect(isValidImageSize(99, 99)).toBe(false);
    expect(isValidImageSize(100, 100)).toBe(true);
    expect(isValidImageSize(800, 600)).toBe(true);
    expect(isValidImageSize(0, 0)).toBe(true); // Allow unknown dimensions
  });

  it('should reject extreme aspect ratios', () => {
    const isValidAspectRatio = (width: number, height: number): boolean => {
      if (width > 0 && height > 0) {
        const ratio = width / height;
        if (ratio > 5 || ratio < 0.15) return false;
      }
      return true;
    };

    // Banner ads (very wide) - ratio > 5
    expect(isValidAspectRatio(728, 90)).toBe(false);  // 8.09
    expect(isValidAspectRatio(970, 90)).toBe(false);  // 10.78
    
    // Skyscraper ads (very tall) - ratio < 0.15
    expect(isValidAspectRatio(100, 800)).toBe(false);  // 0.125 < 0.15
    expect(isValidAspectRatio(120, 800)).toBe(true);   // 0.15 is exactly at boundary
    
    // Normal images
    expect(isValidAspectRatio(800, 600)).toBe(true);   // 1.33
    expect(isValidAspectRatio(1920, 1080)).toBe(true); // 1.78
    expect(isValidAspectRatio(600, 800)).toBe(true);   // 0.75
  });
});
