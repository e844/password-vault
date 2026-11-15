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

  const setValue = (el, v) => {
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    el.focus();
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

  function show(anchor, build) {
    close();
    current = anchor;
    host = document.createElement('div');
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
    if (document.activeElement !== anchor) return;
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
  window.addEventListener('resize', close);

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
