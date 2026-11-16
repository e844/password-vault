'use strict';
/* ממשק המשתמש. אין כאן הצפנה ואין גישה לקבצים – הכול דרך window.vault (תהליך ראשי). */
(() => {
  const api = window.vault;
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- אייקונים (Material Icons, Apache 2.0) ----------
  const ICONS = {
    lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
    search: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
    refresh: 'M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
    key: 'M12.65 10A5.99 5.99 0 007 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 005.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
    back: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
    more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
    open: 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
    upload: 'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z',
    download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
    save: 'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z',
    restore: 'M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0013 21a9 9 0 000-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
    warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    all: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
    web: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
    update: 'M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1a6.875 6.875 0 000 9.79 7.02 7.02 0 009.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58a8.987 8.987 0 0112.65 0L21 3v7.12zM12.5 8v4.25l3.5 2.08-.72 1.21L11 13V8h1.5z',
    palette: 'M12 3a9 9 0 000 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    eye: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
    eyeOff: 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z',
    notes: 'M3 18h12v-2H3v2zM3 6v2h18V6H3zm0 7h18v-2H3v2z',
    timer: 'M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0012 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z',
    folder: 'M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
    bank: 'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z',
    mail: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
    group: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
    cart: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0020 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
    work: 'M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z',
    home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    torrent: 'M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z',
    movie: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
  };
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function makeIcon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'ic');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', ICONS[name]);
    svg.appendChild(p);
    return svg;
  }
  const setIcon = (el, name) => { el.querySelector('svg.ic')?.remove(); el.prepend(makeIcon(name)); };
  document.querySelectorAll('[data-icon]').forEach((el) => el.prepend(makeIcon(el.dataset.icon)));

  // ---------- קטגוריות ----------
  const CATEGORIES = [
    { key: 'general', label: 'כללי', icon: 'folder', hue: 220 },
    { key: 'banking', label: 'בנק וכספים', icon: 'bank', hue: 150 },
    { key: 'email', label: 'דואר', icon: 'mail', hue: 8 },
    { key: 'social', label: 'רשתות חברתיות', icon: 'group', hue: 270 },
    { key: 'shopping', label: 'קניות', icon: 'cart', hue: 32 },
    { key: 'work', label: 'עבודה', icon: 'work', hue: 195 },
    { key: 'home', label: 'בית', icon: 'home', hue: 52 },
    { key: 'entertainment', label: 'בידור', icon: 'movie', hue: 330 },
    { key: 'torrents', label: 'טורנטים', icon: 'torrent', hue: 100 },
  ];
  const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
  const catOf = (key) => CAT[key] || CAT.general;

  // ---------- טקסטים ----------
  const T = {
    setupTitle: 'יצירת כספת חדשה',
    setupBody: 'בחר סיסמת מאסטר. היא לא נשמרת בשום מקום, ואם תשכח אותה לא ניתן יהיה לפתוח את הכספת.',
    create: 'יצירת כספת', unlockTitle: 'הכספת נעולה', unlockBody: 'הזן את סיסמת המאסטר כדי לפתוח', unlock: 'פתיחה', working: 'רגע...',
    errors: {
      tooShort: 'הסיסמה חייבת להכיל לפחות 8 תווים',
      mismatch: 'הסיסמאות אינן תואמות',
      wrong: 'סיסמה שגויה',
      wrongCurrent: 'הסיסמה הנוכחית שגויה',
      corrupt: 'הקובץ פגום או שאינו קובץ גיבוי של הכספת',
      generic: 'אירעה שגיאה. נסה שוב.',
      titleRequired: 'חובה למלא שם',
      exists: 'כבר קיימת כספת במחשב הזה',
      csvFormat: 'הקובץ לא זוהה כקובץ סיסמאות. ייצא אותו מהדפדפן כ-CSV ונסה שוב.',
      tooBig: 'הקובץ גדול מדי',
      noUrl: 'אין כתובת אתר לרשומה הזו',
      badUrl: 'הכתובת אינה כתובת אתר תקינה',
      busy: 'רגע, פעולה קודמת עדיין רצה',
    },
    blocked: (s) => `יותר מדי ניסיונות שגויים. נסה שוב בעוד ${s} שניות`,
    autoLocked: 'הכספת ננעלה אוטומטית',
    count: (n) => (n === 1 ? 'רשומה אחת' : `${n} רשומות`),
    empty: 'אין עדיין רשומות', noResults: 'לא נמצאו תוצאות', emptyCat: 'אין רשומות בקטגוריה הזו',
    newEntry: 'רשומה חדשה', editEntry: 'עריכת רשומה',
    saved: 'נשמר', deleted: 'הרשומה נמחקה', copied: 'הועתק. הלוח יתנקה בעוד 30 שניות', saveFailed: 'השמירה נכשלה',
    show: 'הצג', hide: 'הסתר',
    strength: { weak: 'חוזק: חלשה', medium: 'חוזק: בינונית', strong: 'חוזק: חזקה' },
    updated: (d) => `עודכן: ${d}`,
    selectOne: 'יש לבחור לפחות סוג תווים אחד',
    all: 'הכול',
    opened: 'האתר נפתח בדפדפן',
    exported: (n, f) => `יוצאו ${n} רשומות לקובץ ${f}`,
    imported: (a, d, s) => `נוספו ${a} רשומות` + (d ? ` · ${d} כפולות דולגו` : '') + (s ? ` · ${s} שורות ריקות דולגו` : ''),
    backedUp: (f) => `הגיבוי נשמר: ${f}`,
    restored: (a, u) => `השחזור הושלם: נוספו ${a}, עודכנו ${u}`,
    masterChanged: 'סיסמת המאסטר הוחלפה',
    lockLabel: (m) => (m === 0 ? 'רק כשנועלים את המחשב, בשינה או בסגירה' : m === 60 ? 'אחרי שעה' : m === 1 ? 'אחרי דקה' : `אחרי ${m} דקות`),
    lockSaved: (m) => (m === 0 ? 'הכספת תינעל רק בנעילת המחשב, בשינה או בסגירה' : `נעילה אוטומטית: ${m === 60 ? 'שעה' : m === 1 ? 'דקה' : m + ' דקות'} בלי שימוש`),
  };

  // ---------- מצב ----------
  let mode = 'unlock';
  let entries = [];
  let selectedId = null;
  let editingId = null;
  let editCategory = 'general';
  let activeCat = 'all';
  let generated = '';
  let confirmAction = null;

  // ---------- צבע דינמי (Material You) מצבע ההדגשה של Windows ----------
  function applyAccent(hex) {
    if (!hex || !/^[0-9a-f]{6}/i.test(hex)) return;
    const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d < 0.05) return;
    let h;
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h = Math.round(h * 60 + 360) % 360;
    const l = (max + min) / 2;
    const s = Math.round(Math.min(70, Math.max(35, (d / (1 - Math.abs(2 * l - 1))) * 70)));
    document.documentElement.style.setProperty('--h', String(h));
    document.documentElement.style.setProperty('--s', `${s}%`);
  }

  // ---------- אפקט אדווה (Material ripple) – רק transform/opacity, כלומר רץ על ה-GPU ----------
  document.addEventListener('pointerdown', (ev) => {
    if (reduceMotion) return;
    const host = ev.target.closest('.filled-btn, .tonal-btn, .outlined-btn, .text-btn, .icon-btn, .fab, .chip, .entry, .menu button');
    if (!host || host.disabled) return;
    const r = host.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const ink = document.createElement('span');
    ink.className = 'ink';
    ink.style.width = ink.style.height = `${size}px`;
    ink.style.left = `${ev.clientX - r.left - size / 2}px`;
    ink.style.top = `${ev.clientY - r.top - size / 2}px`;
    host.appendChild(ink);
    ink.addEventListener('animationend', () => ink.remove(), { once: true });
  });

  // ---------- כלים ----------
  let snackTimer = null;
  function snack(text, isError = false) {
    const el = $('snackbar');
    el.textContent = text;
    el.classList.toggle('error-snack', isError);
    el.classList.add('show');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(() => el.classList.remove('show'), 4000);
  }
  const errText = (r) => (r.error === 'blocked' ? T.blocked(r.seconds) : (T.errors[r.error] || T.errors.generic));

  async function setStrength(el, password) {
    if (!password) { el.hidden = true; return; }
    const { strength } = await api.strength(password);
    el.hidden = false;
    el.className = `strength ${strength}`;
    el.querySelector('small').textContent = T.strength[strength];
  }

  const initial = (t) => {
    const parts = String(t).split(/\s[–-]\s/);
    const name = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).trim();
    return ([...name][0] || '?').toLocaleUpperCase();
  };
  const fmtDate = (ms) => new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));

  function paintAvatar(el, e) {
    el.textContent = initial(e.title);
    el.style.setProperty('--ch', String(catOf(e.category).hue));
  }

  document.querySelectorAll('.toggle-vis').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = $(btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      if (btn.dataset.also) $(btn.dataset.also).type = input.type;
      btn.textContent = show ? T.hide : T.show;
    });
  });

  function animateIn(el, cls = 'enter') {
    if (reduceMotion) return;
    el.classList.remove(cls);
    void el.offsetWidth; // מאפס את האנימציה
    el.classList.add(cls);
  }

  // ---------- יצירה / פתיחה ----------
  function wipeUi() {
    document.querySelectorAll('dialog[open]').forEach((d) => d.close());
    $('entries').replaceChildren();
    $('cats').replaceChildren();
    $('search').value = '';
    document.querySelectorAll('#detail .value, #detail-title, #detail-avatar, #detail-cat, #confirm-body, #gen-output').forEach((el) => { el.textContent = ''; });
    document.querySelectorAll('dialog input, dialog textarea').forEach((el) => { if (el.type !== 'checkbox' && el.type !== 'range') el.value = ''; });
    $('detail').hidden = true;
    $('detail-empty').hidden = false;
    $('main-view').classList.remove('show-detail');
  }

  function showLock(m) {
    mode = m;
    entries = []; selectedId = null; editingId = null; generated = ''; activeCat = 'all';
    wipeUi();
    $('main-view').hidden = true;
    $('lock-view').hidden = false;
    animateIn($('lock-view'));
    const setup = m === 'setup';
    $('lock-title').textContent = setup ? T.setupTitle : T.unlockTitle;
    $('lock-body').textContent = setup ? T.setupBody : T.unlockBody;
    $('lock-submit').textContent = setup ? T.create : T.unlock;
    $('confirm-wrap').hidden = !setup;
    $('sample-banner').hidden = !setup;
    $('setup-strength').hidden = true;
    $('master').value = ''; $('confirm').value = '';
    $('master').type = 'password'; $('confirm').type = 'password';
    document.querySelector('.toggle-vis[data-target="master"]').textContent = T.show;
    $('lock-error').textContent = '';
    $('lock-submit').disabled = true;
    setTimeout(() => $('master').focus(), 50);
  }

  $('master').addEventListener('input', () => {
    $('lock-submit').disabled = !$('master').value;
    if (mode === 'setup') setStrength($('setup-strength'), $('master').value);
  });

  $('lock-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('lock-submit');
    if (btn.disabled) return;
    const pw = $('master').value;
    const confirm = $('confirm').value;
    btn.disabled = true;
    btn.textContent = T.working;
    btn.classList.add('busy');
    $('lock-error').textContent = '';
    const res = mode === 'setup' ? await api.create(pw, confirm) : await api.unlock(pw);
    btn.classList.remove('busy');
    if (mode === 'unlock') $('master').value = '';
    btn.textContent = mode === 'setup' ? T.create : T.unlock;
    btn.disabled = !$('master').value;
    if (res.ok) {
      $('master').value = ''; $('confirm').value = '';
      showMain(res.entries);
    } else {
      $('lock-error').textContent = errText(res);
      animateIn(document.querySelector('.lock-card'), 'shake');
      $('master').focus();
    }
  });

  // ---------- מסך ראשי ----------
  function showMain(list) {
    entries = list;
    $('lock-view').hidden = true;
    $('main-view').hidden = false;
    animateIn($('main-view'));
    $('search').value = '';
    selectedId = null;
    activeCat = 'all';
    renderAll();
  }

  function renderAll() { renderCats(); renderList(); renderDetail(); }

  function matches(e) {
    if (activeCat !== 'all' && e.category !== activeCat) return false;
    const q = $('search').value.trim().toLocaleLowerCase();
    return !q || [e.title, e.username, e.url, e.notes].some((f) => f.toLocaleLowerCase().includes(q));
  }
  const filtered = () => entries.filter(matches).sort((a, b) => a.title.localeCompare(b.title, 'he'));

  function chip(label, iconName, selected, count, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (selected ? ' selected' : '');
    b.setAttribute('aria-pressed', String(selected));
    b.appendChild(makeIcon(iconName));
    b.append(label);
    if (count !== undefined) { const c = document.createElement('span'); c.className = 'chip-count'; c.textContent = count; b.appendChild(c); }
    b.addEventListener('click', onClick);
    return b;
  }

  function navItem(label, iconName, active, count, hue) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'nav-item cat' + (active ? ' active' : '');
    b.setAttribute('aria-pressed', String(active));
    if (hue !== undefined) b.style.setProperty('--ch', String(hue));
    b.appendChild(makeIcon(iconName));
    const l = document.createElement('span'); l.className = 'nl'; l.textContent = label;
    const c = document.createElement('span'); c.className = 'nc'; c.textContent = count;
    b.append(l, c);
    return b;
  }

  function renderCats() {
    const box = $('cats');
    box.replaceChildren();
    const all = navItem(T.all, 'all', activeCat === 'all', entries.length);
    all.addEventListener('click', () => setCat('all'));
    box.appendChild(all);
    for (const c of CATEGORIES) {
      const n = entries.filter((e) => e.category === c.key).length;
      if (!n && activeCat !== c.key) continue;
      const b = navItem(c.label, c.icon, activeCat === c.key, n, c.hue);
      b.dataset.cat = c.key;
      b.addEventListener('click', () => setCat(c.key));
      box.appendChild(b);
    }
    $('list-title').textContent = activeCat === 'all' ? 'כל הרשומות' : catOf(activeCat).label;
  }

  function setCat(key) {
    activeCat = key;
    renderCats();
    renderList();
  }

  function renderList() {
    const list = filtered();
    const ul = $('entries');
    ul.replaceChildren();
    list.forEach((e, i) => {
      const li = document.createElement('li');
      li.className = 'entry' + (e.id === selectedId ? ' selected' : '');
      li.style.setProperty('--i', String(Math.min(i, 12)));
      li.tabIndex = 0;
      li.dataset.id = e.id;
      const av = document.createElement('div');
      av.className = 'avatar';
      paintAvatar(av, e);
      const txt = document.createElement('div');
      txt.className = 'txt';
      const t = document.createElement('div'); t.className = 't'; t.textContent = e.title;
      txt.appendChild(t);
      const u = document.createElement('div'); u.className = 'u'; u.dir = 'auto';
      u.textContent = e.username || catOf(e.category).label;
      txt.appendChild(u);
      li.append(av, txt);
      if (e.url) {
        const open = document.createElement('button');
        open.className = 'icon-btn row-open';
        open.title = 'פתח בדפדפן';
        open.setAttribute('aria-label', 'פתח בדפדפן');
        open.appendChild(makeIcon('open'));
        open.addEventListener('click', (ev) => { ev.stopPropagation(); openUrl(e.id); });
        li.appendChild(open);
      }
      li.addEventListener('click', () => select(e.id));
      li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') select(e.id); });
      ul.appendChild(li);
    });
    $('count').textContent = T.count(list.length);
    $('empty').hidden = list.length > 0;
    $('empty').textContent = $('search').value.trim() ? T.noResults : (activeCat !== 'all' ? T.emptyCat : T.empty);
  }

  $('search').addEventListener('input', renderList);

  function select(id) {
    selectedId = id;
    document.querySelectorAll('#entries .entry').forEach((li) => li.classList.toggle('selected', li.dataset.id === id));
    renderDetail();
  }

  let revealed = false;
  function renderDetail() {
    const e = entries.find((x) => x.id === selectedId);
    $('main-view').classList.toggle('show-detail', !!e);
    $('detail-empty').hidden = !!e;
    $('detail').hidden = !e;
    if (!e) return;
    animateIn($('detail'));
    revealed = false;
    $('detail-title').textContent = e.title;
    paintAvatar($('detail-avatar'), e);
    const c = catOf(e.category);
    const dc = $('detail-cat');
    dc.replaceChildren(makeIcon(c.icon), c.label);
    dc.style.setProperty('--ch', String(c.hue));
    const setField = (id, value) => { $(id).hidden = !value; $(id).querySelector('.value').textContent = value; };
    setField('f-username', e.username);
    setField('f-url', e.url);
    setField('f-notes', e.notes);
    $('f-password').hidden = !e.hasPassword;
    $('f-password').querySelector('.value').textContent = '••••••••••';
    setIcon($('reveal'), 'eye');
    $('reveal').setAttribute('aria-label', 'הצג סיסמה');
    $('open-url').hidden = !e.url;
    $('detail-strength').hidden = true;
    $('detail-updated').textContent = T.updated(fmtDate(e.updatedAt));
    if (e.hasPassword) {
      api.get(e.id).then((r) => { if (r.entry && selectedId === e.id) setStrength($('detail-strength'), r.entry.password); });
    }
  }

  $('reveal').addEventListener('click', async () => {
    const value = $('f-password').querySelector('.value');
    if (revealed) { value.textContent = '••••••••••'; setIcon($('reveal'), 'eye'); revealed = false; return; }
    const r = await api.get(selectedId);
    if (!r.entry) return;
    value.textContent = r.entry.password;
    setIcon($('reveal'), 'eyeOff');
    $('reveal').setAttribute('aria-label', 'הסתר סיסמה');
    revealed = true;
  });

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = await api.copyField(selectedId, btn.dataset.copy);
      if (r.ok) snack(T.copied);
    });
  });

  async function openUrl(id) {
    const r = await api.openUrl(id);
    if (r.ok) snack(T.opened); else snack(errText(r), true);
  }
  $('open-url').addEventListener('click', () => openUrl(selectedId));

  $('detail-back').addEventListener('click', () => select(null));
  $('lock-btn').addEventListener('click', () => api.lock());

  // ---------- הוספה / עריכה ----------
  function renderEditCats() {
    const row = $('e-cats');
    row.replaceChildren();
    for (const c of CATEGORIES) {
      const b = chip(c.label, c.icon, editCategory === c.key, undefined, () => { editCategory = c.key; renderEditCats(); });
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(editCategory === c.key));
      b.dataset.cat = c.key;
      b.style.setProperty('--ch', String(c.hue));
      row.appendChild(b);
    }
  }

  async function openEditor(id) {
    editingId = id;
    let e = { title: '', username: '', password: '', url: '', notes: '', category: activeCat !== 'all' ? activeCat : 'general' };
    if (id) {
      const r = await api.get(id);
      if (!r.entry) return;
      e = r.entry;
    }
    editCategory = e.category || 'general';
    renderEditCats();
    $('edit-title').textContent = id ? T.editEntry : T.newEntry;
    $('e-title').value = e.title;
    $('e-username').value = e.username;
    $('e-password').value = e.password;
    $('e-password').type = id ? 'password' : 'text';
    document.querySelector('.toggle-vis[data-target="e-password"]').textContent = id ? T.show : T.hide;
    $('e-url').value = e.url;
    $('e-notes').value = e.notes;
    $('edit-error').textContent = '';
    setStrength($('edit-strength'), e.password);
    $('edit-dialog').showModal();
    $('e-title').focus();
  }

  $('fab').addEventListener('click', () => openEditor(null));
  $('detail-edit').addEventListener('click', () => openEditor(selectedId));
  $('edit-cancel').addEventListener('click', () => $('edit-dialog').close());
  $('edit-dialog').addEventListener('close', () => { $('e-password').value = ''; editingId = null; });
  $('e-password').addEventListener('input', () => setStrength($('edit-strength'), $('e-password').value));

  $('edit-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const entry = {
      id: editingId || undefined,
      title: $('e-title').value, username: $('e-username').value, password: $('e-password').value,
      url: $('e-url').value, notes: $('e-notes').value, category: editCategory,
    };
    if (!entry.title.trim()) { $('edit-error').textContent = T.errors.titleRequired; $('e-title').focus(); return; }
    const r = await api.save(entry);
    if (!r.ok) { $('edit-error').textContent = T.errors[r.error] || T.saveFailed; return; }
    entries = r.entries;
    $('edit-dialog').close();
    if (activeCat !== 'all' && activeCat !== entry.category) activeCat = 'all';
    selectedId = r.id;
    renderAll();
    snack(T.saved);
  });

  // ---------- חלון אישור כללי ----------
  function askConfirm({ title, body, ok, icon = 'warning', danger = false }, action) {
    $('confirm-title').textContent = title;
    $('confirm-body').textContent = body;
    $('confirm-ok').textContent = ok;
    $('confirm-ok').classList.toggle('danger', danger);
    $('confirm-icon').classList.toggle('danger', danger);
    setIcon($('confirm-icon'), icon);
    confirmAction = action;
    $('confirm-dialog').showModal();
  }
  $('confirm-cancel').addEventListener('click', () => $('confirm-dialog').close());
  $('confirm-dialog').addEventListener('close', () => { confirmAction = null; });
  $('confirm-ok').addEventListener('click', async () => {
    const action = confirmAction;
    $('confirm-dialog').close();
    if (action) await action();
  });

  $('detail-delete').addEventListener('click', () => {
    const e = entries.find((x) => x.id === selectedId);
    if (!e) return;
    askConfirm({ title: 'למחוק את הרשומה?', body: `הרשומה "${e.title}" תימחק לצמיתות.`, ok: 'מחיקה', icon: 'delete', danger: true }, async () => {
      const r = await api.remove(e.id);
      if (!r.ok) { snack(T.saveFailed, true); return; }
      entries = r.entries;
      selectedId = null;
      if (activeCat !== 'all' && !entries.some((x) => x.category === activeCat)) activeCat = 'all';
      renderAll();
      snack(T.deleted);
    });
  });

  // ---------- הגדרות ----------
  async function openSettings() {
    const [{ settings }, info] = await Promise.all([api.getSettings(), api.updateInfo()]);
    $('set-lock-desc').textContent = T.lockLabel(settings.autoLockMinutes);
    $('set-version').textContent = info.current ? `הגרסה שלך: בנייה ${info.current}` : 'בנייה מקומית';
    $('settings-dialog').showModal();
  }
  $('nav-settings').addEventListener('click', openSettings);
  $('settings-close').addEventListener('click', () => $('settings-dialog').close());

  const ACTIONS = {
    exportCsv: () => askConfirm({
      title: 'ייצוא לקובץ לא מוצפן',
      body: 'קובץ ה-CSV יכיל את כל הסיסמאות כטקסט גלוי. השתמש בו רק לייבוא לדפדפן (Chrome, Edge, Firefox) או למנהל סיסמאות אחר, ומחק אותו מיד אחר כך.',
      ok: 'ייצוא', icon: 'warning', danger: true,
    }, async () => {
      const r = await api.exportCsv();
      if (r.ok) snack(T.exported(r.count, r.name)); else if (!r.canceled) snack(errText(r), true);
    }),
    importCsv: async () => {
      const r = await api.importCsv();
      if (r.canceled) return;
      if (!r.ok) { snack(errText(r), true); return; }
      entries = r.entries;
      renderAll();
      snack(T.imported(r.added, r.duplicates, r.skipped));
    },
    backup: async () => {
      const r = await api.backup();
      if (r.ok) snack(T.backedUp(r.name)); else if (!r.canceled) snack(errText(r), true);
    },
    restore: async () => {
      const r = await api.restorePick();
      if (r.canceled) return;
      if (!r.ok) { snack(errText(r), true); return; }
      $('restore-name').textContent = r.name;
      $('restore-password').value = '';
      $('restore-error').textContent = '';
      $('restore-dialog').showModal();
      $('restore-password').focus();
    },
    update: async () => {
      const info = await api.updateInfo();
      $('update-current').textContent = info.current ? `הגרסה שלך: בנייה ${info.current}` : 'הגרסה שלך: בנייה מקומית (לא מ-GitHub)';
      $('update-status').textContent = 'בודק ב-GitHub…';
      $('update-download').hidden = true;
      $('update-howto').hidden = true;
      $('update-dialog').showModal();
      const r = await api.checkUpdate();
      if (!r.ok) { $('update-status').textContent = 'לא ניתן להתחבר ל-GitHub כרגע. בדוק את החיבור לאינטרנט ונסה שוב.'; return; }
      const when = r.publishedAt ? ` (${new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium' }).format(new Date(r.publishedAt))})` : '';
      if (r.newer) {
        $('update-status').textContent = `✨ יש גרסה חדשה: בנייה ${r.latest}${when}`;
        $('update-download').hidden = !r.download;
        $('update-howto').hidden = false;
      } else {
        $('update-status').textContent = `✓ יש לך את הגרסה העדכנית ביותר (בנייה ${r.latest}${when})`;
      }
    },
    browserFill: () => { $('browser-dialog').showModal(); },
    lockSettings: async () => {
      const { settings, choices } = await api.getSettings();
      const box = $('lock-choices');
      box.replaceChildren();
      for (const m of choices) {
        const label = document.createElement('label');
        label.className = 'radio-row';
        const input = document.createElement('input');
        input.type = 'radio'; input.name = 'autolock'; input.value = String(m);
        input.checked = m === settings.autoLockMinutes;
        const span = document.createElement('span');
        span.textContent = T.lockLabel(m);
        label.append(input, span);
        box.appendChild(label);
      }
      $('lock-dialog').showModal();
    },
    changeMaster: () => {
      ['m-current', 'm-new', 'm-confirm'].forEach((id) => { $(id).value = ''; });
      $('m-error').textContent = '';
      $('m-strength').hidden = true;
      $('master-dialog').showModal();
      $('m-current').focus();
    },
  };
  document.querySelectorAll('#settings [data-action]').forEach((b) => b.addEventListener('click', () => { $('settings-dialog').close(); ACTIONS[b.dataset.action](); }));

  $('restore-cancel').addEventListener('click', () => $('restore-dialog').close());
  $('restore-dialog').addEventListener('close', () => { $('restore-password').value = ''; });
  $('restore-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $('restore-ok').disabled = true;
    $('restore-ok').textContent = T.working;
    const r = await api.restoreApply($('restore-password').value);
    $('restore-ok').disabled = false;
    $('restore-ok').textContent = 'שחזור';
    if (!r.ok) { $('restore-error').textContent = errText(r); $('restore-password').select(); return; }
    entries = r.entries;
    $('restore-dialog').close();
    renderAll();
    snack(T.restored(r.added, r.updated));
  });

  $('update-close').addEventListener('click', () => $('update-dialog').close());
  $('update-page').addEventListener('click', () => api.openUpdate('page'));
  $('update-download').addEventListener('click', async () => { const r = await api.openUpdate('download'); if (r.ok) snack('ההורדה נפתחה בדפדפן'); });
  $('browser-close').addEventListener('click', () => $('browser-dialog').close());
  $('browser-open').addEventListener('click', async () => { const r = await api.openExtensionFolder(); if (!r.ok) snack(T.errors.generic, true); });
  $('browser-copy').addEventListener('click', async () => { await api.copyExtensionsUrl(); snack('הכתובת הועתקה – הדבק אותה בשורת הכתובת של הדפדפן'); });

  $('lock-cancel').addEventListener('click', () => $('lock-dialog').close());
  $('lock-settings-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const sel = document.querySelector('#lock-choices input:checked');
    if (!sel) return;
    const r = await api.setSettings({ autoLockMinutes: Number(sel.value) });
    $('lock-dialog').close();
    if (r.ok) snack(T.lockSaved(r.settings.autoLockMinutes));
  });

  $('m-new').addEventListener('input', () => setStrength($('m-strength'), $('m-new').value));
  $('m-cancel').addEventListener('click', () => $('master-dialog').close());
  $('master-dialog').addEventListener('close', () => ['m-current', 'm-new', 'm-confirm'].forEach((id) => { $(id).value = ''; }));
  $('master-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    $('m-ok').disabled = true;
    $('m-ok').textContent = T.working;
    const r = await api.changeMaster($('m-current').value, $('m-new').value, $('m-confirm').value);
    $('m-ok').disabled = false;
    $('m-ok').textContent = 'החלפה';
    if (!r.ok) { $('m-error').textContent = errText(r); return; }
    $('master-dialog').close();
    snack(T.masterChanged);
  });

  // ---------- מחולל ----------
  function genOptions() {
    return {
      length: Number($('gen-length').value),
      lowercase: $('gen-lower').checked, uppercase: $('gen-upper').checked,
      digits: $('gen-digits').checked, symbols: $('gen-symbols').checked, avoidAmbiguous: $('gen-ambig').checked,
    };
  }
  async function regenerate() {
    $('gen-len-label').textContent = $('gen-length').value;
    const r = await api.generate(genOptions());
    generated = r.password || '';
    $('gen-output').textContent = generated || T.selectOne;
    animateIn($('gen-output'), 'pop');
    $('gen-refresh').disabled = $('gen-copy').disabled = $('gen-use').disabled = !generated;
    setStrength($('gen-strength'), generated);
  }
  function openGenerator(m) {
    $('gen-use').hidden = m !== 'pick';
    $('gen-copy').hidden = m === 'pick';
    regenerate();
    $('gen-dialog').showModal();
  }
  $('open-generator').addEventListener('click', () => openGenerator('standalone'));
  $('e-generate').addEventListener('click', () => openGenerator('pick'));
  $('gen-length').addEventListener('input', regenerate);
  ['gen-lower', 'gen-upper', 'gen-digits', 'gen-symbols', 'gen-ambig'].forEach((id) => $(id).addEventListener('change', regenerate));
  $('gen-refresh').addEventListener('click', regenerate);
  $('gen-copy').addEventListener('click', async () => { if ((await api.copyText(generated)).ok) snack(T.copied); });
  $('gen-close').addEventListener('click', () => $('gen-dialog').close());
  $('gen-dialog').addEventListener('close', () => { generated = ''; $('gen-output').textContent = ''; });
  $('gen-use').addEventListener('click', () => {
    $('e-password').value = generated;
    $('e-password').type = 'text';
    document.querySelector('.toggle-vis[data-target="e-password"]').textContent = T.hide;
    setStrength($('edit-strength'), generated);
    $('gen-dialog').close();
  });

  // ---------- פעילות ונעילה ----------
  let lastPing = 0;
  const ping = () => {
    const t = Date.now();
    if (t - lastPing > 5000) { lastPing = t; api.activity(); }
  };
  ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, ping, { passive: true }));

  api.onLocked((info) => {
    showLock('unlock');
    if (info && info.auto) snack(T.autoLocked);
  });

  document.addEventListener('keydown', (ev) => {
    const inMain = !$('main-view').hidden;
    if (ev.key === 'Escape' && inMain && !document.querySelector('dialog[open]') && selectedId) select(null);
    if (ev.ctrlKey && ev.key.toLowerCase() === 'l' && inMain) api.lock();
    if (ev.ctrlKey && ev.key.toLowerCase() === 'f' && inMain) { ev.preventDefault(); $('search').focus(); }
    if (ev.ctrlKey && ev.key.toLowerCase() === 'n' && inMain && !document.querySelector('dialog[open]')) { ev.preventDefault(); openEditor(null); }
  });

  // ---------- התחלה ----------
  api.state().then((s) => {
    applyAccent(s.accent);
    showLock(s.exists ? 'unlock' : 'setup');
  });
})();
