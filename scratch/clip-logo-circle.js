import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const src = 'C:/Users/stara/.gemini/antigravity-ide/brain/70563eb3-3d2c-4f11-b000-a2bfd864c1ec/ritual_brain_logo_1783645787429.png';
const destBase = 'c:/Users/stara/Downloads/ritual-cortex/public';

const sizes = [
  { name: 'logo-32x32.png', size: 32 },
  { name: 'logo-64x64.png', size: 64 },
  { name: 'logo-128x128.png', size: 128 },
  { name: 'logo-256x256.png', size: 256 },
  { name: 'logo.png', size: 512 },
];

async function generateAll() {
  for (const { name, size } of sizes) {
    const circleSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>` +
      `</svg>`
    );

    const dest = path.join(destBase, name);
    await sharp(src)
      .resize(size, size)
      .composite([{ input: circleSvg, blend: 'dest-in' }])
      .png({ compressionLevel: 9 })
      .toFile(dest);

    console.log(`Saved ${name} at ${size}x${size} (circular transparent)`);
  }
  console.log('All logos generated!');
}

generateAll().catch(console.error);
