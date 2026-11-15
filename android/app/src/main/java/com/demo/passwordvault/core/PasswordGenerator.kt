package com.demo.passwordvault.core

import java.security.SecureRandom
import kotlin.math.ln

data class GeneratorOptions(
    val length: Int = 16,
    val lowercase: Boolean = true,
    val uppercase: Boolean = true,
    val digits: Boolean = true,
    val symbols: Boolean = true,
    val avoidAmbiguous: Boolean = false,
)

enum class Strength { WEAK, MEDIUM, STRONG }

/** מחולל סיסמאות מבוסס SecureRandom (מקור אקראיות קריפטוגרפי של המערכת). */
class PasswordGenerator(private val random: SecureRandom = SecureRandom()) {

    fun generate(options: GeneratorOptions): String {
        require(options.length in MIN_LENGTH..MAX_LENGTH) { "length out of range" }
        val sets = charSets(options)
        require(sets.isNotEmpty()) { "select at least one character type" }
        require(options.length >= sets.size) { "length too short for selected types" }

        val all = sets.joinToString("")
        val chars = ArrayList<Char>(options.length)
        // תו אחד לפחות מכל סוג שנבחר
        sets.forEach { chars += it[random.nextInt(it.length)] }
        while (chars.size < options.length) chars += all[random.nextInt(all.length)]
        chars.shuffle(random)
        return chars.joinToString("")
    }

    companion object {
        const val MIN_LENGTH = 8
        const val MAX_LENGTH = 64

        private const val LOWER = "abcdefghijklmnopqrstuvwxyz"
        private const val UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        private const val DIGITS = "0123456789"
        private const val SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/"
        private const val AMBIGUOUS = "Il1O0o"

        fun charSets(o: GeneratorOptions): List<String> {
            fun clean(s: String) = if (o.avoidAmbiguous) s.filterNot { it in AMBIGUOUS } else s
            return buildList {
                if (o.lowercase) add(clean(LOWER))
                if (o.uppercase) add(clean(UPPER))
                if (o.digits) add(clean(DIGITS))
                if (o.symbols) add(SYMBOLS)
            }
        }

        /** הערכת חוזק גסה לפי אורך ומגוון סוגי התווים. */
        fun strengthOf(password: String): Strength {
            if (password.isEmpty()) return Strength.WEAK
            var pool = 0
            if (password.any { it in 'a'..'z' }) pool += 26
            if (password.any { it in 'A'..'Z' }) pool += 26
            if (password.any { it in '0'..'9' }) pool += 10
            if (password.any { !it.isLetterOrDigit() }) pool += 24
            if (password.any { it.isLetter() && it !in 'a'..'z' && it !in 'A'..'Z' }) pool += 27 // למשל אותיות עבריות
            val bits = password.length * (ln(pool.toDouble()) / ln(2.0))
            return when {
                bits < 50 -> Strength.WEAK
                bits < 80 -> Strength.MEDIUM
                else -> Strength.STRONG
            }
        }
    }
}
