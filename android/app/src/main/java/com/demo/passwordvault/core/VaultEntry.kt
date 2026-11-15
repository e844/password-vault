package com.demo.passwordvault.core

import java.util.Locale
import java.util.UUID

/** רשומה אחת בכספת. נשמרת רק בתוך הקובץ המוצפן. */
data class VaultEntry(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val username: String = "",
    val password: String = "",
    val url: String = "",
    val notes: String = "",
    val category: String = Categories.DEFAULT,
    val updatedAt: Long = System.currentTimeMillis(),
) {
    /** לא מדפיסים את הסיסמה גם אם מישהו בטעות קורא toString(). */
    override fun toString(): String = "VaultEntry(id=$id, title=$title)"
}

/** חיפוש בכותרת, שם משתמש, כתובת והערות. לעולם לא בסיסמה עצמה. */
fun List<VaultEntry>.search(query: String): List<VaultEntry> {
    val q = query.trim().lowercase(Locale.ROOT)
    val filtered = if (q.isEmpty()) this else filter { e ->
        e.title.lowercase(Locale.ROOT).contains(q) ||
            e.username.lowercase(Locale.ROOT).contains(q) ||
            e.url.lowercase(Locale.ROOT).contains(q) ||
            e.notes.lowercase(Locale.ROOT).contains(q)
    }
    return filtered.sortedBy { it.title.lowercase(Locale.ROOT) }
}

/** פעולות רשימה טהורות (ללא תופעות לוואי) – קל לבדוק. */
object VaultOps {
    fun add(entries: List<VaultEntry>, entry: VaultEntry): List<VaultEntry> {
        require(entry.title.isNotBlank()) { "title is required" }
        require(entries.none { it.id == entry.id }) { "duplicate id" }
        return entries + entry
    }

    fun update(entries: List<VaultEntry>, entry: VaultEntry, now: Long = System.currentTimeMillis()): List<VaultEntry> {
        require(entry.title.isNotBlank()) { "title is required" }
        require(entries.any { it.id == entry.id }) { "entry not found" }
        return entries.map { if (it.id == entry.id) entry.copy(updatedAt = now) else it }
    }

    fun delete(entries: List<VaultEntry>, id: String): List<VaultEntry> = entries.filterNot { it.id == id }

    data class MergeResult(val entries: List<VaultEntry>, val added: Int, val updated: Int)
    data class ImportResult(val entries: List<VaultEntry>, val added: Int, val duplicates: Int)

    /** מיזוג מגיבוי: id חדש נוסף; id קיים מתעדכן רק אם בגיבוי הוא חדש יותר. */
    fun merge(current: List<VaultEntry>, incoming: List<VaultEntry>): MergeResult {
        val map = LinkedHashMap<String, VaultEntry>()
        current.forEach { map[it.id] = it }
        var added = 0
        var updated = 0
        for (e in incoming) {
            val old = map[e.id]
            if (old == null) { map[e.id] = e; added++ } else if (e.updatedAt > old.updatedAt) { map[e.id] = e; updated++ }
        }
        return MergeResult(map.values.toList(), added, updated)
    }

    /** ייבוא רשומות חדשות (מ-CSV), בלי כפולות (אותה כתובת, משתמש וסיסמה). */
    fun import(current: List<VaultEntry>, incoming: List<VaultEntry>, now: Long = System.currentTimeMillis()): ImportResult {
        fun key(e: VaultEntry) = e.url.lowercase(Locale.ROOT) + "\u0000" + e.username + "\u0000" + e.password
        val seen = current.map(::key).toHashSet()
        val out = current.toMutableList()
        var added = 0
        var duplicates = 0
        for (raw in incoming) {
            val e = raw.copy(id = UUID.randomUUID().toString(), title = raw.title.ifBlank { "ללא שם" }, updatedAt = now)
            if (!seen.add(key(e))) { duplicates++; continue }
            out += e
            added++
        }
        return ImportResult(out, added, duplicates)
    }
}
