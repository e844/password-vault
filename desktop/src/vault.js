'use strict';
/**
 * קובץ הכספת המוצפן.
 * ההצפנה משתמשת רק במודול ההצפנה המובנה של Node (OpenSSL) – אין מימוש הצפנה עצמי:
 *  - PBKDF2-HMAC-SHA256 (600,000 חזרות) לגזירת מפתח מסיסמת המאסטר
 *  - AES-256-GCM להצפנה מאומתת
 * מבנה הקובץ: MAGIC(4) | גרסה(1) | חזרות(4) | מלח(16) | IV(12) | מוצפן | תג(16)
 * סיסמת המאסטר לא נשמרת בשום מקום, גם לא hash שלה.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MAGIC = Buffer.from('PVLT', 'ascii');
const FILE_VERSION = 1;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const DEFAULT_ITERATIONS = 600_000;
const HEADER_LENGTH = MAGIC.length + 1 + 4 + SALT_LENGTH + IV_LENGTH;

class WrongPasswordError extends Error { constructor() { super('wrong master password'); } }
class CorruptVaultError extends Error {}

function deriveKey(passwordBuf, salt, iterations) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(passwordBuf, salt, iterations, 32, 'sha256', (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function encode(entries) {
  return Buffer.from(JSON.stringify({ v: 1, entries }), 'utf8');
}

function decode(buf) {
  let obj;
  try { obj = JSON.parse(buf.toString('utf8')); } catch { throw new CorruptVaultError('bad content'); }
  if (!obj || obj.v !== 1 || !Array.isArray(obj.entries)) throw new CorruptVaultError('bad content');
  return obj.entries.map(normalizeEntry);
}

function normalizeEntry(e) {
  const s = (x) => (typeof x === 'string' ? x : '');
  return {
    id: s(e.id) || crypto.randomUUID(),
    title: s(e.title),
    username: s(e.username),
    password: s(e.password),
    url: s(e.url),
    notes: s(e.notes),
    updatedAt: Number.isFinite(e.updatedAt) ? e.updatedAt : Date.now(),
  };
}

class VaultStore {
  constructor(file, { iterations = DEFAULT_ITERATIONS } = {}) {
    this.file = file;
    this.iterations = iterations;
  }

  exists() { return fs.existsSync(this.file); }

  /** passwordBuf (Buffer) מאופס בסיום. */
  async create(passwordBuf, entries) {
    try {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const key = await deriveKey(passwordBuf, salt, this.iterations);
      const session = new VaultSession(this, key, salt, this.iterations, []);
      session.save(entries.map(normalizeEntry));
      return session;
    } finally {
      passwordBuf.fill(0);
    }
  }

  /** passwordBuf (Buffer) מאופס בסיום. */
  async unlock(passwordBuf) {
    try {
      const data = fs.readFileSync(this.file);
      if (data.length < HEADER_LENGTH + TAG_LENGTH) throw new CorruptVaultError('file too short');
      if (!data.subarray(0, 4).equals(MAGIC)) throw new CorruptVaultError('bad magic');
      if (data[4] !== FILE_VERSION) throw new CorruptVaultError('unsupported version');
      const iterations = data.readUInt32BE(5);
      if (iterations < 1 || iterations > 10_000_000) throw new CorruptVaultError('bad iterations');
      const salt = Buffer.from(data.subarray(9, 9 + SALT_LENGTH));
      const iv = data.subarray(9 + SALT_LENGTH, HEADER_LENGTH);
      const header = data.subarray(0, HEADER_LENGTH);
      const ciphertext = data.subarray(HEADER_LENGTH, data.length - TAG_LENGTH);
      const tag = data.subarray(data.length - TAG_LENGTH);

      const key = await deriveKey(passwordBuf, salt, iterations);
      let plain;
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
        decipher.setAAD(header);
        decipher.setAuthTag(tag);
        plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } catch {
        key.fill(0);
        throw new WrongPasswordError();
      }
      try {
        return new VaultSession(this, key, salt, iterations, decode(plain));
      } finally {
        plain.fill(0);
      }
    } finally {
      passwordBuf.fill(0);
    }
  }

  _write(key, salt, iterations, entries) {
    const iv = crypto.randomBytes(IV_LENGTH); // IV חדש בכל שמירה
    const header = Buffer.alloc(HEADER_LENGTH);
    MAGIC.copy(header, 0);
    header[4] = FILE_VERSION;
    header.writeUInt32BE(iterations, 5);
    salt.copy(header, 9);
    iv.copy(header, 9 + SALT_LENGTH);

    const plain = encode(entries);
    let ciphertext;
    let tag;
    try {
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
      cipher.setAAD(header);
      ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
      tag = cipher.getAuthTag();
    } finally {
      plain.fill(0);
    }
    // כתיבה אטומית: קובץ זמני ואז החלפה
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, Buffer.concat([header, ciphertext, tag]));
    try {
      fs.renameSync(tmp, this.file);
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      throw e;
    }
  }
}

class VaultSession {
  constructor(store, key, salt, iterations, entries) {
    this._store = store;
    this._key = key;
    this._salt = salt;
    this._iterations = iterations;
    this.entries = entries;
    this.locked = false;
  }

  save(newEntries) {
    if (this.locked) throw new Error('vault is locked');
    this._store._write(this._key, this._salt, this._iterations, newEntries);
    this.entries = newEntries;
  }

  lock() {
    this._key.fill(0);
    this.entries = [];
    this.locked = true;
  }
}

// ---------- פעולות על רשימת הרשומות ----------
function addEntry(entries, entry, now = Date.now()) {
  const e = normalizeEntry({ ...entry, id: entry.id || crypto.randomUUID(), updatedAt: now });
  if (!e.title.trim()) throw new Error('title is required');
  if (entries.some((x) => x.id === e.id)) throw new Error('duplicate id');
  return [...entries, e];
}

function updateEntry(entries, entry, now = Date.now()) {
  const e = normalizeEntry({ ...entry, updatedAt: now });
  if (!e.title.trim()) throw new Error('title is required');
  if (!entries.some((x) => x.id === e.id)) throw new Error('entry not found');
  return entries.map((x) => (x.id === e.id ? e : x));
}

function deleteEntry(entries, id) {
  return entries.filter((x) => x.id !== id);
}

/** חיפוש בשם, שם משתמש, כתובת והערות – לעולם לא בסיסמה. */
function searchEntries(entries, query) {
  const q = String(query || '').trim().toLocaleLowerCase();
  const list = q
    ? entries.filter((e) => [e.title, e.username, e.url, e.notes].some((f) => f.toLocaleLowerCase().includes(q)))
    : entries.slice();
  return list.sort((a, b) => a.title.localeCompare(b.title, 'he'));
}

/** מה שנשלח לממשק ברשימה – בלי הסיסמה. */
function summary(e) {
  return { id: e.id, title: e.title, username: e.username, url: e.url, notes: e.notes, hasPassword: e.password.length > 0, updatedAt: e.updatedAt };
}

module.exports = {
  VaultStore, VaultSession, WrongPasswordError, CorruptVaultError,
  addEntry, updateEntry, deleteEntry, searchEntries, summary,
  DEFAULT_ITERATIONS,
};
