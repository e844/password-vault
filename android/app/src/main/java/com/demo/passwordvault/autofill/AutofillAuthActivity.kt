package com.demo.passwordvault.autofill

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.view.autofill.AutofillId
import android.view.autofill.AutofillManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.demo.passwordvault.BuildConfig
import com.demo.passwordvault.core.AutofillMatch
import com.demo.passwordvault.core.VaultEntry
import com.demo.passwordvault.core.WrongPasswordException
import com.demo.passwordvault.core.search
import com.demo.passwordvault.ui.AppIcons
import com.demo.passwordvault.ui.Txt
import com.demo.passwordvault.ui.VaultTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * נפתח מתוך המילוי האוטומטי: סיסמת מאסטר (אם הכספת נעולה) ← בחירת רשומה ← מילוי הטופס.
 * אחרי פתיחה הכספת נשארת פתוחה לפי "נעילה אוטומטית" (משותף עם האפליקציה), כדי שלא תצטרך להזין סיסמה בכל מילוי.
 */
class AutofillAuthActivity : ComponentActivity() {

    companion object {
        const val EXTRA_USERNAME_ID = "pv_username_id"
        const val EXTRA_PASSWORD_ID = "pv_password_id"
        const val EXTRA_WEB_DOMAIN = "pv_web_domain"
        const val EXTRA_PACKAGE = "pv_package"
    }

    private var entriesForThisFill: List<VaultEntry> = emptyList()

    @Suppress("DEPRECATION")
    private fun <T : android.os.Parcelable> parcel(intent: Intent, key: String, cls: Class<T>): T? =
        if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(key, cls) else intent.getParcelableExtra(key)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!BuildConfig.ALLOW_SCREENSHOTS) {
            window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        }
        val fields = LoginFields(
            usernameId = parcel(intent, EXTRA_USERNAME_ID, AutofillId::class.java),
            passwordId = parcel(intent, EXTRA_PASSWORD_ID, AutofillId::class.java),
            webDomain = intent.getStringExtra(EXTRA_WEB_DOMAIN),
            packageName = intent.getStringExtra(EXTRA_PACKAGE) ?: "",
        )
        val open = VaultHolder.current(this)
        if (open != null) entriesForThisFill = open.entries

        setContent {
            VaultTheme {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    AutofillScreen(
                        initiallyUnlocked = open != null,
                        site = fields.webDomain ?: fields.packageName,
                        unlock = { pw -> unlockOnce(pw) },
                        entries = { entriesForThisFill },
                        suggested = { AutofillMatch.matches(entriesForThisFill, fields.webDomain, fields.packageName) },
                        onPick = { e -> finishWith(e, fields) },
                        onCancel = { setResult(Activity.RESULT_CANCELED); finish() },
                    )
                }
            }
        }
    }

    /** פותח את הכספת. היא נשארת פתוחה לפי "נעילה אוטומטית", כדי שלא תצטרך להזין סיסמה בכל מילוי. */
    private suspend fun unlockOnce(password: String): String? {
        val chars = password.toCharArray()
        return try {
            val list = withContext(Dispatchers.Default) {
                val s = VaultHolder.store(this@AutofillAuthActivity).unlock(chars)
                VaultHolder.open(this@AutofillAuthActivity, s)
                s.entries
            }
            entriesForThisFill = list
            null
        } catch (e: WrongPasswordException) {
            Txt.ERR_WRONG
        } catch (e: Exception) {
            Txt.ERR_GENERIC
        } finally {
            chars.fill('\u0000')
        }
    }

    private fun finishWith(e: VaultEntry, fields: LoginFields) {
        VaultHolder.touch()
        val dataset = VaultAutofillService.datasetFor(this, e, fields)
        setResult(Activity.RESULT_OK, Intent().putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, dataset))
        entriesForThisFill = emptyList()
        finish()
    }

    override fun onStop() {
        super.onStop()
        if (!isChangingConfigurations) { entriesForThisFill = emptyList(); finish() }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AutofillScreen(
    initiallyUnlocked: Boolean,
    site: String,
    unlock: suspend (String) -> String?,
    entries: () -> List<VaultEntry>,
    suggested: () -> List<VaultEntry>,
    onPick: (VaultEntry) -> Unit,
    onCancel: () -> Unit,
) {
    var unlocked by remember { mutableStateOf(initiallyUnlocked) }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(Txt.APP_NAME) },
                actions = { TextButton(onClick = onCancel) { Text(Txt.CANCEL) } },
            )
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).imePadding().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("מילוי עבור: $site", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (!unlocked) {
                val submit: () -> Unit = {
                    if (!busy && password.isNotEmpty()) {
                        busy = true
                        scope.launch {
                            error = unlock(password)
                            password = ""
                            busy = false
                            if (error == null) unlocked = true
                        }
                    }
                }
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text(Txt.MASTER_PASSWORD) },
                    singleLine = true,
                    isError = error != null,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { submit() }),
                    textStyle = MaterialTheme.typography.bodyLarge.copy(textDirection = TextDirection.Ltr),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                Button(onClick = submit, enabled = !busy && password.isNotEmpty(), modifier = Modifier.fillMaxWidth().height(52.dp)) {
                    Text(if (busy) Txt.WORKING else Txt.UNLOCK)
                }
            } else {
                val sugg = suggested()
                val list = if (query.isBlank()) sugg.ifEmpty { entries().search("") } else entries().search(query)
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    label = { Text(Txt.SEARCH) },
                    singleLine = true,
                    shape = RoundedCornerShape(28.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                if (query.isBlank() && sugg.isNotEmpty()) {
                    Text("מתאים לאתר הזה", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                }
                LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(list, key = { it.id }) { e ->
                        Card(
                            onClick = { onPick(e) },
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            ListItem(
                                headlineContent = { Text(e.title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                                supportingContent = { Text(e.username.ifEmpty { Txt.categoryLabel(e.category) }, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                                leadingContent = { Icon(AppIcons.category(e.category), contentDescription = null) },
                                colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                            )
                        }
                    }
                }
            }
        }
    }
}
