// בדיקה אמיתית של המילוי בדפדפן: Chromium עם התוסף + התוכנה פתוחה + דף התחברות.
import { _electron as electron, chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
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
const step = async (name, fn) => { await fn(); process.stdout.write(`  ✓ ${name}\n`); };

const LOGIN = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>התחברות</title>
<style>body{font-family:sans-serif;background:#f3f4f8;display:grid;place-items:center;height:100vh;margin:0}
form{background:#fff;padding:28px;border-radius:16px;width:320px;box-shadow:0 2px 12px #0002}
input{display:block;width:100%;box-sizing:border-box;margin:8px 0 16px;padding:10px;font-size:15px;border:1px solid #bbb;border-radius:8px}
button{width:100%;padding:10px;font-size:15px;border:0;border-radius:8px;background:#1f5fbf;color:#fff}</style></head>
<body><form onsubmit="return false"><h2>כניסה לחשבון (דף בדיקה)</h2>
<label>שם משתמש<input id="user" name="username" autocomplete="username"></label>
<label>סיסמה<input id="pass" type="password" name="password" autocomplete="current-password"></label>
<button>כניסה</button></form></body></html>`;
const server = http.createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(LOGIN); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// 1) התוכנה: יצירת כספת עם נתוני הדוגמה
const app = await electron.launch({
  args: ['--no-sandbox', root],
  env: { ...process.env, PV_USER_DATA: userData, PV_TEST_NM_DIR: nmDirs.join(path.delimiter) },
});
const win = await app.firstWindow();
await win.waitForSelector('#lock-view:not([hidden])');
await win.fill('#master', MASTER);
await win.fill('#confirm', MASTER);
await win.click('#lock-submit');
await win.waitForSelector('#main-view:not([hidden])');

// 2) הדפדפן עם התוסף
const ctx = await chromium.launchPersistentContext(chromeData, {
  executablePath: process.env.PV_CHROME || undefined,
  headless: false,
  viewport: { width: 900, height: 640 },
  args: [
    `--disable-extensions-except=${extDir}`,
    `--load-extension=${extDir}`,
    `--host-resolver-rules=MAP demo-bank.example 127.0.0.1:${port}, MAP evil.example 127.0.0.1:${port}`,
    '--no-sandbox',
  ],
});
const page = await ctx.newPage();

async function dropdownItemPoint(selector, index) {
  const r = await page.locator(selector).boundingBox();
  // הרשימה נפתחת 6px מתחת לשדה; כותרת ~32px; כל פריט ~52px
  return { x: r.x + r.width - 120, y: r.y + r.height + 6 + 6 + 32 + 26 + index * 52 };
}

await step('extension loaded, native host registered', async () => {
  assert.ok(fs.existsSync(path.join(nmDirs[0], 'com.demo.passwordvault.json')));
  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  assert.match(sw.url(), /nkhmbogejfailleiddedhcgmhbehlggn/);
});

await step('login page on the matching site shows the vault suggestion and fills it', async () => {
  await page.goto('http://demo-bank.example/login');
  await page.click('#user');
  await page.waitForTimeout(2500); // הפעלת ה-native host
  await page.screenshot({ path: path.join(shots, 'browser-autofill.png') });
  const p = await dropdownItemPoint('#user', 0);
  await page.mouse.click(p.x, p.y);
  await page.waitForFunction(() => document.querySelector('#user').value !== '', null, { timeout: 8000 });
  assert.equal(await page.inputValue('#user'), 'demo-user-1234');
  assert.equal((await page.inputValue('#pass')).length, 16);
  await page.screenshot({ path: path.join(shots, 'browser-filled.png') });
});

await step('a different site gets nothing', async () => {
  await page.goto('http://evil.example/login');
  await page.click('#user');
  await page.waitForTimeout(2500);
  const p = await dropdownItemPoint('#user', 0);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(800);
  assert.equal(await page.inputValue('#user'), '');
  assert.equal(await page.inputValue('#pass'), '');
});

await step('locked vault: suggestion asks to unlock instead of filling', async () => {
  await win.click('#lock-btn');
  await win.waitForSelector('#lock-view:not([hidden])');
  await page.goto('http://demo-bank.example/login');
  await page.click('#pass');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(shots, 'browser-locked.png') });
  const p = await dropdownItemPoint('#pass', 0);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(1200);
  assert.equal(await page.inputValue('#pass'), '');
});

await ctx.close();
await app.close();
server.close();
process.stdout.write('\nbrowser autofill checks passed\n');
