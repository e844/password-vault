'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const M = require('../src/match');
const { startBridge, pipePath } = require('../src/bridge');
const { registerNativeHost, EXTENSION_ID } = require('../src/register-host');

const bank = { id: 'b', title: 'בנק', url: 'https://www.leumi.co.il/login', username: 'u', password: 'BankPass!' };
const google = { id: 'g', title: 'Gmail', url: 'https://accounts.google.com', username: 'g@example.com', password: 'G!' };
const entries = [bank, google, { id: 'w', title: 'Wi-Fi', url: '', username: '', password: 'x' }];

test('match: same site only, look-alikes rejected', () => {
  assert.equal(M.baseDomain('hb2.leumi.co.il'), 'leumi.co.il');
  assert.equal(M.baseDomain('accounts.google.com'), 'google.com');
  assert.deepEqual(M.matchesFor(entries, 'https://hb2.leumi.co.il/x').map((e) => e.id), ['b']);
  assert.deepEqual(M.matchesFor(entries, 'https://mail.google.com/').map((e) => e.id), ['g']);
  assert.deepEqual(M.matchesFor(entries, 'https://leumi.co.il.evil.com/'), []);
  assert.deepEqual(M.matchesFor(entries, 'https://g00gle.com/'), []);
  assert.deepEqual(M.matchesFor(entries, 'file:///C:/x.html'), []);
  assert.deepEqual(M.matchesFor(entries, 'chrome://settings'), []);
});

function frame(obj) {
  const j = Buffer.from(JSON.stringify(obj));
  const l = Buffer.alloc(4); l.writeUInt32LE(j.length);
  return Buffer.concat([l, j]);
}

/** מריץ את native-host.js כמו שהדפדפן מריץ אותו ושולח הודעה אחת. */
function viaHost(dir, msg, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(__dirname, '..', 'src', 'native-host.js')], {
      env: { ...process.env, PV_BRIDGE_DIR: dir, ...extraEnv }, stdio: ['pipe', 'pipe', 'inherit'],
    });
    let out = Buffer.alloc(0);
    p.stdout.on('data', (d) => { out = Buffer.concat([out, d]); });
    p.on('exit', () => {
      if (out.length < 4) { reject(new Error('no reply')); return; }
      resolve(JSON.parse(out.subarray(4, 4 + out.readUInt32LE(0)).toString()));
    });
    p.stdin.end(frame(msg));
  });
}

test('bridge + native host: query, fill, domain check, locked, not running', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-br-'));
  let vault = { entries };
  let focused = 0;
  const b = startBridge(dir, { getVault: () => vault, focusWindow: () => { focused++; } });
  await new Promise((r) => setTimeout(r, 100));

  const q = await viaHost(dir, { type: 'query', url: 'https://hb2.leumi.co.il/login' });
  assert.deepEqual(q, { ok: true, locked: false, matches: [{ id: 'b', title: 'בנק', username: 'u' }] });
  assert.equal(JSON.stringify(q).includes('BankPass'), false); // query לא מחזיר סיסמאות

  assert.deepEqual(await viaHost(dir, { type: 'fill', id: 'b', url: 'https://leumi.co.il/' }), { ok: true, username: 'u', password: 'BankPass!' });
  // אתר אחר מבקש את הסיסמה של הבנק – נדחה
  assert.deepEqual(await viaHost(dir, { type: 'fill', id: 'b', url: 'https://evil.example.com/' }), { ok: false, error: 'noMatch' });

  await viaHost(dir, { type: 'focus', url: 'https://x.com' });
  assert.equal(focused, 1);

  vault = null;
  assert.deepEqual(await viaHost(dir, { type: 'query', url: 'https://leumi.co.il' }), { ok: true, locked: true, matches: [] });
  assert.deepEqual(await viaHost(dir, { type: 'fill', id: 'b', url: 'https://leumi.co.il' }), { ok: false, locked: true });

  b.close();
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(await viaHost(dir, { type: 'query', url: 'https://leumi.co.il' }), { error: 'notRunning' });
});

test('bridge rejects connections without the secret token', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-br-'));
  const b = startBridge(dir, { getVault: () => ({ entries }), focusWindow: () => {} });
  await new Promise((r) => setTimeout(r, 100));
  const reply = await new Promise((resolve) => {
    const c = net.connect(pipePath(dir));
    let buf = '';
    c.on('connect', () => c.write(JSON.stringify({ type: 'fill', id: 'b', url: 'https://leumi.co.il', token: 'guess' }) + '\n'));
    c.on('data', (d) => { buf += d; });
    c.on('end', () => resolve(JSON.parse(buf)));
  });
  assert.deepEqual(reply, { error: 'forbidden' });
  b.close();
});

test('native host manifest points to the fixed extension id', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-nm-'));
  const extra = path.join(dir, 'NativeMessagingHosts');
  const { manifestPath, launcher } = registerNativeHost(dir, '/opt/fake/PasswordVault', [extra]);
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(m.name, 'com.demo.passwordvault');
  assert.deepEqual(m.allowed_origins, [`chrome-extension://${EXTENSION_ID}/`]);
  assert.equal(m.path, launcher);
  assert.ok(fs.existsSync(path.join(extra, 'com.demo.passwordvault.json')));
  assert.match(fs.readFileSync(launcher, 'utf8'), /ELECTRON_RUN_AS_NODE=1/);
  // מזהה התוסף נגזר מהמפתח הציבורי שב-manifest של התוסף
  const ext = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'browser-extension', 'manifest.json'), 'utf8'));
  const der = Buffer.from(ext.key, 'base64');
  const id = require('node:crypto').createHash('sha256').update(der).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, (c) => 'abcdefghijklmnop'[parseInt(c, 16)]);
  assert.equal(id, EXTENSION_ID);
});

test('update check: compares build numbers, only repo links allowed', () => {
  const U = require('../src/update');
  assert.equal(U.parseBuild('build-12'), 12);
  assert.equal(U.parseBuild('v1'), 0);
  const rel = {
    tag_name: 'build-9', name: 'גרסת בדיקה #9', html_url: 'https://github.com/e844/password-vault/releases/tag/build-9',
    assets: [{ name: 'PasswordVault-Windows.zip', browser_download_url: 'https://github.com/e844/password-vault/releases/download/build-9/PasswordVault-Windows.zip' }],
  };
  assert.deepEqual(
    [U.summarize(rel, 7).newer, U.summarize(rel, 9).newer, U.summarize(rel, 7).download],
    [true, false, rel.assets[0].browser_download_url],
  );
  const evil = { ...rel, html_url: 'https://evil.example/x', assets: [{ name: 'PasswordVault-Windows.zip', browser_download_url: 'https://evil.example/a.zip' }] };
  assert.equal(U.summarize(evil, 1).download, null);
  assert.equal(U.summarize(evil, 1).page, U.RELEASES_PAGE);
});

test('save from browser: new, same, update, locked, invalid', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pv-sv-'));
  const store = new (require('../src/vault').VaultStore)(path.join(dir, 'vault.bin'), { iterations: 1000 });
  let vault = await store.create(Buffer.from('pw-123456'), [{ ...bank }]);
  let changed = 0;
  const b = startBridge(dir, { getVault: () => vault, focusWindow: () => {}, onChanged: () => { changed++; } });
  await new Promise((r) => setTimeout(r, 100));
  const site = 'https://hb2.leumi.co.il/login';

  // בדיקה בלבד – לא שומרת
  assert.deepEqual(await viaHost(dir, { type: 'checkSave', url: site, username: 'u', password: 'BankPass!' }), { ok: true, state: 'same', id: 'b' });
  assert.deepEqual(await viaHost(dir, { type: 'checkSave', url: site, username: 'U', password: 'NewPass1' }), { ok: true, state: 'update', id: 'b' });
  assert.deepEqual(await viaHost(dir, { type: 'checkSave', url: site, username: 'other', password: 'x1' }), { ok: true, state: 'new' });
  assert.equal(vault.entries.length, 1);
  assert.equal(changed, 0);

  // שמירה (אחרי "שמור")
  assert.deepEqual(await viaHost(dir, { type: 'save', url: site, username: 'other', password: 'x1' }), { ok: true, action: 'added' });
  const added = vault.entries.find((e) => e.username === 'other');
  assert.deepEqual([added.title, added.url, added.password, added.category], ['hb2.leumi.co.il', 'https://hb2.leumi.co.il', 'x1', 'banking']);
  // עדכון (אחרי "עדכן")
  assert.deepEqual(await viaHost(dir, { type: 'save', url: site, username: 'u', password: 'NewPass1' }), { ok: true, action: 'updated' });
  assert.equal(vault.entries.find((e) => e.id === 'b').password, 'NewPass1');
  // זהה – לא משנה כלום
  assert.deepEqual(await viaHost(dir, { type: 'save', url: site, username: 'u', password: 'NewPass1' }), { ok: true, action: 'same' });
  assert.equal(changed, 2);
  // נשמר באמת בקובץ המוצפן
  const reopened = await store.unlock(Buffer.from('pw-123456'));
  assert.equal(reopened.entries.length, 2);

  // אתר אחר עם אותו שם משתמש – רשומה חדשה, לא עדכון של הבנק
  assert.deepEqual(await viaHost(dir, { type: 'checkSave', url: 'https://evil.example/', username: 'u', password: 'NewPass1' }), { ok: true, state: 'new' });
  // קלט לא תקין
  assert.deepEqual(await viaHost(dir, { type: 'save', url: 'file:///x', username: 'u', password: 'p' }), { error: 'bad' });
  assert.deepEqual(await viaHost(dir, { type: 'save', url: site, username: 'u', password: '' }), { error: 'bad' });

  // כספת נעולה: לא שומר, מבקש לפתוח
  const live = vault;
  vault = null;
  assert.deepEqual(await viaHost(dir, { type: 'checkSave', url: site, username: 'n', password: 'p2' }), { ok: true, state: 'locked' });
  assert.deepEqual(await viaHost(dir, { type: 'save', url: site, username: 'n', password: 'p2' }), { ok: false, locked: true });
  vault = live;
  assert.deepEqual(await viaHost(dir, { type: 'save', url: site, username: 'n', password: 'p2' }), { ok: true, action: 'added' });
  b.close();
});

test('browser-tab copy of the UI is up to date (run scripts/sync-extension-ui.js)', () => {
  const { build, dst } = require('../scripts/sync-extension-ui');
  for (const [name, content] of Object.entries(build())) {
    const lf = (t) => t.replace(/\r\n/g, '\n'); // ב-Windows git ממיר סופי שורות
    assert.equal(lf(fs.readFileSync(path.join(dst, name), 'utf8')), lf(content), `browser-extension/vault/${name} is stale`);
  }
  const html = fs.readFileSync(path.join(dst, 'index.html'), 'utf8');
  assert.ok(html.indexOf('vault-api.js') < html.indexOf('app.js'));
});
