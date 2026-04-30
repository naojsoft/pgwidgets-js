"""
pgwidgets_js — pip-installable distribution of the pgwidgets JavaScript
widget library.  Provides a helper to locate the static JS/CSS assets
so that Python server code can serve them to a browser.

Usage:
    from pgwidgets_js import get_static_path
    static = get_static_path()  # Path to directory with Widgets.js, etc.

Version:
    import pgwidgets_js
    print(pgwidgets_js.__version__)
"""

from pathlib import Path
from importlib.metadata import version as _pkg_version, PackageNotFoundError

try:
    __version__ = _pkg_version("pgwidgets_js")
except PackageNotFoundError:
    # Package not installed (e.g. running from a source checkout
    # without `pip install -e .`).  Fall back to a sentinel.
    __version__ = "0.0.0+unknown"

_PKG_DIR = Path(__file__).resolve().parent
_STATIC_PATH = _PKG_DIR / "static"


def get_static_path():
    """Return the Path to the directory containing Widgets.js, Widgets.css,
    modules/, css/, and icons/."""
    return _STATIC_PATH


def get_remote_html():
    """Return the Path to the minimal remote.html connector page."""
    return _PKG_DIR / "static" / "remote.html"
