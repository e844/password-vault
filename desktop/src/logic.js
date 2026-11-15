'use strict';
const crypto = require('node:crypto');

// ---------- מחולל סיסמאות (crypto.randomInt – אקראיות קריפטוגרפית, ללא הטיה) ----------
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/';
const AMBIGUOUS = 'Il1O0o';
const MIN_LENGTH = 8;
const MAX_LENGTH = 64;

const DEFAULT_OPTIONS = { length: 16, lowercase: true, uppercase: true, digits: true, symbols: true, avoidAmbiguous: false };

function charSets(o) {
  const clean = (s) => (o.avoidAmbiguous ? [...s].filter((c) => !AMBIGUOUS.includes(c)).join('') : s);
  const sets = [];
  if (o.lowercase) sets.push(clean(LOWER));
  if (o.uppercase) sets.push(clean(UPPER));
  if (o.digits) sets.push(clean(DIGITS));
  if (o.symbols) sets.push(SYMBOLS);
  return sets;
}

function generatePassword(options = {}) {
  const o = { ...DEFAULT_OPTIONS, ...options };
  const length = Math.trunc(Number(o.length));
  if (!(length >= MIN_LENGTH && length <= MAX_LENGTH)) throw new RangeError('length out of range');
  const sets = charSets(o);
  if (sets.length === 0) throw new RangeError('select at least one character type');
  const all = sets.join('');
  const chars = sets.map((s) => s[crypto.randomInt(s.length)]); // לפחות תו אחד מכל סוג
  while (chars.length < length) chars.push(all[crypto.randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { // ערבוב Fisher–Yates
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** הערכת חוזק גסה: 'weak' | 'medium' | 'strong' */
function strengthOf(password) {
  const p = String(password || '');
  if (!p) return 'weak';
  let pool = 0;
  if (/[a-z]/.test(p)) pool += 26;
  if (/[A-Z]/.test(p)) pool += 26;
  if (/[0-9]/.test(p)) pool += 10;
  if (/[^\p{L}\p{N}]/u.test(p)) pool += 24;
  if (/[^\x00-\x7F]/.test(p) && /\p{L}/u.test(p.replace(/[A-Za-z]/g, ''))) pool += 27;
  const bits = [...p].length * Math.log2(pool || 1);
  return bits < 50 ? 'weak' : bits < 80 ? 'medium' : 'strong';
}

// ---------- נעילה אוטומטית ----------
class AutoLockPolicy {
  constructor({ inactivityMs = 15 * 60_000, backgroundGraceMs = 15 * 60_000 } = {}) {
    this.inactivityMs = inactivityMs;
    this.backgroundGraceMs = backgroundGraceMs;
    this.lastInteraction = 0;
    this.backgroundedAt = null;
  }
  onUnlocked(now) { this.lastInteraction = now; this.backgroundedAt = null; }
  onInteraction(now) { this.lastInteraction = now; }
  onBackground(now) { if (this.backgroundedAt === null) this.backgroundedAt = now; }
  onForeground(now) {
    const lock = this.shouldLock(now);
    this.backgroundedAt = null;
    if (!lock) this.lastInteraction = now;
    return lock;
  }
  shouldLock(now) {
    if (now - this.lastInteraction >= this.inactivityMs) return true;
    return this.backgroundedAt !== null && now - this.backgroundedAt >= this.backgroundGraceMs;
  }
}

/** 5 ניסיונות חופשיים, ואז 30 שניות שמוכפלות בכל כישלון (עד 5 דקות). */
class UnlockThrottle {
  constructor({ freeAttempts = 5, baseDelayMs = 30_000, maxDelayMs = 5 * 60_000 } = {}) {
    Object.assign(this, { freeAttempts, baseDelayMs, maxDelayMs, failures: 0, blockedUntil: 0 });
  }
  remainingMs(now) { return Math.max(0, this.blockedUntil - now); }
  onFailure(now) {
    this.failures++;
    if (this.failures >= this.freeAttempts) {
      const exp = Math.min(this.failures - this.freeAttempts, 10);
      this.blockedUntil = now + Math.min(this.baseDelayMs * 2 ** exp, this.maxDelayMs);
    }
  }
  onSuccess() { this.failures = 0; this.blockedUntil = 0; }
}

// ---------- קטגוריות ----------
const CATEGORY_KEYS = ['general', 'banking', 'email', 'social', 'shopping', 'work', 'home', 'entertainment', 'torrents'];

const CATEGORY_HINTS = {
  torrents: ['torrent', 'טורנט', 'tracker', 'rutracker', '1337x', 'piratebay', 'rarbg', 'yts', 'nyaa', 'fuzer', 'iptorrents', 'torrentleech', 'bittorrent', 'qbittorrent', 'utorrent', 'passthepopcorn', 'privatehd', 'filelist', 'seedbox'],
  banking: ['bank', 'בנק', 'paypal', 'pay', 'visa', 'mastercard', 'isracard', 'cal-online', 'max.co', 'leumi', 'hapoalim', 'discount', 'mizrahi', 'credit', 'אשראי', 'ביטוח', 'insurance', 'crypto', 'binance', 'coinbase'],
  email: ['mail', 'דואר', 'outlook', 'gmail', 'yahoo', 'proton', 'walla'],
  social: ['facebook', 'instagram', 'twitter', 'x.com', 'tiktok', 'linkedin', 'reddit', 'whatsapp', 'telegram', 'discord', 'snapchat', 'social', 'רשת חברתית'],
  shopping: ['shop', 'store', 'amazon', 'aliexpress', 'ebay', 'קניות', 'חנות', 'ksp', 'ivory', 'shufersal', 'temu', 'shein'],
  work: ['slack', 'jira', 'atlassian', 'github', 'gitlab', 'zoom', 'office', 'teams', 'work', 'עבודה', 'salesforce', 'notion', 'server', 'admin'],
  home: ['wifi', 'wi-fi', 'router', 'בית', 'חשמל', 'electric', 'water', 'מים', 'ארנונה', 'gas', 'internet', 'bezeq', 'hot', 'partner', 'cellcom'],
  entertainment: ['netflix', 'spotify', 'youtube', 'disney', 'steam', 'xbox', 'playstation', 'epic', 'twitch', 'apple music', 'game', 'משחק'],
};

/** ניחוש קטגוריה לפי שם וכתובת (לייבוא מדפדפן). */
function guessCategory(title, url) {
  const t = `${title || ''} ${url || ''}`.toLowerCase();
  // מילים קצרות באנגלית חייבות להופיע כמילה שלמה (אחרת "netflix.com" נתפס כ-"x.com")
  const has = (w) => (/^[a-z.\-]{1,5}$/.test(w)
    ? new RegExp(`(^|[^a-z0-9])${w.replace(/[.\-]/g, '\\$&')}($|[^a-z0-9])`).test(t)
    : t.includes(w));
  for (const [cat, words] of Object.entries(CATEGORY_HINTS)) {
    if (words.some(has)) return cat;
  }
  return 'general';
}

// ---------- נתוני דוגמה (חשבונות מומצאים ב-example.com) ----------
function sampleEntries() {
  const pw = () => generatePassword({ length: 16 });
  return [
    { title: 'דוגמה – דואר אלקטרוני', username: 'dana.demo@example.com', password: pw(), url: 'https://demo-mail.example', notes: 'חשבון דוגמה', category: 'email' },
    { title: 'דוגמה – בנק', username: 'demo-user-1234', password: pw(), url: 'https://demo-bank.example', notes: 'לא חשבון אמיתי', category: 'banking' },
    { title: 'דוגמה – רשת חברתית', username: '@demo_user', password: pw(), url: 'https://demo-social.example', notes: '', category: 'social' },
    { title: 'דוגמה – חנות מקוונת', username: 'shopper@example.com', password: pw(), url: 'https://demo-shop.example', notes: 'מספר לקוח: 000000', category: 'shopping' },
    { title: 'דוגמה – Wi-Fi בבית', username: '', password: pw(), url: '', notes: 'שם רשת: Demo-WiFi', category: 'home' },
    { title: 'דוגמה – מערכת בעבודה', username: 'd.demo', password: pw(), url: 'https://demo-work.example', notes: '', category: 'work' },
    { title: 'דוגמה – אתר טורנטים', username: 'seeder_demo', password: pw(), url: 'https://demo-tracker.example', notes: 'יחס שיתוף: 1.0 (מומצא)', category: 'torrents' },
    { title: 'דוגמה – סטרימינג', username: 'family@example.com', password: pw(), url: 'https://demo-tv.example', notes: 'חשבון משפחתי', category: 'entertainment' },
  ].map((e) => ({ id: crypto.randomUUID(), updatedAt: Date.now(), ...e }));
}

module.exports = {
  generatePassword, strengthOf, charSets, DEFAULT_OPTIONS, MIN_LENGTH, MAX_LENGTH,
  AutoLockPolicy, UnlockThrottle, sampleEntries, CATEGORY_KEYS, guessCategory,
};
