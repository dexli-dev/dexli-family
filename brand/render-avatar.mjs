// Render brand/org-avatar.svg → org-avatar-1024.png via Edge headless.
// Run from E:/lab/_eval so its node_modules/puppeteer-core resolves:
//   node E:/lab/sandbox/dexli-family/brand/render-avatar.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire('file:///E:/lab/_eval/');
const puppeteer = require('puppeteer-core');

const here = dirname(fileURLToPath(import.meta.url));
const svg = readFileSync(join(here, 'org-avatar.svg'), 'utf8');

const browser = await puppeteer.launch({
	executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	headless: 'new',
});
const page = await browser.newPage();
await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
await page.setContent(
	`<!doctype html><style>*{margin:0;padding:0}svg{display:block;width:1024px;height:1024px}</style>${svg}`,
);
await page.screenshot({
	path: join(here, 'org-avatar-1024.png'),
	clip: { x: 0, y: 0, width: 1024, height: 1024 },
});
await browser.close();
console.log('rendered org-avatar-1024.png');
