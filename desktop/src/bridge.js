'use strict';
/**
 * גשר מקומי בין התוסף לדפדפן לבין התוכנה.
 * הדפדפן מפעיל את native-host.js (Native Messaging), והוא מתחבר לכאן דרך Named Pipe (ב-Windows)
 * או Unix socket (בלינוקס). אין פורט רשת ואין חיבור לאינטרנט.
 * כל בקשה חייבת לכלול אסימון סודי שנוצר מחדש בכל הפעלה של התוכנה.
 */
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const M = require('./match');
const V = require('./vault');
const L = require('./logic');

const MAX_USER = 1000;
const MAX_PASS = 4096;

/** הרשומה הקיימת לאותו אתר ואותו שם משתמש (אם יש). */
function existingFor(entries, url, username) {
  const u = String(username || '').trim().toLowerCase();
  return M.matchesFor(entries, url).find((e) => e.username.trim().toLowerCase() === u) || null;
}

/** 'new' – אין רשומה; 'update' – יש, והסיסמה שונה; 'same' – כבר שמור בדיוק כך. */
function saveState(entries, url, username, password) {
  const e = existingFor(entries, url, username);
  if (!e) return { state: 'new' };
  return e.password === password ? { state: 'same', id: e.id } : { state: 'update', id: e.id };
}

function pipePath(userDataDir) {
  if (process.platform === 'win32') {
    const h = crypto.createHash('sha256').update(userDataDir.toLowerCase()).digest('hex').slice(0, 16);
    return `\\\\.\\pipe\\passwordvault-${h}`;
  }
  return path.join(userDataDir, 'bridge.sock');
}

/**
 * hooks: { getVault(): VaultSession|null, focusWindow(): void, onFilled?(entry, host) }
 */
function startBridge(userDataDir, hooks) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenFile = path.join(userDataDir, 'bridge-token');
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(tokenFile, token, { mode: 0o600 });
  const sock = pipePath(userDataDir);
  if (process.platform !== 'win32') { try { fs.unlinkSync(sock); } catch { /* none */ } }

  const tokenBuf = Buffer.from(token);
  const okToken = (t) => {
    const b = Buffer.from(String(t || ''));
    return b.length === tokenBuf.length && crypto.timingSafeEqual(b, tokenBuf);
  };

  function validCredentials(m) {
    return M.isFillablePage(m.url)
      && typeof m.password === 'string' && m.password.length > 0 && m.password.length <= MAX_PASS
      && typeof (m.username ?? '') === 'string' && String(m.username ?? '').length <= MAX_USER;
  }

  async function handle(msg) {
    if (!msg || !okToken(msg.token)) return { error: 'forbidden' };
    if (msg.type === 'ipc') {
      // הממשק המלא בלשונית של התוסף (רק מדף של התוסף עצמו – נבדק ב-background.js)
      if (!hooks.ipc || typeof msg.channel !== 'string') return { error: 'unknown' };
      return { ok: true, result: await hooks.ipc(msg.channel, msg.args) };
    }
    const vault = hooks.getVault();
    switch (msg.type) {
      case 'ping':
        return { ok: true, locked: !vault };
      case 'query': {
        const autoFill = !!(hooks.getPrefs && hooks.getPrefs().autofillOnLoad);
        if (!M.isFillablePage(msg.url)) return { ok: true, locked: !vault, autoFill, matches: [] };
        if (!vault) return { ok: true, locked: true, autoFill, matches: [] };
        // בלי סיסמאות – רק מה שצריך כדי להציג רשימה. exact = אותו שם מארח בדיוק (למילוי בטעינת דף)
        const matches = M.matchesFor(vault.entries, msg.url).slice(0, 8)
          .map((e) => ({ id: e.id, title: e.title, username: e.username, exact: M.exactHostMatch(e.url, msg.url) }));
        return { ok: true, locked: false, autoFill, matches };
      }
      // הגדרות התוסף (לא סודיות) נשמרות בתוכנה, לא באחסון של התוסף
      case 'getPrefs':
        return { ok: true, autofillOnLoad: !!(hooks.getPrefs && hooks.getPrefs().autofillOnLoad) };
      case 'setPrefs':
        if (!hooks.setPrefs || typeof msg.value !== 'boolean') return { error: 'bad' };
        hooks.setPrefs({ autofillOnLoad: msg.value });
        return { ok: true, autofillOnLoad: msg.value };
      case 'fill': {
        if (!vault) return { ok: false, locked: true };
        const e = vault.entries.find((x) => x.id === msg.id);
        // הגנה: לעולם לא מוסרים סיסמה לאתר שהדומיין שלו לא תואם לרשומה
        if (!e || !M.isFillablePage(msg.url) || !M.domainMatches(e.url, msg.url)) return { ok: false, error: 'noMatch' };
        if (hooks.onFilled) hooks.onFilled(e, M.hostOf(msg.url));
        return { ok: true, username: e.username, password: e.password };
      }
      case 'focus':
        hooks.focusWindow();
        return { ok: true };
      case 'checkSave': {
        // רק בדיקה – לא נשמר כלום
        if (!validCredentials(msg)) return { error: 'bad' };
        if (!vault) return { ok: true, state: 'locked' };
        return { ok: true, ...saveState(vault.entries, msg.url, msg.username, msg.password) };
      }
      case 'save': {
        // נשמר רק אחרי שהמשתמש לחץ "שמור" / "עדכן" בהצעה של התוסף
        if (!validCredentials(msg)) return { error: 'bad' };
        if (!vault) return { ok: false, locked: true };
        const st = saveState(vault.entries, msg.url, msg.username, msg.password);
        if (st.state === 'same') return { ok: true, action: 'same' };
        let next;
        if (st.state === 'update') {
          const e = vault.entries.find((x) => x.id === st.id);
          next = V.updateEntry(vault.entries, { ...e, password: msg.password });
        } else {
          const u = new URL(msg.url);
          const host = u.hostname.replace(/^www\./, '');
          next = V.addEntry(vault.entries, {
            title: host, url: u.origin, username: String(msg.username || '').trim(), password: msg.password,
            notes: '', category: L.guessCategory(host, u.origin),
          });
        }
        vault.save(next);
        if (hooks.onChanged) hooks.onChanged();
        return { ok: true, action: st.state === 'update' ? 'updated' : 'added' };
      }
      default:
        return { error: 'unknown' };
    }
  }

  const server = net.createServer((conn) => {
    let buf = '';
    conn.setEncoding('utf8');
    conn.setTimeout(310_000, () => conn.destroy()); // פעולות עם חלון בחירת קובץ יכולות לקחת זמן
    let started = false;
    conn.on('data', async (chunk) => {
      buf += chunk;
      if (buf.length > 2 * 1024 * 1024) { conn.destroy(); return; }
      const nl = buf.indexOf('\n');
      if (nl < 0 || started) return;
      started = true;
      let reply;
      try { reply = await handle(JSON.parse(buf.slice(0, nl))); } catch { reply = { error: 'bad' }; }
      conn.end(JSON.stringify(reply) + '\n');
    });
    conn.on('error', () => { /* החיבור נסגר – מתעלמים */ });
  });
  server.on('error', () => { /* צינור תפוס (מופע אחר) – הגשר לא זמין */ });
  server.listen(sock, () => {
    if (process.platform !== 'win32') { try { fs.chmodSync(sock, 0o600); } catch { /* ignore */ } }
  });

  return {
    close() {
      server.close();
      try { fs.unlinkSync(tokenFile); } catch { /* ignore */ }
    },
  };
}

module.exports = { startBridge, pipePath, saveState };
