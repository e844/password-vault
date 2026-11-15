package com.demo.passwordvault.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.File

class PasswordGeneratorTest {
    private val gen = PasswordGenerator()

    @Test fun respectsLengthAndCharacterTypes() {
        repeat(200) {
            val p = gen.generate(GeneratorOptions(length = 20))
            assertEquals(20, p.length)
            assertTrue(p.any { it in 'a'..'z' })
            assertTrue(p.any { it in 'A'..'Z' })
            assertTrue(p.any { it in '0'..'9' })
            assertTrue(p.any { !it.isLetterOrDigit() })
        }
    }

    @Test fun onlyDigits() {
        val p = gen.generate(GeneratorOptions(length = 12, lowercase = false, uppercase = false, symbols = false))
        assertTrue(p.all { it in '0'..'9' })
    }

    @Test fun avoidAmbiguous() {
        repeat(200) {
            val p = gen.generate(GeneratorOptions(length = 64, symbols = false, avoidAmbiguous = true))
            assertTrue(p.none { it in "Il1O0o" })
        }
    }

    @Test fun outputsAreNotRepeated() {
        val set = HashSet<String>()
        repeat(1000) { set += gen.generate(GeneratorOptions()) }
        assertEquals(1000, set.size)
    }

    @Test fun invalidOptionsRejected() {
        for (o in listOf(
            GeneratorOptions(length = 7),
            GeneratorOptions(length = 65),
            GeneratorOptions(lowercase = false, uppercase = false, digits = false, symbols = false),
        )) {
            try { gen.generate(o); fail("expected rejection for $o") } catch (e: IllegalArgumentException) { }
        }
    }

    @Test fun strength() {
        assertEquals(Strength.WEAK, PasswordGenerator.strengthOf(""))
        assertEquals(Strength.WEAK, PasswordGenerator.strengthOf("abcdef"))
        assertEquals(Strength.MEDIUM, PasswordGenerator.strengthOf("Abcdef123456"))
        assertEquals(Strength.STRONG, PasswordGenerator.strengthOf(gen.generate(GeneratorOptions(length = 16))))
    }
}

class SearchAndOpsTest {
    private val list = listOf(
        VaultEntry(id = "1", title = "דואר", username = "dana@example.com", url = "https://mail.example.com"),
        VaultEntry(id = "2", title = "Bank", username = "user1", notes = "סניף ראשי", password = "findme"),
        VaultEntry(id = "3", title = "alpha", username = "x"),
    )

    @Test fun searchByFields() {
        assertEquals(listOf("1"), list.search("דוא").map { it.id })
        assertEquals(listOf("1"), list.search("DANA").map { it.id })
        assertEquals(listOf("1"), list.search("mail.example").map { it.id })
        assertEquals(listOf("2"), list.search("סניף").map { it.id })
        assertEquals(listOf("2"), list.search("  bank ").map { it.id })
    }

    @Test fun searchNeverMatchesPassword() {
        assertTrue(list.search("findme").isEmpty())
    }

    @Test fun emptyQueryReturnsAllSorted() {
        assertEquals(listOf("3", "2", "1"), list.search("").map { it.id })
    }

    @Test fun opsValidate() {
        try { VaultOps.add(list, VaultEntry(title = "  ")); fail() } catch (e: IllegalArgumentException) { }
        try { VaultOps.add(list, VaultEntry(id = "1", title = "dup")); fail() } catch (e: IllegalArgumentException) { }
        try { VaultOps.update(list, VaultEntry(id = "nope", title = "x")); fail() } catch (e: IllegalArgumentException) { }
        assertEquals(2, VaultOps.delete(list, "2").size)
        assertEquals(3, VaultOps.delete(list, "missing").size)
    }

    @Test fun sampleDataIsFakeAndValid() {
        val s = SampleData.entries()
        assertTrue(s.isNotEmpty())
        assertTrue(s.all { it.title.startsWith("דוגמה") })
        assertTrue(s.all { it.url.isEmpty() || it.url.contains(".example") })
        assertTrue(s.all { it.password.length == 16 })
    }
}

class AutoLockTest {
    @Test fun locksAfterInactivity() {
        val p = AutoLockPolicy(inactivityMillis = 1000, backgroundGraceMillis = 500)
        p.onUnlocked(0)
        assertFalse(p.shouldLock(999))
        assertTrue(p.shouldLock(1000))
    }

    @Test fun interactionResetsTimer() {
        val p = AutoLockPolicy(inactivityMillis = 1000, backgroundGraceMillis = 500)
        p.onUnlocked(0)
        p.onInteraction(900)
        assertFalse(p.shouldLock(1800))
        assertTrue(p.shouldLock(1900))
    }

    @Test fun backgroundGrace() {
        val p = AutoLockPolicy(inactivityMillis = 10_000, backgroundGraceMillis = 500)
        p.onUnlocked(0)
        p.onBackground(100)
        assertFalse(p.shouldLock(599))
        assertTrue(p.shouldLock(600))
        assertTrue(p.onForeground(700))
    }

    @Test fun quickReturnFromBackgroundDoesNotLock() {
        val p = AutoLockPolicy(inactivityMillis = 10_000, backgroundGraceMillis = 500)
        p.onUnlocked(0)
        p.onBackground(100)
        assertFalse(p.onForeground(300))
        assertFalse(p.shouldLock(5000)) // היציאה לרקע נמחקה
    }

    @Test fun throttle() {
        val t = UnlockThrottle(freeAttempts = 3, baseDelayMillis = 1000, maxDelayMillis = 3000)
        t.onFailure(0); t.onFailure(0)
        assertEquals(0, t.remainingBlockMillis(0))
        t.onFailure(0)
        assertEquals(1000, t.remainingBlockMillis(0))
        t.onFailure(1000)
        assertEquals(2000, t.remainingBlockMillis(1000))
        t.onFailure(3000)
        assertEquals(3000, t.remainingBlockMillis(3000)) // תקרה
        t.onSuccess()
        assertEquals(0, t.remainingBlockMillis(3000))
    }
}

/** מוודא שאין בקוד האפליקציה שום כתיבה ללוג או להדפסה. */
class NoLoggingTest {
    @Test fun sourceHasNoLoggingCalls() {
        val root = listOf(File("src/main"), File("app/src/main")).firstOrNull { it.isDirectory }
            ?: error("source folder not found from ${File(".").absolutePath}")
        val forbidden = listOf(
            Regex("""\bLog\.[vdiwe]\("""), Regex("""\bLog\.wtf\("""), Regex("""\bprintln\("""),
            Regex("""\bprint\("""), Regex("""System\.(out|err)"""), Regex("""printStackTrace\("""),
            Regex("""\bTimber\."""), Regex("""android\.util\.Log\b"""),
        )
        val sources = root.walkTopDown().filter { it.isFile && (it.extension == "kt" || it.extension == "java") }.toList()
        assertTrue("no sources found", sources.size >= 5)
        for (f in sources) {
            val text = f.readText()
            for (r in forbidden) assertFalse("${f.path} matches ${r.pattern}", r.containsMatchIn(text))
        }
    }

    @Test fun manifestHasNoInternetPermissionAndNoBackup() {
        val manifest = listOf(File("src/main/AndroidManifest.xml"), File("app/src/main/AndroidManifest.xml")).first { it.isFile }.readText()
        assertFalse(manifest.contains("android.permission.INTERNET"))
        assertTrue(manifest.contains("android:allowBackup=\"false\""))
    }
}
