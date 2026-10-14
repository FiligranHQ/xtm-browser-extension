/**
 * Unit Tests for Sanitization inside Content Extraction
 *
 * extractContent() sanitizes Readability's output before the extractors read
 * image attributes back off the DOM, so these assert that scriptable content
 * is gone while the markup the pipeline depends on survives.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Readability } from '@mozilla/readability';
import { extractContent } from '../../src/shared/extraction/content-extractor';

const PROSE = `
  <p>Threat actors have been observed deploying a new loader against energy
  sector targets across three continents, according to telemetry gathered over
  the past quarter. The loader stages a second payload from infrastructure that
  overlaps with previously reported activity.</p>
  <p>Analysts attribute the campaign with moderate confidence based on tooling
  overlap, shared certificate reuse, and consistent operational hours. The
  infrastructure was registered through a reseller that has appeared in earlier
  reporting on the same cluster.</p>
  <p>Defenders should hunt for the loader's scheduled task persistence and the
  distinctive user agent string used during the staging request, both of which
  are documented in the indicators section below.</p>
`;

function setPage(bodyHtml: string): void {
  document.head.innerHTML = '<title>Loader campaign report</title>';
  document.body.innerHTML = bodyHtml;
}

describe('extractContent sanitization', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('should strip scripts and event handlers from extracted content', () => {
    setPage(`
      <article>
        <h1>Loader campaign report</h1>
        ${PROSE}
        <script>window.stolen = document.cookie;</script>
        <p onclick="alert(1)">Indicators follow.</p>
      </article>
    `);

    const result = extractContent();

    expect(result.content).not.toContain('<script');
    expect(result.content).not.toContain('document.cookie');
    expect(result.content).not.toContain('onclick');
    expect(result.textContent).toContain('Threat actors');
  });

  it('should keep content images through sanitization', () => {
    setPage(`
      <article>
        <h1>Loader campaign report</h1>
        <figure><img data-src="/assets/diagram.png" alt="Staging chain"></figure>
        ${PROSE}
      </article>
    `);

    const result = extractContent();

    expect(result.content).toContain('<img');
    expect(result.content).toContain('diagram.png');
  });

  it('should keep a prepended hero image', () => {
    setPage(`
      <div class="featured-image"><img src="https://cdn.example.com/hero.png" alt="Hero"></div>
      <article>
        <h1>Loader campaign report</h1>
        ${PROSE}
      </article>
    `);

    const result = extractContent();

    expect(result.content).toContain('hero.png');
    expect(result.content).toContain('hero-image');
  });
});

describe('extractContent sanitization (fallback extractor)', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    // Force the fallback path: it runs when Readability finds nothing.
    vi.spyOn(Readability.prototype, 'parse').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should strip handlers, javascript: links and srcdoc iframes', () => {
    setPage(`
      <article>
        <h1>Loader campaign report</h1>
        ${PROSE}
        <p tabindex="0" onfocus="alert(1)">Indicators follow.</p>
        <a href="javascript:alert(1)">details</a>
        <iframe srcdoc="<script>alert(1)</script>"></iframe>
      </article>
    `);

    const result = extractContent();

    expect(result.content).not.toContain('onfocus');
    expect(result.content).not.toContain('javascript:');
    expect(result.content).not.toContain('srcdoc');
    expect(result.content).toContain('Indicators follow.');
    expect(result.textContent).toContain('Threat actors');
  });

  it('should drop non-video iframes and keep video embeds', () => {
    setPage(`
      <article>
        <h1>Loader campaign report</h1>
        ${PROSE}
        <iframe src="https://tracker.example.net/frame.html"></iframe>
        <iframe src="https://www.youtube.com/embed/abc123"></iframe>
      </article>
    `);

    const result = extractContent();

    expect(result.content).not.toContain('tracker.example.net');
    expect(result.content).toContain('youtube.com/embed/abc123');
    expect(result.textContent).toContain('Threat actors');
  });

  it('should keep content images', () => {
    setPage(`
      <article>
        <h1>Loader campaign report</h1>
        <figure><img src="https://cdn.example.com/diagram.png" alt="Staging chain"></figure>
        ${PROSE}
      </article>
    `);

    const result = extractContent();

    expect(result.content).toContain('diagram.png');
    expect(result.images.some(img => img.src.includes('diagram.png'))).toBe(true);
  });
});
