package com.demo.passwordvault.core

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class VaultStoreTest {
    @get:Rule val tmp = TemporaryFolder()

    // מספר חזרות נמוך כדי שהבדיקות ירוצו מהר; בדיקה נפרדת משתמשת בברירת המחדל.
    private fun store(file: File = File(tmp.root, "vault.bin")) = VaultStore(file, iterations = 1_000)

    private val sample = listOf(
        VaultEntry(title = "דוגמה – מייל", username = "a@example.com", password = "S3cret!pass", url = "https://example.com", notes = "הערה"),
        VaultEntry(title = "Bank demo", username = "user", password = "p@ss-אבג"),
    )

    @Test fun createThenUnlockRoundTrip() {
        val s = store()
        s.create("master-סיסמה-1".toCharArray(), sample)
        val session = s.unlock("master-סיסמה-1".toCharArray())
        assertEquals(sample, session.entries)
    }

    @Test fun wrongPasswordIsRejected() {
        val s = store()
        s.create("correct horse".toCharArray(), sample)
        try {
            s.unlock("wrong horse".toCharArray())
            fail("expected WrongPasswordException")
        } catch (e: WrongPasswordException) { /* ok */ }
    }

    @Test fun fileContainsNoPlaintextAndNoMasterPassword() {
        val file = File(tmp.root, "vault.bin")
        val master = "MyMasterPassword123"
        store(file).create(master.toCharArray(), sample)
        val raw = file.readBytes()
        val asText = String(raw, Charsets.ISO_8859_1)
        val asUtf8 = String(raw, Charsets.UTF_8)
        for (needle in listOf(master, "S3cret!pass", "a@example.com", "Bank demo", "example.com")) {
            assertFalse("found '$needle' in vault file", asText.contains(needle) || asUtf8.contains(needle))
        }
        assertFalse(asUtf8.contains("דוגמה"))
        // אין קבצים נוספים בתיקייה (למשל קובץ זמני או קובץ עם hash של הסיסמה)
        assertEquals(listOf("vault.bin"), tmp.root.list()!!.toList())
    }

    @Test fun tamperedFileIsDetected() {
        val file = File(tmp.root, "vault.bin")
        store(file).create("pw-123456".toCharArray(), sample)
        val bytes = file.readBytes()
        bytes[bytes.size - 5] = (bytes[bytes.size - 5].toInt() xor 1).toByte()
        file.writeBytes(bytes)
        try {
            store(file).unlock("pw-123456".toCharArray())
            fail("expected failure")
        } catch (e: WrongPasswordException) { /* GCM tag mismatch */ }
    }

    @Test fun garbageFileIsCorrupt() {
        val file = File(tmp.root, "vault.bin")
        file.writeBytes(ByteArray(100) { 7 })
        try {
            store(file).unlock("x".toCharArray())
            fail("expected CorruptVaultException")
        } catch (e: CorruptVaultException) { /* ok */ }
    }

    @Test fun saveUsesFreshIvEachTime() {
        val file = File(tmp.root, "vault.bin")
        val session = store(file).create("pw-123456".toCharArray(), sample)
        val first = file.readBytes()
        session.save(sample)
        val second = file.readBytes()
        assertNotEquals(first.toList(), second.toList())
        assertEquals(sample, store(file).unlock("pw-123456".toCharArray()).entries)
    }

    @Test fun addEditDeletePersist() {
        val file = File(tmp.root, "vault.bin")
        val session = store(file).create("pw-123456".toCharArray(), sample)
        val added = VaultEntry(title = "חדש", password = "n3w")
        session.save(VaultOps.add(session.entries, added))
        session.save(VaultOps.update(session.entries, added.copy(username = "edited"), now = 42L))
        session.save(VaultOps.delete(session.entries, sample[0].id))

        val reopened = store(file).unlock("pw-123456".toCharArray()).entries
        assertEquals(2, reopened.size)
        val e = reopened.single { it.id == added.id }
        assertEquals("edited", e.username)
        assertEquals(42L, e.updatedAt)
        assertTrue(reopened.none { it.id == sample[0].id })
    }

    @Test fun lockWipesKeyAndBlocksSaving() {
        val session = store().create("pw-123456".toCharArray(), sample)
        session.lock()
        assertTrue(session.isLocked)
        assertTrue(session.entries.isEmpty())
        try {
            session.save(sample)
            fail("expected IllegalStateException")
        } catch (e: IllegalStateException) { /* ok */ }
    }

    @Test fun passwordCharArrayIsWipedAfterUse() {
        val s = store()
        val pw = "pw-123456".toCharArray()
        s.create(pw, sample)
        assertTrue(pw.all { it == '\u0000' })
        val pw2 = "pw-123456".toCharArray()
        s.unlock(pw2)
        assertTrue(pw2.all { it == '\u0000' })
    }

    @Test fun defaultIterationsWork() {
        val file = File(tmp.root, "real.bin")
        val s = VaultStore(file) // 600,000 חזרות
        s.create("real-master".toCharArray(), sample)
        assertEquals(sample, s.unlock("real-master".toCharArray()).entries)
    }

    @Test fun codecRoundTripWithEmptyAndUnicode() {
        val entries = listOf(VaultEntry(title = "😀 שלום", username = "", password = "", url = "", notes = "שורה\nשנייה"))
        assertEquals(entries, VaultCodec.decode(VaultCodec.encode(entries)))
        assertEquals(emptyList<VaultEntry>(), VaultCodec.decode(VaultCodec.encode(emptyList())))
    }

    @Test fun derivedKeyDependsOnSalt() {
        val a = VaultCrypto.deriveKey("pw".toCharArray(), ByteArray(16) { 1 }, 1000)
        val b = VaultCrypto.deriveKey("pw".toCharArray(), ByteArray(16) { 2 }, 1000)
        assertEquals(32, a.size)
        assertFalse(a.contentEquals(b))
        assertArrayEquals(a, VaultCrypto.deriveKey("pw".toCharArray(), ByteArray(16) { 1 }, 1000))
    }

    @Test fun toStringDoesNotLeakPassword() {
        val e = VaultEntry(title = "t", password = "TopSecret!")
        assertFalse(e.toString().contains("TopSecret!"))
    }
}
