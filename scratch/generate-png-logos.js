import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const PUBLIC_DIR = 'c:/Users/stara/Downloads/ritual-cortex/public';
const SVG_PATH = path.join(PUBLIC_DIR, 'logo.svg');

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const svgContent = fs.readFileSync(SVG_PATH, 'utf-8');
  
  const sizes = [32, 64, 128, 256, 512];
  
  for (const size of sizes) {
    const htmlContent = `
      <!doctype html>
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: transparent;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${size}px;
            height: ${size}px;
          }
          svg {
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
      </html>
    `;
    
    await page.setContent(htmlContent);
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    
    const outputPath = size === 512 
      ? path.join(PUBLIC_DIR, 'logo.png')
      : path.join(PUBLIC_DIR, `logo-${size}x${size}.png`);
      
    await page.screenshot({
      path: outputPath,
      omitBackground: true,
      type: 'png'
    });
    
    console.log(`Saved logo at ${size}x${size} to ${outputPath}`);
  }
  
  await browser.close();
}

main().catch(console.error);
