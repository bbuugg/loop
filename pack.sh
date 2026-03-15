#!/usr/bin/env bash
set -e

read -rp 'Version (e.g. 1.0.0): ' version
if [[ -z "$version" ]]; then
  echo 'Error: version cannot be empty'
  exit 1
fi

OUT="plugin/loop-${version}.zip"

# Remove existing zip with same name if present
[ -f "$OUT" ] && rm "$OUT"

# Zip all plugin contents except existing zips, preserving directory structure
(cd plugin && zip -r "../temp_loop_pack.zip" . --exclude '*.zip')
mv temp_loop_pack.zip "$OUT"

echo "Created: $OUT"
