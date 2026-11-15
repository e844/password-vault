'use strict';
/**
 * בדיקת עדכונים מול GitHub Releases. רצה רק כשהמשתמש לוחץ על "בדיקת עדכונים",
 * ומתחברת אך ורק ל-api.github.com. שום מידע מהכספת לא נשלח.
 */
const https = require('node:https');
const path = require('node:path');
const fs = require('node:fs');

const REPO = 'e844/password-vault';
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

function currentBuild() {
  try {
    const info = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build-info.json'), 'utf8'));
    return Number.isInteger(info.build) ? info.build : 0;
  } catch {
    return 0; // בנייה מקומית
  }
}

function parseBuild(tag) {
  const m = /build-(\d+)/.exec(String(tag || ''));
  return m ? Number(m[1]) : 0;
}

/** רק קישורים של המאגר הזה ב-GitHub מותרים לפתיחה. */
function isRepoUrl(u) {
  return typeof u === 'string' && u.startsWith(`https://github.com/${REPO}/`);
}

function summarize(release, current) {
  const latest = parseBuild(release.tag_name);
  const asset = (release.assets || []).find((a) => /Windows\.zip$/i.test(a.name));
  return {
    current,
    latest,
    newer: latest > current,
    name: String(release.name || release.tag_name || ''),
    publishedAt: release.published_at || null,
    page: isRepoUrl(release.html_url) ? release.html_url : RELEASES_PAGE,
    download: asset && isRepoUrl(asset.browser_download_url) ? asset.browser_download_url : null,
  };
}

function fetchLatest() {
  return new Promise((resolve, reject) => {
    const req = https.get({
      host: 'api.github.com',
      path: `/repos/${REPO}/releases/latest`,
      headers: { 'User-Agent': 'PasswordVault-desktop', Accept: 'application/vnd.github+json' },
      timeout: 10_000,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { body += d; if (body.length > 2_000_000) req.destroy(new Error('too big')); });
      res.on('end', () => {
        if (res.statusCode !== 200) { reject(new Error(`status ${res.statusCode}`)); return; }
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function checkForUpdate() {
  return summarize(await fetchLatest(), currentBuild());
}

module.exports = { checkForUpdate, summarize, parseBuild, isRepoUrl, currentBuild, RELEASES_PAGE };
