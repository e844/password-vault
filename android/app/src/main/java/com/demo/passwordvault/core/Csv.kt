package com.demo.passwordvault.core

import java.net.URI
import java.util.Locale

/**
 * ייבוא/ייצוא CSV בפורמט של דפדפנים (Chrome / Edge / Firefox) וביטוורדן – זהה לגרסת המחשב.
 * ייצוא: name,url,username,password,note,category
 */
object Csv {
    class UnrecognizedCsvException : Exception("unrecognized csv")
    data class Parsed(val entries: List<VaultEntry>, val skipped: Int)

    /** מפענח CSV לפי RFC 4180. */
    fun parse(text: String): List<List<String>> {
        val s = text.removePrefix("﻿")
        val rows = mutableListOf<List<String>>()
        var row = mutableListOf<String>()
        val field = StringBuilder()
        var quoted = false
        var i = 0
        fun endRow() {
            row.add(field.toString()); field.setLength(0)
            if (row.size > 1 || row[0].isNotEmpty()) rows.add(row)
            row = mutableListOf()
        }
        while (i < s.length) {
            val c = s[i]
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < s.length && s[i + 1] == '"') { field.append('"'); i++ } else quoted = false
                } else field.append(c)
            } else when {
                c == '"' && field.isEmpty() -> quoted = true
                c == ',' -> { row.add(field.toString()); field.setLength(0) }
                c == '\n' || c == '\r' -> {
                    if (c == '\r' && i + 1 < s.length && s[i + 1] == '\n') i++
                    endRow()
                }
                else -> field.append(c)
            }
            i++
        }
        if (field.isNotEmpty() || row.isNotEmpty()) endRow()
        return rows
    }

    private fun field(v: String): String =
        if (v.any { it == '"' || it == ',' || it == '\n' || it == '\r' }) "\"" + v.replace("\"", "\"\"") + "\"" else v

    fun export(entries: List<VaultEntry>): String {
        val sb = StringBuilder("﻿")
        sb.append("name,url,username,password,note,category\r\n")
        for (e in entries) {
            sb.append(listOf(e.title, e.url, e.username, e.password, e.notes, e.category).joinToString(",") { field(it) }).append("\r\n")
        }
        return sb.toString()
    }

    private val HEADERS = mapOf(
        "title" to listOf("name", "title", "login_name", "שם"),
        "url" to listOf("url", "login_uri", "website", "uri", "origin", "כתובת"),
        "username" to listOf("username", "login_username", "user", "email", "login", "שם משתמש"),
        "password" to listOf("password", "login_password", "pass", "סיסמה"),
        "notes" to listOf("note", "notes", "extra", "comments", "הערות"),
        "category" to listOf("category", "folder", "grouping", "group", "קטגוריה"),
    )

    private fun hostOf(url: String): String = try {
        val u = if (Regex("^[a-zA-Z]+://").containsMatchIn(url)) url else "https://$url"
        (URI(u).host ?: "").removePrefix("www.")
    } catch (e: Exception) {
        ""
    }

    fun parseEntries(text: String): Parsed {
        val rows = parse(text)
        if (rows.size < 2) return Parsed(emptyList(), 0)
        val header = rows[0].map { it.trim().lowercase(Locale.ROOT) }
        val col = HEADERS.mapValues { (_, names) -> header.indexOfFirst { it in names } }.filterValues { it >= 0 }
        if ("password" !in col && "username" !in col) throw UnrecognizedCsvException()
        val out = mutableListOf<VaultEntry>()
        var skipped = 0
        for (r in rows.drop(1)) {
            fun get(k: String) = col[k]?.let { r.getOrNull(it)?.trim() } ?: ""
            val url = get("url")
            val username = get("username")
            val password = col["password"]?.let { r.getOrNull(it) } ?: ""
            var title = get("title").ifEmpty { hostOf(url) }.ifEmpty { username }
            if (title.isEmpty() && password.isEmpty()) { skipped++; continue }
            if (title.isEmpty()) title = "ללא שם"
            val rawCat = get("category").lowercase(Locale.ROOT)
            val category = if (rawCat in Categories.KEYS) rawCat else Categories.guess(title, url)
            out += VaultEntry(title = title, url = url, username = username, password = password, notes = get("notes"), category = category)
        }
        return Parsed(out, skipped)
    }
}
