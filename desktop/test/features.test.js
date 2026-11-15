'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const V = require('../src/vault');
const L = require('../src/logic');
const C = require('../src/csv');

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pv-f-'));
const pw = (s) => Buffer.from(s, 'utf8');
const store = (dir) => new V.VaultStore(path.join(dir, 'vault.bin'), { iterations: 1000 });
const sample = [
  { id: 'a', title: 'מייל', username: 'a@example.com', password: 'S3cret!', url: 'https://example.com', notes: '', category: 'email', updatedAt: 1 },
  { id: 'b', title: 'Bank', username: 'u', password: 'p@ss', url: '', notes: 'n', category: 'banking', updatedAt: 2 },
];

test('unknown category falls back to general', async () => {
  const d = tmpDir();
  await store(d).create(pw('pw-123456'), [{ id: 'x', title: 't', category: 'nope' }, { id: 'y', title: 'u' }]);
  const e = (await store(d).unlock(pw('pw-123456'))).entries;
  assert.deepEqual(e.map((x) => x.category), ['general', 'general']);
});

test('guess category', () => {
  assert.equal(L.guessCategory('Leumi', 'https://www.leumi.co.il'), 'banking');
  assert.equal(L.guessCategory('', 'https://accounts.google.com/gmail'), 'email');
  assert.equal(L.guessCategory('Facebook', ''), 'social');
  assert.equal(L.guessCategory('Netflix', 'netflix.com'), 'entertainment');
  assert.equal(L.guessCategory('משהו', 'https://example.org'), 'general');
});

test('csv: parse quotes, commas, newlines, BOM, CRLF', () => {
  const text = '﻿' + 'a,b,c\r\n' + '"x, y","he said ""hi""","line1\nline2"\r\n';
  assert.deepEqual(C.parseCsv(text), [['a', 'b', 'c'], ['x, y', 'he said "hi"', 'line1\nline2']]);
});

test('csv: export then import keeps tricky values exactly', () => {
  const tricky = [
    { title: 'א, ב', url: 'https://a.example.com', username: 'u"1', password: '=SUM(1)', notes: 'שורה\nשנייה', category: 'work' },
    { title: 'b', url: '', username: 'x', password: '-start,with"quote', notes: '', category: 'general' },
  ];
  const { entries, skipped } = C.entriesFromCsv(C.toCsv(tricky));
  assert.equal(skipped, 0);
  assert.deepEqual(entries, tricky);
});

test('csv: import Chrome, Firefox and Bitwarden formats', () => {
  const chrome = 'name,url,username,password,note\nmy bank,https://www.leumi.co.il/,me,p1,\n';
  assert.deepEqual(C.entriesFromCsv(chrome).entries[0],
    { title: 'my bank', url: 'https://www.leumi.co.il/', username: 'me', password: 'p1', notes: '', category: 'banking' });

  const firefox = '"url","username","password","httpRealm","formActionOrigin","guid","timeCreated","timeLastUsed","timePasswordChanged"\n'
    + '"https://www.facebook.com","fb@example.com","p2",,"https://www.facebook.com","{x}","1","1","1"\n';
  const f = C.entriesFromCsv(firefox).entries[0];
  assert.deepEqual([f.title, f.password, f.category], ['facebook.com', 'p2', 'social']);

  const bw = 'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\n'
    + 'work,,login,Jira,n,,,https://jira.example.com,dev,p3,\n';
  const b = C.entriesFromCsv(bw).entries[0];
  assert.deepEqual([b.title, b.url, b.username, b.password, b.notes, b.category], ['Jira', 'https://jira.example.com', 'dev', 'p3', 'n', 'work']);

  assert.throws(() => C.entriesFromCsv('foo,bar\n1,2\n'));
});

test('import skips duplicates', () => {
  const cur = [{ id: '1', title: 'a', url: 'https://x.com', username: 'u', password: 'p', notes: '', category: 'general', updatedAt: 1 }];
  const r = V.importEntries(cur, [
    { title: 'a2', url: 'https://X.com', username: 'u', password: 'p' },
    { title: 'b', username: 'u2', password: 'q' },
    { title: 'b', username: 'u2', password: 'q' },
  ]);
  assert.equal(r.added, 1);
  assert.equal(r.duplicates, 2);
  assert.equal(r.entries.length, 2);
});

test('merge from backup: add new, update only if newer', () => {
  const base = { username: '', password: '', url: '', notes: '', category: 'general' };
  const cur = [{ ...base, id: '1', title: 'old', updatedAt: 10 }, { ...base, id: '2', title: 'keep', updatedAt: 50 }];
  const inc = [{ id: '1', title: 'newer', updatedAt: 20 }, { id: '2', title: 'older', updatedAt: 5 }, { id: '3', title: 'new', updatedAt: 1 }];
  const r = V.mergeEntries(cur, inc);
  assert.equal(r.added, 1);
  assert.equal(r.updated, 1);
  assert.deepEqual(r.entries.map((e) => e.title).sort(), ['keep', 'new', 'newer']);
});

test('backup file restores with its own password only', async () => {
  const d = tmpDir();
  const s = await store(d).create(pw('backup-pass-1'), sample);
  const backup = path.join(d, 'copy.pvault');
  fs.copyFileSync(path.join(d, 'vault.bin'), backup);
  assert.deepEqual(await V.readBackup(backup, pw('backup-pass-1')), sample);
  await assert.rejects(V.readBackup(backup, pw('nope')), V.WrongPasswordError);
  s.lock();
});

test('change master password', async () => {
  const d = tmpDir();
  const s = await store(d).create(pw('old-password'), sample);
  const oldKey = s._key;
  await s.changePassword(pw('new-password-2'));
  assert.ok(oldKey.every((b) => b === 0));
  await assert.rejects(store(d).unlock(pw('old-password')), V.WrongPasswordError);
  assert.deepEqual((await store(d).unlock(pw('new-password-2'))).entries, sample);
  s.save(s.entries);
  assert.deepEqual((await store(d).unlock(pw('new-password-2'))).entries, sample);
});

test('vault payload is the shared JSON format (same as Android)', async () => {
  // הפורמט המשותף: {"v":1,"entries":[...]} מוצפן ב-AES-GCM. בדיקה שהמבנה לא השתנה בטעות.
  const crypto = require('node:crypto');
  const d = tmpDir();
  await store(d).create(pw('pw-123456'), sample);
  const raw = fs.readFileSync(path.join(d, 'vault.bin'));
  const salt = raw.subarray(9, 25);
  const iv = raw.subarray(25, 37);
  const key = crypto.pbkdf2Sync('pw-123456', salt, raw.readUInt32BE(5), 32, 'sha256');
  const dc = crypto.createDecipheriv('aes-256-gcm', key, iv);
  dc.setAAD(raw.subarray(0, 37));
  dc.setAuthTag(raw.subarray(raw.length - 16));
  const json = JSON.parse(Buffer.concat([dc.update(raw.subarray(37, raw.length - 16)), dc.final()]).toString('utf8'));
  assert.equal(json.v, 1);
  assert.deepEqual(Object.keys(json.entries[0]).sort(), ['category', 'id', 'notes', 'password', 'title', 'updatedAt', 'url', 'username']);
});

test('auto-lock settings: default 15 minutes, saved, invalid values ignored', () => {
  const S = require('../src/settings');
  const d = tmpDir();
  assert.deepEqual(S.load(d), { autoLockMinutes: 15 });
  S.save(d, { autoLockMinutes: 60 });
  assert.equal(S.load(d).autoLockMinutes, 60);
  S.save(d, { autoLockMinutes: 7 });
  assert.equal(S.load(d).autoLockMinutes, 15);
  fs.writeFileSync(path.join(d, 'settings.json'), 'garbage');
  assert.equal(S.load(d).autoLockMinutes, 15);
  assert.equal(S.minutesToMs(0), Infinity);
  const p = new L.AutoLockPolicy({ inactivityMs: Infinity, backgroundGraceMs: Infinity });
  p.onUnlocked(0); p.onBackground(1);
  assert.equal(p.shouldLock(10 ** 12), false); // "רק בנעילת המחשב"
  assert.equal(new L.AutoLockPolicy().inactivityMs, 15 * 60_000);
});
