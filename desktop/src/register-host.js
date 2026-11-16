'use strict';
/**
 * רושם את התוכנה כ"Native messaging host" עבור Chrome / Edge / Brave, כדי שהתוסף יוכל לדבר איתה.
 * ב-Windows: מפתח ברישום תחת HKEY_CURRENT_USER (בלי הרשאות מנהל). בלינוקס: קובץ בתיקיית הדפדפן.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile, execFileSync } = require('node:child_process');

/**
 * ב-Windows: נתיב "קצר" (8.3) באותיות אנגליות בלבד, למשל C:\Users\X\ONEDRI~1\9C2B~1.
 * cmd.exe קורא קבצי .bat בקידוד ישן ולא מבין עברית בנתיב – אז עדיף נתיב בלי עברית.
 * אם אין נתיב קצר (או שמשהו נכשל) – מחזירים את הנתיב המקורי.
 */
function shortPath(p) {
  if (process.platform !== 'win32' || /^[\x20-\x7e]*$/.test(p)) return p;
  try {
    const out = execFileSync('cmd.exe', ['/d', '/s', '/c', `"for %I in ("${p}") do @echo %~sI"`], {
      windowsVerbatimArguments: true, windowsHide: true, encoding: 'utf8', timeout: 5000,
    }).trim();
    return /^[\x20-\x7e]+$/.test(out) && out.length > 2 ? out : p;
  } catch {
    return p;
  }
}

/**
 * ב-Windows: נתיב לתוכנה שכולו אותיות אנגליות, כדי שאפשר יהיה לכתוב אותו ב-host.bat.
 * יוצר בתיקיית native-host קיצור מסוג junction בשם app שמצביע על תיקיית התוכנה (לא צריך הרשאות מנהל).
 * אם זה נכשל – נתיב קצר (8.3), ואם גם הוא לא קיים – הנתיב המקורי.
 */
function appExeAlias(hostDir, appExe) {
  const ascii = (x) => /^[\x20-\x7e]*$/.test(x);
  let real = appExe;
  try { real = fs.realpathSync(appExe); } catch { /* נשאר כמו שהוא */ }
  if (ascii(real)) return real;
  const name = path.basename(real);
  if (ascii(name)) {
    const link = path.join(hostDir, 'app');
    try {
      let st = null;
      try { st = fs.lstatSync(link); } catch { /* אין עדיין */ }
      if (st) {
        // מוחקים רק קיצור קודם – לעולם לא תיקייה אמיתית עם תוכן
        if (!st.isSymbolicLink()) throw new Error('not a link');
        fs.unlinkSync(link);
      }
      fs.symlinkSync(path.dirname(real), link, 'junction');
      if (fs.existsSync(path.join(link, name))) return `%~dp0app\\${name}`;
    } catch { /* ננסה נתיב קצר */ }
  }
  return shortPath(real);
}

const HOST_NAME = 'com.demo.passwordvault';
// מזהה קבוע של התוסף (נגזר מהמפתח הציבורי שב-manifest.json של התוסף)
const EXTENSION_ID = 'nkhmbogejfailleiddedhcgmhbehlggn';

const WIN_KEYS = [
  'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts',
  'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts',
  'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts',
  'HKCU\\Software\\Chromium\\NativeMessagingHosts',
];
const LINUX_DIRS = ['google-chrome', 'chromium', 'microsoft-edge', 'BraveSoftware/Brave-Browser'];

/**
 * @param {string} userDataDir   תיקיית הנתונים של התוכנה
 * @param {string} appExe        נתיב ל-PasswordVault.exe (או ל-electron בפיתוח)
 * @param {string[]} extraDirs   תיקיות נוספות לקובץ ההגדרה (לבדיקות)
 */
function registerNativeHost(userDataDir, appExe, extraDirs = []) {
  const dir = path.join(userDataDir, 'native-host');
  fs.mkdirSync(dir, { recursive: true });
  const hostJs = path.join(dir, 'host.js');
  fs.writeFileSync(hostJs, fs.readFileSync(path.join(__dirname, 'native-host.js'), 'utf8'));

  let launcher;
  if (process.platform === 'win32') {
    launcher = path.join(dir, 'host.bat');
    // cmd.exe קורא קבצי .bat בקידוד ישן, ועם chcp 65001 הוא מתבלבל בתווים מרובי-בתים. לכן הקובץ כולו באנגלית:
    // %~dp0 = התיקייה של הקובץ עצמו (נפרש בזמן ריצה, גם אם יש בה עברית), ו-app = קיצור (junction) לתיקיית התוכנה.
    const exeRel = appExeAlias(dir, appExe);
    fs.writeFileSync(launcher, [
      '@echo off',
      'set ELECTRON_RUN_AS_NODE=1',
      'set "PV_BRIDGE_DIR=%~dp0.."',
      `set "PV_APP_EXE=${exeRel}"`,
      '"%PV_APP_EXE%" "%~dp0host.js" %*',
      '',
    ].join('\r\n'));
  } else {
    launcher = path.join(dir, 'host.sh');
    const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
    fs.writeFileSync(launcher, [
      '#!/bin/sh',
      'export ELECTRON_RUN_AS_NODE=1',
      `export PV_BRIDGE_DIR=${q(userDataDir)}`,
      `export PV_APP_EXE=${q(appExe)}`,
      `exec ${q(appExe)} ${q(hostJs)} "$@"`,
      '',
    ].join('\n'), { mode: 0o755 });
  }

  const manifest = {
    name: HOST_NAME,
    description: 'PasswordVault – כספת סיסמאות',
    path: launcher,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${EXTENSION_ID}/`],
  };
  const manifestPath = path.join(dir, `${HOST_NAME}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const targets = [...extraDirs];
  if (process.platform === 'linux') {
    for (const b of LINUX_DIRS) {
      const base = path.join(os.homedir(), '.config', b);
      if (fs.existsSync(base)) targets.push(path.join(base, 'NativeMessagingHosts'));
    }
  }
  for (const t of targets) {
    fs.mkdirSync(t, { recursive: true });
    fs.writeFileSync(path.join(t, `${HOST_NAME}.json`), JSON.stringify(manifest, null, 2));
  }

  if (process.platform === 'win32') {
    for (const key of WIN_KEYS) {
      execFile('reg', ['add', `${key}\\${HOST_NAME}`, '/ve', '/t', 'REG_SZ', '/d', manifestPath, '/f'], { windowsHide: true }, () => { /* אין דפדפן כזה – לא חשוב */ });
    }
  }
  return { manifestPath, launcher };
}

module.exports = { registerNativeHost, HOST_NAME, EXTENSION_ID, shortPath, appExeAlias };
