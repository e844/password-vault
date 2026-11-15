// בדיקת קצה לקצה: מריץ את האפליקציה האמיתית ועובר על כל התהליך דרך הממשק.
import { _electron as electron } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-e2e-'));
const shots = process.env.PV_SHOTS || path.join(os.tmpdir(), 'pv-shots');
fs.mkdirSync(shots, { recursive: true });
const MASTER = 'Demo-Master-2026!';
const results = [];
const step = async (name, fn) => { await fn(); results.push(name); process.stdout.write(`  ✓ ${name}\n`); };

async function launch(extraEnv = {}) {
  const app = await electron.launch({
    args: ['--no-sandbox', root],
    env: { ...process.env, PV_USER_DATA: userData, ...extraEnv },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('#lock-view:not([hidden])');
  await page.waitForTimeout(1000);
  return { app, page };
}
async function shot(page, name) {
  for (let i = 0; i < 5; i++) {
    try { await page.screenshot({ path: path.join(shots, name) }); return; } catch { await page.waitForTimeout(500); }
  }
}
const count = (page) => page.locator('#entries .entry').count();

let { app, page } = await launch();
await page.setViewportSize({ width: 1100, height: 740 });

await step('first run shows setup screen in Hebrew RTL', async () => {
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await page.textContent('#lock-title'), 'יצירת כספת חדשה');
  assert.ok(await page.isVisible('#sample-banner'));
  await shot(page, '1-setup.png');
});

await step('short master password rejected', async () => {
  await page.fill('#master', 'short');
  await page.fill('#confirm', 'short');
  await page.click('#lock-submit');
  await page.waitForFunction(() => document.querySelector('#lock-error').textContent.includes('8'));
});

await step('mismatched confirmation rejected', async () => {
  await page.fill('#master', MASTER);
  await page.fill('#confirm', MASTER + 'x');
  await page.click('#lock-submit');
  await page.waitForFunction(() => document.querySelector('#lock-error').textContent.includes('תואמות'));
});

await step('create vault with 5 sample entries', async () => {
  await page.fill('#master', MASTER);
  await page.fill('#confirm', MASTER);
  await page.click('#lock-submit');
  await page.waitForSelector('#main-view:not([hidden])');
  assert.equal(await count(page), 5);
  await shot(page, '2-list.png');
});

await step('vault file is encrypted and master password not stored', async () => {
  const files = fs.readdirSync(userData, { recursive: true }).map(String);
  const raw = fs.readFileSync(path.join(userData, 'vault.bin'));
  assert.equal(raw.subarray(0, 4).toString(), 'PVLT');
  for (const f of files) {
    const p = path.join(userData, f);
    let st; try { st = fs.lstatSync(p); } catch { continue; }
    if (!st.isFile()) continue;
    const b = fs.readFileSync(p);
    assert.equal(b.includes(Buffer.from(MASTER)), false, `master password found in ${f}`);
    assert.equal(b.includes(Buffer.from('dana.demo@example.com')), false, `plaintext found in ${f}`);
  }
});

await step('search filters entries', async () => {
  await page.fill('#search', 'בנק');
  assert.equal(await count(page), 1);
  await page.fill('#search', 'zzzz-none');
  assert.equal(await count(page), 0);
  assert.ok(await page.isVisible('#empty'));
  await page.fill('#search', '');
  assert.equal(await count(page), 5);
});

await step('detail view: password hidden until revealed', async () => {
  await page.click('#entries .entry >> nth=0');
  await page.waitForSelector('#detail:not([hidden])');
  assert.equal(await page.textContent('#f-password .value'), '••••••••••');
  await page.click('#reveal');
  await page.waitForFunction(() => document.querySelector('#f-password .value').textContent.length === 16);
  await shot(page, '3-detail.png');
  await page.click('#reveal');
});

await step('copy password to clipboard', async () => {
  await page.click('#f-password [data-copy="password"]');
  await page.waitForFunction(() => document.querySelector('#snackbar').textContent.includes('הועתק'));
  const clip = await app.evaluate(async ({ clipboard }) => await clipboard.readText());
  assert.equal(clip.length, 16);
});

await step('add entry with generated password', async () => {
  await page.click('#fab');
  await page.fill('#e-title', 'רשומת בדיקה');
  await page.fill('#e-username', 'tester@example.com');
  await page.click('#e-generate');
  await page.waitForFunction(() => document.querySelector('#gen-output').textContent.length === 16);
  await page.fill('#gen-length', '24');
  await page.dispatchEvent('#gen-length', 'input');
  await page.waitForFunction(() => document.querySelector('#gen-output').textContent.length === 24);
  await shot(page, '4-generator.png');
  await page.click('#gen-use');
  assert.equal((await page.inputValue('#e-password')).length, 24);
  await shot(page, '5-edit.png');
  await page.click('#edit-save');
  await page.waitForFunction(() => document.querySelectorAll('#entries .entry').length === 6);
  assert.equal(await page.textContent('#detail-title'), 'רשומת בדיקה');
});

await step('title is required', async () => {
  await page.click('#fab');
  await page.click('#edit-save');
  await page.waitForFunction(() => document.querySelector('#edit-error').textContent.includes('חובה'));
  await page.click('#edit-cancel');
  assert.equal(await count(page), 6);
});

await step('edit entry', async () => {
  await page.click('#detail-edit');
  await page.fill('#e-username', 'edited@example.com');
  await page.click('#edit-save');
  await page.waitForFunction(() => document.querySelector('#f-username .value').textContent === 'edited@example.com');
});

await step('delete entry with confirmation', async () => {
  await page.click('#detail-delete');
  await page.waitForSelector('#confirm-dialog[open]');
  await shot(page, '6-delete.png');
  await page.click('#confirm-ok');
  await page.waitForFunction(() => document.querySelectorAll('#entries .entry').length === 5);
});

await step('generator option: digits only', async () => {
  await page.click('#open-generator');
  for (const id of ['#gen-lower', '#gen-upper', '#gen-symbols']) await page.click(`label:has(${id})`);
  await page.waitForFunction(() => /^[0-9]+$/.test(document.querySelector('#gen-output').textContent));
  await page.click('label:has(#gen-digits)');
  await page.waitForFunction(() => document.querySelector('#gen-output').textContent.includes('יש לבחור'));
  await page.click('#gen-close');
});

await step('network is blocked', async () => {
  const ok = await page.evaluate(() => fetch('https://example.com').then(() => true, () => false));
  assert.equal(ok, false);
  const mainOk = await app.evaluate(async ({ session }) => {
    try { await session.defaultSession.fetch('https://example.com'); return true; } catch { return false; }
  });
  assert.equal(mainOk, false);
});

await step('manual lock clears the screen and clipboard', async () => {
  await page.click('#lock-btn');
  await page.waitForSelector('#lock-view:not([hidden])');
  assert.equal(await page.textContent('#lock-title'), 'הכספת נעולה');
  assert.equal(await page.locator('#entries .entry').count(), 0);
  await page.waitForTimeout(500);
  const clip = await app.evaluate(async ({ clipboard }) => await clipboard.readText());
  assert.equal(clip, '');
  await shot(page, '7-locked.png');
});

await step('wrong master password rejected', async () => {
  await page.fill('#master', 'not-the-password');
  await page.click('#lock-submit');
  await page.waitForFunction(() => document.querySelector('#lock-error').textContent === 'סיסמה שגויה');
});

await app.close();

({ app, page } = await launch({ PV_TEST_INACTIVITY_MS: '3000' }));

await step('data persists after restart', async () => {
  assert.equal(await page.textContent('#lock-title'), 'הכספת נעולה');
  await page.fill('#master', MASTER);
  await page.click('#lock-submit');
  await page.waitForSelector('#main-view:not([hidden])');
  assert.equal(await count(page), 5);
});

await step('auto-lock after inactivity', async () => {
  await page.waitForSelector('#lock-view:not([hidden])', { timeout: 10_000 });
  await page.waitForFunction(() => document.querySelector('#snackbar').textContent.includes('אוטומטית'));
});

await step('narrow window shows one pane at a time', async () => {
  await page.fill('#master', MASTER);
  await page.click('#lock-submit');
  await page.waitForSelector('#main-view:not([hidden])');
  await page.setViewportSize({ width: 480, height: 760 });
  assert.equal(await page.isVisible('#detail-pane'), false);
  await page.click('#entries .entry >> nth=1');
  assert.equal(await page.isVisible('#detail-pane'), true);
  assert.equal(await page.isVisible('.list-pane'), false);
  await shot(page, '8-narrow.png');
  await page.click('#detail-back');
  assert.equal(await page.isVisible('.list-pane'), true);
});

await app.close();
process.stdout.write(`\n${results.length} end-to-end checks passed\n`);
