import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  mkdirSync,
  existsSync,
  rmSync,
} from 'fs';

// Get browser from environment variable
const browser = process.env.BROWSER || 'chrome';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest-and-assets',
      writeBundle() {
        const distDir = resolve(__dirname, `dist/${browser}`);
        mkdirSync(distDir, { recursive: true });

        // Read and process manifest
        const manifestSrc = resolve(__dirname, `src/manifest.${browser}.json`);
        const manifestContent = JSON.parse(readFileSync(manifestSrc, 'utf-8'));
        const manifestDest = resolve(distDir, 'manifest.json');
        writeFileSync(manifestDest, JSON.stringify(manifestContent, null, 2));

        // Copy logos
        const logosDir = resolve(__dirname, 'src/assets/logos');
        const destLogosDir = resolve(distDir, 'assets/logos');
        mkdirSync(destLogosDir, { recursive: true });

        if (existsSync(logosDir)) {
          const logos = readdirSync(logosDir);
          logos.forEach((logo) => {
            copyFileSync(resolve(logosDir, logo), resolve(destLogosDir, logo));
          });
        }

        // Copy icons for all browsers
        const iconsDir = resolve(__dirname, 'src/assets/icons');
        const destIconsDir = resolve(distDir, 'assets/icons');
        mkdirSync(destIconsDir, { recursive: true });

        if (existsSync(iconsDir)) {
          const icons = readdirSync(iconsDir);
          icons.forEach((icon) => {
            copyFileSync(resolve(iconsDir, icon), resolve(destIconsDir, icon));
          });
        }

        console.log(`✓ Manifest and assets copied for ${browser}`);
      },
    },
    {
      name: 'restructure-output',
      writeBundle() {
        const distDir = resolve(__dirname, `dist/${browser}`);
        const srcDir = resolve(distDir, 'src');

        if (!existsSync(srcDir)) return;

        // Fix paths in HTML files and move them
        const fixHtmlPaths = (htmlPath: string): string => {
          let content = readFileSync(htmlPath, 'utf-8');
          // Fix asset paths - make them relative to parent directory
          content = content.replace(/src="\.\.\/\.\.\/([^"]+)"/g, 'src="../$1"');
          content = content.replace(/href="\.\.\/\.\.\/([^"]+)"/g, 'href="../$1"');
          content = content.replace(/src="\.\/([^"]+)"/g, 'src="../$1"');
          content = content.replace(/href="\.\/([^"]+\.css)"/g, 'href="../$1"');
          content = content.replace(/src="\/src\/([^"]+)"/g, 'src="../$1"');
          content = content.replace(/href="\/src\/([^"]+)"/g, 'href="../$1"');
          return content;
        };

        // Move popup
        const popupSrc = resolve(srcDir, 'popup/index.html');
        if (existsSync(popupSrc)) {
          const popupDest = resolve(distDir, 'popup');
          mkdirSync(popupDest, { recursive: true });
          const content = fixHtmlPaths(popupSrc);
          writeFileSync(resolve(popupDest, 'index.html'), content);
        }

        // Move options
        const optionsSrc = resolve(srcDir, 'options/index.html');
        if (existsSync(optionsSrc)) {
          const optionsDest = resolve(distDir, 'options');
          mkdirSync(optionsDest, { recursive: true });
          const content = fixHtmlPaths(optionsSrc);
          writeFileSync(resolve(optionsDest, 'index.html'), content);
        }

        // Move panel
        const panelSrc = resolve(srcDir, 'panel/index.html');
        if (existsSync(panelSrc)) {
          const panelDest = resolve(distDir, 'panel');
          mkdirSync(panelDest, { recursive: true });
          const content = fixHtmlPaths(panelSrc);
          writeFileSync(resolve(panelDest, 'index.html'), content);
        }

        // Clean up src directory
        rmSync(srcDir, { recursive: true, force: true });
        console.log(`✓ HTML files restructured for ${browser}`);
      },
    },
    {
      // Build content script as IIFE (separate build) - Run after main build
      name: 'build-content-script',
      async closeBundle() {
        const { build } = await import('vite');
        const distDir = resolve(__dirname, `dist/${browser}`);
        const contentDir = resolve(distDir, 'content');
        mkdirSync(contentDir, { recursive: true });
        
        await build({
          configFile: false,
          build: {
            outDir: contentDir,
            emptyDirBeforeWrite: false,
            lib: {
              entry: resolve(__dirname, 'src/content/index.ts'),
              name: 'xtmContent',
              formats: ['iife'],
              fileName: () => 'index.js',
            },
            rollupOptions: {
              output: {
                extend: true,
              },
            },
            minify: 'terser',
            sourcemap: false,
          },
          define: {
            'process.env.NODE_ENV': JSON.stringify('production'),
          },
        });
        
        console.log(`✓ Content script built as IIFE for ${browser}`);
      },
    },
  ],
  base: './',
  build: {
    outDir: `dist/${browser}`,
    emptyDirBeforeWrite: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        panel: resolve(__dirname, 'src/panel/index.html'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background/index.js';
          }
          return '[name]/[name].js';
        },
        chunkFileNames: 'shared/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    minify: 'terser',
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
