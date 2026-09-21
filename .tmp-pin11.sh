#!/usr/bin/env bash
set -u
cd /mnt/e/www/genlayer
S=.tmp-rc/newstd
timeout 60 .venv/bin/python - <<'EOF'
import sys
sys.path.insert(0, ".tmp-rc/newstd")
import os
os.environ["GENERATING_DOCS"] = "true"  # eager submodule import like IDE/docs mode
try:
    import _genlayer_wasi
except ImportError:
    from unittest.mock import MagicMock
    sys.modules["_genlayer_wasi"] = MagicMock()

import genlayer as gl
print("== genlayer.types exports (TreeMap/DynArray there?) ==")
import genlayer.types as t
for n in ["TreeMap", "DynArray", "Address", "u256", "SizedArray"]:
    print(f"  types.{n}:", "YES" if hasattr(t, n) else "MISSING")
print("== gl.* top-level ==")
for n in ["TreeMap", "DynArray", "storage", "types"]:
    print(f"  gl.{n}:", "YES" if hasattr(gl, n) else "MISSING")
print("== genlayer.storage exports (allow decorator public name) ==")
import genlayer.storage as st
print("  storage.__all__:", getattr(st, "__all__", "(none)"))
for n in ["allow", "TreeMap", "DynArray"]:
    print(f"  storage.{n}:", "YES" if hasattr(st, n) else "MISSING")
print("== genlayer.vm ==")
import genlayer.vm as vm
for n in ["Return", "UserError", "run_nondet_unsafe"]:
    print(f"  vm.{n}:", "YES" if hasattr(vm, n) else "MISSING")
print("== genlayer.nondet ==")
import genlayer.nondet as nd
print("  nondet.__all__:", getattr(nd, "__all__", "(none)"))
import genlayer.nondet.web as w
print("  nondet.web.render:", "YES" if hasattr(w, "render") else "MISSING")
print("== genlayer.eq_principle ==")
import genlayer.eq_principle as eq
print("  eq.__all__:", getattr(eq, "__all__", "(none)"))
print("== gl.public / gl.private / gl.message / gl.contract ==")
print("  gl.public:", "YES" if hasattr(gl, "public") else "MISSING")
import genlayer.message as msg
print("  message attrs:", [a for a in dir(msg) if not a.startswith("_")][:12])
print("== contract base ==")
import genlayer.contract as c
print("  contract.Contract:", "YES" if hasattr(c, "Contract") else "MISSING")
print("== calldata.eq_principle variants ==")
import genlayer.eq_principle as eq2
print("  dir:", [a for a in dir(eq2) if not a.startswith("_")])
EOF
