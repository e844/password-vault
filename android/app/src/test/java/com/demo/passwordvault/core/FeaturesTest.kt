package com.demo.passwordvault.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File

class FeaturesTest {
    @get:Rule val tmp = TemporaryFolder()

    private fun store(name: String = "vault.bin") = VaultStore(File(tmp.root, name), iterations = 1_000)

    private val sample = listOf(
        VaultEntry(id = "a", title = "מייל", username = "a@example.com", password = "S3cret!", url = "https://example.com", category = "email", updatedAt = 1),
        VaultEntry(id = "b", title = "Bank", username = "u", password = "p@ss", notes = "n", category = "banking", updatedAt = 2),
    )

    @Test fun categoriesRoundTripAndUnknownFallsBack() {
        val s = store()
        s.create("pw-123456".toCharArray(), sample + VaultEntry(id = "c", title = "x", category = "nope"))
        val e = s.unlock("pw-123456".toCharArray()).entries
        assertEquals(listOf("email", "banking", "general"), e.map { it.category })
    }

    @Test fun guessCategory() {
        assertEquals("banking", Categories.guess("Leumi", "https://www.leumi.co.il"))
        assertEquals("email", Categories.guess("", "https://accounts.google.com/gmail"))
        assertEquals("social", Categories.guess("Facebook", ""))
        assertEquals("entertainment", Categories.guess("Netflix", "netflix.com"))
        assertEquals("general", Categories.guess("משהו", "https://example.org"))
        assertEquals("torrents", Categories.guess("RuTracker", "https://rutracker.org"))
        assertEquals("torrents", Categories.guess("", "https://www.torrentleech.org/user/login"))
        assertEquals("torrents", Categories.guess("Nyaa", "https://nyaa.si"))
    }

    @Test fun csvParseQuotesNewlinesBom() {
        val rows = Csv.parse("﻿a,b,c\r\n\"x, y\",\"he said \"\"hi\"\"\",\"line1\nline2\"\r\n")
        assertEquals(listOf(listOf("a", "b", "c"), listOf("x, y", "he said \"hi\"", "line1\nline2")), rows)
    }

    @Test fun csvExportImportKeepsTrickyValues() {
        val tricky = listOf(
            VaultEntry(title = "א, ב", url = "https://a.example.com", username = "u\"1", password = "=SUM(1)", notes = "שורה\nשנייה", category = "work"),
            VaultEntry(title = "b", url = "", username = "x", password = "-start,with\"quote", notes = "", category = "general"),
        )
        val parsed = Csv.parseEntries(Csv.export(tricky))
        assertEquals(0, parsed.skipped)
        assertEquals(tricky.map { listOf(it.title, it.url, it.username, it.password, it.notes, it.category) },
            parsed.entries.map { listOf(it.title, it.url, it.username, it.password, it.notes, it.category) })
    }

    @Test fun csvImportBrowserFormats() {
        val chrome = Csv.parseEntries("name,url,username,password,note\nmy bank,https://www.leumi.co.il/,me,p1,\n").entries.single()
        assertEquals(listOf("my bank", "https://www.leumi.co.il/", "me", "p1", "banking"), listOf(chrome.title, chrome.url, chrome.username, chrome.password, chrome.category))
        val ff = Csv.parseEntries("\"url\",\"username\",\"password\",\"httpRealm\"\n\"https://www.facebook.com\",\"fb@example.com\",\"p2\",\n").entries.single()
        assertEquals(listOf("facebook.com", "p2", "social"), listOf(ff.title, ff.password, ff.category))
        val bw = Csv.parseEntries("folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\nwork,,login,Jira,n,,,https://jira.example.com,dev,p3,\n").entries.single()
        assertEquals(listOf("Jira", "https://jira.example.com", "dev", "p3", "n", "work"), listOf(bw.title, bw.url, bw.username, bw.password, bw.notes, bw.category))
        try { Csv.parseEntries("foo,bar\n1,2\n"); fail() } catch (e: Csv.UnrecognizedCsvException) { }
    }

    @Test fun importSkipsDuplicates() {
        val cur = listOf(VaultEntry(id = "1", title = "a", url = "https://x.com", username = "u", password = "p"))
        val r = VaultOps.import(cur, listOf(
            VaultEntry(title = "a2", url = "https://X.com", username = "u", password = "p"),
            VaultEntry(title = "b", username = "u2", password = "q"),
            VaultEntry(title = "b", username = "u2", password = "q"),
        ))
        assertEquals(1, r.added)
        assertEquals(2, r.duplicates)
        assertEquals(2, r.entries.size)
    }

    @Test fun mergeAddsNewAndUpdatesOnlyNewer() {
        val cur = listOf(VaultEntry(id = "1", title = "old", updatedAt = 10), VaultEntry(id = "2", title = "keep", updatedAt = 50))
        val r = VaultOps.merge(cur, listOf(VaultEntry(id = "1", title = "newer", updatedAt = 20), VaultEntry(id = "2", title = "older", updatedAt = 5), VaultEntry(id = "3", title = "new", updatedAt = 1)))
        assertEquals(1, r.added)
        assertEquals(1, r.updated)
        assertEquals(listOf("keep", "new", "newer"), r.entries.map { it.title }.sorted())
    }

    @Test fun backupRestoresWithItsOwnPasswordOnly() {
        val s = store()
        val session = s.create("backup-pass-1".toCharArray(), sample)
        val bytes = s.encryptedBytes()
        assertEquals(sample, s.readBackup(bytes, "backup-pass-1".toCharArray()))
        try { s.readBackup(bytes, "nope".toCharArray()); fail() } catch (e: WrongPasswordException) { }
        try { s.readBackup(ByteArray(80) { 3 }, "x".toCharArray()); fail() } catch (e: CorruptVaultException) { }
        session.lock()
    }

    @Test fun changeMasterPassword() {
        val s = store()
        val session = s.create("old-password".toCharArray(), sample)
        session.changePassword("new-password-2".toCharArray())
        try { s.unlock("old-password".toCharArray()); fail() } catch (e: WrongPasswordException) { }
        assertEquals(sample, s.unlock("new-password-2".toCharArray()).entries)
        session.save(session.entries) // המפתח החדש עובד גם לשמירה
        assertEquals(sample, s.unlock("new-password-2".toCharArray()).entries)
    }

    /** גיבוי שנוצר בגרסת המחשב נפתח באנדרואיד (אותו פורמט קובץ ואותה הצפנה). */
    @Test fun opensBackupCreatedByDesktopApp() {
        val bytes = javaClass.getResourceAsStream("/desktop-vault.pvault")!!.readBytes()
        val e = store().readBackup(bytes, "desktop-fixture-1".toCharArray())
        assertEquals(2, e.size)
        assertEquals(listOf("מהמחשב – בנק", "pc@example.com", "Pc!pass\"1,ש", "https://bank.example.com", "שורה\nשנייה", "banking", 1700000000000L),
            listOf(e[0].title, e[0].username, e[0].password, e[0].url, e[0].notes, e[0].category, e[0].updatedAt))
        assertEquals("work", e[1].category)
    }

    /** כספת בפורמט הבינארי של גרסה 0.1 עדיין נקראת. */
    @Test fun readsLegacyV01Payload() {
        val bytes = ByteArrayOutputStream()
        DataOutputStream(bytes).use { out ->
            out.writeInt(1); out.writeInt(1)
            for (f in listOf("id1", "ישן", "u", "p", "https://x", "n")) { val b = f.toByteArray(); out.writeInt(b.size); out.write(b) }
            out.writeLong(5L)
        }
        val e = VaultCodec.decode(bytes.toByteArray()).single()
        assertEquals(listOf("id1", "ישן", "u", "p", "https://x", "n", "general", 5L), listOf(e.id, e.title, e.username, e.password, e.url, e.notes, e.category, e.updatedAt))
    }

    @Test fun payloadIsSharedJsonFormat() {
        val json = String(VaultCodec.encode(sample), Charsets.UTF_8)
        assertTrue(json.startsWith("{\"v\":1,\"entries\":["))
        assertTrue(json.contains("\"category\":\"email\""))
        assertFalse(json.contains("\\u05")) // עברית נשמרת כ-UTF-8 רגיל
    }

    @Test fun autoLockDefaultsAndNever() {
        val p = AutoLockPolicy()
        assertEquals(15 * 60_000L, p.inactivityMillis)
        p.setMinutes(0)
        p.onUnlocked(0)
        p.onBackground(1)
        assertFalse(p.shouldLock(1_000_000_000_000L))
        p.setMinutes(5)
        assertTrue(p.shouldLock(1_000_000_000_000L))
        assertEquals(listOf(1, 5, 15, 30, 60, 0), AutoLockPolicy.CHOICES_MINUTES)
    }
}

class AutofillMatchTest {
    private val bank = VaultEntry(title = "בנק", url = "https://www.leumi.co.il/login", username = "u", password = "p")
    private val google = VaultEntry(title = "Gmail", url = "https://accounts.google.com", username = "g", password = "p")
    private val fb = VaultEntry(title = "Facebook", url = "facebook.com", username = "f", password = "p")
    private val noUrl = VaultEntry(title = "Wi-Fi", username = "", password = "p")
    private val all = listOf(bank, google, fb, noUrl)

    @Test fun exactForPageOnlySameHost() {
        val bank2 = VaultEntry(title = "בנק 2", url = "leumi.co.il", username = "u2", password = "p")
        val hb = VaultEntry(title = "HB", url = "https://hb2.leumi.co.il", username = "h", password = "p")
        val list = listOf(bank, bank2, hb, google, noUrl)
        assertEquals(listOf("h"), AutofillMatch.exactForPage(list, "hb2.leumi.co.il").map { it.username })
        assertEquals(setOf("u", "u2"), AutofillMatch.exactForPage(list, "www.leumi.co.il").map { it.username }.toSet())
        assertEquals(emptyList<VaultEntry>(), AutofillMatch.exactForPage(list, "leumi.co.il.evil.example"))
        assertEquals(emptyList<VaultEntry>(), AutofillMatch.exactForPage(list, null)) // אפליקציה – לא
        assertEquals(3, AutofillMatch.matches(list, "hb2.leumi.co.il", "").size) // הרשימה הרגילה – כל האתר
    }

    @Test fun baseDomain() {
        assertEquals("leumi.co.il", AutofillMatch.baseDomain("hb2.leumi.co.il"))
        assertEquals("google.com", AutofillMatch.baseDomain("accounts.google.com"))
        assertEquals("example.com", AutofillMatch.baseDomain("www.example.com"))
    }

    @Test fun webDomainMatchesOnlySameSite() {
        assertEquals(listOf(bank), AutofillMatch.matches(all, "hb2.leumi.co.il", "com.android.chrome"))
        assertEquals(listOf(google), AutofillMatch.matches(all, "mail.google.com", "com.android.chrome"))
        assertEquals(listOf(fb), AutofillMatch.matches(all, "m.facebook.com", "com.android.chrome"))
        // אתר מתחזה לא מקבל את הסיסמה
        assertTrue(AutofillMatch.matches(all, "leumi.co.il.evil.com", "com.android.chrome").isEmpty())
        assertTrue(AutofillMatch.matches(all, "faceb00k.com", "com.android.chrome").isEmpty())
        // בדפדפן לא מתאימים לפי שם האפליקציה
        assertTrue(AutofillMatch.matches(all, "example.org", "com.android.chrome").isEmpty())
    }

    @Test fun appPackageMatches() {
        assertEquals(listOf(fb), AutofillMatch.matches(all, null, "com.facebook.orca"))
        assertEquals(listOf(google), AutofillMatch.matches(all, null, "com.google.android.gm.gmail"))
        assertTrue(AutofillMatch.matches(all, null, "com.unknown.thing").isEmpty())
    }
}
