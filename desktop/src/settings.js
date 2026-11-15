'use strict';
/** הגדרות לא-סודיות (זמן נעילה). נשמרות בקובץ JSON רגיל ליד הכספת. */
const fs = require('node:fs');
const path = require('node:path');

const AUTO_LOCK_CHOICES = [1, 5, 15, 30, 60, 0]; // דקות; 0 = רק בנעילת המחשב / שינה / סגירה
const DEFAULTS = { autoLockMinutes: 15 };

function sanitize(raw) {
  const s = { ...DEFAULTS };
  if (raw && AUTO_LOCK_CHOICES.includes(raw.autoLockMinutes)) s.autoLockMinutes = raw.autoLockMinutes;
  return s;
}

function load(dir) {
  try { return sanitize(JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'))); } catch { return { ...DEFAULTS }; }
}

function save(dir, settings) {
  const s = sanitize(settings);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(s));
  return s;
}

/** ממיר דקות לאלפיות שנייה (0 = אף פעם לפי זמן). */
const minutesToMs = (m) => (m > 0 ? m * 60_000 : Infinity);

module.exports = { AUTO_LOCK_CHOICES, DEFAULTS, sanitize, load, save, minutesToMs };
