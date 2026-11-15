'use strict';
/**
 * ייבוא/ייצוא CSV בפורמט של דפדפנים (Chrome / Edge / Firefox) וביטוורדן.
 * ייצוא: name,url,username,password,note  (הפורמט ש-Chrome ו-Edge מייבאים)
 */
const { CATEGORY_KEYS, guessCategory } = require('./logic');

/** מפענח CSV לפי RFC 4180 (שדות במירכאות, פסיקים ושורות בתוך שדה). */
function parseCsv(text) {
  const s = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.length > 1 || row[0] !== '') rows.push(row); }
  return rows;
}

function csvField(v) {
  // בלי שינוי בתוכן: סיסמה שמתחילה ב-"=" או "-" חייבת להישאר בדיוק כפי שהיא
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(entries) {
  const lines = [['name', 'url', 'username', 'password', 'note', 'category'].join(',')];
  for (const e of entries) {
    lines.push([e.title, e.url, e.username, e.password, e.notes, e.category].map(csvField).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}

const HEADER_MAP = {
  title: ['name', 'title', 'login_name', 'שם'],
  url: ['url', 'login_uri', 'website', 'uri', 'origin', 'כתובת'],
  username: ['username', 'login_username', 'user', 'email', 'login', 'שם משתמש'],
  password: ['password', 'login_password', 'pass', 'סיסמה'],
  notes: ['note', 'notes', 'extra', 'comments', 'הערות'],
  category: ['category', 'folder', 'grouping', 'group', 'קטגוריה'],
};

function hostOf(url) {
  try { return new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** ממיר שורות CSV לרשומות. מחזיר { entries, skipped }. */
function entriesFromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { entries: [], skipped: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [key, names] of Object.entries(HEADER_MAP)) {
    const idx = header.findIndex((h) => names.includes(h));
    if (idx >= 0) col[key] = idx;
  }
  if (col.password === undefined && col.username === undefined) throw new Error('unrecognized');
  const entries = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const get = (k) => (col[k] !== undefined ? String(r[col[k]] ?? '').trim() : '');
    const url = get('url');
    const username = get('username');
    const password = col.password !== undefined ? String(r[col.password] ?? '') : '';
    let title = get('title') || hostOf(url) || username;
    if (!title && !password) { skipped++; continue; }
    if (!title) title = 'ללא שם';
    const rawCat = get('category').toLowerCase();
    const category = CATEGORY_KEYS.includes(rawCat) ? rawCat : guessCategory(title, url);
    entries.push({ title, url, username, password, notes: get('notes'), category });
  }
  return { entries, skipped };
}

module.exports = { parseCsv, toCsv, entriesFromCsv };
