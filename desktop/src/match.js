'use strict';
/** איזו רשומה מתאימה לאתר – אותם כללים כמו באנדרואיד (core/AutofillMatch.kt). */

const SECOND_LEVEL = new Set(['co', 'org', 'ac', 'gov', 'net', 'com', 'muni', 'edu']);

function hostOf(url) {
  const t = String(url || '').trim();
  if (!t) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`);
    return u.hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/** login.bank.co.il → bank.co.il ; accounts.google.com → google.com */
function baseDomain(host) {
  const parts = String(host).toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const tld = parts[parts.length - 1];
  const second = parts[parts.length - 2];
  return parts.slice(tld.length === 2 && SECOND_LEVEL.has(second) ? -3 : -2).join('.');
}

function domainMatches(entryUrl, pageUrl) {
  const a = hostOf(entryUrl);
  const b = hostOf(pageUrl);
  return !!a && !!b && baseDomain(a) === baseDomain(b);
}

/** רק אתרי http/https אמיתיים (לא file:, לא chrome:, לא כתובת IP פרטית ריקה). */
function isFillablePage(pageUrl) {
  try {
    const u = new URL(pageUrl);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname;
  } catch {
    return false;
  }
}

function matchesFor(entries, pageUrl) {
  if (!isFillablePage(pageUrl)) return [];
  return entries.filter((e) => domainMatches(e.url, pageUrl)).sort((a, b) => a.title.localeCompare(b.title, 'he'));
}

module.exports = { hostOf, baseDomain, domainMatches, matchesFor, isFillablePage };
