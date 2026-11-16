'use strict';
// מעתיק את הממשק (renderer) לתוך התוסף, כדי שאפשר יהיה לפתוח את הכספת בלשונית בדפדפן.
// מריצים אחרי כל שינוי בממשק: node scripts/sync-extension-ui.js (הבדיקות מוודאות שהעותק עדכני).
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'renderer');
const dst = path.join(root, 'browser-extension', 'vault');

function build() {
  const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8')
    // בדף של תוסף מדיניות האבטחה מוגדרת ב-manifest
    .replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
    .replace('<script src="app.js"></script>', '<script src="vault-api.js"></script>\n  <script src="app.js"></script>')
    .replace('<title>כספת סיסמאות</title>', '<title>כספת סיסמאות</title>\n  <link rel="icon" href="../icons/32.png">');
  return {
    'index.html': html,
    'styles.css': fs.readFileSync(path.join(src, 'styles.css'), 'utf8'),
    'app.js': fs.readFileSync(path.join(src, 'app.js'), 'utf8'),
    'vault-api.js': fs.readFileSync(path.join(__dirname, 'vault-api.js'), 'utf8'),
  };
}

if (require.main === module) {
  fs.mkdirSync(dst, { recursive: true });
  for (const [name, content] of Object.entries(build())) fs.writeFileSync(path.join(dst, name), content);
}
module.exports = { build, dst };
