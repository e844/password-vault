'use strict';
/**
 * "Native messaging host": הדפדפן מפעיל את הקובץ הזה (דרך PasswordVault.exe במצב Node),
 * מעביר הודעה מהתוסף, והקובץ מעביר אותה לתוכנה הפתוחה דרך הגשר המקומי.
 * פרוטוקול Chrome: 4 בתים אורך (little-endian) + JSON, ב-stdin/stdout.
 * הגדרות מגיעות ממשתני סביבה שנכתבים ע"י register-host.js:
 *   PV_BRIDGE_DIR – תיקיית הנתונים של התוכנה, PV_APP_EXE – לפתיחת התוכנה אם היא סגורה.
 */
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const dir = process.env.PV_BRIDGE_DIR ? path.resolve(process.env.PV_BRIDGE_DIR) : ''; // resolve: מגיע מ-host.bat בצורה ...\native-host\..

function pipePath(userDataDir) {
  if (process.platform === 'win32') {
    const h = crypto.createHash('sha256').update(userDataDir.toLowerCase()).digest('hex').slice(0, 16);
    return `\\\\.\\pipe\\passwordvault-${h}`;
  }
  return path.join(userDataDir, 'bridge.sock');
}

function send(obj) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32LE(json.length, 0);
  process.stdout.write(Buffer.concat([len, json]));
}

function askApp(msg) {
  return new Promise((resolve) => {
    let token;
    try { token = fs.readFileSync(path.join(dir, 'bridge-token'), 'utf8').trim(); } catch { resolve({ error: 'notRunning' }); return; }
    const c = net.connect(pipePath(dir));
    let buf = '';
    c.setEncoding('utf8');
    c.setTimeout(msg.type === 'ipc' ? 300_000 : 8000, () => { c.destroy(); resolve({ error: 'timeout' }); });
    c.on('connect', () => c.write(JSON.stringify({ ...msg, token }) + '\n'));
    c.on('data', (d) => { buf += d; });
    c.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve({ error: 'bad' }); } });
    c.on('error', () => resolve({ error: 'notRunning' }));
  });
}

function launchApp() {
  const exe = process.env.PV_APP_EXE;
  if (!exe || !fs.existsSync(exe)) return false;
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  spawn(exe, [], { detached: true, stdio: 'ignore', env }).unref();
  return true;
}

let input = Buffer.alloc(0);
let pending = 0;
let ended = false;
const maybeExit = () => { if (ended && pending === 0) process.exit(0); };
process.stdin.on('data', async (chunk) => {
  input = Buffer.concat([input, chunk]);
  while (input.length >= 4) {
    const len = input.readUInt32LE(0);
    if (len > 4 * 1024 * 1024) process.exit(1);
    if (input.length < 4 + len) return;
    let msg;
    try { msg = JSON.parse(input.subarray(4, 4 + len).toString('utf8')); } catch { msg = null; }
    input = input.subarray(4 + len);
    if (!msg || typeof msg.type !== 'string') { send({ error: 'bad' }); continue; }
    pending++;
    // מעבירים רק שדות ידועים. הסיסמה עוברת בזיכרון בלבד (stdin → צינור מקומי) ולא נכתבת לשום מקום.
    let reply = await askApp({ type: msg.type, url: msg.url, id: msg.id, username: msg.username, password: msg.password, channel: msg.channel, args: msg.args, value: msg.value });
    if (reply.error === 'notRunning' && msg.type === 'focus') reply = launchApp() ? { ok: true, launched: true } : reply;
    send(reply);
    pending--;
    maybeExit();
  }
});
process.stdin.on('end', () => { ended = true; maybeExit(); });
