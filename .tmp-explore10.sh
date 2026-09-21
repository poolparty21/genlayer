#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
echo "=== 1. genvm-lint CLI surface ==="
timeout 30 .venv/bin/genvm-lint --help 2>&1 | head -40
echo ""
echo "=== 2. what does the linter consider the LATEST py-genlayer? (official resolution) ==="
timeout 120 .venv/bin/python - <<'EOF'
import sys
from pathlib import Path
sys.path.insert(0, str(Path(".venv/lib/python3.12/site-packages")))
from genvm_linter.validate.artifacts import (
    resolve_artifact_source, find_latest_runner, parse_runner_manifest,
)
tarball = resolve_artifact_source()
print("bundle:", tarball)
latest = find_latest_runner(tarball, "py-genlayer")
print("latest py-genlayer:", latest)
all_g = find_latest_runner(tarball, "py-genlayer", list_all=True) if 'list_all' in find_latest_runner.__code__.co_varnames else None
import inspect
print("find_latest_runner signature:", inspect.signature(find_latest_runner))
EOF
echo ""
echo "=== 3. does gltest direct ever run a real VM binary? ==="
timeout 30 grep -rn "wasmtime\|wasm\|subprocess\|Popen\|genvm" .venv/lib/python3.12/site-packages/gltest/ 2>/dev/null | grep -v ".pyc" | grep -iv "wasimock\|_genlayer_wasi" | head -15
echo ""
echo "=== 4. real genvm binary present on system? ==="
timeout 10 bash -lc "which genvm genvm-runner genvm-manager 2>/dev/null; ls ~/.local/bin 2>/dev/null | grep -i genvm | head -5"
echo "done"
