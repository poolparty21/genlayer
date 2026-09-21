#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
echo "=== A. state after restart ==="
timeout 10 ls /home/unexpected/.cache/gltest-direct/trees-v2/ 2>/dev/null
timeout 10 ls /home/unexpected/.cache/genvm-linter/ 2>/dev/null | head -5
echo "=== A2. contract pin (fresh) ==="
head -2 contracts/AgentzProofVerifier.py
wc -l contracts/AgentzProofVerifier.py
echo "=== A3. newest published genvm-manager releases ==="
timeout 15 curl -s "https://api.github.com/repos/genlayerlabs/genvm-manager/releases?per_page=5" | grep -E '"tag_name"|"prerelease"' | head -10
echo "=== B. re-extract RC payloads ==="
timeout 60 .venv/bin/python - <<'EOF'
import zipfile, pathlib
tree = pathlib.Path("/home/unexpected/.cache/gltest-direct/trees-v2/v0.6.0-rc6/runners")
out = pathlib.Path("/tmp/rc-runners")
for typ, pre, name in (("py-genlayer","5j","new"), ("py-lib-genlayer-std","kz","newstd")):
    z = next((tree/typ/pre).glob("*.zip"))
    dest = out/name
    if not (dest/"runner.json").exists():
        dest.mkdir(parents=True, exist_ok=True)
        zipfile.ZipFile(z).extractall(dest)
    print(name, "<-", z.name)
print("runner.json:", (out/"new"/"runner.json").read_text()[:400])
EOF
echo "=== C. contract surface ==="
grep -nE "from genlayer|import genlayer" contracts/AgentzProofVerifier.py
echo "--- decorators ---"
grep -oE "@[A-Za-z_.]+" contracts/AgentzProofVerifier.py | sort | uniq -c
echo "=== D. API presence in NEW RC std ==="
S=/tmp/rc-runners/newstd
timeout 10 ls "$S/genlayer"
timeout 10 ls "$S/genlayer/py" 2>/dev/null | head -8 || echo "NO genlayer/py legacy path in RC std"
timeout 10 find "$S/genlayer" \( -name "get_schema*" -o -name "_internal" \) | head -5
timeout 10 grep -rln "eq_principle_prompt" "$S/genlayer" | head -3
timeout 10 grep -rln "run_llm_task\|ai_infra" "$S/genlayer" | head -3
timeout 10 ls "$S/genlayer/nondet"
echo "--- bootloader head ---"
timeout 10 head -30 "$S/_genlayer_bootloader.py"
echo "=== E. same APIs in LEGACY std (baseline) ==="
L=/home/unexpected/.cache/gltest-direct/extracted/local/py-lib-genlayer-std/11rhn002yfajawsz7fai6mykznbxkxs6l91iskj5cm82c92qhy3v
timeout 10 ls "$L/genlayer/py" 2>/dev/null | head -8
timeout 10 grep -rln "eq_principle_prompt" "$L/genlayer" | head -3
echo "=== F. real genvm binary shipped anywhere locally? ==="
timeout 10 ls .venv/lib/python3.12/site-packages/gltest/artifacts | head
timeout 20 find .venv/lib/python3.12/site-packages/gltest \( -iname "*genvm*" -o -iname "*.wasm" \) | head -5
echo "=== G. genvm-lint check (lint+validate, RC bundle, read-only) ==="
timeout 150 .venv/bin/genvm-lint check contracts/AgentzProofVerifier.py 2>&1 | tail -35
