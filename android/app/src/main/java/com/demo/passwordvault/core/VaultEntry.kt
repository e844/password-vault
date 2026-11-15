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
}
