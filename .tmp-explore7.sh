#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
T=/home/unexpected/.cache/gltest-direct/trees-v2/v0.6.0-rc6
W=/tmp/rc-runners
rm -rf "$W"; mkdir -p "$W/new" "$W/newstd"
echo "=== 1. extract new py-genlayer runner + new std ==="
timeout 60 .venv/bin/python - <<'EOF'
import zipfile
z = zipfile.ZipFile("/home/unexpected/.cache/gltest-direct/trees-v2/v0.6.0-rc6/runners/py-genlayer/5j/ycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng.zip")
z.extractall("/tmp/rc-runners/new")
z2 = zipfile.ZipFile("/home/unexpected/.cache/gltest-direct/trees-v2/v0.6.0-rc6/runners/py-lib-genlayer-std/kz/r02ndm9et4qkmbqpq5djjt5sme2yt76n7sz1qbzax0knt6mam0.zip")
z2.extractall("/tmp/rc-runners/newstd")
print("extracted ok")
EOF
echo "=== 2. new runner layout ==="
timeout 15 find "$W/new" -maxdepth 3 | head -20
echo "=== 3. new std layout (top) ==="
timeout 15 find "$W/newstd" -maxdepth 3 | head -25
echo "=== 4. bootloader header / version markers ==="
timeout 15 grep -rn "version\|VERSION\|0\.19\|genlayer-py" "$W/new/py/libs/_genlayer_bootloader.py" 2>/dev/null | head -10
echo "=== 5. legacy runner py entry for comparison ==="
L=/home/unexpected/.cache/gltest-direct/extracted/local/py-genlayer/1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6
timeout 15 find "$L" -maxdepth 3 | head -15
echo "=== 6. new pin hash in installed SDKs ==="
timeout 60 grep -rn "ycge4q8k\|kzr02ndm9\|3t4hs1eyr" .venv/lib/python3.12/site-packages/ 2>/dev/null | grep -v ".pyc" | head -10
echo "=== 7. Depends-generation code in installed SDKs ==="
timeout 60 grep -rn "Depends" .venv/lib/python3.12/site-packages/genlayer/ 2>/dev/null | grep -v ".pyc" | head -10
timeout 60 grep -rn "Depends" .venv/lib/python3.12/site-packages/genvm_linter/ 2>/dev/null | grep -v ".pyc" | head -10
