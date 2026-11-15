@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class, ExperimentalLayoutApi::class)

package com.demo.passwordvault.ui

import androidx.activity.compose.BackHandler
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.RadioButton
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import com.demo.passwordvault.core.Categories
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.demo.passwordvault.core.PasswordGenerator
import com.demo.passwordvault.core.Strength
import com.demo.passwordvault.core.VaultEntry
import java.text.DateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

@Composable
fun VaultApp(vm: VaultViewModel) {
    val snackbar = remember { SnackbarHostState() }
    val msg = vm.message
    LaunchedEffect(msg) {
        if (msg != null) {
            snackbar.showSnackbar(msg)
            vm.message = null
        }
    }
    // testTag-ים חשופים כ-resource-id לבדיקות אוטומטיות וצילומי מסך
    Box(Modifier.fillMaxSize().semantics { testTagsAsResourceId = true }) {
    AnimatedContent(
        targetState = vm.screen,
        transitionSpec = {
            (fadeIn(tween(260)) + scaleIn(tween(260), initialScale = 0.96f)) togetherWith fadeOut(tween(160))
        },
        label = "screen",
    ) { s ->
        when (s) {
            Screen.Setup -> LockScreen(vm, setup = true, snackbar = snackbar)
            Screen.Locked -> LockScreen(vm, setup = false, snackbar = snackbar)
            Screen.Home -> HomeScreen(vm, snackbar)
            is Screen.Detail -> DetailScreen(vm, s.id, snackbar)
            is Screen.Edit -> EditScreen(vm, s.id, snackbar)
            Screen.Generator -> GeneratorScreen(vm, snackbar)
        }
    }
    VaultDialogs(vm)
    }
}

// ======================= יצירה / פתיחה =======================

@Composable
private fun LockScreen(vm: VaultViewModel, setup: Boolean, snackbar: SnackbarHostState) {
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var visible by remember { mutableStateOf(false) }

    val submit: () -> Unit = {
        if (setup) {
            vm.createVault(password, confirm)
        } else {
            vm.unlock(password)
            password = ""
        }
        Unit
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbar) }) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(72.dp))
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primaryContainer,
                modifier = Modifier.size(104.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Filled.Lock, contentDescription = null,
                        modifier = Modifier.size(52.dp),
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }
            Spacer(Modifier.height(28.dp))
            Text(
                if (setup) Txt.SETUP_TITLE else Txt.UNLOCK_TITLE,
                style = MaterialTheme.typography.headlineMedium,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                if (setup) Txt.SETUP_BODY else Txt.UNLOCK_BODY,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(28.dp))
            SecretField(
                value = password,
                onValueChange = { password = it },
                label = Txt.MASTER_PASSWORD,
                visible = visible,
                onToggle = { visible = !visible },
                imeAction = if (setup) ImeAction.Next else ImeAction.Done,
                onDone = submit,
                isError = vm.error != null,
                tag = "master",
            )
            if (setup) {
                Spacer(Modifier.height(12.dp))
                SecretField(
                    value = confirm,
                    onValueChange = { confirm = it },
                    label = Txt.CONFIRM_PASSWORD,
                    visible = visible,
                    onToggle = { visible = !visible },
                    imeAction = ImeAction.Done,
                    onDone = submit,
                    isError = vm.error != null,
                    tag = "confirm",
                )
                Spacer(Modifier.height(8.dp))
                StrengthMeter(password)
            }
            vm.error?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
            }
            Spacer(Modifier.height(24.dp))
            Button(
                onClick = submit,
                enabled = !vm.busy && password.isNotEmpty(),
                modifier = Modifier.fillMaxWidth().height(56.dp).testTag("submit"),
            ) {
                if (vm.busy) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp), strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                    Spacer(Modifier.width(12.dp))
                    Text(Txt.WORKING)
                } else {
                    Text(if (setup) Txt.CREATE else Txt.UNLOCK, style = MaterialTheme.typography.titleMedium)
                }
            }
            if (setup) {
                Spacer(Modifier.height(20.dp))
                Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.tertiaryContainer) {
                    Text(
                        Txt.SAMPLE_BANNER,
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onTertiaryContainer,
                    )
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

// ======================= רשימה =======================

@Composable
private fun HomeScreen(vm: VaultViewModel, snackbar: SnackbarHostState) {
    val context = LocalContext.current
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    var menuOpen by remember { mutableStateOf(false) }

    // חלונות הקבצים של אנדרואיד (Storage Access Framework) – בלי הרשאות אחסון
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let(vm::importCsv) }
    val backupLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri -> uri?.let(vm::backup) }
    val restoreLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let(vm::pickRestore) }

    Scaffold(
        modifier = Modifier.nestedScroll(scroll.nestedScrollConnection),
        topBar = {
            LargeTopAppBar(
                title = { Text(Txt.APP_NAME) },
                actions = {
                    IconButton(onClick = { vm.lock() }, modifier = Modifier.testTag("lock")) { Icon(Icons.Filled.Lock, contentDescription = Txt.LOCK) }
                    Box {
                        IconButton(onClick = { menuOpen = true }, modifier = Modifier.testTag("menu")) {
                            Icon(Icons.Filled.MoreVert, contentDescription = Txt.MORE)
                        }
                        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                            MenuRow(Txt.MENU_AUTOFILL, AppIcons.Key, "menu_autofill") {
                                menuOpen = false
                                enableAutofill(context) { vm.message = it }
                            }
                            HorizontalDivider()
                            MenuRow(Txt.MENU_IMPORT, AppIcons.Upload, "menu_import") {
                                menuOpen = false
                                importLauncher.launch(arrayOf("text/csv", "text/comma-separated-values", "text/plain", "application/csv", "*/*"))
                            }
                            MenuRow(Txt.MENU_EXPORT, AppIcons.Download, "menu_export") { menuOpen = false; vm.showDialog(VaultDialog.ExportWarning) }
                            HorizontalDivider()
                            MenuRow(Txt.MENU_BACKUP, AppIcons.Save, "menu_backup") { menuOpen = false; backupLauncher.launch(vm.backupFileName()) }
                            MenuRow(Txt.MENU_RESTORE, AppIcons.Restore, "menu_restore") { menuOpen = false; restoreLauncher.launch(arrayOf("*/*")) }
                            HorizontalDivider()
                            MenuRow(Txt.MENU_AUTOLOCK, AppIcons.Timer, "menu_autolock") { menuOpen = false; vm.showDialog(VaultDialog.LockSettings) }
                            MenuRow(Txt.MENU_CHANGE_MASTER, AppIcons.Key, "menu_master") { menuOpen = false; vm.showDialog(VaultDialog.ChangeMaster) }
                            HorizontalDivider()
                            MenuRow(Txt.MENU_UPDATE, AppIcons.Restore, "menu_update") { menuOpen = false; vm.showDialog(VaultDialog.Update) }
                        }
                    }
                },
                scrollBehavior = scroll,
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { vm.openNew() },
                modifier = Modifier.testTag("fab"),
                icon = { Icon(Icons.Filled.Add, contentDescription = null) },
                text = { Text(Txt.ADD) },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        val list = vm.visibleEntries
        LazyColumn(
            contentPadding = padding,
            modifier = Modifier.fillMaxSize(),
        ) {
            item(key = "search") {
                TextField(
                    value = vm.query,
                    onValueChange = { vm.query = it },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp).testTag("search"),
                    placeholder = { Text(Txt.SEARCH) },
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                    trailingIcon = if (vm.query.isNotEmpty()) {
                        { IconButton(onClick = { vm.query = "" }) { Icon(Icons.Filled.Clear, contentDescription = null) } }
                    } else null,
                    singleLine = true,
                    shape = RoundedCornerShape(28.dp),
                    colors = TextFieldDefaults.colors(
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                        focusedContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                        unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                    ),
                )
            }
            item(key = "cats") {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item {
                        FilterChip(
                            selected = vm.activeCategory == "all",
                            onClick = { vm.activeCategory = "all" },
                            label = { Text("${Txt.ALL} ${vm.entries.size}") },
                            leadingIcon = { Icon(AppIcons.All, contentDescription = null, modifier = Modifier.size(18.dp)) },
                            modifier = Modifier.testTag("cat_all"),
                        )
                    }
                    items(Categories.KEYS.filter { vm.categoryCount(it) > 0 || vm.activeCategory == it }) { key ->
                        FilterChip(
                            selected = vm.activeCategory == key,
                            onClick = { vm.activeCategory = key },
                            label = { Text("${Txt.categoryLabel(key)} ${vm.categoryCount(key)}") },
                            leadingIcon = {
                                Icon(AppIcons.category(key), contentDescription = null, modifier = Modifier.size(18.dp), tint = categoryAccent(key))
                            },
                            modifier = Modifier.testTag("cat_$key"),
                        )
                    }
                }
            }
            item(key = "meta") {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    AssistChip(
                        onClick = { vm.openGenerator() },
                        modifier = Modifier.testTag("open_generator"),
                        label = { Text(Txt.GENERATOR) },
                        leadingIcon = {
                            Icon(Icons.Filled.Refresh, contentDescription = null, modifier = Modifier.size(AssistChipDefaults.IconSize))
                        },
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        Txt.entriesCount(list.size),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (list.isEmpty()) {
                item(key = "empty") {
                    Text(
                        when {
                            vm.query.isNotBlank() -> Txt.NO_RESULTS
                            vm.activeCategory != "all" -> Txt.EMPTY_CATEGORY
                            else -> Txt.EMPTY_LIST
                        },
                        modifier = Modifier.fillMaxWidth().padding(48.dp),
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            items(list, key = { it.id }) { e ->
                EntryRow(e, Modifier.animateItem()) { vm.openDetail(e.id) }
            }
            item(key = "bottom") { Spacer(Modifier.height(96.dp)) }
        }
    }
}

@Composable
private fun MenuRow(text: String, icon: ImageVector, tag: String, onClick: () -> Unit) {
    DropdownMenuItem(
        text = { Text(text) },
        onClick = onClick,
        leadingIcon = { Icon(icon, contentDescription = null) },
        modifier = Modifier.testTag(tag),
    )
}

/** צבע לכל קטגוריה, מותאם למצב בהיר/כהה. */
@Composable
private fun categoryAccent(key: String): Color {
    val dark = isSystemInDarkTheme()
    return Color.hsl(AppIcons.categoryHue(key), if (dark) 0.65f else 0.55f, if (dark) 0.72f else 0.42f)
}

@Composable
private fun categoryContainer(key: String): Pair<Color, Color> {
    val h = AppIcons.categoryHue(key)
    return if (isSystemInDarkTheme()) {
        Color.hsl(h, 0.35f, 0.30f) to Color.hsl(h, 0.70f, 0.88f)
    } else {
        Color.hsl(h, 0.70f, 0.88f) to Color.hsl(h, 0.60f, 0.20f)
    }
}

@Composable
private fun EntryRow(e: VaultEntry, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).testTag("entry"),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        ListItem(
            headlineContent = { Text(e.title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            supportingContent = { Text(e.username.ifEmpty { Txt.categoryLabel(e.category) }, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            leadingContent = { Avatar(e.title, e.category) },
            colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        )
    }
}

private fun initialOf(title: String): String {
    val parts = title.split(Regex("\\s[–-]\\s"))
    val name = (if (parts.size > 1) parts.last() else parts.first()).trim()
    return name.take(1).uppercase().ifEmpty { "?" }
}

@Composable
private fun Avatar(title: String, category: String, size: Int = 44) {
    val (bg, fg) = categoryContainer(category)
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(bg),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            initialOf(title),
            style = if (size > 44) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.titleMedium,
            color = fg,
        )
    }
}

// ======================= פרטי רשומה =======================

@Composable
private fun DetailScreen(vm: VaultViewModel, id: String, snackbar: SnackbarHostState) {
    BackHandler { vm.back() }
    val e = vm.entry(id) ?: return
    val context = LocalContext.current
    var showPassword by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(e.title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = {
                    IconButton(onClick = { vm.back() }, modifier = Modifier.testTag("back")) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = Txt.BACK)
                    }
                },
                actions = {
                    IconButton(onClick = { vm.openEdit(e.id) }, modifier = Modifier.testTag("edit")) { Icon(Icons.Filled.Edit, contentDescription = Txt.EDIT) }
                    IconButton(onClick = { confirmDelete = true }, modifier = Modifier.testTag("delete")) { Icon(Icons.Filled.Delete, contentDescription = Txt.DELETE) }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Avatar(e.title, e.category, size = 56)
                val (bg, fg) = categoryContainer(e.category)
                Surface(shape = RoundedCornerShape(8.dp), color = bg, contentColor = fg) {
                    Row(Modifier.padding(horizontal = 10.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(AppIcons.category(e.category), contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(Txt.categoryLabel(e.category), style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
            FieldCard(Txt.USERNAME, e.username, ltr = true) {
                TextButton(onClick = { vm.copyToClipboard(Txt.USERNAME, e.username) }) { Text(Txt.COPY) }
            }
            FieldCard(
                Txt.PASSWORD,
                if (showPassword) e.password else "•".repeat(10),
                ltr = true,
                monospace = showPassword,
                hidden = e.password.isEmpty(),
            ) {
                TextButton(onClick = { showPassword = !showPassword }, modifier = Modifier.testTag("reveal")) { Text(if (showPassword) Txt.HIDE else Txt.SHOW) }
                TextButton(onClick = { vm.copyToClipboard(Txt.PASSWORD, e.password) }) { Text(Txt.COPY) }
            }
            if (e.password.isNotEmpty()) StrengthMeter(e.password)
            FieldCard(Txt.URL, e.url, ltr = true) {
                TextButton(onClick = { openInBrowser(context, e.url) { vm.message = it } }, modifier = Modifier.testTag("open_url")) {
                    Icon(AppIcons.OpenInNew, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(Txt.OPEN_IN_BROWSER)
                }
            }
            FieldCard(Txt.NOTES, e.notes)
            Text(
                Txt.updated(
                    DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT, Locale.forLanguageTag("he"))
                        .format(Date(e.updatedAt)),
                ),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            icon = { Icon(Icons.Filled.Delete, contentDescription = null) },
            title = { Text(Txt.DELETE_TITLE) },
            text = { Text(Txt.deleteBody(e.title)) },
            confirmButton = {
                TextButton(onClick = { confirmDelete = false; vm.delete(e.id) }, modifier = Modifier.testTag("confirm_delete")) {
                    Text(Txt.DELETE, color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text(Txt.CANCEL) } },
        )
    }
}

@Composable
private fun FieldCard(
    label: String,
    value: String,
    ltr: Boolean = false,
    monospace: Boolean = false,
    hidden: Boolean = value.isEmpty(),
    actions: @Composable RowScope.() -> Unit = {},
) {
    if (hidden) return
    Card(
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(start = 20.dp, end = 8.dp, top = 14.dp, bottom = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(4.dp))
                Text(
                    value,
                    style = MaterialTheme.typography.bodyLarge.copy(
                        textDirection = if (ltr) TextDirection.Ltr else TextDirection.Content,
                        fontFamily = if (monospace) FontFamily.Monospace else null,
                    ),
                )
            }
            actions()
        }
    }
}

// ======================= הוספה / עריכה =======================

@Composable
private fun EditScreen(vm: VaultViewModel, id: String?, snackbar: SnackbarHostState) {
    BackHandler { vm.back() }
    val d = vm.draft ?: return
    var showPassword by remember { mutableStateOf(id == null) }
    var showGenerator by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (id == null) Txt.NEW_ENTRY else Txt.EDIT_ENTRY) },
                navigationIcon = {
                    IconButton(onClick = { vm.back() }) { Icon(Icons.Filled.Close, contentDescription = Txt.CANCEL) }
                },
                actions = {
                    Button(onClick = { vm.saveDraft() }, modifier = Modifier.padding(end = 8.dp).testTag("save")) { Text(Txt.SAVE) }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            val titleError = vm.error != null && d.title.isBlank()
            OutlinedTextField(
                value = d.title,
                onValueChange = { v -> vm.draft = vm.draft?.copy(title = v) },
                label = { Text(Txt.TITLE) },
                singleLine = true,
                isError = titleError,
                supportingText = if (titleError) { { Text(Txt.ERR_TITLE_REQUIRED) } } else null,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth().testTag("e_title"),
            )
            Text(Txt.CATEGORY, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Categories.KEYS.forEach { key ->
                    FilterChip(
                        selected = d.category == key,
                        onClick = { vm.draft = vm.draft?.copy(category = key) },
                        label = { Text(Txt.categoryLabel(key)) },
                        leadingIcon = { Icon(AppIcons.category(key), contentDescription = null, modifier = Modifier.size(18.dp), tint = categoryAccent(key)) },
                        modifier = Modifier.testTag("e_cat_$key"),
                    )
                }
            }
            OutlinedTextField(
                value = d.username,
                onValueChange = { v -> vm.draft = vm.draft?.copy(username = v) },
                label = { Text(Txt.USERNAME) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                textStyle = LocalTextStyle.current.copy(textDirection = TextDirection.Ltr),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth().testTag("e_username"),
            )
            SecretField(
                value = d.password,
                onValueChange = { v -> vm.draft = vm.draft?.copy(password = v) },
                label = Txt.PASSWORD,
                visible = showPassword,
                onToggle = { showPassword = !showPassword },
                tag = "e_password",
            )
            StrengthMeter(d.password)
            FilledTonalButton(onClick = { vm.regenerate(); showGenerator = true }, modifier = Modifier.testTag("e_generate")) {
                Icon(Icons.Filled.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(Txt.GENERATE)
            }
            OutlinedTextField(
                value = d.url,
                onValueChange = { v -> vm.draft = vm.draft?.copy(url = v) },
                label = { Text(Txt.URL) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Next),
                textStyle = LocalTextStyle.current.copy(textDirection = TextDirection.Ltr),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = d.notes,
                onValueChange = { v -> vm.draft = vm.draft?.copy(notes = v) },
                label = { Text(Txt.NOTES) },
                minLines = 3,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(24.dp))
        }
    }

    if (showGenerator) {
        AlertDialog(
            onDismissRequest = { showGenerator = false },
            title = { Text(Txt.GENERATOR) },
            text = { GeneratorPanel(vm, showCopy = false, modifier = Modifier.verticalScroll(rememberScrollState())) },
            confirmButton = {
                TextButton(
                    modifier = Modifier.testTag("gen_use"),
                    enabled = vm.generated.isNotEmpty(),
                    onClick = {
                        vm.draft = vm.draft?.copy(password = vm.generated)
                        showPassword = true
                        showGenerator = false
                    },
                ) { Text(Txt.USE_PASSWORD) }
            },
            dismissButton = { TextButton(onClick = { showGenerator = false }) { Text(Txt.CANCEL) } },
        )
    }
}

// ======================= מחולל סיסמאות =======================

@Composable
private fun GeneratorScreen(vm: VaultViewModel, snackbar: SnackbarHostState) {
    BackHandler { vm.back() }
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(Txt.GENERATOR) },
                navigationIcon = {
                    IconButton(onClick = { vm.back() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = Txt.BACK)
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        GeneratorPanel(
            vm,
            showCopy = true,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        )
    }
}

@Composable
private fun GeneratorPanel(vm: VaultViewModel, showCopy: Boolean, modifier: Modifier = Modifier) {
    val o = vm.generatorOptions
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.secondaryContainer,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                vm.generated.ifEmpty { Txt.SELECT_ONE },
                modifier = Modifier.padding(20.dp),
                style = MaterialTheme.typography.titleMedium.copy(
                    fontFamily = FontFamily.Monospace,
                    textDirection = TextDirection.Ltr,
                ),
                color = MaterialTheme.colorScheme.onSecondaryContainer,
                textAlign = TextAlign.Center,
            )
        }
        StrengthMeter(vm.generated)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilledTonalButton(onClick = { vm.regenerate() }, enabled = vm.generated.isNotEmpty()) {
                Icon(Icons.Filled.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(Txt.REGENERATE)
            }
            if (showCopy) {
                OutlinedButton(
                    onClick = { vm.copyToClipboard(Txt.PASSWORD, vm.generated) },
                    enabled = vm.generated.isNotEmpty(),
                ) { Text(Txt.COPY) }
            }
        }
        Spacer(Modifier.height(4.dp))
        Text(Txt.length(o.length), style = MaterialTheme.typography.titleSmall)
        Slider(
            value = o.length.toFloat(),
            onValueChange = { v ->
                val n = v.roundToInt()
                if (n != vm.generatorOptions.length) vm.updateGeneratorOptions(vm.generatorOptions.copy(length = n))
            },
            valueRange = PasswordGenerator.MIN_LENGTH.toFloat()..PasswordGenerator.MAX_LENGTH.toFloat(),
            steps = PasswordGenerator.MAX_LENGTH - PasswordGenerator.MIN_LENGTH - 1,
        )
        OptionSwitch(Txt.LOWER, o.lowercase) { vm.updateGeneratorOptions(vm.generatorOptions.copy(lowercase = it)) }
        OptionSwitch(Txt.UPPER, o.uppercase) { vm.updateGeneratorOptions(vm.generatorOptions.copy(uppercase = it)) }
        OptionSwitch(Txt.DIGITS, o.digits) { vm.updateGeneratorOptions(vm.generatorOptions.copy(digits = it)) }
        OptionSwitch(Txt.SYMBOLS, o.symbols) { vm.updateGeneratorOptions(vm.generatorOptions.copy(symbols = it)) }
        OptionSwitch(Txt.AVOID_AMBIGUOUS, o.avoidAmbiguous) { vm.updateGeneratorOptions(vm.generatorOptions.copy(avoidAmbiguous = it)) }
    }
}

@Composable
private fun OptionSwitch(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .toggleable(value = checked, onValueChange = onChange, role = Role.Switch)
            .padding(horizontal = 4.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyLarge)
        Switch(checked = checked, onCheckedChange = null)
    }
}

// ======================= רכיבים משותפים =======================

@Composable
private fun SecretField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    visible: Boolean,
    onToggle: () -> Unit,
    imeAction: ImeAction = ImeAction.Next,
    onDone: () -> Unit = {},
    isError: Boolean = false,
    tag: String = "",
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth().testTag(tag),
        label = { Text(label) },
        singleLine = true,
        isError = isError,
        visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = imeAction),
        keyboardActions = KeyboardActions(onDone = { onDone() }),
        textStyle = LocalTextStyle.current.copy(textDirection = TextDirection.Ltr),
        trailingIcon = { TextButton(onClick = onToggle) { Text(if (visible) Txt.HIDE else Txt.SHOW) } },
        shape = RoundedCornerShape(16.dp),
    )
}

@Composable
private fun StrengthMeter(password: String) {
    if (password.isEmpty()) return
    val (fraction, label, color) = when (PasswordGenerator.strengthOf(password)) {
        Strength.WEAK -> Triple(0.33f, Txt.STRENGTH_WEAK, MaterialTheme.colorScheme.error)
        Strength.MEDIUM -> Triple(0.66f, Txt.STRENGTH_MEDIUM, MaterialTheme.colorScheme.tertiary)
        Strength.STRONG -> Triple(1f, Txt.STRENGTH_STRONG, MaterialTheme.colorScheme.primary)
    }
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        LinearProgressIndicator(
            progress = { fraction },
            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
            color = color,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
        )
        Text(label, style = MaterialTheme.typography.labelMedium, color = color)
    }
}

// ======================= פתיחת אתר בדפדפן =======================

/** פותח את הכתובת בדפדפן של הטלפון. האפליקציה עצמה לא מתחברת לאינטרנט. */
private fun openInBrowser(context: Context, raw: String, onError: (String) -> Unit) {
    val trimmed = raw.trim()
    val withScheme = if (Regex("^[a-zA-Z][a-zA-Z0-9+.-]*://").containsMatchIn(trimmed)) trimmed else "https://$trimmed"
    val uri = Uri.parse(withScheme)
    if (uri.scheme != "https" && uri.scheme != "http") {
        onError(Txt.NO_BROWSER)
        return
    }
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (e: ActivityNotFoundException) {
        onError(Txt.NO_BROWSER)
    }
}

/** פותח את מסך ההגדרות של אנדרואיד לבחירת "כספת סיסמאות" כשירות המילוי האוטומטי. */
private fun enableAutofill(context: Context, onMessage: (String) -> Unit) {
    val am = context.getSystemService(android.view.autofill.AutofillManager::class.java)
    if (am != null && am.hasEnabledAutofillServices()) {
        onMessage(Txt.AUTOFILL_ON)
        return
    }
    try {
        context.startActivity(
            Intent(android.provider.Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)
                .setData(Uri.parse("package:" + context.packageName)),
        )
    } catch (e: ActivityNotFoundException) {
        context.startActivity(Intent(android.provider.Settings.ACTION_SETTINGS))
    }
}

// ======================= חלונות: ייצוא, שחזור, סיסמת מאסטר, נעילה =======================

@Composable
private fun VaultDialogs(vm: VaultViewModel) {
    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri -> uri?.let(vm::exportCsv) }
    when (vm.dialog) {
        VaultDialog.ExportWarning -> AlertDialog(
            onDismissRequest = { vm.dismissDialog() },
            icon = { Icon(AppIcons.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
            title = { Text(Txt.EXPORT_TITLE) },
            text = { Text(Txt.EXPORT_BODY) },
            confirmButton = {
                TextButton(onClick = { vm.dismissDialog(); exportLauncher.launch(vm.csvFileName()) }, modifier = Modifier.testTag("export_confirm")) {
                    Text(Txt.EXPORT, color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = { TextButton(onClick = { vm.dismissDialog() }) { Text(Txt.CANCEL) } },
        )

        VaultDialog.Restore -> {
            var pw by remember { mutableStateOf("") }
            var visible by remember { mutableStateOf(false) }
            AlertDialog(
                onDismissRequest = { if (!vm.busy) vm.dismissDialog() },
                icon = { Icon(AppIcons.Restore, contentDescription = null) },
                title = { Text(Txt.RESTORE_TITLE) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(Txt.RESTORE_BODY, style = MaterialTheme.typography.bodyMedium)
                        SecretField(pw, { pw = it }, Txt.RESTORE_PASSWORD, visible, { visible = !visible },
                            imeAction = ImeAction.Done, onDone = { vm.restore(pw) }, isError = vm.dialogError != null, tag = "restore_password")
                        vm.dialogError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { vm.restore(pw) }, enabled = !vm.busy && pw.isNotEmpty(), modifier = Modifier.testTag("restore_ok")) {
                        Text(if (vm.busy) Txt.WORKING else Txt.RESTORE)
                    }
                },
                dismissButton = { TextButton(onClick = { vm.dismissDialog() }, enabled = !vm.busy) { Text(Txt.CANCEL) } },
            )
        }

        VaultDialog.ChangeMaster -> {
            var cur by remember { mutableStateOf("") }
            var next by remember { mutableStateOf("") }
            var confirm by remember { mutableStateOf("") }
            var visible by remember { mutableStateOf(false) }
            AlertDialog(
                onDismissRequest = { if (!vm.busy) vm.dismissDialog() },
                icon = { Icon(AppIcons.Key, contentDescription = null) },
                title = { Text(Txt.MENU_CHANGE_MASTER) },
                text = {
                    Column(
                        modifier = Modifier.verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        SecretField(cur, { cur = it }, Txt.CURRENT_PASSWORD, visible, { visible = !visible }, tag = "m_current")
                        SecretField(next, { next = it }, Txt.NEW_PASSWORD, visible, { visible = !visible }, tag = "m_new")
                        StrengthMeter(next)
                        SecretField(confirm, { confirm = it }, Txt.CONFIRM_NEW_PASSWORD, visible, { visible = !visible },
                            imeAction = ImeAction.Done, onDone = { vm.changeMaster(cur, next, confirm) }, tag = "m_confirm")
                        Text(Txt.CHANGE_NOTE, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        vm.dialogError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { vm.changeMaster(cur, next, confirm) }, enabled = !vm.busy && cur.isNotEmpty() && next.isNotEmpty(), modifier = Modifier.testTag("m_ok")) {
                        Text(if (vm.busy) Txt.WORKING else Txt.CHANGE)
                    }
                },
                dismissButton = { TextButton(onClick = { vm.dismissDialog() }, enabled = !vm.busy) { Text(Txt.CANCEL) } },
            )
        }

        VaultDialog.LockSettings -> {
            var choice by remember { mutableStateOf(vm.autoLockMinutes) }
            AlertDialog(
                onDismissRequest = { vm.dismissDialog() },
                icon = { Icon(AppIcons.Timer, contentDescription = null) },
                title = { Text(Txt.MENU_AUTOLOCK) },
                text = {
                    Column {
                        Text(Txt.AUTOLOCK_BODY, style = MaterialTheme.typography.bodyMedium)
                        Spacer(Modifier.height(8.dp))
                        com.demo.passwordvault.core.AutoLockPolicy.CHOICES_MINUTES.forEach { m ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .selectable(selected = choice == m, onClick = { choice = m }, role = Role.RadioButton)
                                    .padding(vertical = 4.dp)
                                    .testTag("lock_$m"),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                RadioButton(selected = choice == m, onClick = null)
                                Spacer(Modifier.width(8.dp))
                                Text(Txt.lockLabel(m))
                            }
                        }
                    }
                },
                confirmButton = { TextButton(onClick = { vm.setAutoLock(choice) }, modifier = Modifier.testTag("lock_save")) { Text(Txt.SAVE) } },
                dismissButton = { TextButton(onClick = { vm.dismissDialog() }) { Text(Txt.CANCEL) } },
            )
        }

        VaultDialog.Update -> {
            val context = LocalContext.current
            AlertDialog(
                onDismissRequest = { vm.dismissDialog() },
                icon = { Icon(AppIcons.Restore, contentDescription = null) },
                title = { Text(Txt.MENU_UPDATE) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(Txt.currentBuild(com.demo.passwordvault.BuildConfig.BUILD_NUMBER), style = MaterialTheme.typography.titleMedium)
                        Text(Txt.UPDATE_BODY, style = MaterialTheme.typography.bodyMedium)
                        Surface(shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.tertiaryContainer) {
                            Text(Txt.UPDATE_WARNING, modifier = Modifier.padding(12.dp), style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onTertiaryContainer)
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { vm.dismissDialog(); openInBrowser(context, Txt.RELEASES_URL) { vm.message = it } }, modifier = Modifier.testTag("update_open")) {
                        Text(Txt.OPEN_RELEASES)
                    }
                },
                dismissButton = { TextButton(onClick = { vm.dismissDialog() }) { Text(Txt.CANCEL) } },
            )
        }

        null -> Unit
    }
}
