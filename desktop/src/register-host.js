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
    const exe = shortPath(appExe);
    // chcp 65001: גם אם נשארה עברית בנתיב, cmd יקרא את שאר הקובץ כ-UTF-8 (הפלט מושתק – לא מפריע לדפדפן)
    fs.writeFileSync(launcher, [
      '@echo off',
      'chcp 65001 >nul',
      'set ELECTRON_RUN_AS_NODE=1',
      `set "PV_BRIDGE_DIR=${shortPath(userDataDir)}"`,
      `set "PV_APP_EXE=${exe}"`,
      `"${exe}" "${shortPath(hostJs)}" %*`,
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

module.exports = { registerNativeHost, HOST_NAME, EXTENSION_ID, shortPath };
