'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const V = require('../src/vault');
const L = require('../src/logic');

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pv-'));
const pw = (s) => Buffer.from(s, 'utf8');
const store = (dir) => new V.VaultStore(path.join(dir, 'vault.bin'), { iterations: 1000 });
const sample = [
  { id: 'a', title: 'דוגמה – מייל', username: 'a@example.com', password: 'S3cret!pass', url: 'https://example.com', notes: 'הערה', category: 'email', updatedAt: 1 },
  { id: 'b', title: 'Bank demo', username: 'user', password: 'p@ss-אבג', url: '', notes: '', category: 'banking', updatedAt: 2 },
];

test('create then unlock round-trip', async () => {
  const d = tmpDir();
  await store(d).create(pw('master-סיסמה'), sample);
  const s = await store(d).unlock(pw('master-סיסמה'));
  assert.deepEqual(s.entries, sample);
});

test('wrong password rejected', async () => {
  const d = tmpDir();
  await store(d).create(pw('correct horse'), sample);
  await assert.rejects(store(d).unlock(pw('wrong horse')), V.WrongPasswordError);
});

test('file has no plaintext and no master password; no extra files', async () => {
  const d = tmpDir();
  await store(d).create(pw('MyMasterPassword123'), sample);
  const raw = fs.readFileSync(path.join(d, 'vault.bin'));
  for (const needle of ['MyMasterPassword123', 'S3cret!pass', 'a@example.com', 'Bank demo', 'example.com', 'דוגמה']) {
    assert.equal(raw.includes(Buffer.from(needle, 'utf8')), false, needle);
    assert.equal(raw.includes(Buffer.from(needle, 'latin1')), false, needle);
  }
  assert.deepEqual(fs.readdirSync(d), ['vault.bin']);
});

test('tampering detected', async () => {
  const d = tmpDir();
  await store(d).create(pw('pw-123456'), sample);
  const f = path.join(d, 'vault.bin');
  const b = fs.readFileSync(f);
  b[b.length - 20] ^= 1;
  fs.writeFileSync(f, b);
  await assert.rejects(store(d).unlock(pw('pw-123456')), V.WrongPasswordError);
});

test('garbage file is corrupt', async () => {
  const d = tmpDir();
  fs.writeFileSync(path.join(d, 'vault.bin'), Buffer.alloc(100, 7));
  await assert.rejects(store(d).unlock(pw('x')), V.CorruptVaultError);
});

test('fresh IV on each save', async () => {
  const d = tmpDir();
  const s = await store(d).create(pw('pw-123456'), sample);
  const a = fs.readFileSync(path.join(d, 'vault.bin'));
  s.save(s.entries);
  const b = fs.readFileSync(path.join(d, 'vault.bin'));
  assert.notDeepEqual(a, b);
});

test('add / edit / delete persist', async () => {
  const d = tmpDir();
  const s = await store(d).create(pw('pw-123456'), sample);
  let list = V.addEntry(s.entries, { title: 'חדש', password: 'n3w' }, 10);
  const added = list.at(-1);
  s.save(list);
  s.save(V.updateEntry(s.entries, { ...added, username: 'edited' }, 42));
  s.save(V.deleteEntry(s.entries, 'a'));
  const re = (await store(d).unlock(pw('pw-123456'))).entries;
  assert.equal(re.length, 2);
  const e = re.find((x) => x.id === added.id);
  assert.equal(e.username, 'edited');
  assert.equal(e.updatedAt, 42);
  assert.ok(!re.some((x) => x.id === 'a'));
});

test('validation of ops', () => {
  assert.throws(() => V.addEntry(sample, { title: '  ' }));
  assert.throws(() => V.addEntry(sample, { id: 'a', title: 'dup' }));
  assert.throws(() => V.updateEntry(sample, { id: 'zzz', title: 'x' }));
  assert.equal(V.deleteEntry(sample, 'missing').length, 2);
});

test('lock wipes key and blocks saving', async () => {
  const d = tmpDir();
  const s = await store(d).create(pw('pw-123456'), sample);
  const key = s._key;
  s.lock();
  assert.ok(key.every((b) => b === 0));
  assert.deepEqual(s.entries, []);
  assert.throws(() => s.save(sample));
});

test('password buffer wiped after use', async () => {
  const d = tmpDir();
  const b1 = pw('pw-123456');
  await store(d).create(b1, sample);
  assert.ok(b1.every((x) => x === 0));
  const b2 = pw('pw-123456');
  await store(d).unlock(b2);
  assert.ok(b2.every((x) => x === 0));
});

test('default 600k iterations works', async () => {
  const d = tmpDir();
  const s = new V.VaultStore(path.join(d, 'real.bin'));
  await s.create(pw('real-master'), sample);
  assert.deepEqual((await s.unlock(pw('real-master'))).entries, sample);
  assert.equal(fs.readFileSync(path.join(d, 'real.bin')).readUInt32BE(5), 600_000);
});

test('search: fields, never password, sorted', () => {
  const list = [
    { id: '1', title: 'דואר', username: 'dana@example.com', url: 'https://mail.example.com', notes: '', password: '' },
    { id: '2', title: 'Bank', username: 'user1', url: '', notes: 'סניף ראשי', password: 'findme' },
    { id: '3', title: 'alpha', username: 'x', url: '', notes: '', password: '' },
  ];
  assert.deepEqual(V.searchEntries(list, 'דוא').map((e) => e.id), ['1']);
  assert.deepEqual(V.searchEntries(list, 'DANA').map((e) => e.id), ['1']);
  assert.deepEqual(V.searchEntries(list, 'סניף').map((e) => e.id), ['2']);
  assert.deepEqual(V.searchEntries(list, 'findme'), []);
  assert.equal(V.searchEntries(list, '').length, 3);
});

test('summary has no password', () => {
  const s = V.summary(sample[0]);
  assert.equal('password' in s, false);
  assert.equal(JSON.stringify(s).includes('S3cret'), false);
  assert.equal(s.hasPassword, true);
});

test('generator: length and classes', () => {
  for (let i = 0; i < 200; i++) {
    const p = L.generatePassword({ length: 20 });
    assert.equal(p.length, 20);
    assert.match(p, /[a-z]/); assert.match(p, /[A-Z]/); assert.match(p, /[0-9]/); assert.match(p, /[^A-Za-z0-9]/);
  }
  assert.match(L.generatePassword({ length: 12, lowercase: false, uppercase: false, symbols: false }), /^[0-9]{12}$/);
  for (let i = 0; i < 100; i++) assert.doesNotMatch(L.generatePassword({ length: 64, symbols: false, avoidAmbiguous: true }), /[Il1O0o]/);
});

test('generator: uniqueness and invalid options', () => {
  const set = new Set();
  for (let i = 0; i < 1000; i++) set.add(L.generatePassword());
  assert.equal(set.size, 1000);
  assert.throws(() => L.generatePassword({ length: 7 }));
  assert.throws(() => L.generatePassword({ length: 65 }));
  assert.throws(() => L.generatePassword({ lowercase: false, uppercase: false, digits: false, symbols: false }));
});

test('strength', () => {
  assert.equal(L.strengthOf(''), 'weak');
  assert.equal(L.strengthOf('abcdef'), 'weak');
  assert.equal(L.strengthOf('Abcdef123456'), 'medium');
  assert.equal(L.strengthOf(L.generatePassword({ length: 16 })), 'strong');
});

test('auto-lock policy', () => {
  const p = new L.AutoLockPolicy({ inactivityMs: 1000, backgroundGraceMs: 500 });
  p.onUnlocked(0);
  assert.equal(p.shouldLock(999), false);
  assert.equal(p.shouldLock(1000), true);
  p.onInteraction(900);
  assert.equal(p.shouldLock(1899), false);
  p.onBackground(1000);
  assert.equal(p.shouldLock(1499), false);
  assert.equal(p.shouldLock(1500), true);
  const q = new L.AutoLockPolicy({ inactivityMs: 10_000, backgroundGraceMs: 500 });
  q.onUnlocked(0); q.onBackground(100);
  assert.equal(q.onForeground(300), false);
  assert.equal(q.shouldLock(5000), false);
});

test('unlock throttle', () => {
  const t = new L.UnlockThrottle({ freeAttempts: 3, baseDelayMs: 1000, maxDelayMs: 3000 });
  t.onFailure(0); t.onFailure(0);
  assert.equal(t.remainingMs(0), 0);
  t.onFailure(0); assert.equal(t.remainingMs(0), 1000);
  t.onFailure(1000); assert.equal(t.remainingMs(1000), 2000);
  t.onFailure(3000); assert.equal(t.remainingMs(3000), 3000);
  t.onSuccess(); assert.equal(t.remainingMs(3000), 0);
});

test('sample data is fake', () => {
  const s = L.sampleEntries();
  assert.equal(s.length, 7);
  assert.ok(s.every((e) => e.title.startsWith('דוגמה')));
  assert.ok(s.every((e) => L.CATEGORY_KEYS.includes(e.category)));
  assert.ok(s.every((e) => !e.url || e.url.includes('example.com')));
});

test('no logging / printing in app source', () => {
  const dirs = ['src', 'renderer'].map((d) => path.join(__dirname, '..', d));
  const files = dirs.flatMap((d) => fs.readdirSync(d).filter((f) => /\.(js|mjs|html)$/.test(f)).map((f) => path.join(d, f)));
  assert.ok(files.length >= 5, 'expected source files');
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(t, /console\.|process\.(stdout|stderr)|\bdebugger\b|appendFile|createWriteStream/, f);
  }
});

test('security settings present in main process', () => {
  const m = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
  for (const s of ['contextIsolation: true', 'nodeIntegration: false', 'sandbox: true', 'setContentProtection(true)', 'onBeforeRequest', 'setWindowOpenHandler']) {
    assert.ok(m.includes(s), s);
  }
  const html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /dir="rtl"/);
});
