"""
Tests for consistency between defs.py and the actual JS/CSS files.

Ensures that every widget defined in Python has a corresponding JS
module, and vice versa, and that CSS imports are in sync.
"""

import re

from pgwidgets_js import get_static_path
from pgwidgets_js.defs import WIDGETS


# JS modules that exist in modules/ but are not user-facing widgets
# defined in defs.py (base classes, infrastructure, etc.)
JS_INFRASTRUCTURE = {
    "Callback",
    "Widget",       # base Widget + ContainerWidget
    "Box",          # exports VBox, HBox, ButtonBox
    "TextWidget",   # internal base for text widgets
    "RemoteInterface",
    "ComboBoxNative",
}

# Widgets in defs.py whose JS is provided by a shared module file
# rather than a file matching their name
SHARED_JS_MODULE = {
    "VBox": "Box",
    "HBox": "Box",
    "ButtonBox": "Box",
    "StackWidget": "TabWidget",
    "MDISubWindow": "MDIWidget",
}


def _js_module_names():
    """Return the set of JS class names found in static/modules/."""
    modules_dir = get_static_path() / "modules"
    names = set()
    for f in modules_dir.glob("*.js"):
        # Skip backup files
        if f.name.endswith("~"):
            continue
        names.add(f.stem)
    return names


def test_every_widget_has_js_module():
    """Every widget in defs.py should have a corresponding JS module
    file (directly or via a shared module)."""
    js_names = _js_module_names()
    for name in WIDGETS:
        expected = SHARED_JS_MODULE.get(name, name)
        assert expected in js_names, (
            f"Widget {name!r} defined in defs.py but no "
            f"modules/{expected}.js found")


def test_every_js_module_has_definition():
    """Every JS module file (except infrastructure) should have a
    corresponding entry in defs.py or be in the known infrastructure
    set."""
    js_names = _js_module_names()
    # Widgets that come from shared modules
    shared_targets = set(SHARED_JS_MODULE.values())
    for js_name in js_names:
        if js_name in JS_INFRASTRUCTURE:
            continue
        if js_name in shared_targets:
            continue
        assert js_name in WIDGETS, (
            f"modules/{js_name}.js exists but {js_name!r} is not "
            f"defined in defs.py")


def _css_file_names():
    """Return the set of CSS file stems found in static/css/."""
    css_dir = get_static_path() / "css"
    names = set()
    for f in css_dir.glob("*.css"):
        if f.name.endswith("~"):
            continue
        names.add(f.stem)
    return names


def _widgets_css_imports():
    """Return the set of CSS file stems imported in Widgets.css."""
    css_file = get_static_path() / "Widgets.css"
    text = css_file.read_text()
    # Match @import "css/Foo.css" patterns
    return set(re.findall(r'@import\s+"css/(\w+)\.css"', text))


def test_all_css_files_imported_in_widgets_css():
    """Every .css file in css/ should be imported by Widgets.css."""
    css_names = _css_file_names()
    imported = _widgets_css_imports()
    for name in css_names:
        assert name in imported, (
            f"css/{name}.css exists but is not imported in Widgets.css")


def test_widgets_css_imports_exist():
    """Every CSS import in Widgets.css should point to an existing file."""
    imported = _widgets_css_imports()
    css_names = _css_file_names()
    for name in imported:
        assert name in css_names, (
            f"Widgets.css imports css/{name}.css but the file "
            f"does not exist")


def _widgets_js_imports():
    """Return the set of module names imported in Widgets.js."""
    js_file = get_static_path() / "Widgets.js"
    text = js_file.read_text()
    # Match import {Foo} from "./modules/Bar.js" patterns
    return set(re.findall(
        r'from\s+"./modules/(\w+)\.js"', text))


def test_all_js_modules_imported_in_widgets_js():
    """Every .js module file should be imported by Widgets.js."""
    js_names = _js_module_names()
    imported = _widgets_js_imports()
    for name in js_names:
        if name.endswith("~"):
            continue
        assert name in imported, (
            f"modules/{name}.js exists but is not imported "
            f"in Widgets.js")


def test_widgets_js_imports_exist():
    """Every JS import in Widgets.js should point to an existing module."""
    imported = _widgets_js_imports()
    js_names = _js_module_names()
    for name in imported:
        assert name in js_names, (
            f"Widgets.js imports modules/{name}.js but the file "
            f"does not exist")
