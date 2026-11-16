package com.demo.passwordvault.autofill

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.SystemClock
import androidx.core.content.ContextCompat
import com.demo.passwordvault.core.AutoLockPolicy
import com.demo.passwordvault.core.UnlockWindow
import com.demo.passwordvault.core.VaultSession
import com.demo.passwordvault.core.VaultStore
import java.io.File

/**
 * הכספת הפתוחה, משותפת לאפליקציה ולשירות המילוי האוטומטי (באותו תהליך, בזיכרון בלבד).
 * אחרי שהזנת סיסמת מאסטר פעם אחת – גם באפליקציה וגם מתוך המילוי – היא נשארת פתוחה
 * לפי הזמן שנבחר ב"נעילה אוטומטית" (ברירת מחדל 15 דקות מהשימוש האחרון).
 * סיסמת המאסטר עצמה לא נשמרת בשום מקום.
 */
object VaultHolder {
    /** הגדרות לא סודיות (SharedPreferences "settings"). */
    const val PREF_AUTOFILL_ON_LOAD = "autofillOnLoad"
    private const val PREF_AUTO_LOCK = "autoLockMinutes"

    @Volatile
    private var session: VaultSession? = null
    private val window = UnlockWindow()
    private var receiverRegistered = false

    private fun now() = SystemClock.elapsedRealtime()

    private fun prefs(context: Context) = context.applicationContext.getSharedPreferences("settings", Context.MODE_PRIVATE)

    fun autoLockMinutes(context: Context): Int =
        prefs(context).getInt(PREF_AUTO_LOCK, AutoLockPolicy.DEFAULT_MINUTES)
            .takeIf { it in AutoLockPolicy.CHOICES_MINUTES } ?: AutoLockPolicy.DEFAULT_MINUTES

    fun autofillOnLoad(context: Context): Boolean = prefs(context).getBoolean(PREF_AUTOFILL_ON_LOAD, false)

    fun store(context: Context) = VaultStore(File(context.applicationContext.filesDir, "vault.bin"))

    @Synchronized
    fun open(context: Context, s: VaultSession) {
        session = s
        window.opened(now())
        if (!receiverRegistered) {
            // המסך כבה – במצב "רק בנעילת הטלפון" נועלים מיד
            ContextCompat.registerReceiver(
                context.applicationContext,
                object : BroadcastReceiver() {
                    override fun onReceive(c: Context, i: Intent) {
                        if (i.action == Intent.ACTION_SCREEN_OFF && window.lockOnScreenOff(autoLockMinutes(c))) lock()
                    }
                },
                IntentFilter(Intent.ACTION_SCREEN_OFF),
                ContextCompat.RECEIVER_NOT_EXPORTED,
            )
            receiverRegistered = true
        }
    }

    /** הכספת הפתוחה, או null אם היא נעולה / הזמן עבר (ואז היא ננעלת עכשיו). */
    @Synchronized
    fun current(context: Context): VaultSession? {
        val s = session ?: return null
        if (s.isLocked || window.expired(now(), autoLockMinutes(context))) { lock(); return null }
        return s
    }

    /** שימוש בכספת (מגע באפליקציה / מילוי) – מאריך את הזמן. */
    @Synchronized
    fun touch() = window.touch(now())

    /** האם זו עדיין אותה כספת פתוחה (לאפליקציה – לזהות שננעלה מבחוץ). */
    fun isCurrent(s: VaultSession?): Boolean = s != null && session === s && !s.isLocked

    @Synchronized
    fun lock() {
        val s = session
        session = null
        window.close()
        try { s?.lock() } catch (e: Exception) { /* כבר נעולה */ }
    }
}
