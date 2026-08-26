// scripts/gen_icons.mjs
//
// Regenerates the favicon / app icons from the brand mark in public/logo.png.
//
// The mark is taller than it is wide (222x291), so browsers squashed it when
// it was used as the favicon directly. Here it is scaled to fit and centred on
// a square canvas instead, which is what keeps the icon true to the logo.
//
// Run with: npm run icons
// Point it at different artwork with: npm run icons -- path/to/mark.png

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const SOURCE = process.argv[2] ?? 'public/logo.png';
/** Share of the canvas the mark occupies; the rest is breathing room. */
const FILL = 0.9;

/** Scale the mark to fit a square canvas of `size`, centred, over `background`. */
async function square(size, background) {
  const box = Math.round(size * FILL);
  const mark = await sharp(SOURCE)
    .resize(box, box, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toBuffer();
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** Pack PNGs into an .ico. ICO entries may hold a whole PNG, so no re-encoding. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette colours
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(
  icoSizes.map(async (size) => ({ size, data: await square(size, TRANSPARENT) })),
);
await writeFile('src/app/favicon.ico', ico(icoImages));
await writeFile('src/app/icon.png', await square(512, TRANSPARENT));
// Apple flattens transparency to black, so this one gets a white plate.
await writeFile('src/app/apple-icon.png', await square(180, WHITE));

console.log(`from ${SOURCE}: wrote src/app/favicon.ico, src/app/icon.png, src/app/apple-icon.png`);
console.log('Restart the dev server, then hard-refresh the tab to see it.');
