#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
S=.tmp-rc/newstd
echo "=== 1. TreeMap / DynArray / storage types in NEW std ==="
timeout 15 ls "$S/genlayer/storage/"
timeout 15 grep -rn "class TreeMap\|^TreeMap\|TreeMap =" "$S/genlayer/storage/"*.py "$S/genlayer/types/"*.py 2>/dev/null | grep -v ".pyc" | head -5
timeout 15 grep -rn "class DynArray\|DynArray =" "$S/genlayer/storage/"*.py "$S/genlayer/types/"*.py 2>/dev/null | grep -v ".pyc" | head -5
echo "=== 2. full __all__ of NEW std (tail) ==="
timeout 15 sed -n 100,200p "$S/genlayer/__init__.py"
echo "=== 3. storage decorator replacement for allow_storage ==="
timeout 15 grep -rn "def allow_storage\|ALLOW_STORAGE_ATTR\|__gl_allow_storage__" "$S/genlayer/storage/_internal/generate.py" | head -8
timeout 15 sed -n 25,55p "$S/genlayer/storage/_internal/generate.py"
echo "=== 4. nondet + eq_principle + public in NEW std ==="
timeout 15 grep -rn "def render" "$S/genlayer/nondet/web.py" | head -3
timeout 15 ls "$S/genlayer/eq_principle/"
timeout 15 grep -rn "strict_eq\|prompt_comparing" "$S/genlayer/eq_principle/"*.py 2>/dev/null | grep -v ".pyc" | head -5
echo "=== 5. Contract base class pattern ==="
timeout 15 ls "$S/genlayer/contract/"
timeout 15 grep -rn "class Contract" "$S/genlayer/contract/"*.py | head -3
echo "=== 6. gltest-direct cache: which std extraction exists for legacy pin ==="
timeout 10 ls /home/unexpected/.cache/gltest-direct/extracted/local/py-lib-genlayer-std/ 2>/dev/null
timeout 10 ls /home/unexpected/.cache/gltest-direct/extracted/local/py-genlayer/ 2>/dev/null
echo "=== 7. is legacy pin resolvable from RC bundle (linter says)? ==="
timeout 120 .venv/bin/python 2>&1 <<'EOF' | tail -8
from genvm_linter.validate.artifacts import resolve_artifact_source, _find_runner_archive_path
tarball = resolve_artifact_source()
p = _find_runner_archive_path(tarball, "py-genlayer", "1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6")
print("legacy pin resolves to in RC bundle:", p)
EOF
