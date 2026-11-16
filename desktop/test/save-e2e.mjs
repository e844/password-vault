// בדיקה אמיתית של "לשמור בכספת?" בדפדפן: Chromium (המנוע של Edge) + התוסף + התוכנה. פרטי דמה בלבד.
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

const page_ = (title, body) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:sans-serif;background:#f3f4f8;display:grid;place-items:center;height:100vh;margin:0}
form,.box{background:#fff;padding:28px;border-radius:16px;width:320px;box-shadow:0 2px 12px #0002}
input{display:block;width:100%;box-sizing:border-box;margin:6px 0 14px;padding:10px;font-size:15px;border:1px solid #bbb;border-radius:8px}
button{width:100%;padding:10px;font-size:15px;border:0;border-radius:8px;background:#1f5fbf;color:#fff}</style></head><body>${body}</body></html>`;
const LOGIN = page_('התחברות', `<form method="post" action="/welcome"><h2>כניסה (דף בדיקה)</h2>
<label>שם משתמש<input id="user" name="username" autocomplete="username"></label>
<label>סיסמה<input id="pass" type="password" name="password" autocomplete="current-password"></label>
<button id="go" type="submit">כניסה</button></form>`);
const SIGNUP = page_('הרשמה', `<form method="post" action="/welcome"><h2>הרשמה (דף בדיקה)</h2>
<label>אימייל<input id="email" type="email" name="email"></label>
<label>סיסמה<input id="p1" type="password" name="p1" autocomplete="new-password"></label>
<label>אימות סיסמה<input id="p2" type="password" name="p2" autocomplete="new-password"></label>
<button id="go" type="submit">הרשמה</button></form>`);
const WELCOME = page_('ברוך הבא', '<div class="box"><h2>נכנסת בהצלחה (דף בדיקה)</h2></div>');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  if (req.method === 'POST') { req.resume(); req.on('end', () => res.end(WELCOME)); return; }
  res.end(req.url.startsWith('/signup') ? SIGNUP : LOGIN);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const app = await electron.launch({ args: ['--no-sandbox', root], env: { ...process.env, PV_USER_DATA: userData, PV_TEST_NM_DIR: nmDirs.join(path.delimiter) } });
const win = await app.firstWindow();
await win.waitForSelector('#lock-view:not([hidden])');
await win.fill('#master', MASTER);
await win.fill('#confirm', MASTER);
await win.click('#lock-submit');
await win.waitForSelector('#main-view:not([hidden])');
const countIs = (n) => win.waitForFunction((x) => document.querySelector('#count').textContent === `${x} רשומות`, n, { timeout: 10000 });
await countIs(8);

const ctx = await chromium.launchPersistentContext(chromeData, {
  executablePath: process.env.PV_CHROME || undefined,
  headless: false,
  viewport: { width: 1000, height: 680 },
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`,
    `--host-resolver-rules=MAP demo-bank.example 127.0.0.1:${port}, MAP shop-test.example 127.0.0.1:${port}`, '--no-sandbox'],
});
let sw = ctx.serviceWorkers()[0];
if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
const page = await ctx.newPage();

async function login(user, pass) {
  await page.goto('http://demo-bank.example/login');
  await page.fill('#user', user);
  await page.fill('#pass', pass);
  await Promise.all([page.waitForURL('**/welcome'), page.click('#go')]);
}
const prompt = () => page.locator('[data-pv-prompt]');
const promptState = async (timeout = 8000) => { await prompt().waitFor({ state: 'attached', timeout }); return prompt().getAttribute('data-pv-prompt'); };

await step('new login → "לשמור בכספת?" → שמור → saved in vault', async () => {
  await login('tester@example.com', 'Dummy-Pass-111');
  assert.equal(await promptState(), 'save');
  await page.screenshot({ path: path.join(shots, 'save-1-prompt.png') });
  // במצב רגיל רואים רק "שמור" ו"לא עכשיו" (כפתור "פתח את התוכנה" מופיע רק כשהכספת נעולה)
  const box = await prompt().boundingBox();
  assert.ok(box.height < 150, `prompt too tall: ${box.height}`);
  await page.keyboard.press('Enter'); // "שמור" מקבל פוקוס
  await page.waitForFunction(() => document.querySelector('[data-pv-prompt]')?.getAttribute('data-pv-prompt') === 'done');
  await page.screenshot({ path: path.join(shots, 'save-2-saved.png') });
  await countIs(9);
});

await step('same credentials again → no prompt', async () => {
  await login('tester@example.com', 'Dummy-Pass-111');
  await page.waitForTimeout(3500);
  assert.equal(await prompt().count(), 0);
});

await step('same user, new password → "לעדכן?" → עדכן → password updated', async () => {
  await login('tester@example.com', 'Dummy-Pass-222');
  assert.equal(await promptState(), 'update');
  await page.screenshot({ path: path.join(shots, 'save-3-update.png') });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-pv-prompt]')?.getAttribute('data-pv-prompt') === 'done');
  await countIs(9);
  await win.fill('#search', 'tester');
  await win.waitForFunction(() => document.querySelectorAll('#entries .entry').length === 1);
  await win.click('#entries .entry >> nth=0', { force: true });
  await win.click('#reveal', { force: true });
  await win.waitForFunction(() => document.querySelector('#f-password .value').textContent === 'Dummy-Pass-222');
  await win.fill('#search', '');
});

await step('"לא עכשיו" → nothing saved, prompt does not come back', async () => {
  await login('other@example.com', 'Dummy-Pass-333');
  assert.equal(await promptState(), 'save');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  assert.equal(await prompt().count(), 0);
  await page.reload();
  await page.waitForTimeout(3500);
  assert.equal(await prompt().count(), 0);
  await countIs(9);
});

await step('locked vault → asks to unlock → after unlocking, שמור works', async () => {
  await win.click('#lock-btn');
  await win.waitForSelector('#lock-view:not([hidden])');
  await login('locked@example.com', 'Dummy-Pass-444');
  assert.equal(await promptState(), 'save');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-pv-prompt]')?.getAttribute('data-pv-prompt') === 'locked');
  await page.screenshot({ path: path.join(shots, 'save-4-locked.png') });
  await win.fill('#master', MASTER);
  await win.click('#lock-submit');
  await win.waitForSelector('#main-view:not([hidden])');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-pv-prompt]')?.getAttribute('data-pv-prompt') === 'done');
  await countIs(10);
});

await step('signup form (password + confirm) → prompt to save', async () => {
  await page.goto('http://shop-test.example/signup');
  await page.fill('#email', 'new-shopper@example.com');
  await page.fill('#p1', 'Dummy-Pass-555');
  await page.fill('#p2', 'Dummy-Pass-555');
  await Promise.all([page.waitForURL('**/welcome'), page.click('#go')]);
  assert.equal(await promptState(), 'save');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-pv-prompt]')?.getAttribute('data-pv-prompt') === 'done');
  await countIs(11);
});

await step('extension cannot store passwords (no storage permission at all)', async () => {
  assert.equal(await sw.evaluate(() => typeof chrome.storage), 'undefined');
  const manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.permissions.sort(), ['activeTab', 'nativeMessaging']);
  const code = ['background.js', 'content.js', 'popup.js'].map((f) => fs.readFileSync(path.join(extDir, f), 'utf8')).join('\n');
  assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|chrome\.storage|console\./);
});

await ctx.close();
await app.close();
server.close();
process.stdout.write('\nsave-prompt checks passed\n');
