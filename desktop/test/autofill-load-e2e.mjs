// בדיקה אמיתית של "מילוי אוטומטי בטעינת דף": Chromium (המנוע של Edge) + התוסף + התוכנה. נתוני דוגמה בלבד.
import { _electron as electron, chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
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

// תעודת https זמנית לאתרי הדמה
const certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-cert-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=demo-bank.example',
  '-keyout', path.join(certDir, 'k.pem'), '-out', path.join(certDir, 'c.pem')], { stdio: 'ignore' });

const page_ = (title, body) => `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:sans-serif;background:#f3f4f8;display:grid;place-items:center;height:100vh;margin:0}
form,.box{background:#fff;padding:28px;border-radius:16px;width:320px;box-shadow:0 2px 12px #0002}
input{display:block;width:100%;box-sizing:border-box;margin:6px 0 14px;padding:10px;font-size:15px;border:1px solid #bbb;border-radius:8px}
button{width:100%;padding:10px;font-size:15px;border:0;border-radius:8px;background:#1f5fbf;color:#fff}</style></head><body>${body}</body></html>`;
const FORM = `<form method="post" action="/welcome"><h2>כניסה (דף בדיקה)</h2>
<label>שם משתמש<input id="user" name="username" autocomplete="username"></label>
<label>סיסמה<input id="pass" type="password" name="password" autocomplete="current-password"></label>
<button id="go" type="submit">התחבר</button></form>`;
const LOGIN = page_('התחברות', FORM);
const LATE = page_('התחברות', `<div id="slot"></div><script>setTimeout(() => { document.getElementById('slot').innerHTML = ${JSON.stringify(FORM)}; }, 900);</script>`);
const WELCOME = page_('ברוך הבא', '<div class="box"><h2>נכנסת בהצלחה (דף בדיקה)</h2></div>');
let posts = 0;
const server = https.createServer({ key: fs.readFileSync(path.join(certDir, 'k.pem')), cert: fs.readFileSync(path.join(certDir, 'c.pem')) }, (req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  if (req.method === 'POST') { posts++; req.resume(); req.on('end', () => res.end(WELCOME)); return; }
  res.end(req.url.startsWith('/late') ? LATE : LOGIN);
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
  ignoreHTTPSErrors: true,
  viewport: { width: 1000, height: 680 },
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`, '--ignore-certificate-errors', '--no-proxy-server',
    `--host-resolver-rules=MAP demo-bank.example 127.0.0.1:${port}, MAP login.demo-bank.example 127.0.0.1:${port}, MAP demo-shop.example 127.0.0.1:${port}`, '--no-sandbox'],
});
let sw = ctx.serviceWorkers()[0];
if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
const extId = new URL(sw.url()).host;
const page = await ctx.newPage();

const BANK = 'https://demo-bank.example';
const values = () => page.evaluate(() => [document.querySelector('#user')?.value, document.querySelector('#pass')?.value]);
const open = async (url) => { await page.goto(url); await page.waitForSelector('#pass'); };
const settingsFile = () => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8'));

await step('switch is off by default → page is not filled', async () => {
  await open(`${BANK}/login`);
  await page.waitForTimeout(2500);
  assert.deepEqual(await values(), ['', '']);
});

await step('turn the switch on in the extension window (saved in the app, not in the extension)', async () => {
  const pop = await ctx.newPage();
  await pop.setViewportSize({ width: 360, height: 420 });
  await pop.goto(`chrome-extension://${extId}/popup.html`);
  await pop.waitForSelector('#auto-row:not([hidden])');
  assert.equal(await pop.isChecked('#auto'), false);
  await pop.click('#auto-row');
  await pop.waitForFunction(() => document.querySelector('#auto').checked);
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(settingsFile().autofillOnLoad, true);
  await pop.screenshot({ path: path.join(shots, 'autofill-0-switch.png') });
  await pop.close();
});

await step('one exact account → username + password filled on load, NOT submitted', async () => {
  const before = posts;
  await open(`${BANK}/login`);
  await page.waitForFunction(() => document.querySelector('#pass').value.length > 0, null, { timeout: 8000 });
  const [u, p] = await values();
  assert.equal(u, 'demo-user-1234');
  assert.ok(p.length >= 12);
  await page.waitForTimeout(1500);
  assert.equal(posts, before, 'the form must not be submitted');
  assert.match(page.url(), /\/login$/);
  await page.screenshot({ path: path.join(shots, 'autofill-1-filled.png') });
});

await step('form that appears after load (dynamic site) → filled too', async () => {
  await open(`${BANK}/late`);
  await page.waitForFunction(() => document.querySelector('#pass').value.length > 0, null, { timeout: 8000 });
  assert.equal((await values())[0], 'demo-user-1234');
});

await step('other subdomain (not an exact match) → not filled', async () => {
  await open('https://login.demo-bank.example/login');
  await page.waitForTimeout(2500);
  assert.deepEqual(await values(), ['', '']);
});

await step('another site → only its own account is filled', async () => {
  await open('https://demo-shop.example/login');
  await page.waitForFunction(() => document.querySelector('#pass').value.length > 0, null, { timeout: 8000 });
  assert.equal((await values())[0], 'shopper@example.com');
});

await step('locked vault → nothing filled', async () => {
  await win.click('#lock-btn');
  await win.waitForSelector('#lock-view:not([hidden])');
  await open(`${BANK}/login`);
  await page.waitForTimeout(2500);
  assert.deepEqual(await values(), ['', '']);
  await win.fill('#master', MASTER);
  await win.click('#lock-submit');
  await win.waitForSelector('#main-view:not([hidden])');
});

await step('two accounts for the site → chooser shown, nothing filled until I pick one', async () => {
  // חשבון שני לאותו אתר – דרך ההצעה "לשמור בכספת?"
  await open(`${BANK}/login`);
  await page.waitForFunction(() => document.querySelector('#pass').value.length > 0, null, { timeout: 8000 });
  await page.fill('#user', 'second@example.com');
  await page.fill('#pass', 'Dummy-Pass-777');
  await Promise.all([page.waitForURL('**/welcome'), page.click('#go')]);
  await page.locator('[data-pv-prompt="save"]').waitFor({ state: 'attached', timeout: 8000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-pv-prompt]')?.getAttribute('data-pv-prompt') === 'done');
  await countIs(9);

  const before = posts;
  await open(`${BANK}/login`);
  const chooser = page.locator('[data-pv-list="choose"]');
  await chooser.waitFor({ state: 'attached', timeout: 8000 });
  await page.waitForTimeout(600);
  assert.deepEqual(await values(), ['', '']);
  await page.screenshot({ path: path.join(shots, 'autofill-2-choose.png') });
  // הכרטיס: כותרת, "בחר חשבון", ושתי רשומות. לוחצים על הרשומה האחרונה (מהתוסף, לא מהדף)
  const box = await chooser.boundingBox();
  assert.ok(box && box.height > 100, `chooser too small: ${JSON.stringify(box)}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 30);
  await page.waitForFunction(() => document.querySelector('#pass').value.length > 0, null, { timeout: 5000 });
  const [u] = await values();
  assert.ok(['demo-user-1234', 'second@example.com'].includes(u), u);
  assert.equal(await chooser.count(), 0);
  await page.waitForTimeout(1000);
  assert.equal(posts, before, 'the form must not be submitted');
  await page.screenshot({ path: path.join(shots, 'autofill-3-picked.png') });
});

await ctx.close();
await app.close();
server.close();
process.stdout.write('\nautofill-on-load checks passed\n');
