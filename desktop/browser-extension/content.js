'use strict';
/*
 * רץ בדפי אתרים. כשנכנסים לשדה שם משתמש / סיסמה – מציג רשימה קטנה מתחת לשדה עם הרשומות
 * שמתאימות לאתר (מהתוכנה במחשב). לחיצה ממלאת. שום דבר לא נשמר בדף ולא נשלח לאתר.
 */
(() => {
  if (window.__pvLoaded) return;
  window.__pvLoaded = true;

  const T = {
    title: 'כספת סיסמאות',
    locked: '🔒 הכספת נעולה – לחץ כדי לפתוח את התוכנה',
    notRunning: 'פתח את תוכנת כספת הסיסמאות',
    noHost: 'התוכנה לא מחוברת. הפעל את "כספת סיסמאות" פעם אחת במחשב.',
    noMatch: 'אין רשומה שמורה לאתר הזה',
    opening: 'פותח את התוכנה… הזן שם את סיסמת המאסטר ואז חזור לשדה',
  };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const isPassword = (el) => el instanceof HTMLInputElement && el.type === 'password';
  const USER_RE = /user|login|email|mail|account|משתמש|מייל|אימייל|ת\.?ז/i;
  const isUsername = (el) => {
    if (!(el instanceof HTMLInputElement)) return false;
    if (!['text', 'email', 'tel', ''].includes(el.type)) return false;
    const ac = (el.autocomplete || '').toLowerCase();
    if (ac.includes('username') || ac.includes('email')) return true;
    if (el.type === 'email') return true;
    return USER_RE.test(`${el.name} ${el.id} ${el.placeholder} ${el.getAttribute('aria-label') || ''}`);
  };
  const passwordFields = () => [...document.querySelectorAll('input[type=password]')].filter(visible);

  function usernameFor(pw) {
    const scope = pw?.form || document;
    const inputs = [...scope.querySelectorAll('input')].filter(visible);
    const idx = pw ? inputs.indexOf(pw) : inputs.length;
    const before = inputs.slice(0, idx < 0 ? inputs.length : idx).reverse();
    return before.find(isUsername) || before.find((i) => ['text', 'email', 'tel'].includes(i.type)) || null;
  }

  const setValue = (el, v, focus = true) => {
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    if (focus) el.focus();
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  function fill(username, password, anchor) {
    const pw = isPassword(anchor) ? anchor : (anchor?.form ? [...anchor.form.querySelectorAll('input[type=password]')].find(visible) : passwordFields()[0]);
    const user = isUsername(anchor) ? anchor : usernameFor(pw || null);
    if (user && username) setValue(user, username);
    if (pw && password) setValue(pw, password);
  }

  // ---------- רשימה קופצת (Shadow DOM כדי שעיצוב האתר לא ישפיע) ----------
  let host = null;
  let current = null;
  function close() { if (host) { host.remove(); host = null; current = null; } }

  function show(anchor, build, mark = 'list') {
    close();
    current = anchor;
    host = document.createElement('div');
    host.setAttribute('data-pv-list', mark); // לזיהוי בבדיקות; בלי פרטים אישיים
    host.style.cssText = 'position:absolute;z-index:2147483647;top:0;left:0;';
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      .box{direction:rtl;font:14px/1.4 "Segoe UI",system-ui,sans-serif;background:#fff;color:#1a1c20;border-radius:16px;
        box-shadow:0 2px 6px rgba(0,0,0,.15),0 8px 24px rgba(0,0,0,.12);padding:6px;min-width:260px;max-width:360px;
        animation:in .16s cubic-bezier(.2,0,0,1)}
      @keyframes in{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}
      .hd{display:flex;align-items:center;gap:8px;padding:6px 10px 8px;font-size:12px;color:#5a5f69}
      .hd img{width:16px;height:16px}
      button{all:unset;box-sizing:border-box;display:block;width:100%;padding:9px 12px;border-radius:12px;cursor:pointer}
      button:hover,button:focus-visible{background:#e8eefc}
      .t{font-weight:600}.u{font-size:12.5px;color:#5a5f69;direction:ltr;text-align:right}
      .msg{padding:8px 12px;color:#5a5f69}
      @media (prefers-color-scheme: dark){.box{background:#23262d;color:#e3e5ea}.hd,.u,.msg{color:#a9adb7}button:hover{background:#30364a}}`;
    const box = document.createElement('div');
    box.className = 'box';
    const hd = document.createElement('div');
    hd.className = 'hd';
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('icons/32.png');
    hd.append(img, T.title);
    box.appendChild(hd);
    build(box);
    root.append(style, box);
    document.documentElement.appendChild(host);
    const r = anchor.getBoundingClientRect();
    host.style.top = `${window.scrollY + r.bottom + 6}px`;
    host.style.left = `${Math.max(8, window.scrollX + r.right - Math.max(260, r.width))}px`;
  }

  function item(box, title, sub, onClick) {
    const b = document.createElement('button');
    const t = document.createElement('div'); t.className = 't'; t.textContent = title;
    b.appendChild(t);
    if (sub) { const u = document.createElement('div'); u.className = 'u'; u.textContent = sub; b.appendChild(u); }
    b.addEventListener('mousedown', (e) => e.preventDefault()); // לא לגנוב פוקוס מהשדה
    b.addEventListener('click', onClick);
    box.appendChild(b);
  }
  function note(box, text) { const d = document.createElement('div'); d.className = 'msg'; d.textContent = text; box.appendChild(d); }

  const ask = (msg) => new Promise((resolve) => {
    try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; resolve(r || { error: 'noHost' }); }); } catch { resolve({ error: 'noHost' }); }
  });

  async function offer(anchor) {
    const r = await ask({ type: 'query' });
    // השדה כבר לא בפוקוס, או שהמשתמש כבר התחיל להקליד – לא מכסים לו את הטופס
    if (document.activeElement !== anchor || anchor.value) return;
    if (r.error === 'noHost') { show(anchor, (box) => note(box, T.noHost)); return; }
    if (r.error === 'notRunning' || r.error === 'timeout') {
      show(anchor, (box) => item(box, T.notRunning, '', async () => { await ask({ type: 'focus' }); show(anchor, (b) => note(b, T.opening)); }));
      return;
    }
    if (r.locked) {
      show(anchor, (box) => item(box, T.locked, '', async () => { await ask({ type: 'focus' }); show(anchor, (b) => note(b, T.opening)); }));
      return;
    }
    if (!r.matches || r.matches.length === 0) return; // אין מה להציע – לא מפריעים
    show(anchor, (box) => {
      for (const m of r.matches) {
        item(box, m.title, m.username, async () => {
          const f = await ask({ type: 'fill', id: m.id });
          close();
          if (f.ok) fill(f.username, f.password, anchor);
        });
      }
    });
  }

  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (el === current) return;
    const relevant = isPassword(el) || (isUsername(el) && (passwordFields().length > 0 || el.autocomplete.includes('username') || el.type === 'email'));
    if (!relevant) { close(); return; }
    offer(el);
  }, true);
  document.addEventListener('mousedown', (e) => { if (host && !host.contains(e.target) && e.target !== current) close(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, true);
  document.addEventListener('input', (e) => { if (host && e.target === current) close(); }, true);
  window.addEventListener('resize', close);

  // ================= מילוי אוטומטי בטעינת דף =================
  // פועל רק כשהמתג בחלון התוסף פעיל, רק בדף הראשי (לא במסגרות מוטמעות), רק ב-https,
  // רק כשהכספת פתוחה, ורק לרשומה עם אותו שם מארח בדיוק. לא לוחץ "התחבר" – זה נשאר למשתמש.
  const A = { choose: 'בחר חשבון למילוי' };
  let autoDone = false;
  const untouched = (pw, user) => !pw.value && !(user && user.value);

  async function autoFillOnLoad() {
    if (autoDone) return;
    const pw = passwordFields()[0];
    if (!pw) return;
    autoDone = true;
    const r = await ask({ type: 'query' });
    if (!r || r.error || r.locked || !r.autoFill || !Array.isArray(r.matches)) return;
    const exact = r.matches.filter((m) => m.exact);
    if (!exact.length) return;
    const user = usernameFor(pw);
    if (!pw.isConnected || !untouched(pw, user)) return; // המשתמש כבר התחיל להקליד – לא נוגעים

    if (exact.length === 1) {
      const f = await ask({ type: 'fill', id: exact[0].id });
      if (!f.ok || !pw.isConnected || !untouched(pw, user)) return;
      if (user && f.username) setValue(user, f.username, false);
      setValue(pw, f.password, false);
      pw.setAttribute('data-pv-autofilled', ''); // לזיהוי בבדיקות; בלי פרטים אישיים
      return;
    }
    // כמה חשבונות לאותו אתר – מציגים בחירה ולא ממלאים לבד
    const anchor = user || pw;
    show(anchor, (box) => {
      const d = document.createElement('div'); d.className = 'msg'; d.textContent = A.choose; box.appendChild(d);
      for (const m of exact) {
        item(box, m.title, m.username, async () => {
          const f = await ask({ type: 'fill', id: m.id });
          close();
          if (f.ok) { fill(f.username, f.password, pw); pw.setAttribute('data-pv-autofilled', ''); }
        });
      }
    }, 'choose');
  }

  if (window.top === window && location.protocol === 'https:') {
    autoFillOnLoad();
    // טפסים שנבנים אחרי הטעינה (אתרים דינמיים) – מחכים להם עד 10 שניות
    if (!autoDone) {
      const mo = new MutationObserver(() => { if (passwordFields().length) { mo.disconnect(); autoFillOnLoad(); } });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => mo.disconnect(), 10000);
    }
  }

  // ================= הצעה לשמור פרטי כניסה חדשים =================
  // הסיסמה נשלחת לתוסף רק כשהטופס נשלח, והתוכנה שומרת רק אחרי לחיצה על "שמור" / "עדכן".
  const S = {
    saveTitle: 'לשמור בכספת?',
    updateTitle: 'לעדכן את הסיסמה בכספת?',
    save: 'שמור',
    update: 'עדכן',
    notNow: 'לא עכשיו',
    locked: 'הכספת נעולה. פתח אותה בתוכנה ואז לחץ שוב.',
    openApp: 'פתח את התוכנה',
    saved: '✓ נשמר בכספת',
    updated: '✓ הסיסמה עודכנה בכספת',
    error: 'השמירה נכשלה. ודא שתוכנת הכספת פתוחה.',
  };

  function captureFrom(scope) {
    const pws = [...scope.querySelectorAll('input[type=password]')].filter((p) => p.value);
    if (!pws.length) return null;
    let password = pws[0].value;
    // הרשמה / החלפת סיסמה: שני השדות האחרונים זהים → זו הסיסמה החדשה
    if (pws.length >= 2 && pws[pws.length - 1].value === pws[pws.length - 2].value) password = pws[pws.length - 1].value;
    const user = usernameFor(pws[0]);
    return { username: user ? user.value.trim() : '', password };
  }

  let lastSent = '';
  let lastAt = 0;
  function onSubmitLike(scope) {
    const c = captureFrom(scope || document);
    if (!c) return;
    const key = `${c.username}\u0000${c.password}`;
    if (key === lastSent && Date.now() - lastAt < 4000) return; // אותה שליחה פעמיים (לחיצה + submit)
    lastSent = key; lastAt = Date.now();
    ask({ type: 'captured', username: c.username, password: c.password }).then((r) => { if (r && r.show) showSavePrompt(r); });
    c.password = '';
  }

  document.addEventListener('submit', (e) => { if (e.target instanceof HTMLFormElement) onSubmitLike(e.target); }, true);
  document.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('button, input[type=submit], input[type=button], [role=button]') : null;
    if (!b) return;
    const scope = b.form || b.closest('form') || document;
    if (scope.querySelector && scope.querySelector('input[type=password]')) setTimeout(() => onSubmitLike(scope), 0);
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return;
    const scope = e.target.form || document;
    if (scope.querySelector('input[type=password]')) onSubmitLike(scope);
  }, true);

  let promptHost = null;
  function closePrompt() { if (promptHost) { promptHost.remove(); promptHost = null; } }

  function showSavePrompt(info) {
    closePrompt();
    promptHost = document.createElement('div');
    promptHost.setAttribute('data-pv-prompt', info.state); // לזיהוי בבדיקות; בלי פרטים אישיים
    promptHost.style.cssText = 'position:fixed;top:14px;right:14px;z-index:2147483647;';
    const root = promptHost.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      [hidden]{display:none !important}
      .card{direction:rtl;font:14px/1.45 "Segoe UI",system-ui,sans-serif;width:340px;background:#fff;color:#1a1c20;border-radius:20px;
        box-shadow:0 4px 10px rgba(0,0,0,.14),0 14px 36px rgba(0,0,0,.16);padding:16px 18px 14px;animation:in .2s cubic-bezier(.2,0,0,1)}
      @keyframes in{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:none}}
      .top{display:flex;align-items:center;gap:10px;margin-bottom:6px}
      .top img{width:22px;height:22px}
      h2{font-size:16px;font-weight:600;margin:0}
      .who{color:#4a4f59;margin:2px 0 12px;font-size:13.5px}
      .who b{direction:ltr;unicode-bidi:isolate;font-weight:600;color:#1a1c20}
      .msg{color:#4a4f59;margin:0 0 10px;font-size:13px}
      .row{display:flex;gap:8px;justify-content:flex-start}
      button{all:unset;cursor:pointer;border-radius:999px;padding:8px 18px;font-weight:600;font-size:14px}
      button:focus-visible{outline:2px solid #3f5f90;outline-offset:2px}
      .primary{background:#3f5f90;color:#fff}.primary:hover{filter:brightness(1.08)}
      .text{color:#3f5f90}.text:hover{background:#e8eefc}
      @media (prefers-color-scheme: dark){.card{background:#23262d;color:#e3e5ea}.who,.msg{color:#a9adb7}.who b{color:#e3e5ea}
        .primary{background:#a9c7ff;color:#07305f}.text{color:#a9c7ff}.text:hover{background:#30364a}}`;
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('role', 'dialog');
    const top = document.createElement('div'); top.className = 'top';
    const img = document.createElement('img'); img.src = chrome.runtime.getURL('icons/32.png'); img.alt = '';
    const h = document.createElement('h2'); h.textContent = info.state === 'update' ? S.updateTitle : S.saveTitle;
    top.append(img, h);
    const who = document.createElement('div'); who.className = 'who';
    const b = document.createElement('b'); b.textContent = info.username || '(ללא שם משתמש)';
    who.append(`${info.host} · `, b);
    const msg = document.createElement('p'); msg.className = 'msg'; msg.hidden = true;
    const row = document.createElement('div'); row.className = 'row';
    const primary = document.createElement('button'); primary.className = 'primary';
    primary.textContent = info.state === 'update' ? S.update : S.save;
    const later = document.createElement('button'); later.className = 'text'; later.textContent = S.notNow;
    const openApp = document.createElement('button'); openApp.className = 'text'; openApp.textContent = S.openApp; openApp.hidden = true;
    row.append(primary, later, openApp);
    card.append(top, who, msg, row);
    root.append(style, card);
    document.documentElement.appendChild(promptHost);
    primary.focus();

    const done = (text) => {
      row.hidden = true; msg.hidden = false; msg.textContent = text;
      promptHost && promptHost.setAttribute('data-pv-prompt', 'done');
      setTimeout(closePrompt, 2200);
    };
    primary.addEventListener('click', async () => {
      primary.disabled = true;
      const r = await ask({ type: 'savePending' });
      primary.disabled = false;
      if (r.ok) { done(r.action === 'updated' ? S.updated : S.saved); return; }
      if (r.locked) {
        msg.hidden = false; msg.textContent = S.locked; openApp.hidden = false;
        promptHost.setAttribute('data-pv-prompt', 'locked');
        primary.focus();
        return;
      }
      msg.hidden = false; msg.textContent = S.error;
    });
    later.addEventListener('click', () => { ask({ type: 'dismissPending' }); closePrompt(); });
    openApp.addEventListener('click', () => { ask({ type: 'focus' }); primary.focus(); });
    card.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); later.click(); } });
  }

  // דף חדש אחרי שליחת הטופס (באותו אתר) – מציגים שוב את ההצעה שממתינה
  if (window.top === window) {
    // הבדיקה מול התוכנה עשויה להסתיים רגע אחרי שהדף החדש נטען – מנסים כמה פעמים
    const tryPending = (n) => ask({ type: 'pendingPrompt' }).then((r) => {
      if (r && r.show) { if (!promptHost) showSavePrompt(r); } else if (n > 0) setTimeout(() => tryPending(n - 1), 700);
    });
    tryPending(4);
  }

  // מילוי שמגיע מחלון התוסף (popup) – רק אם הדף עדיין באותו אתר
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'doFill') {
      if (msg.expectHost && location.hostname !== msg.expectHost) { sendResponse({ ok: false }); return; }
      const target = document.activeElement instanceof HTMLInputElement ? document.activeElement : (passwordFields()[0] || usernameFor(null));
      fill(msg.username, msg.password, target);
      sendResponse({ ok: true });
    }
  });
})();
