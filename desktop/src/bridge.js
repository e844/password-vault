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

  function handle(msg) {
    if (!msg || !okToken(msg.token)) return { error: 'forbidden' };
    const vault = hooks.getVault();
    switch (msg.type) {
      case 'ping':
        return { ok: true, locked: !vault };
      case 'query': {
        if (!M.isFillablePage(msg.url)) return { ok: true, locked: !vault, matches: [] };
        if (!vault) return { ok: true, locked: true, matches: [] };
        const matches = M.matchesFor(vault.entries, msg.url).slice(0, 8)
          .map((e) => ({ id: e.id, title: e.title, username: e.username }));
        return { ok: true, locked: false, matches };
      }
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
      default:
        return { error: 'unknown' };
    }
  }

  const server = net.createServer((conn) => {
    let buf = '';
    conn.setEncoding('utf8');
    conn.setTimeout(10_000, () => conn.destroy());
    conn.on('data', (chunk) => {
      buf += chunk;
      if (buf.length > 64 * 1024) { conn.destroy(); return; }
      const nl = buf.indexOf('\n');
      if (nl < 0) return;
      let reply;
      try { reply = handle(JSON.parse(buf.slice(0, nl))); } catch { reply = { error: 'bad' }; }
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

module.exports = { startBridge, pipePath };
