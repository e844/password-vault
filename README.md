# כספת סיסמאות – גרסה 0.1 (גרסת בדיקה)

מנהל סיסמאות לאנדרואיד ול-Windows. ממשק בעברית מימין לשמאל בעיצוב Material You, עבודה בלי אינטרנט, ו**נתוני דוגמה בלבד**.

| תיקייה | מה יש בה |
|---|---|
| `android/` | אפליקציית אנדרואיד (Kotlin + Jetpack Compose) |
| `desktop/` | אפליקציית Windows (Electron) |

כל דחיפה ל-`main` בונה אוטומטית APK ו-EXE, ומפרסמת אותם בעמוד **Releases** של המאגר.

## התקנה
**Windows:** מורידים את `PasswordVault-Windows.zip` מ-Releases, מחלצים, ומפעילים את `PasswordVault.exe`. אם Windows SmartScreen מציג אזהרה, לוחצים **More info** ואז **Run anyway**. זה צפוי בתוכנה שלא נחתמה דיגיטלית.

**Android 8 ומעלה:** מורידים את `PasswordVault-Android.apk` בטלפון ופותחים את הקובץ. מאשרים "התקנה ממקור זה", ואם Play Protect מזהיר, בוחרים "התקנה בכל זאת".

ראו גם `android/README.md` ו-`desktop/README.md`.

לא כלול בגרסה זו: סנכרון ענן ומילוי אוטומטי.
