#!/usr/bin/env node
/**
 * Génère les icônes PNG et les captures AMO (1280×800) à partir de l'UI.
 * Usage: node scripts/captures-amo.mjs
 */
import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const cssPopup = await readFile(path.join(racine, 'src/popup/popup.css'), 'utf8');
const cssOptions = await readFile(path.join(racine, 'src/options/options.css'), 'utf8');
const iconSvg = await readFile(path.join(racine, 'icons/icon.svg'), 'utf8');
const iconData = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`;

function pageShell(title, bodyCss, bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
html,body{margin:0;height:100%;background:#e8e6f2;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.stage{min-height:100%;display:flex;align-items:center;justify-content:center;padding:40px;box-sizing:border-box;
  background:radial-gradient(1200px 600px at 20% 0%,#ede9fe,transparent),radial-gradient(900px 500px at 90% 100%,#ddd6fe,transparent),#f3f0ff}
.card{background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(55,30,110,.18);overflow:hidden}
${bodyCss}
</style></head><body><div class="stage">${bodyHtml}</div></body></html>`;
}

const popupInner = `
<div class="card" style="width:320px">
  <div class="hd">
    <img src="${iconData}" class="logo" alt="">
    <div class="ht"><strong>No Noise</strong><span>History cleaner</span></div>
    <label class="master"><input type="checkbox" checked disabled><span class="switch"></span></label>
  </div>
  <section class="grid">
    <button class="btn primary">Clean now</button>
    <button class="btn">Preview</button>
  </section>
  <div class="toggles">
    <label class="row"><span>Real-time (adaptive)</span><span class="sw"><input type="checkbox" checked disabled><span class="switch sm"></span></span></label>
    <label class="row"><span>Periodic sweep</span><span class="sw"><input type="checkbox" disabled><span class="switch sm"></span></span></label>
    <label class="row"><span>Simulation (dry-run)</span><span class="sw"><input type="checkbox" disabled><span class="switch sm"></span></span></label>
  </div>
  <div class="stats">
    <div><strong>1 248</strong><span>deleted in total</span></div>
    <div><strong>4</strong><span>active rules</span></div>
  </div>
  <a class="opts" href="#">Manage rules and settings →</a>
</div>`;

const optionsRules = `
<div class="card" style="width:980px;max-width:95vw">
  <header style="display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid #e7e7ee">
    <img src="${iconData}" width="36" height="36" alt="">
    <div><h1 style="margin:0;font-size:20px">No Noise</h1>
    <p style="margin:2px 0 0;color:#6b7280;font-size:13px">Firefox history cleaner — adaptive & configurable</p></div>
  </header>
  <div style="padding:18px 22px">
    <h2 style="margin:0 0 10px;font-size:16px">Cleaning rules</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="text-align:left;color:#6b7280">
        <th style="padding:8px">On</th><th>Kind</th><th>Type</th><th>Value</th><th>Note</th>
      </tr></thead>
      <tbody>
        <tr style="border-top:1px solid #e7e7ee"><td style="padding:10px 8px">✓</td><td>Delete</td><td>Domain</td><td><code>facebook.com</code></td><td>Social media</td></tr>
        <tr style="border-top:1px solid #e7e7ee"><td style="padding:10px 8px">✓</td><td>Delete</td><td>Contains</td><td><code>www.google.com</code></td><td>Google</td></tr>
        <tr style="border-top:1px solid #e7e7ee"><td style="padding:10px 8px">✓</td><td>Delete</td><td>Contains</td><td><code>photos.google.com</code></td><td>Google</td></tr>
        <tr style="border-top:1px solid #e7e7ee"><td style="padding:10px 8px">✓</td><td>Keep</td><td>Contains</td><td><code>google.com/maps</code></td><td>Maps</td></tr>
      </tbody>
    </table>
  </div>
</div>`;

const noiseAnalyzer = `
<div class="card" style="width:720px">
  <div style="padding:22px 24px">
    <h2 style="margin:0 0 6px;font-size:18px">History noise</h2>
    <p style="margin:0 0 16px;color:#6b7280;font-size:13px">Domains that clutter your history most — one click to add a rule.</p>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${[
        ['github.com', '412'],
        ['photos.google.com', '287'],
        ['mail.google.com', '196'],
        ['stackoverflow.com', '94'],
      ]
        .map(
          ([d, n]) =>
            `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:#f6f6fb;border-radius:10px">
              <strong style="flex:1;font-size:14px">${d}</strong>
              <span style="color:#6b7280;font-size:13px">${n} entries</span>
              <button style="appearance:none;border:0;background:#7c3aed;color:#fff;padding:8px 12px;border-radius:8px;font-weight:600;font-size:12px">Add rule</button>
            </div>`,
        )
        .join('')}
    </div>
  </div>
</div>`;

const previewDry = `
<div class="card" style="width:420px">
  <div style="padding:22px 24px">
    <div style="background:#fde68a;color:#7c5b00;text-align:center;font-size:12px;padding:8px;border-radius:8px;margin-bottom:14px">Simulation mode — no actual deletion</div>
    <h2 style="margin:0 0 8px;font-size:18px">Preview</h2>
    <p style="margin:0 0 16px;font-size:14px"><strong>186</strong> entries would be deleted.</p>
    <ul style="margin:0;padding:0;list-style:none;font-size:13px;color:#374151">
      <li style="padding:8px 0;border-top:1px solid #e7e7ee">facebook.com · Social media</li>
      <li style="padding:8px 0;border-top:1px solid #e7e7ee">www.google.com · Google</li>
      <li style="padding:8px 0;border-top:1px solid #e7e7ee">photos.google.com · Google</li>
    </ul>
  </div>
</div>`;

const captures = [
  { fichier: '1-popup.png', html: pageShell('popup', cssPopup, popupInner) },
  { fichier: '2-regles.png', html: pageShell('rules', '', optionsRules) },
  { fichier: '3-bruit.png', html: pageShell('noise', '', noiseAnalyzer) },
  { fichier: '4-apercu.png', html: pageShell('preview', '', previewDry) },
];

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

await mkdir(path.join(racine, 'amo', 'captures'), { recursive: true });
await mkdir(path.join(racine, 'icons'), { recursive: true });

for (const { fichier, html } of captures) {
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({
    path: path.join(racine, 'amo', 'captures', fichier),
    type: 'png',
    clip: { x: 0, y: 0, width: 1280, height: 800 },
  });
  console.log('capture', fichier);
}

// Icônes PNG depuis le SVG
const sizes = [32, 48, 64, 96, 128];
for (const size of sizes) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!DOCTYPE html><html><body style="margin:0">${iconSvg.replace(
      /width="96"/,
      `width="${size}"`,
    ).replace(/height="96"/, `height="${size}"`)}</body></html>`,
    { waitUntil: 'load' },
  );
  await page.locator('svg').screenshot({
    path: path.join(racine, 'icons', `icone-${size}.png`),
    type: 'png',
  });
  console.log('icon', size);
}

await browser.close();
console.log('OK');
