#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
echo "=== 1. single direct test (verifier_pass), 120s cap ==="
timeout 120 .venv/bin/python -m pytest tests/direct/test_verifier_pass.py -x -q --timeout=90 2>&1 | tail -25
echo "EXIT: $?"
