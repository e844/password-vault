package com.demo.passwordvault.ui

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

// צבעי גיבוי למכשירים לפני אנדרואיד 12 (אין שם צבעים דינמיים מהטפט)
private val FallbackLight = lightColorScheme(
    primary = Color(0xFF3F5F90),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD6E3FF),
    onPrimaryContainer = Color(0xFF001B3E),
    secondaryContainer = Color(0xFFDAE2F9),
    surface = Color(0xFFF9F9FF),
)

private val FallbackDark = darkColorScheme(
    primary = Color(0xFFA9C7FF),
    onPrimary = Color(0xFF07305F),
    primaryContainer = Color(0xFF254777),
    onPrimaryContainer = Color(0xFFD6E3FF),
    secondaryContainer = Color(0xFF3E4759),
    surface = Color(0xFF111318),
)

private val PixelShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp),
)

/** Material You: צבעים דינמיים מהטפט (אנדרואיד 12+), מצב כהה לפי המערכת. */
@Composable
fun VaultTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val context = LocalContext.current
    val colors = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> FallbackDark
        else -> FallbackLight
    }
    MaterialTheme(colorScheme = colors, shapes = PixelShapes, content = content)
}
