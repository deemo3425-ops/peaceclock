#!/usr/bin/env node
/**
 * Generates the PeaceClock MapLibre SDF sprite atlas (PRD §5.3).
 * Run: node apps/web/scripts/generate-map-sprites.mjs
 *
 * White-on-transparent glyphs; MapLibre tints via icon-color / icon-halo-color.
 * Export path shared with M6 native clients.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../public/sprites');
const SIZE = 64; // @2x tile
const COLS = 5;

/** @type {Record<string, (ctx: Canvas) => void>} */
const GLYPHS = {
  'pin-base': (ctx) => {
    // Teardrop / lozenge body for side chroma fill.
    ctx.fillCircle(32, 36, 14);
    ctx.fillCircle(32, 22, 9);
  },
  'ring-official': (ctx) => {
    ctx.strokeRing(32, 32, 22, 3);
  },
  'ring-confirmed': (ctx) => {
    ctx.strokeRing(32, 32, 20, 2.5);
  },
  'ring-osint': (ctx) => {
    ctx.strokeDashedRing(32, 32, 22, 3, 8, 6);
  },
  'ring-ai_corroborated': (ctx) => {
    ctx.strokeDottedRing(32, 32, 22, 3, 5);
  },
  'badge-provisional': (ctx) => {
    // Small pennant at top-right of pin anchor.
    ctx.fillTriangle(44, 10, 56, 16, 44, 22);
  },
  'cluster-disc': (ctx) => {
    ctx.fillCircle(32, 32, 26);
    ctx.clearCircle(32, 32, 18);
  },
};

function createCanvas() {
  const w = SIZE;
  const h = SIZE;
  const data = new Uint8ClampedArray(w * h * 4);
  const get = (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) return 0;
    return data[(iy * w + ix) * 4 + 3];
  };
  const set = (x, y, a) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) return;
    const i = (iy * w + ix) * 4;
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = Math.min(255, Math.max(0, Math.round(a)));
  };
  const stampDisk = (cx, cy, r, alpha = 255) => {
    const r2 = r * r;
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2) set(x, y, alpha);
      }
    }
  };
  const ctx = {
    fillCircle(cx, cy, r) {
      stampDisk(cx, cy, r, 255);
    },
    clearCircle(cx, cy, r) {
      const r2 = r * r;
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
        for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          if (dx * dx + dy * dy <= r2) {
            const ix = Math.floor(x);
            const iy = Math.floor(y);
            if (ix >= 0 && iy >= 0 && ix < w && iy < h) {
              const i = (iy * w + ix) * 4 + 3;
              data[i] = 0;
            }
          }
        }
      }
    },
    strokeRing(cx, cy, radius, width) {
      const outer = radius + width / 2;
      const inner = radius - width / 2;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d <= outer && d >= inner) set(x, y, 255);
        }
      }
    },
    strokeDashedRing(cx, cy, radius, width, dash, gap) {
      const outer = radius + width / 2;
      const inner = radius - width / 2;
      const circ = 2 * Math.PI * radius;
      const period = dash + gap;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > outer || d < inner) continue;
          let ang = Math.atan2(dy, dx);
          if (ang < 0) ang += 2 * Math.PI;
          const arc = (ang / (2 * Math.PI)) * circ;
          if (arc % period < dash) set(x, y, 255);
        }
      }
    },
    strokeDottedRing(cx, cy, radius, width, spacing) {
      const outer = radius + width / 2;
      const inner = radius - width / 2;
      const circ = 2 * Math.PI * radius;
      const n = Math.floor(circ / spacing);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * 2 * Math.PI;
        const px = cx + Math.cos(ang) * radius;
        const py = cy + Math.sin(ang) * radius;
        stampDisk(px, py, width * 0.55, 255);
      }
    },
    fillTriangle(x1, y1, x2, y2, x3, y3) {
      const minX = Math.max(0, Math.floor(Math.min(x1, x2, x3)));
      const maxX = Math.min(w - 1, Math.ceil(Math.max(x1, x2, x3)));
      const minY = Math.max(0, Math.floor(Math.min(y1, y2, y3)));
      const maxY = Math.min(h - 1, Math.ceil(Math.max(y1, y2, y3)));
      const sign = (ax, ay, bx, by, cx, cy) => (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const d1 = sign(px, py, x1, y1, x2, y2);
          const d2 = sign(px, py, x2, y2, x3, y3);
          const d3 = sign(px, py, x3, y3, x1, y1);
          const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
          const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
          if (!(hasNeg && hasPos)) set(x, y, 255);
        }
      }
    },
    data,
    w,
    h,
  };
  return ctx;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const names = Object.keys(GLYPHS);
const rows = Math.ceil(names.length / COLS);
const atlasW = COLS * SIZE;
const atlasH = rows * SIZE;
const atlas = Buffer.alloc(atlasW * atlasH * 4, 0);

const spriteJson = { peaceclock: {} };

names.forEach((name, idx) => {
  const col = idx % COLS;
  const row = Math.floor(idx / COLS);
  const canvas = createCanvas();
  GLYPHS[name](canvas);
  const ox = col * SIZE;
  const oy = row * SIZE;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const si = (y * SIZE + x) * 4;
      const di = ((oy + y) * atlasW + (ox + x)) * 4;
      atlas[di] = canvas.data[si];
      atlas[di + 1] = canvas.data[si + 1];
      atlas[di + 2] = canvas.data[si + 2];
      atlas[di + 3] = canvas.data[si + 3];
    }
  }
  spriteJson.peaceclock[name] = {
    width: SIZE,
    height: SIZE,
    x: ox,
    y: oy,
    pixelRatio: 2,
    sdf: true,
  };
});

mkdirSync(OUT_DIR, { recursive: true });
const pngPath = join(OUT_DIR, 'peaceclock-pins.png');
const jsonPath = join(OUT_DIR, 'peaceclock-pins.json');
writeFileSync(pngPath, encodePng(atlas, atlasW, atlasH));
writeFileSync(jsonPath, JSON.stringify(spriteJson, null, 2) + '\n');
console.log(`Wrote ${pngPath} (${atlasW}x${atlasH}) and ${jsonPath} (${names.length} glyphs)`);