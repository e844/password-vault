package com.demo.passwordvault.core

/**
 * כמה זמן הכספת נשארת פתוחה אחרי שהזנת סיסמת מאסטר – משותף לאפליקציה ולמילוי האוטומטי.
 * נסגרת אחרי הזמן שנבחר ב"נעילה אוטומטית", מהשימוש האחרון (מגע באפליקציה או מילוי בטופס).
 * 0 דקות = בלי הגבלת זמן; אז היא ננעלת כשהמסך כבה.
 */
class UnlockWindow {
    var isOpen = false
        private set
    private var lastUse = 0L

    fun opened(now: Long) { isOpen = true; lastUse = now }
    fun touch(now: Long) { if (isOpen) lastUse = now }
    fun close() { isOpen = false }

    fun expired(now: Long, minutes: Int): Boolean =
        isOpen && now - lastUse >= AutoLockPolicy.minutesToMillis(minutes)

    /** המסך כבה: נועלים רק במצב "רק בנעילת הטלפון" (0). בשאר המצבים – לפי הזמן. */
    fun lockOnScreenOff(minutes: Int): Boolean = isOpen && minutes == 0
}
