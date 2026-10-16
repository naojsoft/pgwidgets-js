"""Run the JS-side TreeView sort-gate tests under node.

A column can opt out of the header-click sort with ``sortable: false``.
The gate (``_columnIsSortable``) and the sort itself are pure -- they
only touch plain objects and Maps -- so they can be exercised in node
without a DOM (see tests/treeview_sort.mjs).

Skipped when node isn't installed.
"""

import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent / "treeview_sort.mjs"


@pytest.mark.skipif(shutil.which("node") is None,
                    reason="node is not installed")
def test_treeview_sort():
    proc = subprocess.run(["node", str(SCRIPT)], capture_output=True,
                          text=True)
    assert proc.returncode == 0, (
        f"JS sort tests failed:\n{proc.stdout}\n{proc.stderr}")
    assert "ALL JS SORT TESTS PASSED" in proc.stdout
