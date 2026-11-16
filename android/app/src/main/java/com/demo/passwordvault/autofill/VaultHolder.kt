package com.demo.passwordvault.autofill

import android.content.Context
import com.demo.passwordvault.core.VaultSession
import com.demo.passwordvault.core.VaultStore
import java.io.File

/**
 * הכספת הפתוחה, משותפת לאפליקציה ולשירות המילוי האוטומטי (באותו תהליך).
 * כשהכספת נעולה – null, ושירות המילוי מבקש סיסמת מאסטר.
 */
object VaultHolder {
    @Volatile
    var session: VaultSession? = null

    /** הגדרה לא סודית (SharedPreferences "settings"): מילוי מהיר בטעינת דף. */
    const val PREF_AUTOFILL_ON_LOAD = "autofillOnLoad"

    fun autofillOnLoad(context: Context): Boolean =
        context.applicationContext.getSharedPreferences("settings", Context.MODE_PRIVATE).getBoolean(PREF_AUTOFILL_ON_LOAD, false)

    fun store(context: Context) = VaultStore(File(context.applicationContext.filesDir, "vault.bin"))
}
