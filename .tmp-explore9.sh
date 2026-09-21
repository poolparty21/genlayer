#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
echo "=== 1. extract_sdk_paths notes logic (80-200) ==="
timeout 15 sed -n 80,200p .venv/lib/python3.12/site-packages/genvm_linter/validate/sdk_loader.py
echo "=== 2. upgrade/outdated language in genvm_linter ==="
timeout 30 grep -rn "upgrade\|outdated\|no longer\|legacy" .venv/lib/python3.12/site-packages/genvm_linter/ 2>/dev/null | grep -v ".pyc" | head -15
echo "=== 3. both pin hashes anywhere in site-packages ==="
timeout 60 grep -rln "1jb45aa8\|b45aa8ynh2\|ycge4q8k\|5jycge4q" .venv/lib/python3.12/site-packages/ 2>/dev/null | grep -v ".pyc" | head -10
echo "=== 4. run RC linter on the contract (read-only) ==="
timeout 90 .venv/bin/genvm-lint contracts/AgentzProofVerifier.py 2>&1 | tail -40
