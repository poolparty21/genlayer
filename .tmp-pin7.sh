#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
echo "=== 1. allow_storage in NEW std: where defined/exported? ==="
timeout 30 grep -rn "allow_storage" /tmp/rc-runners/newstd/genlayer/__init__.py | head -5
timeout 30 grep -rln "def allow_storage" /tmp/rc-runners/newstd/genlayer/ | head -5
echo "=== 2. NEW std genlayer/__init__.py (export surface) ==="
timeout 15 head -80 /tmp/rc-runners/newstd/genlayer/__init__.py
echo "=== 3. LEGACY std: allow_storage location ==="
L=/home/unexpected/.cache/gltest-direct/extracted/local/py-lib-genlayer-std/11rhn002yfajawsz7fai6mykznbxkxs6l91iskj5cm82c92qhy3v
timeout 30 grep -rn "def allow_storage" "$L/genlayer/" | head -5
timeout 15 grep -n "allow_storage" "$L/genlayer/__init__.py" | head -5
echo "=== 4. every name the contract uses from genlayer ==="
grep -noE "\bgl\.[a-zA-Z_.]+|@allow_storage|\bAddress\b|\bTreeMap\b|\bu256\b|\bDynArray\b|\beq_principle[a-zA-Z_]*|\bemulator\.[a-zA-Z_]+|\bRolldownDict\b|\bsuccess\b|\bfail\b" contracts/AgentzProofVerifier.py | sort -t: -k2 | uniq -c -f0 | awk -F: '{print $2}' | sort | uniq -c
echo "=== 5. presence of each in NEW std ==="
timeout 30 .venv/bin/python - <<'EOF'
import sys, subprocess
sys.path.insert(0, "/tmp/rc-runners/newstd")
import os
os.environ["_GL_TEST"] = "1"
names = ["gl", "Address", "TreeMap", "u256", "DynArray", "allow_storage", "eq_principle_prompt_comparing", "emulator", "success", "fail"]
try:
    import genlayer
    print("genlayer.__file__:", genlayer.__file__)
    for n in names:
        print(f"{n:35s}", "YES" if hasattr(genlayer, n) else "MISSING")
except BaseException as e:
    import traceback; traceback.print_exc()
EOF
