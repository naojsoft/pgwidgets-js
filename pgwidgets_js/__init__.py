"""
pgwidgets_js — pip-installable distribution of the pgwidgets JavaScript
widget library.  Provides a helper to locate the static JS/CSS assets
so that Python server code can serve them to a browser.

Usage:
    from pgwidgets_js import get_static_path
    static = get_static_path()  # Path to directory with Widgets.js, etc.
"""

from pathlib import Path

_PKG_DIR = Path(__file__).resolve().parent
_STATIC_PATH = _PKG_DIR / "static"


def get_static_path():
    """Return the Path to the directory containing Widgets.js, Widgets.css,
    modules/, css/, and icons/."""
    return _STATIC_PATH


def get_remote_html():
    """Return the Path to the minimal remote.html connector page."""
    return _PKG_DIR / "static" / "remote.html"
