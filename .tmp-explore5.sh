#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
C=/home/unexpected/.cache/gltest-direct/trees-v2/v0.6.0-rc6
echo "=== 1. NEW-scheme RC runner.json (py-genlayer) ==="
timeout 30 .venv/bin/python - <<'EOF'
import zipfile, json
z = zipfile.ZipFile("/home/unexpected/.cache/gltest-direct/trees-v2/v0.6.0-rc6/runners/py-genlayer/5j/ycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng.zip")
names = z.namelist()
print("members:", names[:12])
if "runner.json" in names:
    print(z.read("runner.json").decode()[:2000])
EOF
echo "=== 2. LEGACY runner.json (the one the contract pins) ==="
cat /home/unexpected/.cache/gltest-direct/extracted/local/py-genlayer/1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6/runner.json
echo ""
echo "=== 3. legacy std runner.json ==="
cat /home/unexpected/.cache/gltest-direct/extracted/local/py-lib-genlayer-std/11rhn002yfajawsz7fai6mykznbxkxs6l91iskj5cm82c92qhy3v/runner.json 2>/dev/null || echo "(no runner.json)"
echo ""
echo "=== 4. does installed tooling know the new hash? ==="
timeout 60 grep -rl "ycge4q8k" .venv/lib/python3.12/site-packages/ 2>/dev/null | head -5
timeout 60 grep -rn "py-genlayer:" .venv/lib/python3.12/site-packages/genlayer/ 2>/dev/null | grep -v ".pyc" | head -10
timeout 60 grep -rn "py-genlayer:" .venv/lib/python3.12/site-packages/gltest/ 2>/dev/null | grep -v ".pyc" | head -10
