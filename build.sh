#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SITE="$ROOT/site"

echo "=== Building Chinese (zh) ==="
mdbook build "$ROOT/book-zh" --dest-dir "$SITE/zh"

echo "=== Building English (en) ==="
mdbook build "$ROOT/book-en" --dest-dir "$SITE/en"

echo "=== Copying root index.html ==="
cp "$ROOT/index.html" "$SITE/"

echo "=== Done ==="
