#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
timeout 240 .venv/bin/python 2>&1 <<'EOF' | tail -60
import traceback, os, sys
from pathlib import Path

def try_load(label, contract, env=None):
    print(f"===== {label} =====")
    old = dict(os.environ)
    if env:
        os.environ.update(env)
    try:
        import numpy  # noqa
        from genvm_linter.validate.sdk_loader import load_sdk, parse_contract_header
        deps = parse_contract_header(Path(contract))
        print("deps:", deps)
        get_schema, notes = load_sdk(Path(contract))
        print("SDK loaded OK; notes:", notes)
        mod_cls = None
        from genvm_linter.validate.sdk_loader import load_contract_module, find_contract_class
        m = load_contract_module(Path(contract))
        cls = find_contract_class(m)
        print("contract class:", cls)
        if cls:
            schema = get_schema(cls)
            import json
            print("SCHEMA HEAD:", json.dumps(schema)[:300])
    except BaseException as e:
        traceback.print_exc()
    finally:
        os.environ.clear(); os.environ.update(old)

CONTRACT = "contracts/AgentzProofVerifier.py"
NEWPIN = "/tmp/abtest/AgentzProofVerifier_newpin.py"
try_load("A: legacy pin, default env", CONTRACT)
try_load("B: legacy pin, GENVM_SOURCE_MODE=release", CONTRACT, {"GENVM_SOURCE_MODE": "release"})
EOF
