// בדיקה אמיתית: הכספת בלשונית בדפדפן (דף של התוסף) מול התוכנה הפתוחה.
import { _electron as electron, chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const extDir = path.join(root, 'browser-extension');
const shots = process.env.PV_SHOTS || path.join(os.tmpdir(), 'pv-shots');
fs.mkdirSync(shots, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-app-'));
const chromeData = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-chrome-'));
const nmDirs = [path.join(chromeData, 'NativeMessagingHosts'), path.join(os.homedir(), '.config', 'chromium', 'NativeMessagingHosts')];
const MASTER = 'Demo-Master-2026!';
const EXT = 'nkhmbogejfailleiddedhcgmhbehlggn';
const step = async (name, fn) => { await fn(); process.stdout.write(`  ✓ ${name}\n`); };
const countIs = (p, n) => p.waitForFunction((x) => document.querySelector('#count').textContent === `${x} רשומות`, n, { timeout: 15000 });

const app = await electron.launch({ args: ['--no-sandbox', root], env: { ...process.env, PV_USER_DATA: userData, PV_TEST_NM_DIR: nmDirs.join(path.delimiter) } });
const win = await app.firstWindow();
await win.waitForSelector('#lock-view:not([hidden])');
await win.fill('#master', MASTER);
await win.fill('#confirm', MASTER);
await win.click('#lock-submit');
await win.waitForSelector('#main-view:not([hidden])');

const ctx = await chromium.launchPersistentContext(chromeData, {
  executablePath: process.env.PV_CHROME || undefined, headless: false, viewport: { width: 1200, height: 760 },
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`, '--no-sandbox'],
});
if (!ctx.serviceWorkers()[0]) await ctx.waitForEvent('serviceworker', { timeout: 15000 });
const tab = await ctx.newPage();

await step('vault opens in a browser tab with the same entries', async () => {
  await tab.goto(`chrome-extension://${EXT}/vault/index.html`);
  await tab.waitForSelector('#main-view:not([hidden])', { timeout: 15000 });
  await countIs(tab, 8);
  assert.equal(await tab.getAttribute('html', 'dir'), 'rtl');
  await tab.click('#entries .entry >> nth=1');
  await tab.click('#reveal');
  await tab.waitForFunction(() => document.querySelector('#f-password .value').textContent.length === 16);
  await tab.screenshot({ path: path.join(shots, 'tab-1-main.png') });
});

await step('adding in the tab shows up in the app window', async () => {
  await tab.click('#fab');
  await tab.fill('#e-title', 'נוסף מהלשונית');
  await tab.fill('#e-username', 'tab@example.com');
  await tab.fill('#e-password', 'Dummy-Tab-1');
  await tab.click('#edit-save');
  await countIs(tab, 9);
  await countIs(win, 9);
});

await step('adding in the app window shows up in the tab', async () => {
  await win.click('#fab');
  await win.fill('#e-title', 'נוסף מהתוכנה');
  await win.fill('#e-password', 'Dummy-App-1');
  await win.click('#edit-save');
  await countIs(win, 10);
  await countIs(tab, 10);
});

await step('generator and settings work in the tab', async () => {
  await tab.click('#open-generator');
  await tab.waitForFunction(() => document.querySelector('#gen-output').textContent.length === 16);
  await tab.click('#gen-close');
  await tab.click('#nav-settings');
  await tab.waitForFunction(() => document.querySelector('#set-lock-desc').textContent.includes('15'));
  await tab.click('#settings-close');
});

await step('lock in the tab locks the app; unlock in the app opens the tab', async () => {
  await tab.click('#lock-btn');
  await tab.waitForSelector('#lock-view:not([hidden])');
  await win.waitForSelector('#lock-view:not([hidden])', { timeout: 10000 });
  await tab.screenshot({ path: path.join(shots, 'tab-2-locked.png') });
  await win.fill('#master', MASTER);
  await win.click('#lock-submit');
  await win.waitForSelector('#main-view:not([hidden])');
  await tab.waitForSelector('#main-view:not([hidden])', { timeout: 10000 });
});

await step('lock in the app locks the tab; unlock in the tab opens the app', async () => {
  await win.click('#lock-btn');
  await tab.waitForSelector('#lock-view:not([hidden])', { timeout: 10000 });
  await tab.fill('#master', 'wrong-password');
  await tab.click('#lock-submit');
  await tab.waitForFunction(() => document.querySelector('#lock-error').textContent === 'סיסמה שגויה');
  await tab.fill('#master', MASTER);
  await tab.click('#lock-submit');
  await tab.waitForSelector('#main-view:not([hidden])');
  await win.waitForSelector('#main-view:not([hidden])', { timeout: 10000 });
  await countIs(tab, 10);
});

await step('only the vault page may use full access (popup is refused)', async () => {
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${EXT}/popup.html`);
  const r = await popup.evaluate(() => new Promise((res) => chrome.runtime.sendMessage({ type: 'ipc', channel: 'list' }, res)));
  assert.deepEqual(r, { error: 'forbidden' });
  await popup.close();
});

await ctx.close();
await app.close();
process.stdout.write('\nbrowser-tab checks passed\n');
