"""Run the JS-side TreeView diff tests under node.

``update_tree`` / ``update_data`` reconcile the existing nodes against a
new dict-tree instead of rebuilding, which is what lets expansion state,
selection, cell colours and an open editor survive a refresh.  That logic
is pure -- it only touches plain objects and Maps -- so it can be
exercised in node without a DOM (see tests/treeview_diff.mjs).

Skipped when node isn't installed.
"""

import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent / "treeview_diff.mjs"


@pytest.mark.skipif(shutil.which("node") is None,
                    reason="node is not installed")
def test_treeview_diff():
    proc = subprocess.run(["node", str(SCRIPT)], capture_output=True,
                          text=True)
    assert proc.returncode == 0, (
        f"JS diff tests failed:\n{proc.stdout}\n{proc.stderr}")
    assert "ALL JS DIFF TESTS PASSED" in proc.stdout
