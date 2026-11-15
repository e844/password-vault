'use strict';
// מתווך בין התוסף לתוכנה במחשב (Native Messaging). לא שומר סיסמאות ולא כותב ללוג.
const HOST = 'com.demo.passwordvault';

function native(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(HOST, msg, (reply) => {
        if (chrome.runtime.lastError || !reply) resolve({ error: 'noHost' });
        else resolve(reply);
      });
    } catch {
      resolve({ error: 'noHost' });
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // הכתובת נלקחת מהדפדפן (sender.url של המסגרת), לא מהדף – כך דף לא יכול להתחזות לאתר אחר.
  const fromPopup = !sender.tab && sender.url && sender.url.startsWith(`chrome-extension://${chrome.runtime.id}/`);
  const url = fromPopup ? msg.url : sender.url;
  if (!url) { sendResponse({ error: 'bad' }); return false; }
  if (msg.type === 'query' || msg.type === 'focus') {
    native({ type: msg.type, url }).then(sendResponse);
    return true;
  }
  if (msg.type === 'fill') {
    native({ type: 'fill', id: String(msg.id || ''), url }).then((r) => {
      if (fromPopup && r.ok && typeof msg.tabId === 'number') {
        let expectHost = '';
        try { expectHost = new URL(url).hostname; } catch { /* ignore */ }
        chrome.tabs.sendMessage(msg.tabId, { type: 'doFill', username: r.username, password: r.password, expectHost }, { frameId: 0 }, () => {
          void chrome.runtime.lastError;
          sendResponse({ ok: true });
        });
      } else {
        sendResponse(r);
      }
    });
    return true;
  }
  sendResponse({ error: 'unknown' });
  return false;
});
