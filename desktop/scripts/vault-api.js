'use strict';
/*
 * מחבר את הממשק (app.js) לתוכנה במחשב כשהוא פתוח בלשונית של הדפדפן.
 * כל קריאה עוברת: הלשונית → background.js → Native Messaging → התוכנה. בלי אינטרנט ובלי אחסון.
 */
(() => {
  const call = (channel, ...args) => new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'ipc', channel, args }, (r) => {
      void chrome.runtime.lastError;
      if (r && r.ok) resolve(r.result || {});
      else resolve({ error: r && r.error === 'noHost' ? 'noHost' : (r && r.error) || 'generic' });
    });
  });

  const lockedHandlers = [];
  const changedHandlers = [];
  const unlockedHandlers = [];
  let last = null;
  let pingAt = 0;

  // סנכרון עם התוכנה: נעילה/פתיחה ושינויים שנעשו בחלון התוכנה או מהדפדפן
  async function poll() {
    const s = await call('state');
    if (!s.error) {
      if (last && last.unlocked && !s.unlocked) lockedHandlers.forEach((cb) => cb({ auto: false }));
      if (last && !last.unlocked && s.unlocked) unlockedHandlers.forEach((cb) => cb());
      else if (last && s.unlocked && last.rev !== s.rev) changedHandlers.forEach((cb) => cb({ source: 'sync' }));
      last = s;
    }
    setTimeout(poll, 1500);
  }

  window.vault = {
    state: async () => {
      const s = await call('state');
      if (s.error === 'noHost') { document.body.dataset.nohost = '1'; }
      if (!s.error) last = s;
      // אם התוכנה כבר פתוחה וגם הכספת פתוחה – אין טעם לבקש סיסמה שוב בלשונית; מציגים את מסך הנעילה רגיל
      return s.error ? { exists: true, unlocked: false, accent: null } : s;
    },
    unlock: (p) => call('unlock', p).then((r) => { if (r.ok && last) last.unlocked = true; return r; }),
    create: (p, c) => call('create', p, c).then((r) => { if (r.ok && last) last.unlocked = true; return r; }),
    lock: () => call('lock').then((r) => { if (last) last.unlocked = false; lockedHandlers.forEach((cb) => cb({ auto: false })); return r; }),
    list: () => call('list'),
    get: (id) => call('get', id),
    save: (e) => call('save', e),
    remove: (id) => call('delete', id),
    copyField: (id, f) => call('copyField', id, f),
    copyText: (t) => call('copyText', t),
    generate: (o) => call('generate', o),
    strength: (p) => call('strength', p),
    openUrl: (id) => call('openUrl', id),
    exportCsv: () => call('exportCsv'),
    importCsv: () => call('importCsv'),
    backup: () => call('backup'),
    restorePick: () => call('restorePick'),
    restoreApply: (p) => call('restoreApply', p),
    changeMaster: (a, b, c) => call('changeMaster', a, b, c),
    getSettings: () => call('getSettings'),
    setSettings: (s) => call('setSettings', s),
    updateInfo: () => call('updateInfo'),
    checkUpdate: () => call('checkUpdate'),
    openUpdate: (k) => call('openUpdate', k),
    browserInfo: () => call('browserInfo'),
    openExtensionFolder: () => call('openExtensionFolder'),
    copyExtensionsUrl: () => call('copyExtensionsUrl'),
    activity: () => { const t = Date.now(); if (t - pingAt > 5000) { pingAt = t; call('activityPing'); } },
    onEntriesChanged: (cb) => changedHandlers.push(cb),
    onLocked: (cb) => lockedHandlers.push(cb),
    onUnlockedElsewhere: (cb) => unlockedHandlers.push(cb),
  };
  poll();
})();
