#!/usr/bin/env python3
"""
Root entry point for dataset removal tool.
Delegates to backend/remove_dataset.py.
"""
import sys
import subprocess
from pathlib import Path

root_dir = Path(__file__).resolve().parent
backend_script = root_dir / "backend" / "remove_dataset.py"

if not backend_script.exists():
    print(f"Error: Could not find {backend_script}")
    sys.exit(1)

cmd = [sys.executable, str(backend_script)] + sys.argv[1:]
sys.exit(subprocess.call(cmd))
