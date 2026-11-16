'use strict';
// מתווך בין התוסף לתוכנה במחשב (Native Messaging).
// לא שומר סיסמאות באחסון של התוסף ולא כותב ללוג.
// פרטי כניסה שממתינים להחלטה ("לשמור בכספת?") מוחזקים רק בזיכרון, לכל היותר 3 דקות.
const HOST = 'com.demo.passwordvault';
const PENDING_TTL = 3 * 60 * 1000;

function native(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(HOST, msg, (reply) => {
        if (chrome.runtime.lastError || !reply) resolve({ error: 'noHost' });
        else resolve(reply);
      });
    } catch {
      resolve({ error: 'noHost' });
    }
  });
}

// ---------- הצעות שמירה שממתינות להחלטה (בזיכרון בלבד) ----------
const pending = new Map(); // tabId -> { url, username, password, state, at }

function wipe(tabId) {
  const p = pending.get(tabId);
  if (p) { p.password = ''; pending.delete(tabId); }
}
function sweep() {
  const now = Date.now();
  for (const [tabId, p] of pending) if (now - p.at > PENDING_TTL) wipe(tabId);
}
chrome.tabs.onRemoved.addListener((tabId) => wipe(tabId));

const SECOND_LEVEL = new Set(['co', 'org', 'ac', 'gov', 'net', 'com', 'muni', 'edu']);
function baseDomain(url) {
  try {
    const parts = new URL(url).hostname.toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
    if (parts.length <= 2) return parts.join('.');
    const tld = parts[parts.length - 1];
    return parts.slice(tld.length === 2 && SECOND_LEVEL.has(parts[parts.length - 2]) ? -3 : -2).join('.');
  } catch {
    return '';
  }
}
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const publicInfo = (p) => ({ show: true, state: p.state, host: hostOf(p.url), username: p.username }); // בלי סיסמה

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // הכתובת נלקחת מהדפדפן (sender.url של המסגרת), לא מהדף – כך דף לא יכול להתחזות לאתר אחר.
  // דף של התוסף עצמו (החלון הקופץ). סקריפט בתוך אתר תמיד מגיע עם כתובת האתר, לא עם כתובת התוסף.
  const fromPopup = sender.id === chrome.runtime.id && typeof sender.url === 'string' && sender.url.startsWith(`chrome-extension://${chrome.runtime.id}/popup.html`);
  const url = fromPopup ? msg.url : sender.url;
  const tabId = sender.tab ? sender.tab.id : null;
  // הגדרות התוסף (מתג "מילוי אוטומטי בטעינת דף") – רק מחלון התוסף; נשמרות בתוכנה, לא בתוסף
  if (msg.type === 'getPrefs' || msg.type === 'setPrefs') {
    if (!fromPopup) { sendResponse({ error: 'forbidden' }); return false; }
    native(msg.type === 'setPrefs' ? { type: 'setPrefs', value: !!msg.value } : { type: 'getPrefs' }).then(sendResponse);
    return true;
  }
  if (!url && msg.type !== 'ipc') { sendResponse({ error: 'bad' }); return false; }
  sweep();

  switch (msg.type) {
    // הממשק המלא בלשונית – מותר רק מהדף של התוסף עצמו (לא מאתרים ולא מתוסף אחר)
    case 'ipc': {
      const fromVaultPage = sender.id === chrome.runtime.id && typeof sender.url === 'string'
        && sender.url.startsWith(`chrome-extension://${chrome.runtime.id}/vault/`);
      if (!fromVaultPage || typeof msg.channel !== 'string') { sendResponse({ error: 'forbidden' }); return false; }
      native({ type: 'ipc', channel: msg.channel, args: Array.isArray(msg.args) ? msg.args : [] }).then((r) => {
        if (r.error === 'notRunning') {
          // התוכנה סגורה – פותחים אותה ומבקשים מהלשונית לנסות שוב
          native({ type: 'focus', url: 'https://localhost.invalid/' }).then(() => sendResponse({ error: 'starting' }));
          return;
        }
        sendResponse(r);
      });
      return true;
    }

    case 'query':
    case 'focus':
      native({ type: msg.type, url }).then(sendResponse);
      return true;

    case 'fill':
      native({ type: 'fill', id: String(msg.id || ''), url }).then((r) => {
        if (fromPopup && r.ok && typeof msg.tabId === 'number') {
          let expectHost = '';
          try { expectHost = new URL(url).hostname; } catch { /* ignore */ }
          chrome.tabs.sendMessage(msg.tabId, { type: 'doFill', username: r.username, password: r.password, expectHost }, { frameId: 0 }, () => {
            void chrome.runtime.lastError;
            sendResponse({ ok: true });
          });
        } else {
          sendResponse(r);
        }
      });
      return true;

    // טופס נשלח: בודקים מול התוכנה אם יש מה להציע (חדש / עדכון / זהה)
    case 'captured': {
      if (tabId === null || typeof msg.password !== 'string' || !msg.password) { sendResponse({ show: false }); return false; }
      const username = String(msg.username || '').slice(0, 1000);
      const password = msg.password.slice(0, 4096);
      native({ type: 'checkSave', url, username, password }).then((r) => {
        if (r.error || r.state === 'same') { wipe(tabId); sendResponse({ show: false }); return; }
        const state = r.state === 'update' ? 'update' : 'save'; // גם כשהכספת נעולה מציעים "שמור", והתוכנה תחליט בזמן השמירה
        wipe(tabId);
        pending.set(tabId, { url, username, password, state, at: Date.now() });
        sendResponse(publicInfo(pending.get(tabId)));
      });
      return true;
    }

    // אחרי מעבר לדף הבא באותו אתר – להציג שוב את ההצעה שממתינה
    case 'pendingPrompt': {
      const p = tabId !== null ? pending.get(tabId) : null;
      if (!p || baseDomain(p.url) !== baseDomain(url)) { sendResponse({ show: false }); return false; }
      sendResponse(publicInfo(p));
      return false;
    }

    // המשתמש לחץ "שמור" / "עדכן"
    case 'savePending': {
      const p = tabId !== null ? pending.get(tabId) : null;
      if (!p) { sendResponse({ ok: false, error: 'expired' }); return false; }
      native({ type: 'save', url: p.url, username: p.username, password: p.password }).then((r) => {
        if (r.ok) wipe(tabId);
        sendResponse(r.locked ? { ok: false, locked: true } : r.error ? { ok: false, error: r.error } : { ok: true, action: r.action });
      });
      return true;
    }

    // המשתמש לחץ "לא עכשיו"
    case 'dismissPending':
      if (tabId !== null) wipe(tabId);
      sendResponse({ ok: true });
      return false;

    default:
      sendResponse({ error: 'unknown' });
      return false;
  }
});
