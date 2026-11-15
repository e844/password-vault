@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalComposeUiApi::class)

package com.demo.passwordvault.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.Crossfade
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
    Crossfade(targetState = vm.screen, label = "screen") { s ->
        when (s) {
            Screen.Setup -> LockScreen(vm, setup = true, snackbar = snackbar)
            Screen.Locked -> LockScreen(vm, setup = false, snackbar = snackbar)
            Screen.Home -> HomeScreen(vm, snackbar)
            is Screen.Detail -> DetailScreen(vm, s.id, snackbar)
            is Screen.Edit -> EditScreen(vm, s.id, snackbar)
            Screen.Generator -> GeneratorScreen(vm, snackbar)
        }
    }
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
    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Scaffold(
        modifier = Modifier.nestedScroll(scroll.nestedScrollConnection),
        topBar = {
            LargeTopAppBar(
                title = { Text(Txt.APP_NAME) },
                actions = {
                    IconButton(onClick = { vm.lock() }, modifier = Modifier.testTag("lock")) { Icon(Icons.Filled.Lock, contentDescription = Txt.LOCK) }
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
            item {
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
            item {
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
                item {
                    Text(
                        if (vm.query.isBlank()) Txt.EMPTY_LIST else Txt.NO_RESULTS,
                        modifier = Modifier.fillMaxWidth().padding(48.dp),
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            items(list, key = { it.id }) { e -> EntryRow(e) { vm.openDetail(e.id) } }
            item { Spacer(Modifier.height(96.dp)) }
        }
    }
}

@Composable
private fun EntryRow(e: VaultEntry, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp).testTag("entry"),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow),
    ) {
        ListItem(
            headlineContent = { Text(e.title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            supportingContent = if (e.username.isNotEmpty()) {
                { Text(e.username, maxLines = 1, overflow = TextOverflow.Ellipsis) }
            } else null,
            leadingContent = { Avatar(e.title) },
            colors = ListItemDefaults.colors(containerColor = Color.Transparent),
        )
    }
}

@Composable
private fun Avatar(title: String) {
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primaryContainer),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            title.trim().take(1).ifEmpty { "?" },
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
        )
    }
}

// ======================= פרטי רשומה =======================

@Composable
private fun DetailScreen(vm: VaultViewModel, id: String, snackbar: SnackbarHostState) {
    BackHandler { vm.back() }
    val e = vm.entry(id) ?: return
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
            FieldCard(Txt.URL, e.url, ltr = true)
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
