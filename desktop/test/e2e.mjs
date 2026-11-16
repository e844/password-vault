// בדיקת קצה לקצה: מריץ את האפליקציה האמיתית ועובר על כל התהליך דרך הממשק.
import { _electron as electron } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-e2e-'));
const filesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-files-'));
const openFile = path.join(filesDir, 'open-me');
const shots = process.env.PV_SHOTS || path.join(os.tmpdir(), 'pv-shots');
fs.mkdirSync(shots, { recursive: true });
const MASTER = 'Demo-Master-2026!';
const NEW_MASTER = 'Changed-Master-2027!';
const SAMPLE_COUNT = 8;
const results = [];
const step = async (name, fn) => { await fn(); results.push(name); process.stdout.write(`  ✓ ${name}\n`); };

async function launch(extraEnv = {}) {
  const app = await electron.launch({
    args: ['--no-sandbox', root],
    env: {
      ...process.env, PV_USER_DATA: userData, PV_TEST_DIALOG_DIR: filesDir, PV_TEST_OPEN_FILE: openFile,
      PV_TEST_RELEASE: JSON.stringify({ tag_name: 'build-99', published_at: '2026-11-15T20:00:00Z', html_url: 'https://github.com/e844/password-vault/releases/tag/build-99',
        assets: [{ name: 'PasswordVault-Windows.zip', browser_download_url: 'https://github.com/e844/password-vault/releases/download/build-99/PasswordVault-Windows.zip' }] }),
      ...extraEnv,
    },
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
const waitCount = (page, n) => page.waitForFunction((x) => document.querySelectorAll('#entries .entry').length === x, n);
const snackHas = (page, text) => page.waitForFunction((t) => document.querySelector('#snackbar').textContent.includes(t), text);
async function unlock(page, pw) {
  await page.fill('#master', pw);
  await page.click('#lock-submit');
  await page.waitForSelector('#main-view:not([hidden])');
}
async function menu(page, action) {
  await page.click('#menu-btn');
  await page.click(`#menu [data-action="${action}"]`);
}

let { app, page } = await launch();
await page.setViewportSize({ width: 1100, height: 740 });

await step('first run shows setup screen in Hebrew RTL', async () => {
  assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  assert.equal(await page.textContent('#lock-title'), 'יצירת כספת חדשה');
  assert.ok(await page.isVisible('#sample-banner'));
  await shot(page, '1-setup.png');
});

await step('short / mismatched master password rejected', async () => {
  await page.fill('#master', 'short');
  await page.fill('#confirm', 'short');
  await page.click('#lock-submit');
  await page.waitForFunction(() => document.querySelector('#lock-error').textContent.includes('8'));
  await page.fill('#master', MASTER);
  await page.fill('#confirm', MASTER + 'x');
  await page.click('#lock-submit');
  await page.waitForFunction(() => document.querySelector('#lock-error').textContent.includes('תואמות'));
});

await step(`create vault with ${SAMPLE_COUNT} sample entries`, async () => {
  await page.fill('#master', MASTER);
  await page.fill('#confirm', MASTER);
  await page.click('#lock-submit');
  await page.waitForSelector('#main-view:not([hidden])');
  await waitCount(page, SAMPLE_COUNT);
  await shot(page, '2-list.png');
});

await step('vault file is encrypted and master password not stored', async () => {
  const raw = fs.readFileSync(path.join(userData, 'vault.bin'));
  assert.equal(raw.subarray(0, 4).toString(), 'PVLT');
  for (const f of fs.readdirSync(userData, { recursive: true }).map(String)) {
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
  await waitCount(page, 1);
  await page.fill('#search', 'zzzz-none');
  await waitCount(page, 0);
  assert.ok(await page.isVisible('#empty'));
  await page.fill('#search', '');
  await waitCount(page, SAMPLE_COUNT);
});

await step('category chips filter the list', async () => {
  const chips = await page.locator('#cats .chip').count();
  assert.equal(chips, 1 + SAMPLE_COUNT); // "הכול" + קטגוריה לכל רשומת דוגמה
  await page.click('#cats .chip[data-cat="banking"]');
  await waitCount(page, 1);
  assert.match(await page.textContent('#entries .entry .t'), /בנק/);
  await page.click('#cats .chip >> nth=0');
  await waitCount(page, SAMPLE_COUNT);
});

await step('detail view: category, hidden password, reveal', async () => {
  await page.click('#entries .entry >> nth=0');
  await page.waitForSelector('#detail:not([hidden])');
  assert.ok((await page.textContent('#detail-cat')).length > 0);
  assert.equal(await page.textContent('#f-password .value'), '••••••••••');
  await page.click('#reveal');
  await page.waitForFunction(() => document.querySelector('#f-password .value').textContent.length === 16);
  await shot(page, '3-detail.png');
  await page.click('#reveal');
});

await step('open website in default browser', async () => {
  await page.click('#cats .chip[data-cat="banking"]');
  await page.click('#entries .entry >> nth=0');
  await page.click('#open-url');
  await snackHas(page, 'נפתח');
  assert.equal(await app.evaluate(() => globalThis.pvLastExternalUrl), 'https://demo-bank.example/');
  await page.click('#cats .chip >> nth=0');
});

await step('copy password to clipboard', async () => {
  await page.click('#f-password [data-copy="password"]');
  await snackHas(page, 'הועתק');
  const clip = await app.evaluate(async ({ clipboard }) => await clipboard.readText());
  assert.equal(clip.length, 16);
});

await step('add entry with category and generated password', async () => {
  await page.click('#fab');
  await page.fill('#e-title', 'רשומת בדיקה');
  await page.fill('#e-username', 'tester@example.com');
  await page.click('#e-cats .chip[data-cat="work"]');
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
  await waitCount(page, SAMPLE_COUNT + 1);
  assert.equal(await page.textContent('#detail-title'), 'רשומת בדיקה');
  assert.match(await page.textContent('#detail-cat'), /עבודה/);
  await page.click('#cats .chip[data-cat="work"]');
  await waitCount(page, 2);
  await page.click('#cats .chip >> nth=0');
});

await step('title is required', async () => {
  await page.click('#fab');
  await page.click('#edit-save');
  await page.waitForFunction(() => document.querySelector('#edit-error').textContent.includes('חובה'));
  await page.click('#edit-cancel');
});

await step('edit entry', async () => {
  await page.click('#detail-edit');
  await page.fill('#e-username', 'edited@example.com');
  await page.click('#edit-save');
  await page.waitForFunction(() => document.querySelector('#f-username .value').textContent === 'edited@example.com');
});

await step('encrypted backup file is created', async () => {
  await menu(page, 'backup');
  await snackHas(page, 'הגיבוי נשמר');
  const f = fs.readdirSync(filesDir).find((n) => n.endsWith('.pvault'));
  assert.ok(f, 'backup file missing');
  const b = fs.readFileSync(path.join(filesDir, f));
  assert.equal(b.subarray(0, 4).toString(), 'PVLT');
  assert.equal(b.includes(Buffer.from('tester')), false);
  fs.copyFileSync(path.join(filesDir, f), path.join(filesDir, 'backup-copy.pvault'));
});

await step('delete entry with confirmation', async () => {
  await page.click('#detail-delete');
  await page.waitForSelector('#confirm-dialog[open]');
  await shot(page, '6-delete.png');
  await page.click('#confirm-ok');
  await waitCount(page, SAMPLE_COUNT);
});

await step('restore from backup: wrong password rejected, then merge', async () => {
  fs.copyFileSync(path.join(filesDir, 'backup-copy.pvault'), openFile);
  await menu(page, 'restore');
  await page.waitForSelector('#restore-dialog[open]');
  await page.fill('#restore-password', 'wrong-one');
  await page.click('#restore-ok');
  await page.waitForFunction(() => document.querySelector('#restore-error').textContent === 'סיסמה שגויה');
  await page.fill('#restore-password', MASTER);
  await page.click('#restore-ok');
  await snackHas(page, 'השחזור הושלם');
  await waitCount(page, SAMPLE_COUNT + 1);
});

await step('export CSV (with warning) for browsers', async () => {
  await menu(page, 'exportCsv');
  await page.waitForSelector('#confirm-dialog[open]');
  assert.match(await page.textContent('#confirm-body'), /גלוי/);
  await page.click('#confirm-ok');
  await snackHas(page, 'יוצאו');
  const f = fs.readdirSync(filesDir).find((n) => n.endsWith('.csv'));
  const text = fs.readFileSync(path.join(filesDir, f), 'utf8');
  assert.match(text, /^﻿name,url,username,password,note,category\r\n/);
  assert.equal(text.trim().split('\r\n').length, SAMPLE_COUNT + 2);
});

await step('import CSV from Chrome (duplicates skipped, category guessed)', async () => {
  fs.writeFileSync(openFile, 'name,url,username,password,note\n'
    + 'Leumi,https://www.leumi.co.il/,me@example.com,Imp0rted!pw,\n'
    + 'Leumi,https://www.leumi.co.il/,me@example.com,Imp0rted!pw,\n'
    + 'Netflix,https://www.netflix.com/,tv@example.com,Fl1x!pw,\n');
  await menu(page, 'importCsv');
  await snackHas(page, 'נוספו 2');
  await waitCount(page, SAMPLE_COUNT + 3);
  await page.click('#cats .chip[data-cat="entertainment"]');
  await waitCount(page, 2);
  await page.click('#cats .chip >> nth=0');
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

await step('auto-lock setting can be changed (default 15 minutes)', async () => {
  await menu(page, 'lockSettings');
  await page.waitForSelector('#lock-dialog[open]');
  assert.equal(await page.inputValue('#lock-choices input:checked'), '15');
  await page.click('#lock-choices input[value="60"]');
  await page.click('#lock-ok');
  await snackHas(page, 'שעה');
  assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).autoLockMinutes, 60);
});

await step('update check finds a newer GitHub release and opens the download', async () => {
  await menu(page, 'update');
  await page.waitForFunction(() => document.querySelector('#update-status').textContent.includes('בנייה 99'));
  assert.equal(await page.isVisible('#update-download'), true);
  await shot(page, '9-update.png');
  await page.click('#update-download');
  assert.equal(await app.evaluate(() => globalThis.pvLastExternalUrl), 'https://github.com/e844/password-vault/releases/download/build-99/PasswordVault-Windows.zip');
  await page.click('#update-close');
});

await step('browser autofill setup dialog', async () => {
  await menu(page, 'browserFill');
  await page.waitForSelector('#browser-dialog[open]');
  await page.click('#browser-open');
  await page.click('#browser-close');
});

await step('personal background photo + colors from photo', async () => {
  fs.copyFileSync('/tmp/sample-photo.jpg', openFile);
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--h').trim());
  await menu(page, 'appearance');
  await page.waitForSelector('#appearance-dialog[open]');
  await page.click('#photo-pick');
  await snackHas(page, 'התמונה נשמרה');
  assert.ok(fs.existsSync(path.join(userData, 'appearance', 'background.jpg')));
  assert.equal(await page.evaluate(() => document.body.classList.contains('has-photo')), true);
  await page.waitForFunction((b) => getComputedStyle(document.documentElement).getPropertyValue('--h').trim() !== b, before);
  await page.click('#appearance-close');
  await shot(page, '10-photo-main.png');
});

await step('change master password', async () => {
  await menu(page, 'changeMaster');
  await page.fill('#m-current', 'not-it');
  await page.fill('#m-new', NEW_MASTER);
  await page.fill('#m-confirm', NEW_MASTER);
  await page.click('#m-ok');
  await page.waitForFunction(() => document.querySelector('#m-error').textContent.includes('שגויה'));
  await page.fill('#m-current', MASTER);
  await page.click('#m-ok');
  await snackHas(page, 'הוחלפה');
});

await step('manual lock clears the screen and clipboard', async () => {
  await page.click('#lock-btn');
  await page.waitForSelector('#lock-view:not([hidden])');
  assert.equal(await page.textContent('#lock-title'), 'הכספת נעולה');
  assert.equal(await page.locator('#entries .entry').count(), 0);
  await page.waitForTimeout(500);
  assert.equal(await app.evaluate(async ({ clipboard }) => await clipboard.readText()), '');
  await shot(page, '7-locked.png'); // עם תמונת הרקע
});

await step('old master password no longer works', async () => {
  await page.fill('#master', MASTER);
  await page.click('#lock-submit');
  await page.waitForFunction(() => document.querySelector('#lock-error').textContent === 'סיסמה שגויה');
});

await app.close();

({ app, page } = await launch({ PV_TEST_INACTIVITY_MS: '3000' }));

await step('data persists after restart (new master password)', async () => {
  assert.equal(await page.textContent('#lock-title'), 'הכספת נעולה');
  await unlock(page, NEW_MASTER);
  assert.equal(await count(page), SAMPLE_COUNT + 3);
});

await step('auto-lock after inactivity', async () => {
  await page.waitForSelector('#lock-view:not([hidden])', { timeout: 10_000 });
  await snackHas(page, 'אוטומטית');
});

await step('narrow window shows one pane at a time', async () => {
  await unlock(page, NEW_MASTER);
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
