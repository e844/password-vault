package com.demo.passwordvault.core

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream

/** המרת רשימת הרשומות לבייטים (לפני הצפנה) ובחזרה. אין כאן הצפנה. */
object VaultCodec {
    private const val FORMAT_VERSION = 1
    private const val MAX_FIELD_BYTES = 1_000_000

    fun encode(entries: List<VaultEntry>): ByteArray {
        val bytes = ByteArrayOutputStream()
        DataOutputStream(bytes).use { out ->
            out.writeInt(FORMAT_VERSION)
            out.writeInt(entries.size)
            for (e in entries) {
                out.writeField(e.id)
                out.writeField(e.title)
                out.writeField(e.username)
                out.writeField(e.password)
                out.writeField(e.url)
                out.writeField(e.notes)
                out.writeLong(e.updatedAt)
            }
        }
        return bytes.toByteArray()
    }

    fun decode(data: ByteArray): List<VaultEntry> {
        DataInputStream(ByteArrayInputStream(data)).use { input ->
            val version = input.readInt()
            if (version != FORMAT_VERSION) throw CorruptVaultException("unsupported format")
            val count = input.readInt()
            if (count < 0 || count > 100_000) throw CorruptVaultException("bad entry count")
            return List(count) {
                VaultEntry(
                    id = input.readField(),
                    title = input.readField(),
                    username = input.readField(),
                    password = input.readField(),
                    url = input.readField(),
                    notes = input.readField(),
                    updatedAt = input.readLong(),
                )
            }
        }
    }

    private fun DataOutputStream.writeField(value: String) {
        val b = value.toByteArray(Charsets.UTF_8)
        writeInt(b.size)
        write(b)
    }

    private fun DataInputStream.readField(): String {
        val len = readInt()
        if (len < 0 || len > MAX_FIELD_BYTES) throw CorruptVaultException("bad field length")
        val b = ByteArray(len)
        readFully(b)
        return String(b, Charsets.UTF_8)
    }
}
