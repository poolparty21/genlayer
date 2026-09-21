#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
echo "=== 1. artifacts.py 280-470 (index resolution logic) ==="
timeout 15 sed -n 280,470p .venv/lib/python3.12/site-packages/genvm_linter/validate/artifacts.py
