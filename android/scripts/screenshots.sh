#!/usr/bin/env bash
# בדיקת ממשק על אמולטור + צילומי מסך לתיעוד (נתוני דוגמה בלבד).
# שימוש: screenshots.sh <path-to-apk> <output-dir>
set -euo pipefail
APK="$1"
OUT="$2"
PKG="com.demo.passwordvault.screenshot"
MASTER="Demo-Master-2026"
mkdir -p "$OUT"

dump() { adb exec-out uiautomator dump /dev/tty 2>/dev/null > /tmp/ui.raw || true; }

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

fail() { echo "FAILED: $1"; dump; head -c 4000 /tmp/ui.raw; echo; adb exec-out screencap -p > "$OUT/failure.png" || true; exit 1; }

tap() {
  for _ in $(seq 1 25); do
    if c=$(center "$1" "${2:-0}"); then adb shell input tap $c; sleep 1; return 0; fi
    sleep 1
  done
  fail "element '$1' not found"
}

type_in() { tap "$1"; adb shell input text "${2// /%s}"; sleep 0.7; }

expect_text() {
  for _ in $(seq 1 40); do dump; grep -q "$1" /tmp/ui.raw && { echo "  ✓ $2"; return 0; }; sleep 1; done
  fail "text not found: $1 ($2)"
}

shot() { sleep 1.5; adb exec-out screencap -p > "$OUT/$1.png"; echo "  📷 $1"; }

echo "== setup =="
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
# בלי מקלדת על המסך, כדי שלא תסתיר את הצילומים (הקלדה דרך adb עובדת גם בלעדיה)
for ime in $(adb shell ime list -s | tr -d '\r'); do adb shell ime disable "$ime" >/dev/null || true; done
adb shell cmd uimode night no
adb install -r "$APK"
adb shell am start -W -n "$PKG/com.demo.passwordvault.MainActivity"

echo "== first run =="
expect_text "יצירת כספת חדשה" "setup screen shown"
expect_text "נתוני דוגמה" "sample data banner shown"
type_in master "short"
type_in confirm "short"
tap submit
expect_text "לפחות 8 תווים" "short master password rejected"
adb shell am force-stop "$PKG"; adb shell am start -W -n "$PKG/com.demo.passwordvault.MainActivity"
type_in master "$MASTER"
type_in confirm "$MASTER"
shot android-1-setup
tap submit
expect_text "5 רשומות" "vault created with 5 sample entries"
shot android-2-list

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
tap e_generate
expect_text "השתמש בסיסמה" "generator dialog shown"
shot android-4-generator
tap gen_use
expect_text "חוזק: חזקה" "generated password is strong"
shot android-5-edit
tap save
expect_text "Demo Server" "entry saved"
tap back
expect_text "6 רשומות" "list has 6 entries"

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
expect_text "6 רשומות" "data persisted (6 entries)"
shot android-8-dark-list
tap entry 0
tap reveal
shot android-9-dark-detail

echo "== delete =="
tap delete
tap confirm_delete
expect_text "5 רשומות" "entry deleted"

adb shell cmd uimode night no
echo "ALL ANDROID UI CHECKS PASSED"
