"""
Tests for static asset packaging.

Verifies that get_static_path() and get_remote_html() return valid
paths to the expected files, and that the static directory contains
the core assets.
"""

from pgwidgets_js import get_static_path, get_remote_html


def test_static_path_exists():
    """get_static_path() should return an existing directory."""
    p = get_static_path()
    assert p.is_dir(), f"static path does not exist: {p}"


def test_static_path_contains_widgets_js():
    """The static directory must contain Widgets.js."""
    p = get_static_path()
    assert (p / "Widgets.js").is_file()


def test_static_path_contains_widgets_css():
    """The static directory must contain Widgets.css."""
    p = get_static_path()
    assert (p / "Widgets.css").is_file()


def test_static_path_contains_modules_dir():
    """The static directory must contain a modules/ subdirectory."""
    p = get_static_path()
    assert (p / "modules").is_dir()


def test_static_path_contains_css_dir():
    """The static directory must contain a css/ subdirectory."""
    p = get_static_path()
    assert (p / "css").is_dir()


def test_static_path_contains_icons_dir():
    """The static directory must contain an icons/ subdirectory."""
    p = get_static_path()
    assert (p / "icons").is_dir()


def test_remote_html_exists():
    """get_remote_html() should return an existing file."""
    p = get_remote_html()
    assert p.is_file(), f"remote.html does not exist: {p}"


def test_remote_html_is_html():
    """remote.html should contain HTML content."""
    p = get_remote_html()
    text = p.read_text()
    assert "<html" in text.lower() or "<!doctype" in text.lower()
