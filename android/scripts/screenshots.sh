#!/usr/bin/env bash
# בדיקת ממשק על אמולטור + צילומי מסך לתיעוד (נתוני דוגמה בלבד).
# שימוש: screenshots.sh <path-to-apk> <output-dir>
set -euo pipefail
APK="$1"
OUT="$2"
PKG="com.demo.passwordvault.screenshot"
MASTER="Demo-Master-2026"
mkdir -p "$OUT"

# אמולטור איטי ב-CI מקפיץ לפעמים "System UI isn't responding" – לוחצים "Wait" וממשיכים
dismiss_system_dialog() {
  local c
  c=$(python3 - <<'PY'
import re
x = open('/tmp/ui.raw', encoding='utf-8', errors='ignore').read()
m = re.search(r'resource-id="android:id/aerr_wait"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', x)
if m:
    a = list(map(int, m.groups()))
    print((a[0] + a[2]) // 2, (a[1] + a[3]) // 2)
PY
)
  if [ -n "$c" ]; then echo "  (dismissing system ANR dialog)" >&2; adb shell input tap $c; sleep 2; return 0; fi
  return 1
}

dump() {
  for _ in 1 2 3; do
    adb exec-out uiautomator dump /dev/tty 2>/dev/null > /tmp/ui.raw || true
    dismiss_system_dialog || return 0
  done
}

center() { # resource-id, index
  dump
  python3 - "$1" "${2:-0}" <<'PY'
import re, sys, xml.etree.ElementTree as ET
x = open('/tmp/ui.raw', encoding='utf-8', errors='ignore').read()
s, e = x.find('<?xml'), x.rfind('</hierarchy>')
if s < 0 or e < 0: sys.exit(1)
root = ET.fromstring(x[s:e + 12])
m = [n for n in root.iter('node') if n.get('resource-id') == sys.argv[1]]
i = int(sys.argv[2])
if len(m) <= i: sys.exit(1)
a = list(map(int, re.findall(r'\d+', m[i].get('bounds'))))
print((a[0] + a[2]) // 2, (a[1] + a[3]) // 2)
PY
}

center_text() { # exact visible text (dialogs/menus are separate windows, without test tags)
  dump
  python3 - "$1" <<'PY'
import re, sys, xml.etree.ElementTree as ET
x = open('/tmp/ui.raw', encoding='utf-8', errors='ignore').read()
s, e = x.find('<?xml'), x.rfind('</hierarchy>')
if s < 0 or e < 0: sys.exit(1)
root = ET.fromstring(x[s:e + 12])
m = [n for n in root.iter('node') if n.get('text') == sys.argv[1]]
if not m: sys.exit(1)
a = list(map(int, re.findall(r'\d+', m[-1].get('bounds'))))
print((a[0] + a[2]) // 2, (a[1] + a[3]) // 2)
PY
}

tap_text() {
  for _ in $(seq 1 25); do
    if c=$(center_text "$1"); then adb shell input tap $c; sleep 1; return 0; fi
    sleep 1
  done
  fail "text '$1' not found"
}

fail() { echo "FAILED: $1"; dump; head -c 4000 /tmp/ui.raw; echo; adb exec-out screencap -p > "$OUT/failure.png" || true; exit 1; }

tap() {
  for _ in $(seq 1 25); do
    if c=$(center "$1" "${2:-0}"); then adb shell input tap $c; sleep 1; return 0; fi
    sleep 1
  done
  fail "element '$1' not found"
}

type_in() { tap "$1"; sleep 0.5; adb shell input text "${2// /%s}"; sleep 0.7; hide_keyboard; }

expect_text() {
  for _ in $(seq 1 40); do dump; grep -q "$1" /tmp/ui.raw && { echo "  ✓ $2"; return 0; }; sleep 1; done
  fail "text not found: $1 ($2)"
}

hide_keyboard() {
  if adb shell dumpsys input_method | grep -q "mInputShown=true"; then adb shell input keyevent 4; sleep 1; fi
}

shot() { hide_keyboard; sleep 1.5; adb exec-out screencap -p > "$OUT/$1.png"; echo "  📷 $1"; }

echo "== setup =="
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb shell cmd uimode night no
sleep 20 # לתת לאמולטור להתייצב אחרי האתחול
adb install -r "$APK"
adb shell am start -W -n "$PKG/com.demo.passwordvault.MainActivity"

echo "== first run =="
expect_text "יצירת כספת חדשה" "setup screen shown"
expect_text "נתוני דוגמה" "sample data banner shown"
sleep 5 # האמולטור איטי בשניות הראשונות אחרי הפתיחה
type_in master "$MASTER"
type_in confirm "$MASTER"
shot android-1-setup
tap submit
expect_text "8 רשומות" "vault created with 8 sample entries"
shot android-2-list

echo "== categories =="
tap cat_banking
expect_text "רשומה אחת" "category filter shows one banking entry"
shot android-2b-category
tap cat_all
expect_text "8 רשומות" "back to all entries"

echo "== detail =="
tap entry 1
expect_text "שם משתמש" "detail screen shown"
tap reveal
expect_text "הסתר" "password revealed"
shot android-3-detail
tap back

echo "== add entry =="
tap fab
type_in e_title "Demo Server"
type_in e_username "admin@example.com"
tap e_cat_work
tap e_generate
expect_text "השתמש בסיסמה" "generator dialog shown"
shot android-4-generator
tap_text "השתמש בסיסמה"
expect_text "חוזק: חזקה" "generated password is strong"
shot android-5-edit
tap save
expect_text "Demo Server" "entry saved"
tap back
expect_text "9 רשומות" "list has 9 entries"

echo "== auto-lock setting =="
tap menu
shot android-10-menu
tap_text "נעילה אוטומטית"
expect_text "אחרי 15 דקות" "auto-lock dialog shows choices"
tap_text "אחרי שעה"
tap_text "שמירה"
expect_text "שעה" "auto-lock saved"

echo "== search =="
type_in search "bank"
expect_text "רשומה אחת" "search finds one entry"
shot android-6-search

echo "== lock =="
tap lock
expect_text "הכספת נעולה" "vault locked"
type_in master "wrong-password"
tap submit
expect_text "סיסמה שגויה" "wrong password rejected"
shot android-7-locked

echo "== dark mode + persistence after restart =="
adb shell am force-stop "$PKG"
adb shell cmd uimode night yes
sleep 2
adb shell am start -W -n "$PKG/com.demo.passwordvault.MainActivity"
expect_text "הכספת נעולה" "starts locked after restart"
type_in master "$MASTER"
tap submit
expect_text "9 רשומות" "data persisted (9 entries)"
shot android-8-dark-list
tap entry 0
tap reveal
shot android-9-dark-detail

echo "== delete =="
tap delete
tap_text "מחיקה"
expect_text "8 רשומות" "entry deleted"

adb shell cmd uimode night no
echo "ALL ANDROID UI CHECKS PASSED"
