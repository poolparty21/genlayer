#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
echo "=== 1. new std: bootloader present? ==="
timeout 15 find /tmp/rc-runners/newstd -name "*bootloader*" -o -name "_genlayer*" | head -10
echo "=== 2. new std: any 'py' dir? ==="
timeout 15 ls /tmp/rc-runners/newstd
echo "=== 3. linter artifacts.py Depends handling (context) ==="
timeout 15 sed -n 500,600p .venv/lib/python3.12/site-packages/genvm_linter/validate/artifacts.py
echo "=== 4. linter sdk_loader.py (top 80 lines) ==="
timeout 15 sed -n 1,80p .venv/lib/python3.12/site-packages/genvm_linter/validate/sdk_loader.py
echo "=== 5. installed genlayer* package versions ==="
timeout 15 ls .venv/lib/python3.12/site-packages/ | grep -i "genlayer\|genvm" | head
for d in genlayer genlayer_py gltest genvm_linter genlayer_test; do
  timeout 10 .venv/bin/python -c "import importlib.metadata as m; print('$d', m.version('$d'))" 2>/dev/null
done
