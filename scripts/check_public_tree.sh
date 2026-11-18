#!/usr/bin/env bash
# Fail if a public-repo tree contains anything that must stay private (PDFs, registry exports, BM25 index, evals).
set -euo pipefail
DEST="${1:?usage: check_public_tree.sh <dir>}"
bad=$(cd "$DEST" && find . -path ./node_modules -prune -o -path ./.git -prune -o -path ./.next -prune -o -path ./out -prune -o -type f \
  \( -iname '*.pdf' -o -iname '*.csv' -o -iname '*.xlsx' -o -iname '*.xls' -o -iname '*.jsonl' \
     -o -path './evals/*' -o -path './Data/*' -o -iname '*_trace.json' -o -iname 'cases.json' \) -print)
if [ -n "$bad" ]; then echo "Refusing: private files in public tree:"; echo "$bad"; exit 1; fi
echo "public tree check: ok"
