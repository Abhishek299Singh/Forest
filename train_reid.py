#!/usr/bin/env python
"""
Workspace root wrapper for training the Tiger Re-ID model on the Amur Tiger dataset.

Usage:
    python train_reid.py --dataset-dir <path_to_amur_tiger_dataset> [--epochs 10] [--batch-size 16]
"""
import sys
import subprocess
from pathlib import Path

def main():
    root_dir = Path(__file__).resolve().parent
    backend_dir = root_dir / "backend"
    
    # Locate virtualenv python
    venv_python = root_dir / "venv" / "Scripts" / "python.exe"
    if not venv_python.exists():
        venv_python = root_dir / "venv" / "bin" / "python"
    if not venv_python.exists():
        venv_python = Path(sys.executable)

    script_path = backend_dir / "app" / "ml" / "train_reid.py"

    cmd = [str(venv_python), str(script_path)] + sys.argv[1:]
    res = subprocess.run(cmd, cwd=str(backend_dir))
    sys.exit(res.returncode)

if __name__ == "__main__":
    main()
