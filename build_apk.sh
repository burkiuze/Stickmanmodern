#!/bin/bash
# Builds dist/NeonDuel.apk from www/ using the Android SDK build tools directly (no Gradle).
set -e
SDK=${ANDROID_HOME:-/home/user/android-sdk}
BT=$SDK/build-tools/35.0.0
JAR=$SDK/platforms/android-34/android.jar
ROOT=$(cd "$(dirname "$0")" && pwd)
OUT=$ROOT/build; rm -rf "$OUT"; mkdir -p "$OUT/classes" "$OUT/assets/www" "$ROOT/dist"
cp "$ROOT"/www/* "$OUT/assets/www/"
$BT/aapt2 compile --dir "$ROOT/android/res" -o "$OUT/res.zip"
$BT/aapt2 link -I "$JAR" --manifest "$ROOT/android/AndroidManifest.xml" -A "$OUT/assets" -o "$OUT/base.apk" "$OUT/res.zip" --auto-add-overlay
javac -source 8 -target 8 -nowarn -bootclasspath "$JAR" -cp "$JAR" -d "$OUT/classes" $(find "$ROOT/android/src" -name '*.java') 2>&1 | grep -v "warning" || true
$BT/d8 --lib "$JAR" --min-api 21 --output "$OUT" $(find "$OUT/classes" -name '*.class')
(cd "$OUT" && zip -q base.apk classes.dex)
$BT/zipalign -f -p 4 "$OUT/base.apk" "$OUT/aligned.apk"
KS=$ROOT/android/debug.keystore
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storepass android -keypass android -alias neonduel -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Neon Duel" >/dev/null 2>&1
$BT/apksigner sign --ks "$KS" --ks-pass pass:android --key-pass pass:android --ks-key-alias neonduel --out "$ROOT/dist/NeonDuel.apk" "$OUT/aligned.apk"
$BT/apksigner verify "$ROOT/dist/NeonDuel.apk" && ls -la "$ROOT/dist/NeonDuel.apk"
