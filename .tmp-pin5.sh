#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
I=/home/unexpected/.cache/genvm-linter/genvm-universal-genlayerlabs-genvm-manager-v0.6.0-rc6.tar.xz.index-v3.json
echo "=== 1. corrupt index file? ==="
ls -la "$I"
wc -c "$I"
head -c 100 "$I" | od -c | head -3
echo "=== 2. delete corrupt cache index (tool rebuilds it by design) ==="
rm -f "$I"
echo deleted
echo "=== 3. schema under LEGACY pin (official path, index rebuilt) ==="
timeout 400 .venv/bin/genvm-lint schema contracts/AgentzProofVerifier.py 2>&1 | head -30
echo "=== 4. schema under NEW pin (scratch copy) ==="
timeout 400 .venv/bin/genvm-lint schema /tmp/abtest/AgentzProofVerifier_newpin.py 2>&1 | head -30
