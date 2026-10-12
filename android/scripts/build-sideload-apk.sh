#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

[[ $# -eq 1 ]] || fail "Usage: android/scripts/build-sideload-apk.sh <existing-debug-keystore>"
KEYSTORE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
[[ -f "$KEYSTORE" ]] || fail "The signing keystore is missing"
ANDROID_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
command -v mise >/dev/null || fail "mise is required; install the JDK pinned in .mise.toml"
export ANDROID_HOME

BUILD_TOOLS="$ANDROID_HOME/build-tools/36.0.0"
[[ -x "$BUILD_TOOLS/apksigner" && -x "$BUILD_TOOLS/zipalign" ]] || fail "Android Build Tools 36.0.0 are required"
[[ -x "$ANDROID_HOME/cmdline-tools/latest/bin/apkanalyzer" ]] || fail "Android command-line tools are required"
for variable in ANDROID_SIGNING_KEY_PATH ANDROID_KEY_STORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
  [[ -z "${!variable:-}" ]] || fail "Unset $variable before creating a locally signed APK"
done

cd "$ANDROID_DIR"
scripts/sdk.sh check
PINNED_VERSION="$(sed -E 's/.*muxy-mobile-(.*)-android.zip/\1/' MuxyMobileSDK/SHA256SUMS)"
[[ "$(cat MuxyMobileSDK/Installed/REVISION)" == "$PINNED_VERSION" ]] || fail "Installed SDK does not match the release pin"
VERSION_CODE="$(date +%s)"
VERSION_NAME="3.1.0"
source scripts/release-inputs.sh
validate_release_inputs
mise exec -- ./gradlew :app:assembleRelease -PmuxyArm64Only=true -PversionName="$VERSION_NAME" -PversionCode="$VERSION_CODE"

UNSIGNED="app/build/outputs/apk/release/app-release-unsigned.apk"
mise exec -- scripts/check-release.sh "$UNSIGNED"
mkdir -p "$ANDROID_DIR/.build"
WORK="$(mktemp -d "$ANDROID_DIR/.build/sideload.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
mise exec -- "$BUILD_TOOLS/apksigner" sign --ks "$KEYSTORE" --ks-key-alias androiddebugkey \
  --ks-pass pass:android --key-pass pass:android --out "$WORK/muxyapp.apk" "$UNSIGNED"
mise exec -- "$BUILD_TOOLS/apksigner" verify --verbose --print-certs "$WORK/muxyapp.apk"
"$BUILD_TOOLS/zipalign" -c -P 16 4 "$WORK/muxyapp.apk"
ABIS="$(unzip -Z1 "$WORK/muxyapp.apk" | awk -F/ '$1 == "lib" && $NF ~ /\.so$/ {print $2}' | sort -u)"
[[ "$ABIS" == arm64-v8a ]] || fail "Expected only arm64-v8a native libraries, found: $ABIS"
unzip -Z1 "$WORK/muxyapp.apk" | grep -Fx 'lib/arm64-v8a/libmuxy_mobile.so' > /dev/null || fail "Muxy SDK library is missing"
OUTPUT="$ANDROID_DIR/app/build/outputs/apk/release/muxyapp.apk"
mv "$WORK/muxyapp.apk" "$OUTPUT"
printf 'APK: %s\nVersion: %s (%s)\nSDK: %s\nABI: %s\nBytes: %s\n' \
  "$OUTPUT" "$VERSION_NAME" "$VERSION_CODE" "$PINNED_VERSION" "$ABIS" "$(stat -f %z "$OUTPUT")"
shasum -a 256 "$OUTPUT"
