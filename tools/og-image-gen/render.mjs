// SVG → 1200×630 PNG renderer for D1 OG share-cards.
// Uses puppeteer-core + system Edge (no Chrome download).

import puppeteer from 'puppeteer-core';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const EDGE_PATHS = [
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
	'/usr/bin/microsoft-edge',
	'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
];

const [, , svgPath, pngPath] = process.argv;
if (!svgPath || !pngPath) {
	console.error('usage: node render.mjs <input.svg> <output.png>');
	process.exit(2);
}

const edge = EDGE_PATHS.find(existsSync);
if (!edge) {
	console.error('Edge not found at known paths; install Microsoft Edge or extend EDGE_PATHS in render.mjs');
	process.exit(3);
}

const svg = readFileSync(resolve(svgPath), 'utf8');

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  svg { display: block; width: 1200px; height: 630px; }
</style></head><body>${svg}</body></html>`;

const browser = await puppeteer.launch({
	executablePath: edge,
	headless: 'new',
	args: ['--no-sandbox']
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle0' });
await page.screenshot({ path: resolve(pngPath), type: 'png', omitBackground: false });
await browser.close();

console.log(`[og-image-gen] ${svgPath} → ${pngPath} (1200×630 PNG)`);
