package com.demo.passwordvault.core

import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/**
 * עטיפה דקה סביב ספריית ההצפנה הסטנדרטית של Java/Android (JCA).
 * אין כאן מימוש הצפנה עצמי – רק שימוש באלגוריתמים מוכרים:
 *  - PBKDF2WithHmacSHA256 לגזירת מפתח מסיסמת המאסטר
 *  - AES-256-GCM להצפנה מאומתת (כל שינוי בקובץ או סיסמה שגויה יתגלו)
 */
object VaultCrypto {
    /** מספר החזרות המומלץ ע"י OWASP ל-PBKDF2-HMAC-SHA256. */
    const val DEFAULT_ITERATIONS = 600_000
    const val SALT_LENGTH = 16
    const val IV_LENGTH = 12
    private const val KEY_BITS = 256
    private const val TAG_BITS = 128

    fun deriveKey(password: CharArray, salt: ByteArray, iterations: Int): ByteArray {
        require(iterations > 0)
        require(salt.size == SALT_LENGTH)
        val spec = PBEKeySpec(password, salt, iterations, KEY_BITS)
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }

    fun encrypt(key: ByteArray, iv: ByteArray, plaintext: ByteArray, aad: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, iv))
        cipher.updateAAD(aad)
        return cipher.doFinal(plaintext)
    }

    /** זורק javax.crypto.AEADBadTagException אם המפתח שגוי או שהנתונים שונו. */
    fun decrypt(key: ByteArray, iv: ByteArray, ciphertext: ByteArray, aad: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, iv))
        cipher.updateAAD(aad)
        return cipher.doFinal(ciphertext)
    }
}
