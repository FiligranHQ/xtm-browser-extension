/**
 * PDF Text Extraction Analysis Script
 * 
 * Run with: node tests/scripts/analyze-pdf.mjs
 * 
 * Analyzes cs.pdf to understand text extraction issues.
 */

import { readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Use legacy build for Node.js
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

// Set worker path for Node.js - use require.resolve to get absolute path
const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath.replace(/\\/g, '/')}`;

const pdfPath = resolve(__dirname, '../unit/fixtures/cs.pdf');

console.log(`\n========================================`);
console.log(`PDF Text Extraction Analysis`);
console.log(`File: ${pdfPath}`);
console.log(`========================================\n`);

try {
  const pdfBuffer = readFileSync(pdfPath);
  const pdfData = new Uint8Array(pdfBuffer);
  
  const loadingTask = pdfjsLib.getDocument({ data: pdfData, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  
  console.log(`PDF loaded: ${pdf.numPages} pages\n`);
  
  // Collect all raw text items
  const allRawItems = [];
  const allPageTexts = [];
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    const pageItems = [];
    textContent.items.forEach((item) => {
      if (item.str) {
        pageItems.push({
          str: item.str,
          y: item.transform[5],
          x: item.transform[4],
          width: item.width,
          height: item.height,
        });
      }
    });
    
    allRawItems.push(...pageItems);
    
    // Group by Y position (line-based)
    const Y_TOLERANCE = 3;
    const lines = [];
    
    const sortedItems = [...pageItems].sort((a, b) => {
      if (Math.abs(a.y - b.y) > Y_TOLERANCE) {
        return b.y - a.y;
      }
      return a.x - b.x;
    });
    
    sortedItems.forEach((item) => {
      const existingLine = lines.find(line => Math.abs(line.y - item.y) <= Y_TOLERANCE);
      if (existingLine) {
        existingLine.items.push(item);
      } else {
        lines.push({ items: [item], y: item.y });
      }
    });
    
    // Build line texts with proper spacing between columns
    lines.forEach(line => {
      line.items.sort((a, b) => a.x - b.x);
      
      let lineText = '';
      line.items.forEach((item, idx) => {
        // Check if we need to add space between items (table columns)
        if (idx > 0 && lineText.length > 0) {
          const prevItem = line.items[idx - 1];
          const prevItemEnd = prevItem.x + prevItem.width;
          const gap = item.x - prevItemEnd;
          const avgCharWidth = prevItem.str.length > 0 ? prevItem.width / prevItem.str.length : 5;
          
          // Add space if:
          // 1. Gap is larger than 1 character (proportional), OR
          // 2. Gap is larger than 4 pixels absolute
          // Also add space if boundary is between alphanumeric characters
          const needsSpace = gap > avgCharWidth * 1.0 || gap > 4;
          const prevChar = prevItem.str.length > 0 ? prevItem.str[prevItem.str.length - 1] : '';
          const currChar = item.str.length > 0 ? item.str[0] : '';
          const alphanumericBoundary = /[a-zA-Z0-9]/.test(prevChar) && /[a-zA-Z0-9]/.test(currChar);
          
          if (needsSpace || (gap > 0 && alphanumericBoundary)) {
            lineText += ' ';
          }
        }
        lineText += item.str;
      });
      
      if (lineText.trim()) {
        allPageTexts.push(lineText);
      }
    });
    
    console.log(`Page ${pageNum}: ${pageItems.length} text items, ${lines.length} lines`);
  }
  
  const fullText = allPageTexts.join('\n');
  
  console.log(`\n--- Statistics ---`);
  console.log(`Total characters: ${fullText.length}`);
  console.log(`Total lines: ${allPageTexts.length}`);
  console.log(`Total raw items: ${allRawItems.length}`);
  
  // Show sample lines
  console.log(`\n--- First 30 Lines ---`);
  allPageTexts.slice(0, 30).forEach((line, i) => {
    console.log(`${String(i + 1).padStart(3)}: ${line}`);
  });
  
  // Look for potential tables
  console.log(`\n--- Potential Table Rows (multiple columns) ---`);
  const tableRows = allPageTexts.filter(line => {
    const parts = line.split(/\s{2,}/);
    return parts.length >= 3 || (line.length > 20 && /\d/.test(line) && /[a-zA-Z]/.test(line));
  });
  tableRows.slice(0, 20).forEach((row, i) => {
    console.log(`${String(i + 1).padStart(3)}: "${row}"`);
  });
  
  // Detect observables
  console.log(`\n--- Observable Detection ---`);
  
  // IP addresses
  const ipPattern = /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\[\.\]|\.)(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\[\.\]|\.)(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\[\.\]|\.)(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))/gi;
  const ipMatches = fullText.match(ipPattern) || [];
  console.log(`IP addresses found: ${ipMatches.length}`);
  [...new Set(ipMatches)].slice(0, 10).forEach(ip => console.log(`  - ${ip}`));
  
  // URLs/Domains (including defanged)
  // Standard domains
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
  const urlMatches = fullText.match(urlPattern) || [];
  // Defanged domains (with [.] notation)
  const defangedDomainPattern = /(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\[\.\]))+(?:com|net|org|edu|gov|io|co|cn|ru|uk|de|fr|it|es|jp|kr|au|br|in|mx|nl|se|ch|no|fi|pl|cz|at|be|tw|hk|sg|my|id|th|vn|ph|za|eg|ng|ke|pk|bd|lk|mm|ae|sa|qa|kw|om|jo|lb|il|tr|ua|by|kz|uz|ge|am|az|ir|iq|af)/gi;
  const defangedDomainMatches = fullText.match(defangedDomainPattern) || [];
  console.log(`\nURLs/Domains found: ${urlMatches.length} (standard), ${defangedDomainMatches.length} (defanged)`);
  console.log('Standard domains:');
  [...new Set(urlMatches)].slice(0, 10).forEach(url => console.log(`  - ${url}`));
  console.log('Defanged domains:');
  [...new Set(defangedDomainMatches)].slice(0, 10).forEach(url => console.log(`  - ${url}`));
  
  // Hashes (MD5, SHA1, SHA256)
  const hashPattern = /\b[a-fA-F0-9]{32}\b|\b[a-fA-F0-9]{40}\b|\b[a-fA-F0-9]{64}\b/g;
  const hashMatches = fullText.match(hashPattern) || [];
  console.log(`\nHashes found: ${hashMatches.length}`);
  [...new Set(hashMatches)].slice(0, 10).forEach(hash => console.log(`  - ${hash}`));
  
  // CVEs
  const cvePattern = /CVE[-–—\u2010-\u2015\u2212]?\d{4}[-–—\u2010-\u2015\u2212]?\d{4,7}/gi;
  const cveMatches = fullText.match(cvePattern) || [];
  console.log(`\nCVEs found: ${cveMatches.length}`);
  [...new Set(cveMatches)].slice(0, 10).forEach(cve => console.log(`  - ${cve}`));
  
  // Emails
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailMatches = fullText.match(emailPattern) || [];
  console.log(`\nEmails found: ${emailMatches.length}`);
  [...new Set(emailMatches)].slice(0, 10).forEach(email => console.log(`  - ${email}`));
  
  // Special character analysis
  console.log(`\n--- Special Character Analysis ---`);
  const specialChars = new Map();
  for (let i = 0; i < fullText.length; i++) {
    const code = fullText.charCodeAt(i);
    if (code > 127 || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      const char = fullText[i];
      if (!specialChars.has(code)) {
        specialChars.set(code, { char, count: 0, contexts: [] });
      }
      const info = specialChars.get(code);
      info.count++;
      if (info.contexts.length < 3) {
        const start = Math.max(0, i - 10);
        const end = Math.min(fullText.length, i + 11);
        info.contexts.push(fullText.slice(start, end).replace(/\n/g, '\\n'));
      }
    }
  }
  
  if (specialChars.size > 0) {
    console.log(`Found ${specialChars.size} different special character codes:`);
    specialChars.forEach((info, code) => {
      console.log(`  U+${code.toString(16).padStart(4, '0')} (code ${code}): ${info.count} occurrences`);
      console.log(`    Char: "${info.char}", Contexts: ${info.contexts.join(' | ')}`);
    });
  } else {
    console.log('No special characters found');
  }
  
  // Look for specific terms that might be in tables
  console.log(`\n--- Known Term Search ---`);
  const knownTerms = [
    'Government',
    'Technology', 
    'Finance',
    'Healthcare',
    'Energy',
    'Manufacturing',
    'Retail',
    'Education',
    'Phishing',
    'Ransomware',
    'APT',
    'C2',
    'backdoor',
    'malware',
    'trojan',
    'exploit',
  ];
  
  knownTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = fullText.match(regex) || [];
    if (matches.length > 0) {
      console.log(`${term}: ${matches.length} occurrences`);
      // Find the line containing it
      const lineWithTerm = allPageTexts.find(line => regex.test(line));
      if (lineWithTerm) {
        console.log(`  Sample: "${lineWithTerm.slice(0, 100)}..."`);
      }
    }
  });
  
  // Check for broken words across items
  console.log(`\n--- Potential Text Joining Issues ---`);
  const shortItems = allRawItems.filter(item => item.str.length <= 3 && /^[a-zA-Z0-9]+$/.test(item.str));
  console.log(`Short text items (<=3 chars, alphanumeric): ${shortItems.length}`);
  if (shortItems.length > 0) {
    console.log('Sample short items (may indicate text splitting):');
    shortItems.slice(0, 20).forEach(item => {
      console.log(`  "${item.str}" at (${item.x.toFixed(1)}, ${item.y.toFixed(1)})`);
    });
  }
  
  // Analyze table rows (items containing hashes or IPs)
  console.log(`\n--- Table Row Analysis (page 2 items) ---`);
  const tableItems = allRawItems.filter(item => 
    /[0-9a-f]{10,}/i.test(item.str) || // Hash fragments
    /\d+\.\d+\.\d+/.test(item.str) || // IP-like
    /^\d{4}$/.test(item.str) // Year-like
  );
  tableItems.slice(0, 30).forEach(item => {
    console.log(`  "${item.str.slice(0, 40)}..." x=${item.x.toFixed(1)} y=${item.y.toFixed(1)} w=${item.width.toFixed(1)}`);
  });
  
  // Output full text for manual inspection
  console.log(`\n--- Full Text Output (first 5000 chars) ---`);
  console.log(fullText.slice(0, 5000));
  
  console.log(`\n========================================`);
  console.log(`Analysis Complete`);
  console.log(`========================================\n`);
  
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}

