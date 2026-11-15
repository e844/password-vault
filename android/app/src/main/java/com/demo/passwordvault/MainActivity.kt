package com.demo.passwordvault

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import com.demo.passwordvault.ui.VaultApp
import com.demo.passwordvault.ui.VaultTheme
import com.demo.passwordvault.ui.VaultViewModel

class MainActivity : ComponentActivity() {
    private val vm: VaultViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // חוסם צילומי מסך והקלטה, ומסתיר את התוכן במסך "אפליקציות אחרונות"
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        enableEdgeToEdge()
        setContent {
            VaultTheme {
                // ממשק מימין לשמאל, גם אם שפת הטלפון אינה עברית
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    VaultApp(vm)
                }
            }
        }
    }

    override fun onUserInteraction() {
        super.onUserInteraction()
        vm.onUserInteraction()
    }

    override fun onStart() {
        super.onStart()
        vm.onForeground()
    }

    override fun onStop() {
        super.onStop()
        if (!isChangingConfigurations) vm.onBackground()
    }
}
