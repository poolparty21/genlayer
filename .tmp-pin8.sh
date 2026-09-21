#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
mkdir -p .tmp-rc
echo "=== 1. extract NEW std persistently ==="
timeout 60 .venv/bin/python - <<'EOF'
import zipfile, pathlib
z = pathlib.Path("/home/unexpected/.cache/gltest-direct/trees-v2/v0.6.0-rc6/runners/py-lib-genlayer-std/kz")
zip_path = next(z.glob("*.zip"))
dest = pathlib.Path(".tmp-rc/newstd")
if not (dest/"genlayer"/"__init__.py").exists():
    dest.mkdir(parents=True, exist_ok=True)
    zipfile.ZipFile(zip_path).extractall(dest)
print("extracted to", dest.resolve())
EOF
echo "=== 2. NEW std genlayer/__init__.py ==="
timeout 15 cat .tmp-rc/newstd/genlayer/__init__.py | head -100
echo "=== 3. does NEW std define allow_storage anywhere? ==="
timeout 30 grep -rn "allow_storage" .tmp-rc/newstd/genlayer/ | grep -v ".pyc" | head -10
echo "=== 4. contract-used names vs NEW std exports ==="
timeout 30 .venv/bin/python - <<'EOF'
import sys
sys.path.insert(0, ".tmp-rc/newstd")
try:
    import genlayer
    print("imported:", genlayer.__file__)
    names = ["gl", "Address", "TreeMap", "u256", "DynArray", "allow_storage",
             "eq_principle_prompt_comparing", "emulator", "success", "fail"]
    for n in names:
        print(f"{n:35s}", "YES" if hasattr(genlayer, n) else "MISSING")
    gl = getattr(genlayer, "gl", None)
    if gl is not None:
        for n in ["public", "nondet", "vm", "eq_principle"]:
            print(f"gl.{n:30s}", "YES" if hasattr(gl, n) else "MISSING")
except BaseException:
    import traceback; traceback.print_exc()
EOF
echo "=== 5. what does NEW std genlayer/py look like? ==="
timeout 10 ls .tmp-rc/newstd/genlayer/py 2>/dev/null || echo "NO genlayer/py in new std"
timeout 10 ls .tmp-rc/newstd/genlayer/contract 2>/dev/null | head -5
echo "=== 6. legacy std __init__ for comparison (export list) ==="
L=/home/unexpected/.cache/gltest-direct/extracted/local/py-lib-genlayer-std/11rhn002yfajawsz7fai6mykznbxkxs6l91iskj5cm82c92qhy3v
timeout 15 sed -n 1,40p "$L/genlayer/__init__.py"
