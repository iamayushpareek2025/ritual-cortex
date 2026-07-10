import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const PUBLIC_DIR = 'c:/Users/stara/Downloads/ritual-cortex/public';
const AI_LOGO_PATH = 'C:/Users/stara/.gemini/antigravity-ide/brain/70563eb3-3d2c-4f11-b000-a2bfd864c1ec/ritual_brain_logo_1783645787429.png';

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Convert AI PNG to base64
  const imgBase64 = fs.readFileSync(AI_LOGO_PATH).toString('base64');
  const imgDataUrl = `data:image/png;base64,${imgBase64}`;

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
            width: ${size}px;
            height: ${size}px;
          }
          .wrap {
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <img src="${imgDataUrl}" alt="logo" />
        </div>
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
