'use strict';
const { app, BrowserWindow, ipcMain, clipboard, powerMonitor, session, Menu, nativeTheme, systemPreferences } = require('electron');
const path = require('node:path');
const V = require('./vault');
const L = require('./logic');

// מאפשר לבדיקות להשתמש בתיקיית נתונים נפרדת
if (process.env.PV_USER_DATA) app.setPath('userData', process.env.PV_USER_DATA);

if (!app.requestSingleInstanceLock()) app.quit();

const store = new V.VaultStore(path.join(app.getPath('userData'), 'vault.bin'));
// לבדיקות בלבד: אפשר רק לקצר את זמן הנעילה, לא להאריך
const testInactivity = Number(process.env.PV_TEST_INACTIVITY_MS);
const policy = new L.AutoLockPolicy(
  Number.isFinite(testInactivity) && testInactivity > 0 ? { inactivityMs: Math.min(testInactivity, 120_000) } : {},
);
const throttle = new L.UnlockThrottle();
const now = () => performance.now();

let win = null;
let vault = null; // VaultSession כשהכספת פתוחה
let busy = false;
let clipboardText = null;
let clipboardTimer = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 740,
    minWidth: 460,
    minHeight: 560,
    title: 'כספת סיסמאות',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#111318' : '#f9f9ff',
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  // חוסם צילום מסך והקלטה של החלון (Windows)
  win.setContentProtection(true);
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  win.on('minimize', () => vault && policy.onBackground(now()));
  win.on('hide', () => vault && policy.onBackground(now()));
  const back = () => { if (vault && policy.onForeground(now())) lock(true); };
  win.on('restore', back);
  win.on('show', back);
  win.on('focus', back);
  win.on('closed', () => { win = null; });
}

function lock(auto = false) {
  if (vault) { vault.lock(); vault = null; }
  if (win) win.webContents.send('locked', { auto });
  return clearClipboard();
}

// ב-Electron 45 פעולות הלוח אסינכרוניות
async function clearClipboard() {
  if (clipboardTimer) clearTimeout(clipboardTimer);
  clipboardTimer = null;
  const ours = clipboardText;
  clipboardText = null;
  if (ours === null) return;
  try {
    // מנקה רק אם הלוח עדיין מכיל את מה שהעתקנו
    if ((await clipboard.readText()) === ours) {
      await clipboard.writeText('');
      clipboard.clear();
    }
  } catch { /* אין מה לעשות; לא כותבים ללוג */ }
}

async function copySecret(text) {
  await clearClipboard();
  await clipboard.writeText(text);
  clipboardText = text;
  clipboardTimer = setTimeout(clearClipboard, 30_000);
}

const list = () => V.searchEntries(vault.entries, '').map(V.summary);

function requireVault() {
  if (!vault) throw new Error('locked');
  policy.onInteraction(now());
}

// ---------- IPC ----------
function handle(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    if (!win || event.sender !== win.webContents) return { error: 'forbidden' };
    try {
      return await fn(...args);
    } catch (e) {
      return { error: e && e.message === 'locked' ? 'locked' : 'generic' };
    }
  });
}

handle('state', () => ({
  exists: store.exists(),
  unlocked: !!vault,
  accent: process.platform === 'win32' || process.platform === 'darwin' ? safeAccent() : null,
}));

function safeAccent() {
  try { return systemPreferences.getAccentColor(); } catch { return null; }
}

handle('create', async (password, confirm) => {
  if (busy) return { error: 'busy' };
  if (typeof password !== 'string' || [...password].length < 8) return { error: 'tooShort' };
  if (password !== confirm) return { error: 'mismatch' };
  if (store.exists()) return { error: 'exists' };
  busy = true;
  try {
    vault = await store.create(Buffer.from(password, 'utf8'), L.sampleEntries());
    policy.onUnlocked(now());
    return { ok: true, entries: list() };
  } finally { busy = false; }
});

handle('unlock', async (password) => {
  if (busy) return { error: 'busy' };
  const blocked = throttle.remainingMs(now());
  if (blocked > 0) return { error: 'blocked', seconds: Math.ceil(blocked / 1000) };
  if (typeof password !== 'string') return { error: 'wrong' };
  busy = true;
  try {
    vault = await store.unlock(Buffer.from(password, 'utf8'));
    throttle.onSuccess();
    policy.onUnlocked(now());
    return { ok: true, entries: list() };
  } catch (e) {
    if (e instanceof V.WrongPasswordError) {
      throttle.onFailure(now());
      const b = throttle.remainingMs(now());
      return b > 0 ? { error: 'blocked', seconds: Math.ceil(b / 1000) } : { error: 'wrong' };
    }
    if (e instanceof V.CorruptVaultError) return { error: 'corrupt' };
    return { error: 'generic' };
  } finally { busy = false; }
});

handle('lock', async () => { await lock(false); return { ok: true }; });

handle('list', () => { requireVault(); return { entries: list() }; });

handle('get', (id) => {
  requireVault();
  const e = vault.entries.find((x) => x.id === id);
  return e ? { entry: { ...e } } : { error: 'notFound' };
});

handle('save', (entry) => {
  requireVault();
  if (!entry || typeof entry.title !== 'string' || !entry.title.trim()) return { error: 'titleRequired' };
  const clean = {
    id: typeof entry.id === 'string' ? entry.id : undefined,
    title: entry.title, username: String(entry.username || ''), password: String(entry.password || ''),
    url: String(entry.url || ''), notes: String(entry.notes || ''),
  };
  const exists = clean.id && vault.entries.some((x) => x.id === clean.id);
  const next = exists ? V.updateEntry(vault.entries, clean) : V.addEntry(vault.entries, { ...clean, id: undefined });
  vault.save(next);
  const saved = exists ? next.find((x) => x.id === clean.id) : next.at(-1);
  return { ok: true, id: saved.id, entries: list() };
});

handle('delete', (id) => {
  requireVault();
  vault.save(V.deleteEntry(vault.entries, id));
  return { ok: true, entries: list() };
});

handle('copyField', async (id, field) => {
  requireVault();
  const e = vault.entries.find((x) => x.id === id);
  if (!e || !['username', 'password', 'url'].includes(field)) return { error: 'notFound' };
  await copySecret(e[field]);
  return { ok: true };
});

handle('copyText', async (text) => { await copySecret(String(text || '')); return { ok: true }; });

handle('generate', (options) => {
  try { return { password: L.generatePassword(options || {}) }; } catch { return { error: 'options' }; }
});

handle('strength', (password) => ({ strength: L.strengthOf(password) }));

ipcMain.on('activity', (event) => {
  if (win && event.sender === win.webContents && vault) policy.onInteraction(now());
});

// ---------- אפליקציה ----------
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  // אין אינטרנט: חוסמים כל בקשה שאינה לקובץ מקומי של האפליקציה
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {
    cb({ cancel: !(details.url.startsWith('file://') || details.url.startsWith('devtools://')) });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

  createWindow();

  setInterval(() => { if (vault && policy.shouldLock(now())) lock(true); }, 1000);
  powerMonitor.on('lock-screen', () => lock(true));
  powerMonitor.on('suspend', () => lock(true));
});

app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (ev) => ev.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

let quitting = false;
app.on('before-quit', (ev) => {
  if (quitting) return;
  ev.preventDefault();
  quitting = true;
  Promise.resolve(lock(false)).finally(() => app.quit());
});
app.on('window-all-closed', () => app.quit());
