// Generates PWA icons from the traced CWC logo. Run: npm run icons
import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

const BRAND = '#1e3a8a';
const src = readFileSync(new URL('../brand/cwc-logo.svg', import.meta.url), 'utf8');
const inner = src.slice(src.indexOf('>') + 1, src.lastIndexOf('</svg>')).replace(/currentColor/g, '#ffffff');
// Logo viewBox is 1365×911; thicken lines slightly so they survive small sizes.
const logo = (size, scale, rounded) => {
  const w = size * scale;
  const h = (w * 911) / 1365;
  const x = (size - w) / 2;
  const y = (size - h) / 2 + size * 0.01;
  const r = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2546a8"/><stop offset="1" stop-color="${BRAND}"/></linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)"/>
  <g transform="translate(${x} ${y}) scale(${w / 1365})" stroke="#ffffff" stroke-width="${Math.max(0, 1365 / w * 0.6)}">${inner}</g></svg>`;
};
const badge = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${size * 0.04} ${(size - size * 0.92 * 911 / 1365) / 2}) scale(${(size * 0.92) / 1365})" stroke="#fff" stroke-width="18">${inner}</g></svg>`;

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
const jobs = [
  ['icon-192.png', logo(192, 0.74, false)],
  ['icon-512.png', logo(512, 0.74, false)],
  ['maskable-192.png', logo(192, 0.58, false)],
  ['maskable-512.png', logo(512, 0.58, false)],
  ['apple-touch-icon.png', logo(180, 0.7, false)],
  ['favicon-32.png', logo(32, 0.86, true)],
  ['badge-96.png', badge(96)],
];
for (const [name, svg] of jobs) {
  await sharp(Buffer.from(svg)).png().toFile(new URL(name, out).pathname);
  console.log('icon', name);
}
writeFileSync(new URL('../public/favicon.svg', import.meta.url), logo(64, 0.86, true));
console.log('favicon.svg');
