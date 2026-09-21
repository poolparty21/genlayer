#!/usr/bin/env bash
set -u
P=/home/unexpected/.cache/gltest-direct/extracted/local/py-lib-genlayer-std/11rhn002yfajawsz7fai6mykznbxkxs6l91iskj5cm82c92qhy3v
echo "P=[$P]"
ls "$P" | head
cd /mnt/e/www/genlayer || exit 1
PYTHONPATH="$P" timeout 60 .venv/bin/python - <<'EOF' 2>&1 | tail -30
import importlib.util, sys, traceback
P = "/home/unexpected/.cache/gltest-direct/extracted/local/py-lib-genlayer-std/11rhn002yfajawsz7fai6mykznbxkxs6l91iskj5cm82c92qhy3v"
sys.path.insert(0, P)
spec = importlib.util.spec_from_file_location("c", "contracts/AgentzProofVerifier.py")
m = importlib.util.module_from_spec(spec)
sys.modules["c"] = m
try:
    spec.loader.exec_module(m)
    print("LOAD OK")
except Exception:
    traceback.print_exc()
EOF
