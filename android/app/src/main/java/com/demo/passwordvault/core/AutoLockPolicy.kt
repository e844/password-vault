package com.demo.passwordvault.core

/**
 * מתי לנעול אוטומטית. הזמן מוזרק מבחוץ (millis מונוטוני) כדי שאפשר יהיה לבדוק.
 *  - אחרי [inactivityMillis] בלי מגע במסך
 *  - אחרי [backgroundGraceMillis] מרגע שהאפליקציה עברה לרקע
 */
class AutoLockPolicy(
    var inactivityMillis: Long = 15 * 60_000L,
    var backgroundGraceMillis: Long = 15 * 60_000L,
) {
    companion object {
        /** אפשרויות בדקות; 0 = רק כשהטלפון ננעל / האפליקציה נסגרת. */
        val CHOICES_MINUTES = listOf(1, 5, 15, 30, 60, 0)
        const val DEFAULT_MINUTES = 15

        fun minutesToMillis(m: Int): Long = if (m > 0) m * 60_000L else Long.MAX_VALUE
    }

    fun setMinutes(minutes: Int) {
        val ms = minutesToMillis(minutes)
        inactivityMillis = ms
        backgroundGraceMillis = ms
    }

    private var lastInteraction = 0L
    private var backgroundedAt: Long? = null

    fun onUnlocked(now: Long) {
        lastInteraction = now
        backgroundedAt = null
    }

    fun onInteraction(now: Long) {
        lastInteraction = now
    }

    fun onBackground(now: Long) {
        if (backgroundedAt == null) backgroundedAt = now
    }

    /** מחזיר true אם צריך לנעול בחזרה מהרקע. */
    fun onForeground(now: Long): Boolean {
        val lock = shouldLock(now)
        backgroundedAt = null
        if (!lock) lastInteraction = now
        return lock
    }

    fun shouldLock(now: Long): Boolean {
        if (now - lastInteraction >= inactivityMillis) return true
        val b = backgroundedAt ?: return false
        return now - b >= backgroundGraceMillis
    }
}

/**
 * השהיה אחרי ניסיונות פתיחה שגויים: 5 ניסיונות חופשיים, ואז 30 שניות שמוכפלות בכל כישלון (עד 5 דקות).
 */
class UnlockThrottle(
    private val freeAttempts: Int = 5,
    private val baseDelayMillis: Long = 30_000L,
    private val maxDelayMillis: Long = 5 * 60_000L,
) {
    private var failures = 0
    private var blockedUntil = 0L

    fun remainingBlockMillis(now: Long): Long = (blockedUntil - now).coerceAtLeast(0)

    fun onFailure(now: Long) {
        failures++
        if (failures >= freeAttempts) {
            val exp = (failures - freeAttempts).coerceAtMost(10)
            blockedUntil = now + (baseDelayMillis shl exp).coerceAtMost(maxDelayMillis)
        }
    }

    fun onSuccess() {
        failures = 0
        blockedUntil = 0
    }
}
