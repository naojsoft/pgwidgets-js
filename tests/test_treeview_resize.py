"""Run the JS-side TreeView column-resize tests under node.

Dragging a header divider resizes the column to its left and nothing
else, the way a qt ``QHeaderView`` does in its default Interactive mode:
the columns after it keep their widths and slide along, and the table
grows past the viewport into the horizontal scrollbar.  It used to work
like a splitter, taking every gained pixel out of the next column, so
widening a column ate its neighbour down to the 5px floor before
anything to the right would move.

The drag handler only reads the header cells' rendered widths and writes
``_colWidths``, so it runs in node with a stub header and a small
document shim (see tests/treeview_resize.mjs).

Skipped when node isn't installed.
"""

import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent / "treeview_resize.mjs"


@pytest.mark.skipif(shutil.which("node") is None,
                    reason="node is not installed")
def test_treeview_resize():
    proc = subprocess.run(["node", str(SCRIPT)], capture_output=True,
                          text=True)
    assert proc.returncode == 0, (
        f"JS resize tests failed:\n{proc.stdout}\n{proc.stderr}")
    assert "ALL JS RESIZE TESTS PASSED" in proc.stdout
