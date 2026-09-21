#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
S=.tmp-rc/newstd
echo "=== 1. run_nondet / nondet execution in new std ==="
timeout 20 grep -rn "run_nondet\|nondet_unsafe\|def exec_prompt" "$S/genlayer/vm/"*.py "$S/genlayer/nondet/"*.py 2>/dev/null | grep -v ".pyc" | head -15
echo "=== 2. new std vm module surface ==="
timeout 20 .venv/bin/python - <<'EOF'
import sys
sys.path.insert(0, ".tmp-rc/newstd")
from unittest.mock import MagicMock
sys.modules["_genlayer_wasi"] = MagicMock()
import genlayer.vm as vm
print([a for a in dir(vm) if not a.startswith("_")])
import genlayer.nondet as nd
print([a for a in dir(nd) if not a.startswith("_")])
import inspect
import genlayer.nondet
try:
    print("exec_prompt sig:", inspect.signature(genlayer.nondet.exec_prompt))
except Exception as e:
    print("exec_prompt:", e)
EOF
echo "=== 3. legacy std vm.run_nondet_unsafe (for reference) ==="
L=/home/unexpected/.cache/gltest-direct/extracted/local/py-lib-genlayer-std/11rhn002yfajawsz7fai6mykznbxkxs6l91iskj5cm82c92qhy3v
timeout 15 grep -rn "def run_nondet_unsafe" "$L/genlayer/" | head -3
echo "=== 4. how does the contract use run_nondet_unsafe? ==="
grep -n "run_nondet_unsafe" contracts/AgentzProofVerifier.py
