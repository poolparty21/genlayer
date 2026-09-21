#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
echo "=== 1. latest py-genlayer per RC linter (stderr visible) ==="
timeout 90 .venv/bin/python 2>&1 <<'EOF' | tail -15
from genvm_linter.validate.artifacts import resolve_artifact_source, find_latest_runner
tarball = resolve_artifact_source()
print("bundle:", tarball)
latest = find_latest_runner(tarball, "py-genlayer")
print("latest py-genlayer:", latest)
EOF
echo "=== 2. repo test infra ==="
timeout 15 ls tests tests/direct tests/integration 2>/dev/null
timeout 15 ls *.toml *.ini *.cfg docker-compose* Makefile 2>/dev/null
echo "=== 3. integration conftest / node launcher ==="
timeout 15 find . -maxdepth 2 -name "conftest.py" -not -path "./.venv/*" 2>/dev/null
timeout 15 grep -n "ledger\|docker\|image\|node_url\|LOCALNET\|localnet" tests/integration/conftest.py 2>/dev/null | head -20
echo "=== 4. gltest runner modes ==="
timeout 15 ls .venv/lib/python3.12/site-packages/gltest/
timeout 15 ls .venv/lib/python3.12/site-packages/gltest/direct/ 2>/dev/null
