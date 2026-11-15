// יוצר תמונות מסך לתיעוד (בהיר + כהה), עם נתוני דוגמה בלבד.
import { _electron as electron } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = process.argv[2] || path.join(root, '..', 'docs', 'screenshots');
fs.mkdirSync(out, { recursive: true });
const MASTER = 'Demo-Master-2026!';

async function shot(page, name) {
  await page.waitForTimeout(400);
  for (let i = 0; i < 5; i++) {
    try { await page.screenshot({ path: path.join(out, name) }); return; } catch { await page.waitForTimeout(500); }
  }
}

for (const scheme of ['light', 'dark']) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-shots-'));
  const app = await electron.launch({ args: ['--no-sandbox', root], env: { ...process.env, PV_USER_DATA: userData } });
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 1100, height: 720 });
  await page.waitForSelector('#lock-view:not([hidden])');
  await page.waitForTimeout(800);
  const p = `desktop-${scheme}-`;
  if (scheme === 'light') await shot(page, `${p}1-setup.png`);
  await page.fill('#master', MASTER);
  await page.fill('#confirm', MASTER);
  await page.click('#lock-submit');
  await page.waitForSelector('#main-view:not([hidden])');
  await page.click('#entries .entry >> nth=1');
  await page.click('#reveal');
  await shot(page, `${p}2-main.png`);
  if (scheme === 'light') {
    await page.click('#open-generator');
    await shot(page, `${p}3-generator.png`);
    await page.click('#gen-close');
    await page.click('#detail-edit');
    await shot(page, `${p}4-edit.png`);
    await page.click('#edit-cancel');
    await page.click('#lock-btn');
    await page.waitForSelector('#lock-view:not([hidden])');
    await shot(page, `${p}5-locked.png`);
  }
  await app.close();
}
