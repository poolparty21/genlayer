#!/usr/bin/env bash
set -u
C=/home/unexpected/.cache/gltest-direct
echo "=== bundles-v2 (maxdepth 3) ==="
find "$C/bundles-v2" -maxdepth 3 2>/dev/null | head -30
echo "=== trees-v2 file inventory ==="
find "$C/trees-v2" -type f 2>/dev/null | sed "s|$C/trees-v2/||" | sort | head -80
echo "=== nippy files anywhere in cache ==="
find "$C" -name "*.nippy" 2>/dev/null | head -20
echo "=== extracted/local (maxdepth 3) ==="
find "$C/extracted" -maxdepth 3 2>/dev/null | sed "s|$C/extracted/||" | head -30
echo "=== genlayer_py refs to bundle layout ==="
cd /mnt/e/www/genlayer
grep -rln "trees-v2\|bundles-v2\|genvm-universal" .venv/lib/python3.12/site-packages/genlayer_py/ 2>/dev/null | head -20
