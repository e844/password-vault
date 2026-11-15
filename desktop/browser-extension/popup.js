'use strict';
const $ = (id) => document.getElementById(id);
const ask = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; resolve(r || { error: 'noHost' }); }));

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab && tab.url ? tab.url : '';
  let host = '';
  try { host = new URL(url).hostname; } catch { /* no page */ }
  $('site').textContent = host ? `אתר: ${host}` : 'פתח אתר עם טופס התחברות';
  if (!/^https?:/.test(url)) return;

  const r = await ask({ type: 'query', url });
  const status = $('status');
  if (r.error === 'noHost') { status.textContent = 'התוכנה לא מחוברת. הפעל את "כספת סיסמאות" במחשב פעם אחת.'; return; }
  if (r.error) { status.textContent = 'התוכנה לא פתוחה.'; $('open').hidden = false; }
  else if (r.locked) { status.textContent = '🔒 הכספת נעולה. פתח אותה בתוכנה.'; $('open').hidden = false; }
  else if (!r.matches.length) status.textContent = 'אין רשומה שמורה לאתר הזה.';
  for (const m of r.matches || []) {
    const b = document.createElement('button');
    b.className = 'entry';
    const t = document.createElement('b'); t.textContent = m.title;
    const u = document.createElement('span'); u.textContent = m.username;
    b.append(t, u);
    b.addEventListener('click', async () => { await ask({ type: 'fill', id: m.id, url, tabId: tab.id }); window.close(); });
    $('list').appendChild(b);
  }
  $('open').addEventListener('click', async () => { await ask({ type: 'focus', url }); window.close(); });
})();
