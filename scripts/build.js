/**
 * Build Script
 * 
 * Handles building the extension for different browsers.
 */

import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, existsSync, writeFileSync, readdirSync, statSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const browser = process.argv[2] || 'chrome';

console.log(`Building for ${browser}...`);

// Build with Vite
try {
  execSync(`npx vite build`, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, BROWSER: browser },
  });
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}

// Copy manifest
const distDir = join(rootDir, 'dist', browser);
const manifestSrc = join(rootDir, 'src', `manifest.${browser}.json`);
const manifestDest = join(distDir, 'manifest.json');

// Read and potentially modify manifest
let manifest = JSON.parse(readFileSync(manifestSrc, 'utf8'));

// Write manifest
writeFileSync(manifestDest, JSON.stringify(manifest, null, 2));
console.log(`Copied manifest for ${browser}`);

// Copy icons
const iconsDir = join(distDir, 'assets', 'icons');
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

// Generate placeholder icons (in production, you'd use real icons)
const iconSizes = [16, 32, 48, 128];
const svgIcon = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="url(#grad)"/>
  <path d="M256 128L352 224L256 320L160 224L256 128Z" fill="white" opacity="0.9"/>
  <path d="M256 192L320 256L256 320L192 256L256 192Z" fill="white"/>
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="512" y2="512">
      <stop offset="0%" stop-color="#00bcd4"/>
      <stop offset="100%" stop-color="#0097a7"/>
    </linearGradient>
  </defs>
</svg>`;

// For now, create SVG files (you'd convert to PNG in production)
iconSizes.forEach(size => {
  const iconPath = join(iconsDir, `icon-${size}.png`);
  // In a real build, you'd use a proper image conversion library
  // For now, we'll just note that icons need to be added manually
  if (!existsSync(iconPath)) {
    console.log(`Note: Add icon-${size}.png to ${iconsDir}`);
  }
});

console.log(`\nBuild complete! Output: dist/${browser}/`);
console.log(`\nTo load the extension:`);

if (browser === 'chrome' || browser === 'edge') {
  console.log(`1. Open ${browser}://extensions/`);
  console.log(`2. Enable "Developer mode"`);
  console.log(`3. Click "Load unpacked"`);
  console.log(`4. Select the dist/${browser} folder`);
} else if (browser === 'firefox') {
  console.log(`1. Open about:debugging#/runtime/this-firefox`);
  console.log(`2. Click "Load Temporary Add-on"`);
  console.log(`3. Select any file in the dist/${browser} folder`);
}

