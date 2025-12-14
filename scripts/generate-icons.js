/**
 * Generate PNG icons from SVG for browser extensions
 * Chrome/Edge require PNG icons, not SVG
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [16, 32, 48, 128];
const srcDir = resolve(__dirname, '../src/assets/logos');
const outDir = resolve(__dirname, '../src/assets/icons');

// Filigran emblem with background (blue square with white logo) for browser bar
const svgPath = resolve(srcDir, 'logo_filigran_embleme_background.svg');

async function generateIcons() {
  console.log('Generating PNG icons from SVG...');
  
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  // Read the SVG content
  const svgContent = readFileSync(svgPath, 'utf8');
  
  for (const size of sizes) {
    try {
      // Convert SVG to PNG at the specified size
      await sharp(Buffer.from(svgContent))
        .resize(size, size)
        .png()
        .toFile(resolve(outDir, `icon-${size}.png`));
      
      console.log(`✓ Generated icon-${size}.png`);
    } catch (error) {
      console.error(`✗ Failed to generate icon-${size}.png:`, error.message);
    }
  }

  console.log('Icon generation complete!');
}

generateIcons().catch(console.error);
