'use strict';
const { app, BrowserWindow, ipcMain, clipboard, powerMonitor, session, Menu, nativeTheme, systemPreferences, dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const V = require('./vault');
const L = require('./logic');
const C = require('./csv');
const { startBridge } = require('./bridge');
const { registerNativeHost, EXTENSION_ID } = require('./register-host');
const U = require('./update');

// מאפשר לבדיקות להשתמש בתיקיית נתונים נפרדת
if (process.env.PV_USER_DATA) app.setPath('userData', process.env.PV_USER_DATA);

// אם התוכנה כבר פתוחה – המופע החדש רק מבקש מהקיים להציג את החלון, ויוצא מיד
if (!app.requestSingleInstanceLock()) {
  app.exit(0);
  process.exit(0);
}

// שגיאה לא צפויה בתהליך הראשי: מציגים הודעה במקום להיעלם בשקט (בלי מידע מהכספת)
process.on('uncaughtException', (e) => {
  try { dialog.showErrorBox('כספת סיסמאות – שגיאה', String((e && e.stack) || e)); } catch { /* ignore */ }
});

const store = new V.VaultStore(path.join(app.getPath('userData'), 'vault.bin'));
const S = require('./settings');
let settings = S.load(app.getPath('userData'));
// לבדיקות בלבד: זמן נעילה קצר מאוד
const testInactivity = Number(process.env.PV_TEST_INACTIVITY_MS);
const policy = new L.AutoLockPolicy();
function applyLockSettings() {
  const ms = Number.isFinite(testInactivity) && testInactivity > 0 ? testInactivity : S.minutesToMs(settings.autoLockMinutes);
  policy.inactivityMs = ms;
  policy.backgroundGraceMs = ms; // גם כשהחלון ממוזער – אותו זמן
}
applyLockSettings();
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
  // רשת ביטחון: אם מסיבה כלשהי "מוכן להצגה" לא הגיע – מציגים בכל זאת
  win.webContents.once('did-finish-load', () => { if (win && !win.isVisible()) win.show(); });
  setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible()) win.show(); }, 2500);
  win.webContents.on('render-process-gone', () => {
    if (win && !win.isDestroyed()) { lock(false); win.reload(); }
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  win.on('minimize', () => vault && policy.onBackground(now()));
  win.on('hide', () => vault && policy.onBackground(now()));
  const back = () => { if (vault && policy.onForeground(now())) lock(true); };
  win.on('restore', back);
  win.on('show', back);
  win.on('focus', back);
  win.on('closed', () => { win = null; });
}

let pendingRestore = null;
let bridge = null;

const extensionDir = () => (app.isPackaged
  ? path.join(process.resourcesPath, 'browser-extension')
  : path.join(__dirname, '..', 'browser-extension'));

// ---------- חלונות קבצים (בבדיקות אוטומטיות: נתיבים קבועים במקום חלון) ----------
const TEST_DIR = process.env.PV_TEST_DIALOG_DIR || null;
const stamp = () => new Date().toISOString().slice(0, 10);

async function pickSavePath(title, defaultName, filters) {
  if (TEST_DIR) return path.join(TEST_DIR, defaultName);
  const r = await dialog.showSaveDialog(win, { title, defaultPath: path.join(app.getPath('documents'), defaultName), filters });
  return r.canceled || !r.filePath ? null : r.filePath;
}

async function pickOpenPath(title, filters) {
  if (TEST_DIR) return process.env.PV_TEST_OPEN_FILE || null;
  const r = await dialog.showOpenDialog(win, { title, properties: ['openFile'], filters });
  return r.canceled || !r.filePaths.length ? null : r.filePaths[0];
}

function lock(auto = false) {
  pendingRestore = null;
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
    category: String(entry.category || 'general'),
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

handle('getSettings', () => ({ settings, choices: S.AUTO_LOCK_CHOICES }));
handle('setSettings', (next) => {
  settings = S.save(app.getPath('userData'), { ...settings, ...(next || {}) });
  applyLockSettings();
  if (vault) policy.onInteraction(now());
  return { ok: true, settings };
});

handle('strength', (password) => ({ strength: L.strengthOf(password) }));

// ---------- פתיחת אתר בדפדפן ----------
handle('openUrl', async (id) => {
  requireVault();
  const e = vault.entries.find((x) => x.id === id);
  if (!e || !e.url.trim()) return { error: 'noUrl' };
  let u;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(e.url.trim()) ? e.url.trim() : `https://${e.url.trim()}`); } catch { return { error: 'badUrl' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: 'badUrl' };
  if (TEST_DIR) { globalThis.pvLastExternalUrl = u.href; return { ok: true }; }
  await shell.openExternal(u.href); // נפתח בדפדפן ברירת המחדל; האפליקציה עצמה לא מתחברת לרשת
  return { ok: true };
});

// ---------- ייצוא / ייבוא CSV ----------
handle('exportCsv', async () => {
  requireVault();
  const file = await pickSavePath('ייצוא סיסמאות לקובץ CSV', `PasswordVault-${stamp()}.csv`, [{ name: 'CSV', extensions: ['csv'] }]);
  if (!file) return { canceled: true };
  fs.writeFileSync(file, C.toCsv(vault.entries), { encoding: 'utf8', mode: 0o600 });
  return { ok: true, count: vault.entries.length, name: path.basename(file) };
});

handle('importCsv', async () => {
  requireVault();
  const file = await pickOpenPath('ייבוא סיסמאות מקובץ CSV', [{ name: 'CSV', extensions: ['csv'] }]);
  if (!file) return { canceled: true };
  if (fs.statSync(file).size > 20 * 1024 * 1024) return { error: 'tooBig' };
  let parsed;
  try { parsed = C.entriesFromCsv(fs.readFileSync(file, 'utf8')); } catch { return { error: 'csvFormat' }; }
  const r = V.importEntries(vault.entries, parsed.entries);
  if (r.added) vault.save(r.entries);
  return { ok: true, added: r.added, duplicates: r.duplicates, skipped: parsed.skipped, entries: list() };
});

// ---------- גיבוי מוצפן / שחזור ----------
handle('backup', async () => {
  requireVault();
  const file = await pickSavePath('שמירת גיבוי מוצפן', `PasswordVault-backup-${stamp()}.pvault`, [{ name: 'גיבוי כספת', extensions: ['pvault'] }]);
  if (!file) return { canceled: true };
  vault.save(vault.entries); // מוודא שהקובץ עדכני, ואז מעתיקים אותו כמו שהוא – מוצפן
  fs.copyFileSync(store.file, file);
  return { ok: true, name: path.basename(file) };
});

handle('restorePick', async () => {
  requireVault();
  const file = await pickOpenPath('בחירת קובץ גיבוי', [{ name: 'גיבוי כספת', extensions: ['pvault', 'bin'] }]);
  if (!file) return { canceled: true };
  pendingRestore = file;
  return { ok: true, name: path.basename(file) };
});

handle('restoreApply', async (password) => {
  requireVault();
  if (!pendingRestore) return { error: 'generic' };
  if (busy) return { error: 'busy' };
  busy = true;
  try {
    const incoming = await V.readBackup(pendingRestore, Buffer.from(String(password || ''), 'utf8'));
    const r = V.mergeEntries(vault.entries, incoming);
    vault.save(r.entries);
    pendingRestore = null;
    return { ok: true, added: r.added, updated: r.updated, entries: list() };
  } catch (e) {
    if (e instanceof V.WrongPasswordError) return { error: 'wrong' };
    if (e instanceof V.CorruptVaultError) return { error: 'corrupt' };
    return { error: 'generic' };
  } finally { busy = false; }
});

// התמונה האישית הוסרה מהתוכנה – מוחקים תמונה ששמורה מגרסה קודמת
try { fs.rmSync(path.join(app.getPath('userData'), 'appearance'), { recursive: true, force: true }); } catch { /* ignore */ }

// ---------- עדכונים (GitHub Releases) ----------
let lastUpdate = null;
handle('updateInfo', () => ({ current: U.currentBuild(), page: U.RELEASES_PAGE }));
handle('checkUpdate', async () => {
  if (TEST_DIR) {
    lastUpdate = U.summarize(JSON.parse(process.env.PV_TEST_RELEASE || '{}'), U.currentBuild());
    return { ok: true, ...lastUpdate };
  }
  try {
    lastUpdate = await U.checkForUpdate();
    return { ok: true, ...lastUpdate };
  } catch {
    return { error: 'offline' };
  }
});
handle('openUpdate', async (kind) => {
  const url = kind === 'download' ? lastUpdate?.download : (lastUpdate?.page || U.RELEASES_PAGE);
  if (!U.isRepoUrl(url)) return { error: 'generic' };
  if (TEST_DIR) { globalThis.pvLastExternalUrl = url; return { ok: true }; }
  await shell.openExternal(url);
  return { ok: true };
});

// ---------- מילוי אוטומטי בדפדפן ----------
handle('browserInfo', () => ({ extensionId: EXTENSION_ID, folder: extensionDir() }));
handle('openExtensionFolder', async () => {
  if (TEST_DIR) return { ok: true };
  const err = await shell.openPath(extensionDir());
  return err ? { error: 'generic' } : { ok: true };
});
handle('copyExtensionsUrl', async () => { await clipboard.writeText('chrome://extensions'); return { ok: true }; });

// ---------- החלפת סיסמת מאסטר ----------
handle('changeMaster', async (current, next, confirm) => {
  requireVault();
  if (typeof next !== 'string' || [...next].length < 8) return { error: 'tooShort' };
  if (next !== confirm) return { error: 'mismatch' };
  if (busy) return { error: 'busy' };
  busy = true;
  try {
    try {
      (await store.unlock(Buffer.from(String(current || ''), 'utf8'))).lock();
    } catch (e) {
      return { error: e instanceof V.WrongPasswordError ? 'wrongCurrent' : 'generic' };
    }
    await vault.changePassword(Buffer.from(next, 'utf8'));
    return { ok: true };
  } finally { busy = false; }
});

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

  // מילוי אוטומטי בדפדפן: גשר מקומי + רישום ה-Native messaging host
  bridge = startBridge(app.getPath('userData'), {
    getVault: () => vault,
    focusWindow: () => showWindow(),
    onFilled: () => policy.onInteraction(now()),
  });
  try {
    const extra = process.env.PV_TEST_NM_DIR ? process.env.PV_TEST_NM_DIR.split(path.delimiter) : [];
    registerNativeHost(app.getPath('userData'), process.execPath, extra);
  } catch { /* בלי מילוי בדפדפן – שאר התוכנה עובדת */ }

  setInterval(() => { if (vault && policy.shouldLock(now())) lock(true); }, 1000);
  powerMonitor.on('lock-screen', () => lock(true));
  powerMonitor.on('suspend', () => lock(true));
});

app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (ev) => ev.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

function showWindow() {
  if (!win || win.isDestroyed()) { createWindow(); return; }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

app.on('second-instance', () => { if (app.isReady()) showWindow(); });

let quitting = false;
app.on('before-quit', (ev) => {
  if (quitting) return;
  ev.preventDefault();
  quitting = true;
  if (bridge) bridge.close();
  Promise.resolve(lock(false)).finally(() => app.quit());
});
app.on('window-all-closed', () => app.quit());
