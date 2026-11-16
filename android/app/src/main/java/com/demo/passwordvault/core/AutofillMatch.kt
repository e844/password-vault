package com.demo.passwordvault.core

import java.net.URI
import java.util.Locale

/** איזו רשומה מתאימה לאתר / לאפליקציה שבה המשתמש ממלא טופס התחברות. */
object AutofillMatch {
    private val SECOND_LEVEL = setOf("co", "org", "ac", "gov", "net", "com", "muni", "edu")
    private val PACKAGE_NOISE = setOf("com", "org", "net", "android", "app", "apps", "mobile", "il", "co", "www", "client", "main", "lite", "beta", "debug", "release", "google", "katana")

    fun hostOf(url: String): String? {
        val t = url.trim()
        if (t.isEmpty()) return null
        return try {
            val u = if (Regex("^[a-zA-Z][a-zA-Z0-9+.-]*://").containsMatchIn(t)) t else "https://$t"
            URI(u).host?.lowercase(Locale.ROOT)?.removePrefix("www.")?.takeIf { it.isNotEmpty() }
        } catch (e: Exception) {
            null
        }
    }

    /** הדומיין "הרשום": login.bank.co.il → bank.co.il ; accounts.google.com → google.com */
    fun baseDomain(host: String): String {
        val parts = host.lowercase(Locale.ROOT).removePrefix("www.").split('.').filter { it.isNotEmpty() }
        if (parts.size <= 2) return parts.joinToString(".")
        val tld = parts.last()
        val second = parts[parts.size - 2]
        val take = if (tld.length == 2 && second in SECOND_LEVEL) 3 else 2
        return parts.takeLast(take).joinToString(".")
    }

    fun domainMatches(entryUrl: String, webDomain: String): Boolean {
        val a = hostOf(entryUrl) ?: return false
        val b = hostOf(webDomain) ?: return false
        return baseDomain(a) == baseDomain(b)
    }

    fun packageMatches(e: VaultEntry, packageName: String): Boolean {
        val hay = (e.title + " " + (hostOf(e.url) ?: "")).lowercase(Locale.ROOT)
        return packageName.lowercase(Locale.ROOT).split('.', '_')
            .filter { it.length >= 4 && it !in PACKAGE_NOISE }
            .any { hay.contains(it) }
    }

    /** התאמה מדויקת: אותו שם מארח בדיוק (בלי www) – לא רק אותו דומיין בסיס. */
    fun exactHostMatch(entryUrl: String, webDomain: String): Boolean {
        val a = hostOf(entryUrl) ?: return false
        val b = hostOf(webDomain) ?: return false
        return a == b
    }

    /**
     * "מילוי אוטומטי בטעינת דף": רק באתר (לא באפליקציה), רק רשומות עם אותו שם מארח בדיוק.
     * רשומה אחת → מוצעת לבד, במגע אחד. כמה → בחירה. אף אחת → ההתנהגות הרגילה.
     */
    fun exactForPage(entries: List<VaultEntry>, webDomain: String?): List<VaultEntry> {
        if (webDomain.isNullOrBlank()) return emptyList()
        return entries.filter { exactHostMatch(it.url, webDomain) }.sortedBy { it.title.lowercase(Locale.ROOT) }
    }

    /**
     * רשומות מתאימות. באתר (webDomain) – לפי דומיין בלבד, כדי לא למלא סיסמה של אתר אחד באתר אחר.
     * באפליקציה – לפי שם החבילה (למשל com.facebook.orca ↔ facebook.com).
     */
    fun matches(entries: List<VaultEntry>, webDomain: String?, packageName: String): List<VaultEntry> {
        val list = if (!webDomain.isNullOrBlank()) {
            entries.filter { domainMatches(it.url, webDomain) }
        } else {
            entries.filter { packageMatches(it, packageName) }
        }
        return list.sortedBy { it.title.lowercase(Locale.ROOT) }
    }
}
