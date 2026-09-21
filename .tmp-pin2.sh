#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
echo "=== 1. where does 'Expecting value' come from? ==="
timeout 15 grep -rn "Failed to load SDK" .venv/lib/python3.12/site-packages/genvm_linter/ | grep -v ".pyc" | head -5
echo "=== 2. validate command implementation (top) ==="
timeout 15 grep -n "def validate\|def _validate\|load_sdk\|json.loads\|json.load" .venv/lib/python3.12/site-packages/genvm_linter/validate/*.py .venv/lib/python3.12/site-packages/genvm_linter/cli.py 2>/dev/null | grep -v ".pyc" | head -20
echo "=== 3. schema command on real contract (uses pinned legacy runner) ==="
timeout 120 .venv/bin/genvm-lint schema contracts/AgentzProofVerifier.py 2>&1 | head -20
echo "=== 4. A/B: scratch copy with NEW pin (NOT touching real contract) ==="
mkdir -p /tmp/abtest
sed 's/py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6/py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng/' contracts/AgentzProofVerifier.py > /tmp/abtest/AgentzProofVerifier_newpin.py
head -1 /tmp/abtest/AgentzProofVerifier_newpin.py
echo "--- schema under NEW pin ---"
timeout 120 .venv/bin/genvm-lint schema /tmp/abtest/AgentzProofVerifier_newpin.py 2>&1 | head -20
echo "--- lint+validate under NEW pin ---"
timeout 180 .venv/bin/genvm-lint check /tmp/abtest/AgentzProofVerifier_newpin.py 2>&1 | tail -25
