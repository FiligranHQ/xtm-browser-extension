#!/usr/bin/env node

/**
 * Coverage Merge Script
 * 
 * Merges coverage reports from different test suites:
 * - Unit tests (vitest)
 * - E2E tests (playwright + istanbul)
 * - Integration tests (vitest)
 * 
 * Usage: node scripts/merge-coverage.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Coverage directories
const COVERAGE_DIRS = {
  unit: path.join(rootDir, 'coverage'),
  e2e: path.join(rootDir, 'coverage', 'e2e'),
  opencti: path.join(rootDir, 'coverage', 'opencti'),
  openaev: path.join(rootDir, 'coverage', 'openaev'),
};

const NYC_OUTPUT_DIR = path.join(rootDir, '.nyc_output');
const COMBINED_COVERAGE_DIR = path.join(rootDir, 'coverage', 'combined');

/**
 * Ensure directories exist
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Clean up directories
 */
function cleanDirs() {
  if (fs.existsSync(NYC_OUTPUT_DIR)) {
    fs.rmSync(NYC_OUTPUT_DIR, { recursive: true });
  }
  if (fs.existsSync(COMBINED_COVERAGE_DIR)) {
    fs.rmSync(COMBINED_COVERAGE_DIR, { recursive: true });
  }
  ensureDir(NYC_OUTPUT_DIR);
  ensureDir(COMBINED_COVERAGE_DIR);
}

/**
 * Find all coverage JSON files in a directory
 */
function findCoverageFiles(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`⚠ Coverage directory not found: ${dir}`);
    return [];
  }

  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findCoverageFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name.includes('coverage')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Copy coverage files to .nyc_output for merging
 */
function copyCoverageFiles() {
  let fileIndex = 0;
  
  for (const [name, dir] of Object.entries(COVERAGE_DIRS)) {
    const files = findCoverageFiles(dir);
    console.log(`Found ${files.length} coverage files in ${name}`);
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const data = JSON.parse(content);
        
        // Check if it's a valid coverage object
        if (typeof data === 'object' && data !== null) {
          const destFile = path.join(NYC_OUTPUT_DIR, `coverage-${name}-${fileIndex}.json`);
          fs.writeFileSync(destFile, JSON.stringify(data, null, 2));
          fileIndex++;
          console.log(`  ✓ Copied: ${path.basename(file)}`);
        }
      } catch (error) {
        console.log(`  ⚠ Skipped invalid file: ${path.basename(file)}`);
      }
    }
  }
  
  // Also check for unit test coverage-final.json
  const unitCoverageFinal = path.join(COVERAGE_DIRS.unit, 'coverage-final.json');
  if (fs.existsSync(unitCoverageFinal)) {
    try {
      const content = fs.readFileSync(unitCoverageFinal, 'utf8');
      const data = JSON.parse(content);
      const destFile = path.join(NYC_OUTPUT_DIR, `coverage-unit-final-${fileIndex}.json`);
      fs.writeFileSync(destFile, JSON.stringify(data, null, 2));
      console.log(`  ✓ Copied unit test coverage-final.json`);
      fileIndex++;
    } catch (error) {
      console.log(`  ⚠ Failed to copy unit coverage-final.json: ${error.message}`);
    }
  }
  
  return fileIndex;
}

/**
 * Run nyc to merge coverage reports
 */
function mergeCoverage() {
  try {
    console.log('\nMerging coverage reports with nyc...');
    execSync('npx nyc report', {
      cwd: rootDir,
      stdio: 'inherit',
    });
    console.log('\n✓ Coverage merged successfully!');
  } catch (error) {
    console.error('\n✗ Failed to merge coverage:', error.message);
    process.exit(1);
  }
}

/**
 * Main function
 */
function main() {
  console.log('=== Coverage Merge Script ===\n');
  
  // Clean and prepare directories
  console.log('Cleaning directories...');
  cleanDirs();
  
  // Copy coverage files
  console.log('\nCopying coverage files...');
  const fileCount = copyCoverageFiles();
  
  if (fileCount === 0) {
    console.log('\n⚠ No coverage files found to merge.');
    console.log('Run tests first:');
    console.log('  npm run test:coverage      # Unit tests');
    console.log('  npm run test:e2e:coverage  # E2E tests');
    process.exit(0);
  }
  
  console.log(`\nTotal coverage files: ${fileCount}`);
  
  // Merge coverage
  mergeCoverage();
  
  console.log(`\nCombined coverage report available at: ${COMBINED_COVERAGE_DIR}`);
}

main();

