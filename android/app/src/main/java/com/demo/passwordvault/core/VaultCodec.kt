package com.demo.passwordvault.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import java.io.ByteArrayInputStream
import java.io.DataInputStream
import java.util.UUID

/**
 * המרת רשימת הרשומות לבייטים (לפני הצפנה) ובחזרה. אין כאן הצפנה.
 * הפורמט הוא JSON זהה לגרסת המחשב: {"v":1,"entries":[...]}, כך שגיבוי עובר בין טלפון למחשב.
 * כספות מגרסה 0.1 של האנדרואיד (פורמט בינארי) עדיין נקראות.
 */
object VaultCodec {
    private const val MAX_FIELD_BYTES = 1_000_000

    fun encode(entries: List<VaultEntry>): ByteArray {
        val obj = buildJsonObject {
            put("v", 1)
            putJsonArray("entries") {
                for (e in entries) addJsonObject {
                    put("id", e.id)
                    put("title", e.title)
                    put("username", e.username)
                    put("password", e.password)
                    put("url", e.url)
                    put("notes", e.notes)
                    put("category", e.category)
                    put("updatedAt", e.updatedAt)
                }
            }
        }
        return obj.toString().toByteArray(Charsets.UTF_8)
    }

    fun decode(data: ByteArray): List<VaultEntry> {
        if (data.isNotEmpty() && data[0] == '{'.code.toByte()) return decodeJson(data)
        return decodeLegacyBinary(data)
    }

    private fun decodeJson(data: ByteArray): List<VaultEntry> {
        val root: JsonObject = try {
            Json.parseToJsonElement(String(data, Charsets.UTF_8)).jsonObject
        } catch (e: Exception) {
            throw CorruptVaultException("bad json")
        }
        try {
            if (root["v"]?.jsonPrimitive?.intOrNull != 1) throw CorruptVaultException("unsupported format")
            return root["entries"]!!.jsonArray.map { el ->
                val o = el.jsonObject
                fun s(k: String) = o[k]?.jsonPrimitive?.contentOrNull ?: ""
                VaultEntry(
                    id = s("id").ifEmpty { UUID.randomUUID().toString() },
                    title = s("title"),
                    username = s("username"),
                    password = s("password"),
                    url = s("url"),
                    notes = s("notes"),
                    category = Categories.normalize(o["category"]?.jsonPrimitive?.contentOrNull),
                    updatedAt = o["updatedAt"]?.jsonPrimitive?.longOrNull ?: System.currentTimeMillis(),
                )
            }
        } catch (e: CorruptVaultException) {
            throw e
        } catch (e: Exception) {
            throw CorruptVaultException("bad content")
        }
    }

    /** הפורמט של גרסה 0.1 (לפני שעברנו ל-JSON). */
    private fun decodeLegacyBinary(data: ByteArray): List<VaultEntry> {
        try {
            DataInputStream(ByteArrayInputStream(data)).use { input ->
                if (input.readInt() != 1) throw CorruptVaultException("unsupported format")
                val count = input.readInt()
                if (count < 0 || count > 100_000) throw CorruptVaultException("bad entry count")
                fun field(): String {
                    val len = input.readInt()
                    if (len < 0 || len > MAX_FIELD_BYTES) throw CorruptVaultException("bad field length")
                    val b = ByteArray(len)
                    input.readFully(b)
                    return String(b, Charsets.UTF_8)
                }
                return List(count) {
                    VaultEntry(
                        id = field(), title = field(), username = field(), password = field(),
                        url = field(), notes = field(), updatedAt = input.readLong(),
                    )
                }
            }
        } catch (e: CorruptVaultException) {
            throw e
        } catch (e: Exception) {
            throw CorruptVaultException("bad content")
        }
    }
}
