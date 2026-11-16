package com.demo.passwordvault.autofill

import android.app.PendingIntent
import android.app.assist.AssistStructure
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveRequest
import android.text.InputType
import android.view.View
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import com.demo.passwordvault.R
import com.demo.passwordvault.core.AutofillMatch
import com.demo.passwordvault.core.VaultEntry
import java.util.Locale

/** השדות שנמצאו בטופס ההתחברות. */
data class LoginFields(
    val usernameId: AutofillId?,
    val passwordId: AutofillId?,
    val webDomain: String?,
    val packageName: String,
) {
    val ids: Array<AutofillId> get() = listOfNotNull(usernameId, passwordId).toTypedArray()
}

/**
 * שירות המילוי האוטומטי של אנדרואיד.
 * - כספת פתוחה: מציע את הרשומות שמתאימות לאתר/לאפליקציה, ועוד "חיפוש בכספת".
 * - כספת נעולה: מציע "פתח את הכספת" – נפתח מסך סיסמת מאסטר ובחירת רשומה.
 * הסיסמאות לא נשמרות בשום מקום נוסף, ושום דבר לא נכתב ללוג.
 */
class VaultAutofillService : AutofillService() {

    override fun onFillRequest(request: FillRequest, cancellationSignal: CancellationSignal, callback: FillCallback) {
        val structure = request.fillContexts.lastOrNull()?.structure
        if (structure == null) { callback.onSuccess(null); return }
        val fields = parse(structure)
        if (fields == null || fields.packageName == packageName) { callback.onSuccess(null); return }

        val response = FillResponse.Builder()
        val session = VaultHolder.session
        val exact = if (session != null && !session.isLocked && VaultHolder.autofillOnLoad(this)) {
            AutofillMatch.exactForPage(session.entries, fields.webDomain)
        } else emptyList()
        if (exact.isNotEmpty()) {
            // מילוי מהיר: רק החשבונות של האתר הזה בדיוק. אחד → מגע אחד ממלא. כמה → בחירה.
            // (אנדרואיד לא מאפשר לשירות למלא בלי מגע של המשתמש, ולוחצים "התחבר" לבד.)
            if (exact.size > 1 && Build.VERSION.SDK_INT >= 28) {
                response.setHeader(presentation(this, getString(R.string.app_name), com.demo.passwordvault.ui.Txt.AUTOFILL_CHOOSE))
            }
            exact.take(5).forEach { e -> response.addDataset(datasetFor(this, e, fields)) }
        } else if (session != null && !session.isLocked) {
            AutofillMatch.matches(session.entries, fields.webDomain, fields.packageName).take(5).forEach { e ->
                response.addDataset(datasetFor(this, e, fields))
            }
            response.addDataset(authDataset(fields, getString(R.string.autofill_search), getString(R.string.app_name), 1))
        } else {
            response.addDataset(authDataset(fields, getString(R.string.autofill_unlock), getString(R.string.app_name), 2))
        }
        callback.onSuccess(response.build())
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        // שמירת סיסמאות חדשות מתוך טפסים – בגרסה הבאה
        callback.onSuccess()
    }

    /** פריט שפותח את מסך הכספת (פתיחה + בחירת רשומה), והתוצאה ממלאת את הטופס. */
    @Suppress("DEPRECATION")
    private fun authDataset(fields: LoginFields, title: String, subtitle: String, requestCode: Int): Dataset {
        val intent = Intent(this, AutofillAuthActivity::class.java)
            .putExtra(AutofillAuthActivity.EXTRA_USERNAME_ID, fields.usernameId)
            .putExtra(AutofillAuthActivity.EXTRA_PASSWORD_ID, fields.passwordId)
            .putExtra(AutofillAuthActivity.EXTRA_WEB_DOMAIN, fields.webDomain)
            .putExtra(AutofillAuthActivity.EXTRA_PACKAGE, fields.packageName)
        val flags = PendingIntent.FLAG_CANCEL_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
        val pi = PendingIntent.getActivity(this, requestCode, intent, flags)
        val builder = Dataset.Builder(presentation(this, title, subtitle))
        fields.ids.forEach { builder.setValue(it, null) }
        builder.setAuthentication(pi.intentSender)
        return builder.build()
    }

    companion object {
        fun presentation(context: Context, title: String, subtitle: String): RemoteViews =
            RemoteViews(context.packageName, R.layout.autofill_item).apply {
                setTextViewText(R.id.title, title)
                setTextViewText(R.id.subtitle, subtitle)
            }

        @Suppress("DEPRECATION")
        fun datasetFor(context: Context, e: VaultEntry, fields: LoginFields): Dataset {
            val b = Dataset.Builder(presentation(context, e.title, e.username.ifEmpty { "••••••" }))
            fields.usernameId?.let { b.setValue(it, AutofillValue.forText(e.username)) }
            fields.passwordId?.let { b.setValue(it, AutofillValue.forText(e.password)) }
            return b.build()
        }

        /** מוצא שדה שם משתמש ושדה סיסמה בטופס. */
        fun parse(structure: AssistStructure): LoginFields? {
            val textFields = mutableListOf<AssistStructure.ViewNode>()
            var webDomain: String? = null
            fun walk(n: AssistStructure.ViewNode) {
                if (webDomain == null && !n.webDomain.isNullOrBlank()) webDomain = n.webDomain
                if (n.autofillId != null && n.autofillType == View.AUTOFILL_TYPE_TEXT && n.visibility == View.VISIBLE) textFields += n
                for (i in 0 until n.childCount) walk(n.getChildAt(i))
            }
            for (i in 0 until structure.windowNodeCount) walk(structure.getWindowNodeAt(i).rootViewNode)

            val password = textFields.firstOrNull(::isPassword)
            var username = textFields.firstOrNull { it !== password && isUsername(it) }
            if (username == null && password != null) {
                // אין סימן ברור – לוקחים את שדה הטקסט שלפני הסיסמה
                val idx = textFields.indexOf(password)
                username = textFields.take(idx).lastOrNull { !isPassword(it) }
            }
            if (password == null && username == null) return null
            val pkg = structure.activityComponent?.packageName ?: ""
            return LoginFields(username?.autofillId, password?.autofillId, webDomain, pkg)
        }

        private fun text(n: AssistStructure.ViewNode): String = listOfNotNull(
            n.idEntry, n.hint, n.autofillHints?.joinToString(" "),
            n.htmlInfo?.attributes?.joinToString(" ") { "${it.first}=${it.second}" },
        ).joinToString(" ").lowercase(Locale.ROOT)

        private fun isPassword(n: AssistStructure.ViewNode): Boolean {
            val variation = n.inputType and InputType.TYPE_MASK_VARIATION
            val cls = n.inputType and InputType.TYPE_MASK_CLASS
            if (cls == InputType.TYPE_CLASS_TEXT && variation in setOf(
                    InputType.TYPE_TEXT_VARIATION_PASSWORD,
                    InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD,
                    InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD,
                )
            ) return true
            if (cls == InputType.TYPE_CLASS_NUMBER && variation == InputType.TYPE_NUMBER_VARIATION_PASSWORD) return true
            val t = text(n)
            return "type=password" in t || "password" in t || "סיסמ" in t
        }

        private fun isUsername(n: AssistStructure.ViewNode): Boolean {
            val variation = n.inputType and InputType.TYPE_MASK_VARIATION
            if (variation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS || variation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS) return true
            val t = text(n)
            return listOf("username", "user", "email", "e-mail", "login", "account", "type=email", "משתמש", "מייל", "דוא\"ל", "תעודת זהות").any { it in t }
        }
    }
}
