#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
T=/home/unexpected/.cache/gltest-direct/trees-v2/v0.6.0-rc6
echo "=== 1. tree top-level (what binaries ship) ==="
timeout 15 ls "$T"
timeout 15 find "$T" -maxdepth 2 -type d | grep -v legacy-runners | head -20
echo "=== 2. any genvm executables ==="
timeout 15 find "$T" -maxdepth 3 -type f \( -name "genvm*" -o -name "*.wasm" \) | grep -v legacy | head -20
echo "=== 3. vm.py execution mechanism (key excerpts) ==="
timeout 15 grep -n "def \|subprocess\|import\|wasm\|genvm\|_genlayer\|sys.path" .venv/lib/python3.12/site-packages/gltest/direct/vm.py | head -40
