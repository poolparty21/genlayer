#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
echo "=== 1. which packages write gltest-direct cache ==="
grep -rln "gltest-direct" .venv/lib/python3.12/site-packages/ 2>/dev/null | head -10
echo "=== 2. genvm-universal bundle contents (manifest-level) ==="
B=/home/unexpected/.cache/gltest-direct/bundles-v2/genvm-universal-v0.6.0-rc6.tar.xz
timeout 40 tar -tJf "$B" 2>/dev/null | head -50
