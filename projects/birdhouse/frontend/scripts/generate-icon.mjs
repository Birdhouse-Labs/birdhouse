#!/usr/bin/env node
// ABOUTME: Generates PNG icons from SVG favicon for iOS/Android home screen
// ABOUTME: Uses puppeteer-core from browser-tools to avoid adding puppeteer to frontend deps
//
// Usage: node scripts/generate-icon.mjs
// Requires: browser-tools project with npm dependencies installed

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// Find puppeteer-core from browser-tools
const browserToolsDir = resolve(__dirname, '../../../agentic-coding/browser-tools');
const puppeteerPath = join(browserToolsDir, 'node_modules/puppeteer-core');

if (!existsSync(puppeteerPath)) {
  console.error('Error: puppeteer-core not found in browser-tools.');
  console.error('Expected at:', browserToolsDir);
  console.error('\nPlease run: cd', browserToolsDir, '&& npm install');
  process.exit(1);
}

// Import puppeteer-core and use system Chrome
const puppeteer = require(puppeteerPath);

// Find Chrome/Chromium on macOS
const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function generateIcon() {
  const svg = readFileSync(join(publicDir, 'favicon.svg'), 'utf-8');
  
  // Create HTML with the SVG scaled to 180x180 with white background
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { 
            margin: 0; 
            padding: 0; 
            background: white;
            width: 180px;
            height: 180px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          svg { 
            width: 160px; 
            height: 160px; 
          }
        </style>
      </head>
      <body>${svg}</body>
    </html>
  `;
  
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ 
    headless: true,
    executablePath,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 180, height: 180, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  console.log('Rendering icon...');
  const screenshot = await page.screenshot({
    type: 'png',
    omitBackground: false,
  });
  
  const outputPath = join(publicDir, 'apple-touch-icon.png');
  writeFileSync(outputPath, screenshot);
  console.log('✓ Generated apple-touch-icon.png');
  
  await browser.close();
}

generateIcon().catch((err) => {
  console.error('Error generating icon:', err);
  process.exit(1);
});
