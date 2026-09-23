"""Run the JS-side TreeView selection tests under node.

``select_path`` / ``select_paths`` / ``select_all`` default ``state`` to
true, matching ``select_cell``/``select_cells`` and the Python API (whose
callers write ``select_path(path)`` to select a row).  The bridge forwards
only the arguments it was given, so without those defaults the JS side
receives ``undefined`` and the call silently does nothing -- or, for
``select_all()``, clears the selection instead of filling it.

The selection setters only touch ``_selection`` and the node tree, so they
can be exercised in node without a DOM (see tests/treeview_select.mjs).

Skipped when node isn't installed.
"""

import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent / "treeview_select.mjs"


@pytest.mark.skipif(shutil.which("node") is None,
                    reason="node is not installed")
def test_treeview_select():
    proc = subprocess.run(["node", str(SCRIPT)], capture_output=True,
                          text=True)
    assert proc.returncode == 0, (
        f"JS select tests failed:\n{proc.stdout}\n{proc.stderr}")
    assert "ALL JS SELECT TESTS PASSED" in proc.stdout
