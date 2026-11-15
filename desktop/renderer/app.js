'use strict';
/* ממשק המשתמש. אין כאן הצפנה ואין גישה לקבצים – הכול דרך window.vault (תהליך ראשי). */
(() => {
  const api = window.vault;
  const $ = (id) => document.getElementById(id);

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
  document.querySelectorAll('[data-icon]').forEach((el) => el.prepend(makeIcon(el.dataset.icon)));

  // ---------- טקסטים ----------
  const T = {
    setupTitle: 'יצירת כספת חדשה',
    setupBody: 'בחר סיסמת מאסטר. היא לא נשמרת בשום מקום, ואם תשכח אותה לא ניתן יהיה לפתוח את הכספת.',
    create: 'יצירת כספת',
    unlockTitle: 'הכספת נעולה',
    unlockBody: 'הזן את סיסמת המאסטר כדי לפתוח',
    unlock: 'פתיחה',
    working: 'רגע...',
    errors: {
      tooShort: 'סיסמת המאסטר חייבת להכיל לפחות 8 תווים',
      mismatch: 'הסיסמאות אינן תואמות',
      wrong: 'סיסמה שגויה',
      corrupt: 'קובץ הכספת פגום ולא ניתן לפתוח אותו',
      generic: 'אירעה שגיאה. נסה שוב.',
      titleRequired: 'חובה למלא שם',
      exists: 'כבר קיימת כספת במחשב הזה',
    },
    blocked: (s) => `יותר מדי ניסיונות שגויים. נסה שוב בעוד ${s} שניות`,
    autoLocked: 'הכספת ננעלה אוטומטית',
    count: (n) => (n === 1 ? 'רשומה אחת' : `${n} רשומות`),
    empty: 'אין עדיין רשומות',
    noResults: 'לא נמצאו תוצאות',
    newEntry: 'רשומה חדשה',
    editEntry: 'עריכת רשומה',
    saved: 'נשמר',
    deleted: 'הרשומה נמחקה',
    copied: 'הועתק. הלוח יתנקה בעוד 30 שניות',
    saveFailed: 'השמירה נכשלה',
    show: 'הצג', hide: 'הסתר',
    strength: { weak: 'חוזק: חלשה', medium: 'חוזק: בינונית', strong: 'חוזק: חזקה' },
    deleteBody: (t) => `הרשומה "${t}" תימחק לצמיתות.`,
    updated: (d) => `עודכן: ${d}`,
    selectOne: 'יש לבחור לפחות סוג תווים אחד',
  };

  // ---------- מצב ----------
  let mode = 'unlock'; // 'setup' | 'unlock'
  let entries = [];
  let selectedId = null;
  let editingId = null;
  let genMode = 'standalone'; // 'standalone' | 'pick'
  let generated = '';

  // ---------- צבע דינמי (Material You) מצבע ההדגשה של Windows ----------
  function applyAccent(hex) {
    if (!hex || !/^[0-9a-f]{6}/i.test(hex)) return;
    const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d < 0.05) return; // אפור – נשאר עם ברירת המחדל
    let h;
    if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h = Math.round(h * 60 + 360) % 360;
    const l = (max + min) / 2;
    const s = Math.round(Math.min(70, Math.max(35, (d / (1 - Math.abs(2 * l - 1))) * 70)));
    document.documentElement.style.setProperty('--h', String(h));
    document.documentElement.style.setProperty('--s', `${s}%`);
  }

  // ---------- כלים ----------
  let snackTimer = null;
  function snack(text) {
    const el = $('snackbar');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(snackTimer);
    snackTimer = setTimeout(() => el.classList.remove('show'), 3500);
  }

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

  document.querySelectorAll('.toggle-vis').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = $(btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      if (btn.dataset.target === 'master') $('confirm').type = input.type;
      btn.textContent = show ? T.hide : T.show;
    });
  });

  // ---------- יצירה / פתיחה ----------
  function showLock(m) {
    mode = m;
    entries = []; selectedId = null; editingId = null; generated = '';
    document.querySelectorAll('dialog[open]').forEach((d) => d.close());
    // מוחקים מהדף כל מידע מהכספת, לא רק מסתירים אותו
    $('entries').replaceChildren();
    $('search').value = '';
    document.querySelectorAll('#detail .value, #detail-title, #detail-avatar, #confirm-body, #gen-output').forEach((el) => { el.textContent = ''; });
    ['e-title', 'e-username', 'e-password', 'e-url', 'e-notes'].forEach((id) => { $(id).value = ''; });
    $('detail').hidden = true;
    $('detail-empty').hidden = false;
    $('main-view').classList.remove('show-detail');
    $('main-view').hidden = true;
    $('lock-view').hidden = false;
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
    $('lock-error').textContent = '';
    const res = mode === 'setup' ? await api.create(pw, confirm) : await api.unlock(pw);
    if (mode === 'unlock') $('master').value = '';
    btn.textContent = mode === 'setup' ? T.create : T.unlock;
    btn.disabled = !$('master').value;
    if (res.ok) {
      $('master').value = ''; $('confirm').value = '';
      showMain(res.entries);
    } else {
      $('lock-error').textContent = res.error === 'blocked' ? T.blocked(res.seconds) : (T.errors[res.error] || T.errors.generic);
      $('master').focus();
    }
  });

  // ---------- מסך ראשי ----------
  function showMain(list) {
    entries = list;
    $('lock-view').hidden = true;
    $('main-view').hidden = false;
    $('search').value = '';
    selectedId = null;
    renderList();
    renderDetail();
  }

  function filtered() {
    const q = $('search').value.trim().toLocaleLowerCase();
    if (!q) return entries;
    return entries.filter((e) => [e.title, e.username, e.url, e.notes].some((f) => f.toLocaleLowerCase().includes(q)));
  }

  function renderList() {
    const list = filtered();
    const ul = $('entries');
    ul.replaceChildren();
    for (const e of list) {
      const li = document.createElement('li');
      li.className = 'entry' + (e.id === selectedId ? ' selected' : '');
      li.tabIndex = 0;
      li.dataset.id = e.id;
      const av = document.createElement('div');
      av.className = 'avatar';
      av.textContent = initial(e.title);
      const txt = document.createElement('div');
      txt.className = 'txt';
      const t = document.createElement('div'); t.className = 't'; t.textContent = e.title;
      txt.appendChild(t);
      if (e.username) { const u = document.createElement('div'); u.className = 'u'; u.dir = 'auto'; u.textContent = e.username; txt.appendChild(u); }
      li.append(av, txt);
      li.addEventListener('click', () => select(e.id));
      li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') select(e.id); });
      ul.appendChild(li);
    }
    $('count').textContent = T.count(list.length);
    $('empty').hidden = list.length > 0;
    $('empty').textContent = $('search').value.trim() ? T.noResults : T.empty;
  }

  $('search').addEventListener('input', renderList);

  function select(id) {
    selectedId = id;
    renderList();
    renderDetail();
  }

  let revealed = false;
  function renderDetail() {
    const e = entries.find((x) => x.id === selectedId);
    $('main-view').classList.toggle('show-detail', !!e);
    $('detail-empty').hidden = !!e;
    $('detail').hidden = !e;
    if (!e) return;
    revealed = false;
    $('detail-title').textContent = e.title;
    $('detail-avatar').textContent = initial(e.title);
    const setField = (id, value) => { $(id).hidden = !value; $(id).querySelector('.value').textContent = value; };
    setField('f-username', e.username);
    setField('f-url', e.url);
    $('f-password').hidden = !e.hasPassword;
    $('f-password').querySelector('.value').textContent = '••••••••••';
    $('reveal').textContent = T.show;
    $('detail-strength').hidden = true;
    $('detail-updated').textContent = T.updated(fmtDate(e.updatedAt));
    setField('f-notes', e.notes);
    // הסיסמה לא נשלחת ברשימה – נטענת רק לחישוב החוזק
    if (e.hasPassword) {
      api.get(e.id).then((r) => {
        if (r.entry && selectedId === e.id) setStrength($('detail-strength'), r.entry.password);
      });
    }
  }

  $('reveal').addEventListener('click', async () => {
    const value = $('f-password').querySelector('.value');
    if (revealed) {
      value.textContent = '••••••••••';
      $('reveal').textContent = T.show;
      revealed = false;
      return;
    }
    const r = await api.get(selectedId);
    if (!r.entry) return;
    value.textContent = r.entry.password;
    $('reveal').textContent = T.hide;
    revealed = true;
  });

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = await api.copyField(selectedId, btn.dataset.copy);
      if (r.ok) snack(T.copied);
    });
  });

  $('detail-back').addEventListener('click', () => select(null));
  $('lock-btn').addEventListener('click', () => api.lock());

  // ---------- הוספה / עריכה ----------
  async function openEditor(id) {
    editingId = id;
    let e = { title: '', username: '', password: '', url: '', notes: '' };
    if (id) {
      const r = await api.get(id);
      if (!r.entry) return;
      e = r.entry;
    }
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
      url: $('e-url').value, notes: $('e-notes').value,
    };
    if (!entry.title.trim()) { $('edit-error').textContent = T.errors.titleRequired; $('e-title').focus(); return; }
    const r = await api.save(entry);
    if (!r.ok) { $('edit-error').textContent = T.errors[r.error] || T.saveFailed; return; }
    entries = r.entries;
    $('edit-dialog').close();
    select(r.id);
    snack(T.saved);
  });

  // ---------- מחיקה ----------
  $('detail-delete').addEventListener('click', () => {
    const e = entries.find((x) => x.id === selectedId);
    if (!e) return;
    $('confirm-body').textContent = T.deleteBody(e.title);
    $('confirm-dialog').showModal();
  });
  $('confirm-cancel').addEventListener('click', () => $('confirm-dialog').close());
  $('confirm-ok').addEventListener('click', async () => {
    const r = await api.remove(selectedId);
    $('confirm-dialog').close();
    if (!r.ok) { snack(T.saveFailed); return; }
    entries = r.entries;
    select(null);
    snack(T.deleted);
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
    $('gen-refresh').disabled = $('gen-copy').disabled = $('gen-use').disabled = !generated;
    setStrength($('gen-strength'), generated);
  }
  function openGenerator(m) {
    genMode = m;
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
    if (ev.key === 'Escape' && !$('main-view').hidden && !document.querySelector('dialog[open]') && selectedId) select(null);
    if (ev.ctrlKey && ev.key.toLowerCase() === 'l' && !$('main-view').hidden) api.lock();
    if (ev.ctrlKey && ev.key.toLowerCase() === 'f' && !$('main-view').hidden) { ev.preventDefault(); $('search').focus(); }
  });

  // ---------- התחלה ----------
  api.state().then((s) => {
    applyAccent(s.accent);
    showLock(s.exists ? 'unlock' : 'setup');
  });
})();
