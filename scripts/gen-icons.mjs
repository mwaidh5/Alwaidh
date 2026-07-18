// Generates the app icons (PWA + stores) without any image libraries:
// a brand-blue rounded square with a white geometric "A".
// Run: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BLUE = [37, 99, 235]; // brand-600 #2563eb
const WHITE = [255, 255, 255];

// CRC32 (per PNG spec)
const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(size, pixels /* RGBA Uint8Array */) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // raw scanlines with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels
      .subarray(y * size * 4, (y + 1) * size * 4)
      .forEach((v, i) => (raw[y * (size * 4 + 1) + 1 + i] = v));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// distance from point to segment
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function render(size, { padding = 0 } = {}) {
  const px = new Uint8Array(size * size * 4);
  const r = size * 0.22; // corner radius
  const pad = size * padding;
  const lo = pad, hi = size - pad;
  const stroke = size * 0.075;
  // "A" geometry
  const apexX = size / 2, apexY = size * 0.26;
  const baseY = size * 0.76;
  const spread = size * 0.185;
  const barY = size * 0.585;
  const barHalf = size * 0.115;
  const inRounded = (x, y) => {
    if (x < lo || x >= hi || y < lo || y >= hi) return false;
    const cx = Math.max(lo + r, Math.min(hi - r, x));
    const cy = Math.max(lo + r, Math.min(hi - r, y));
    return Math.hypot(x - cx, y - cy) <= r;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!inRounded(x + 0.5, y + 0.5)) continue; // transparent
      let [cr, cg, cb] = BLUE;
      const dLeft = segDist(x, y, apexX, apexY, apexX - spread, baseY);
      const dRight = segDist(x, y, apexX, apexY, apexX + spread, baseY);
      const dBar = segDist(x, y, apexX - barHalf, barY, apexX + barHalf, barY);
      if (Math.min(dLeft, dRight, dBar) <= stroke / 2) [cr, cg, cb] = WHITE;
      px[i] = cr;
      px[i + 1] = cg;
      px[i + 2] = cb;
      px[i + 3] = 255;
    }
  }
  return encodePNG(size, px);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/pwa-192.png', render(192));
writeFileSync('public/pwa-512.png', render(512));
writeFileSync('public/apple-touch-icon.png', render(180));
// maskable: same art with safe-zone padding, full-bleed square (no transparency)
writeFileSync('public/pwa-maskable-512.png', render(512, { padding: 0 }));
console.log('icons written to public/');
