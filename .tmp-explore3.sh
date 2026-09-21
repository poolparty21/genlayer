#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
echo "=== 1. who writes gltest-direct cache ==="
timeout 60 grep -rl "gltest-direct" .venv/lib/python3.12/site-packages/ 2>/dev/null | head -10
echo "=== 1b. done grep ==="
B=/home/unexpected/.cache/gltest-direct/bundles-v2/genvm-universal-v0.6.0-rc6.tar.xz
echo "=== 2. bundle: first entries ==="
timeout 30 bash -c "xz -dc '$B' 2>/dev/null | head -c 200000 | tar -tv 2>/dev/null | head -40"
echo "=== 2b. done ==="
