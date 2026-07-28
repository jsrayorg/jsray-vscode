#!/bin/sh
# JSRay VS Code · sync bundled Core assets and palettes from the Core repo,
# then regenerate the VS Code themes.
#
# Usage:
#   sh tools/sync-core.sh              # expects Core repo at ../jsray
#   JSRAY_CORE_DIR=/path/to/jsray sh tools/sync-core.sh
set -e
cd "$(dirname "$0")/.."

CORE_DIR="${JSRAY_CORE_DIR:-../jsray}"
CORE_DIST="$CORE_DIR/dist"

if [ ! -d "$CORE_DIST" ]; then
  echo "error: Core dist not found at $CORE_DIST" >&2
  echo "       set JSRAY_CORE_DIR to the JSRay Core repo root." >&2
  exit 1
fi

# Runtime assets for the Markdown preview.
mkdir -p media/themes
cp "$CORE_DIST/jsray.js"            media/jsray.js
cp "$CORE_DIST/jsray.css"           media/jsray.css
cp "$CORE_DIST/themes/default.css"  media/themes/default.css

# Palette sources for theme generation: tokens.json is "default",
# plus every additional palette in the Core themes/ directory.
mkdir -p palettes
cp "$CORE_DIR/tokens.json" palettes/default.json
if [ -d "$CORE_DIR/themes" ]; then
  cp "$CORE_DIR"/themes/*.json palettes/ 2>/dev/null || true
fi

# The token vocabulary travels with the snapshot: the theme generator maps by
# it, and the preview validates custom palettes against it.
cp "$CORE_DIR/vocabulary.json" vocabulary.json

# Track the bundled Core version, then regenerate themes.
if command -v node >/dev/null 2>&1; then
  node tools/sync-core-version.mjs "$CORE_DIR"
  node tools/build-themes.mjs
else
  echo "warn: node not found — assets copied, themes NOT regenerated." >&2
fi

echo "synced Core ($CORE_DIR) → media/ + palettes/ + themes/"
