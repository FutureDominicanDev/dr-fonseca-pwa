#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_ICON="${1:-$ROOT_DIR/public/LOGO_02.png}"
OUT_DIR="$ROOT_DIR/assets/store"

if [[ ! -f "$SOURCE_ICON" ]]; then
  echo "Source icon not found: $SOURCE_ICON"
  exit 1
fi

mkdir -p "$OUT_DIR/ios/icons" "$OUT_DIR/android/icons"

echo "Generating iOS icons from $SOURCE_ICON"
sips -z 1024 1024 "$SOURCE_ICON" --out "$OUT_DIR/ios/icons/AppStore-1024.png" >/dev/null
sips -z 180 180 "$SOURCE_ICON" --out "$OUT_DIR/ios/icons/Icon-180.png" >/dev/null
sips -z 167 167 "$SOURCE_ICON" --out "$OUT_DIR/ios/icons/Icon-167.png" >/dev/null
sips -z 152 152 "$SOURCE_ICON" --out "$OUT_DIR/ios/icons/Icon-152.png" >/dev/null
sips -z 120 120 "$SOURCE_ICON" --out "$OUT_DIR/ios/icons/Icon-120.png" >/dev/null

echo "Generating Android icons from $SOURCE_ICON"
sips -z 512 512 "$SOURCE_ICON" --out "$OUT_DIR/android/icons/PlayStore-512.png" >/dev/null
sips -z 192 192 "$SOURCE_ICON" --out "$OUT_DIR/android/icons/Icon-192.png" >/dev/null
sips -z 144 144 "$SOURCE_ICON" --out "$OUT_DIR/android/icons/Icon-144.png" >/dev/null
sips -z 96 96 "$SOURCE_ICON" --out "$OUT_DIR/android/icons/Icon-96.png" >/dev/null
sips -z 72 72 "$SOURCE_ICON" --out "$OUT_DIR/android/icons/Icon-72.png" >/dev/null
sips -z 48 48 "$SOURCE_ICON" --out "$OUT_DIR/android/icons/Icon-48.png" >/dev/null

cp "$OUT_DIR/ios/icons/Icon-180.png" "$ROOT_DIR/public/apple-touch-icon.png"
cp "$OUT_DIR/android/icons/Icon-192.png" "$ROOT_DIR/public/icon-192.png"
cp "$OUT_DIR/android/icons/PlayStore-512.png" "$ROOT_DIR/public/icon-512.png"

echo "Done."
echo "Store assets generated in: $OUT_DIR"
