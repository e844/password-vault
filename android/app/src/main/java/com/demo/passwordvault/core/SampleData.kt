package com.demo.passwordvault.core

/** נתוני דוגמה בלבד – חשבונות מומצאים בדומיין example.com. הסיסמאות נוצרות אקראית ביצירת הכספת. */
object SampleData {
    fun entries(generator: PasswordGenerator = PasswordGenerator()): List<VaultEntry> {
        fun pw() = generator.generate(GeneratorOptions(length = 16))
        return listOf(
            VaultEntry(title = "דוגמה – דואר אלקטרוני", username = "dana.demo@example.com", password = pw(), url = "https://demo-mail.example", notes = "חשבון דוגמה", category = "email"),
            VaultEntry(title = "דוגמה – בנק", username = "demo-user-1234", password = pw(), url = "https://demo-bank.example", notes = "לא חשבון אמיתי", category = "banking"),
            VaultEntry(title = "דוגמה – רשת חברתית", username = "@demo_user", password = pw(), url = "https://demo-social.example", category = "social"),
            VaultEntry(title = "דוגמה – חנות מקוונת", username = "shopper@example.com", password = pw(), url = "https://demo-shop.example", notes = "מספר לקוח: 000000", category = "shopping"),
            VaultEntry(title = "דוגמה – Wi-Fi בבית", username = "", password = pw(), notes = "שם רשת: Demo-WiFi", category = "home"),
            VaultEntry(title = "דוגמה – מערכת בעבודה", username = "d.demo", password = pw(), url = "https://demo-work.example", category = "work"),
            VaultEntry(title = "דוגמה – אתר טורנטים", username = "seeder_demo", password = pw(), url = "https://demo-tracker.example", notes = "יחס שיתוף: 1.0 (מומצא)", category = "torrents"),
            VaultEntry(title = "דוגמה – סטרימינג", username = "family@example.com", password = pw(), url = "https://demo-tv.example", notes = "חשבון משפחתי", category = "entertainment"),
        )
    }
}
