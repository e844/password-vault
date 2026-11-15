package com.demo.passwordvault.core

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.SecureRandom
import javax.crypto.AEADBadTagException

class WrongPasswordException : Exception("wrong master password")
class CorruptVaultException(message: String) : Exception(message)

/**
 * קובץ הכספת על הדיסק.
 *
 * מבנה הקובץ:  MAGIC(4) | גרסה(1) | חזרות(4) | מלח(16) | IV(12) | מוצפן+תג
 * הכותרת כולה משמשת כ-AAD, כך שגם שינוי בכותרת מתגלה.
 *
 * סיסמת המאסטר לא נשמרת בשום מקום – גם לא hash שלה. הבדיקה שהסיסמה נכונה
 * היא פשוט הצלחת הפענוח המאומת (AES-GCM).
 */
class VaultStore(
    private val file: File,
    private val iterations: Int = VaultCrypto.DEFAULT_ITERATIONS,
    private val random: SecureRandom = SecureRandom(),
) {
    fun exists(): Boolean = file.exists()

    /** יוצר כספת חדשה. המערך password מאופס בסיום. */
    fun create(password: CharArray, initialEntries: List<VaultEntry>): VaultSession {
        try {
            val salt = ByteArray(VaultCrypto.SALT_LENGTH).also(random::nextBytes)
            val key = VaultCrypto.deriveKey(password, salt, iterations)
            val session = VaultSession(this, key, salt, iterations, initialEntries)
            session.save(initialEntries)
            return session
        } finally {
            password.fill('\u0000')
        }
    }

    /** פותח כספת קיימת. המערך password מאופס בסיום. */
    fun unlock(password: CharArray): VaultSession {
        try {
            val data = file.readBytes()
            val headerLen = MAGIC.size + 1 + 4 + VaultCrypto.SALT_LENGTH + VaultCrypto.IV_LENGTH
            if (data.size < headerLen + 16) throw CorruptVaultException("file too short")
            if (!data.copyOfRange(0, MAGIC.size).contentEquals(MAGIC)) throw CorruptVaultException("bad magic")
            var p = MAGIC.size
            val version = data[p++].toInt()
            if (version != FILE_VERSION.toInt()) throw CorruptVaultException("unsupported version")
            val iters = ((data[p].toInt() and 0xff) shl 24) or ((data[p + 1].toInt() and 0xff) shl 16) or
                ((data[p + 2].toInt() and 0xff) shl 8) or (data[p + 3].toInt() and 0xff)
            p += 4
            if (iters <= 0 || iters > 10_000_000) throw CorruptVaultException("bad iterations")
            val salt = data.copyOfRange(p, p + VaultCrypto.SALT_LENGTH); p += VaultCrypto.SALT_LENGTH
            val iv = data.copyOfRange(p, p + VaultCrypto.IV_LENGTH); p += VaultCrypto.IV_LENGTH
            val header = data.copyOfRange(0, p)
            val ciphertext = data.copyOfRange(p, data.size)

            val key = VaultCrypto.deriveKey(password, salt, iters)
            val plain = try {
                VaultCrypto.decrypt(key, iv, ciphertext, header)
            } catch (e: AEADBadTagException) {
                key.fill(0)
                throw WrongPasswordException()
            }
            val entries = try {
                VaultCodec.decode(plain)
            } finally {
                plain.fill(0)
            }
            return VaultSession(this, key, salt, iters, entries)
        } finally {
            password.fill('\u0000')
        }
    }

    internal fun write(key: ByteArray, salt: ByteArray, iters: Int, entries: List<VaultEntry>) {
        val iv = ByteArray(VaultCrypto.IV_LENGTH).also(random::nextBytes) // IV חדש בכל שמירה
        val headerBytes = ByteArrayOutputStream()
        DataOutputStream(headerBytes).use { out ->
            out.write(MAGIC)
            out.writeByte(FILE_VERSION.toInt())
            out.writeInt(iters)
            out.write(salt)
            out.write(iv)
        }
        val header = headerBytes.toByteArray()
        val plain = VaultCodec.encode(entries)
        val ciphertext = try {
            VaultCrypto.encrypt(key, iv, plain, header)
        } finally {
            plain.fill(0)
        }
        // כתיבה אטומית: קודם לקובץ זמני ואז החלפה, כדי שקריסה לא תשאיר קובץ פגום.
        val tmp = File(file.parentFile, file.name + ".tmp")
        tmp.writeBytes(header + ciphertext)
        try {
            Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
        } catch (e: IOException) {
            tmp.delete()
            throw e
        }
    }

    companion object {
        private val MAGIC = byteArrayOf('P'.code.toByte(), 'V'.code.toByte(), 'L'.code.toByte(), 'T'.code.toByte())
        private const val FILE_VERSION: Byte = 1
    }
}

/** כספת פתוחה. המפתח נמצא רק בזיכרון, ונמחק בנעילה. */
class VaultSession internal constructor(
    private val store: VaultStore,
    private val key: ByteArray,
    private val salt: ByteArray,
    private val iterations: Int,
    initialEntries: List<VaultEntry>,
) {
    var entries: List<VaultEntry> = initialEntries
        private set

    var isLocked: Boolean = false
        private set

    fun save(newEntries: List<VaultEntry>) {
        check(!isLocked) { "vault is locked" }
        store.write(key, salt, iterations, newEntries)
        entries = newEntries
    }

    fun lock() {
        key.fill(0)
        entries = emptyList()
        isLocked = true
    }
}
