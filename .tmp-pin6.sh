#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
echo "=== 1. recreate A/B scratch with NEW pin ==="
mkdir -p /tmp/abtest
sed 's/py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6/py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng/' contracts/AgentzProofVerifier.py > /tmp/abtest/AgentzProofVerifier_newpin.py
head -1 /tmp/abtest/AgentzProofVerifier_newpin.py
echo "=== 2. schema under NEW pin (scratch, contract untouched) ==="
timeout 400 .venv/bin/genvm-lint schema /tmp/abtest/AgentzProofVerifier_newpin.py 2>&1 | head -25
echo "=== 3. diff old std (11rhn) vs new std (kzr02) ==="
timeout 30 .venv/bin/python - <<'EOF'
import zipfile, hashlib, pathlib
tree = pathlib.Path("/home/unexpected/.cache/gltest-direct/trees-v2/v0.6.0-rc6/runners")
def members(pre, typ):
    z = next((tree/typ/pre).glob("*.zip"))
    return {n: hashlib.sha256(z.read(n)).hexdigest()[:12] for n in z.namelist() if n.endswith(".py")}
old = members("11", "py-lib-genlayer-std")
new = members("kz", "py-lib-genlayer-std")
only_old = sorted(set(old) - set(new))
only_new = sorted(set(new) - set(old))
diff = sorted(n for n in set(old) & set(new) if old[n] != new[n])
print("only in OLD std:", only_old[:10])
print("only in NEW std:", only_new[:10])
print("content-differs:", diff[:15])
print("totals:", len(old), "old,", len(new), "new")
EOF
echo "=== 4. real VM binaries in RC tree? ==="
T=/home/unexpected/.cache/gltest-direct/trees-v2/v0.6.0-rc6
timeout 20 find "$T" -maxdepth 3 -type d | grep -v runners | head
timeout 20 find "$T" -type f -name "*.wasm" | head -5
timeout 20 find "$T" -type f -name "genvm*" | grep -v legacy | head -5
timeout 20 ls "$T/executor/v0.2.17/" | head -20
