package com.demo.passwordvault.core

import java.util.Locale

/** קטגוריות – אותם מפתחות כמו בגרסת המחשב, כדי שגיבויים יעברו בין המכשירים. */
object Categories {
    val KEYS = listOf("general", "banking", "email", "social", "shopping", "work", "home", "entertainment")
    const val DEFAULT = "general"

    fun normalize(key: String?): String = if (key != null && key in KEYS) key else DEFAULT

    private val HINTS: Map<String, List<String>> = linkedMapOf(
        "banking" to listOf("bank", "בנק", "paypal", "pay", "visa", "mastercard", "isracard", "cal-online", "max.co", "leumi", "hapoalim", "discount", "mizrahi", "credit", "אשראי", "ביטוח", "insurance", "crypto", "binance", "coinbase"),
        "email" to listOf("mail", "דואר", "outlook", "gmail", "yahoo", "proton", "walla"),
        "social" to listOf("facebook", "instagram", "twitter", "x.com", "tiktok", "linkedin", "reddit", "whatsapp", "telegram", "discord", "snapchat", "social", "רשת חברתית"),
        "shopping" to listOf("shop", "store", "amazon", "aliexpress", "ebay", "קניות", "חנות", "ksp", "ivory", "shufersal", "temu", "shein"),
        "work" to listOf("slack", "jira", "atlassian", "github", "gitlab", "zoom", "office", "teams", "work", "עבודה", "salesforce", "notion", "server", "admin"),
        "home" to listOf("wifi", "wi-fi", "router", "בית", "חשמל", "electric", "water", "מים", "ארנונה", "gas", "internet", "bezeq", "hot", "partner", "cellcom"),
        "entertainment" to listOf("netflix", "spotify", "youtube", "disney", "steam", "xbox", "playstation", "epic", "twitch", "apple music", "game", "משחק"),
    )

    private val SHORT_ASCII = Regex("^[a-z.\\-]{1,5}$")

    /** ניחוש קטגוריה לפי שם וכתובת (לייבוא מדפדפן). מילים קצרות באנגלית – רק כמילה שלמה. */
    fun guess(title: String, url: String): String {
        val t = "$title $url".lowercase(Locale.ROOT)
        fun has(w: String): Boolean = if (SHORT_ASCII.matches(w)) {
            Regex("(^|[^a-z0-9])" + Regex.escape(w) + "($|[^a-z0-9])").containsMatchIn(t)
        } else {
            t.contains(w)
        }
        for ((cat, words) in HINTS) if (words.any(::has)) return cat
        return DEFAULT
    }
}
