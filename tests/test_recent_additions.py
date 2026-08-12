"""
Regression-pin tests for widget / callback / CSS additions since
the last test sweep.

These tests target *specific* defs entries and stylesheet rules
rather than the structural invariants exercised by
``test_defs.py`` / ``test_consistency.py``.  Their job is to fail
loudly the moment a recent addition is silently removed by a
refactor.
"""

from pgwidgets_js import get_static_path
from pgwidgets_js.defs import WIDGETS, WIDGET_METHODS


# ----- Widget base / Label / Box methods ----------------------

def test_widget_base_has_set_bg():
    """``Widget.set_bg(color)`` was added so any widget can have a
    background colour set without per-class API."""
    assert "set_bg" in WIDGET_METHODS, (
        "WIDGET_METHODS.set_bg missing -- removed by accident?")
    assert WIDGET_METHODS["set_bg"] == ["color"], (
        f"set_bg params changed: {WIDGET_METHODS['set_bg']}")


def test_label_has_set_valign():
    """``Label.set_valign(align)`` -- vertical text placement."""
    methods = WIDGETS["Label"]["methods"]
    assert "set_valign" in methods, (
        "Label.set_valign missing from defs.py")
    assert methods["set_valign"] == ["align"]


def test_box_has_set_align():
    """``Box.set_align(align)`` -- cross-axis alignment of
    children, orientation-aware.  Should be on Box, HBox, and
    VBox."""
    for name in ("Box", "HBox", "VBox"):
        methods = WIDGETS[name]["methods"]
        assert "set_align" in methods, (
            f"{name}.set_align missing from defs.py")
        assert methods["set_align"] == ["align"], (
            f"{name}.set_align params changed: {methods['set_align']}")


# ----- TreeView / TableView colour overrides + bold ----------

def test_treeview_color_methods_accept_bold():
    """``set_cell_color`` / ``set_row_color`` / ``set_column_color`` /
    ``set_table_color`` on TreeView and TableView all gained a
    ``bold`` parameter."""
    for view in ("TreeView", "TableView"):
        methods = WIDGETS[view]["methods"]
        assert methods["set_cell_color"] == \
            ["path", "col_key", "fg", "bg", "bold"], (
                f"{view}.set_cell_color params: "
                f"{methods['set_cell_color']}")
        assert methods["set_row_color"] == \
            ["path", "fg", "bg", "bold"]
        assert methods["set_column_color"] == \
            ["col_key", "fg", "bg", "bold"]
        assert methods["set_table_color"] == \
            ["fg", "bg", "bold"]


# ----- New callbacks ------------------------------------------

def test_treeview_tableview_have_cell_action():
    """``cell_action(table, row_dict, col_key)`` fires when the
    user clicks a button-shaped widget cell.  Available on both
    TreeView and TableView (the cell hosts a real DOM input)."""
    for view in ("TreeView", "TableView"):
        cbs = WIDGETS[view]["callbacks"]
        assert "cell_action" in cbs, (
            f"{view} callbacks list is missing 'cell_action': {cbs}")


def test_treeview_tableview_have_cell_selected():
    """``cell_selected`` -- cell-mode selection callback added with
    ``selection_mode='single-cell'`` / ``'multiple-cell'``."""
    for view in ("TreeView", "TableView"):
        cbs = WIDGETS[view]["callbacks"]
        assert "cell_selected" in cbs, (
            f"{view} callbacks list is missing 'cell_selected': {cbs}")


# ----- Custom font support ------------------------------------

def test_widget_css_consumes_pg_default_font_variables():
    """``Widget.css`` defines a ``body`` rule that consumes the
    ``--pg-default-font-*`` CSS variables.  Without this rule the
    Application.set_default_font API would be a no-op."""
    css_path = get_static_path() / "css" / "Widget.css"
    text = css_path.read_text(encoding="utf-8")
    for var_name in (
            "--pg-default-font-family",
            "--pg-default-font-size",
            "--pg-default-font-weight",
            "--pg-default-font-style"):
        assert var_name in text, (
            f"Widget.css does not reference {var_name!r} -- the "
            "set_default_font CSS variables won't apply")
    # And there should be a ``body`` selector somewhere consuming
    # them, not just a comment mentioning the name.
    assert "body {" in text or "body{" in text, (
        "Widget.css has the variable names but no body rule "
        "consuming them")


# ----- MenuAction icon support --------------------------------

def test_menuaction_supports_icons_and_icon_only():
    """``MenuAction`` supports an icon (``icon_url``/``iconsize``) as well
    as text, plus an ``icon_only`` option that shows just the icon where
    available and falls back to the text label otherwise."""
    options = WIDGETS["MenuAction"]["options"]
    for opt in ("icon_url", "iconsize", "icon_only"):
        assert opt in options, (
            f"MenuAction.{opt} missing from defs.py options: {options}")
    # the JS module must actually read icon_only and (robustly) create the
    # icon only for a truthy URL (matching ToolBarAction)
    js = (get_static_path() / "modules" / "MenuAction.js").read_text(
        encoding="utf-8")
    assert "icon_only" in js, "MenuAction.js does not reference icon_only"
    assert "if (icon_url)" in js, (
        "MenuAction.js should guard icon creation with a truthy check "
        "(if (icon_url)) to avoid a broken <img> for undefined/'' URLs")


def test_menubar_add_menu_supports_icons():
    """``MenuBar.add_menu`` gained an ``options`` parameter so top-level
    menubar entries can carry an icon (icon_url/iconsize/icon_only), to match
    leaf MenuAction items and the qt/gtk backends."""
    params = WIDGETS["MenuBar"]["methods"]["add_menu"]
    assert params == ["menu", "name", "options"], (
        f"MenuBar.add_menu params changed: {params}")
    js = (get_static_path() / "modules" / "MenuBar.js").read_text(
        encoding="utf-8")
    for token in ("icon_url", "iconsize", "icon_only"):
        assert token in js, f"MenuBar.js does not reference {token}"
    assert "if (icon_url)" in js, (
        "MenuBar.js should guard icon creation with a truthy check")


# ----- TreeView editable-cell discoverability -----------------

def test_treeview_and_tableview_accept_cell_cursor():
    """``cell_cursor`` is a constructor option on both views.

    The spreadsheet-style current-cell cursor (arrow/Tab navigation,
    type-to-edit on editable columns) used to be hard-wired on for
    TableView and off for TreeView.  It is now an option, so a tree
    carrying editable columns can offer keyboard editing instead of
    dblclick being the only way in.  The option must be listed in
    defs.py or the Python wrappers silently drop the kwarg.
    """
    for name in ("TreeView", "TableView"):
        options = WIDGETS[name]["options"]
        assert "cell_cursor" in options, (
            f"{name}.cell_cursor missing from defs.py options: {options}")

    js = (get_static_path() / "modules" / "TreeView.js").read_text(
        encoding="utf-8")
    assert "get_option(options, 'cell_cursor', false)" in js, (
        "TreeView.js must read cell_cursor from its options "
        "(defaulting off) rather than hard-coding it")

    js = (get_static_path() / "modules" / "TableView.js").read_text(
        encoding="utf-8")
    assert "get_option(options, 'cell_cursor', true)" in js, (
        "TableView.js must keep defaulting cell_cursor on")


def test_editable_cells_are_visually_marked():
    """Editable cells need an affordance beyond ``cursor: text``.

    Without a visible cue there is nothing to distinguish an editable
    column from a read-only one until the user happens to double-click
    it.  The rule is painted with a background image (not a border) so
    it adds no layout box and cannot shift row heights.
    """
    css = (get_static_path() / "css" / "TreeView.css").read_text(
        encoding="utf-8")
    idx = css.find(".treeview-cell-editable {")
    assert idx >= 0, "TreeView.css lost the .treeview-cell-editable rule"
    rule = css[idx:css.find("}", idx)]
    assert "cursor: text" in rule
    assert "background-image" in rule, (
        "editable cells should carry a visible underline, not just an "
        "I-beam cursor")
    assert "border" not in rule, (
        "use a background image for the underline -- a border changes "
        "the cell's box and shifts row heights")
    assert ".treeview-cell-editable:not(.treeview-cell-selected):hover" in css, (
        "the editable hover tint must not override the selection "
        "highlight")


# ----- incremental tree / table updates ----------------------------

def test_update_data_is_defined():
    """``update_data`` is the flat-table counterpart of ``update_tree``;
    ``update_rows`` is its TableView alias, mirroring set_rows/set_data.
    Both must be in defs.py or the Python wrappers can't call them."""
    assert WIDGETS["TreeView"]["methods"].get("update_data") == ["data"]
    assert WIDGETS["TableView"]["methods"].get("update_data") == ["data"]
    assert WIDGETS["TableView"]["methods"].get("update_rows") == ["rows"]

    js = (get_static_path() / "modules" / "TableView.js").read_text(
        encoding="utf-8")
    assert "update_rows(rows)" in js, (
        "TableView.js should alias update_rows -> update_data")


def test_update_tree_diffs_instead_of_rebuilding():
    """``update_tree`` used to be set_tree + selection restore, which
    rebuilt every row and so dropped expansion state, cell styles and
    any open editor.  It must now reconcile against the existing nodes.
    """
    js = (get_static_path() / "modules" / "TreeView.js").read_text(
        encoding="utf-8")
    start = js.index("    update_tree(tree) {")
    body = js[start:js.index("\n    }", start)]
    assert "_diffApply" in body, (
        "update_tree should reconcile via _diffApply")
    # set_tree is only the empty-widget shortcut, not the main path
    assert body.count("this.set_tree(") == 1

    for helper in ("_diffApply(parent, spec, path)", "_mergeValues(node,",
                   "_dropStylesUnder(path)"):
        assert helper in js, f"TreeView.js is missing {helper}"


def test_node_classification_is_shared():
    """The diff must classify leaf vs interior exactly as the bulk
    loader does, so the two can't drift apart."""
    js = (get_static_path() / "modules" / "TreeView.js").read_text(
        encoding="utf-8")
    assert "_splitNodeData(data) {" in js
    # both the loader and the diff go through it
    assert js.count("this._splitNodeData(") >= 2


def test_removed_nodes_drop_their_colour_overrides():
    """Style maps are keyed by path; leaving entries behind for a
    removed node would leak them onto a later node reusing that key."""
    js = (get_static_path() / "modules" / "TreeView.js").read_text(
        encoding="utf-8")
    start = js.index("    _diffApply(parent, spec, path) {")
    body = js[start:js.index("\n    }", start)]
    assert "_dropStylesUnder" in body
    assert "_dropFromSelection" in body


def test_set_colors_batch_exists():
    """Batched colour application: one call, one re-render.  Needed
    because each single set_*_color re-renders the whole view (and, over
    the websocket driver, costs a round-trip)."""
    for name in ("TreeView", "TableView"):
        methods = WIDGETS[name]["methods"]
        assert methods.get("set_colors") == ["spec"], (
            f"{name}.set_colors missing from defs.py")

    js = (get_static_path() / "modules" / "TreeView.js").read_text(
        encoding="utf-8")
    start = js.index("    set_colors(spec) {")
    body = js[start:js.index("\n    }", start)]
    assert body.count("this._renderAll()") == 1, (
        "set_colors must render once for the whole batch")
    for helper in ("_setCellStyle", "_setRowStyle", "_setColumnStyle"):
        assert helper in body, f"set_colors should go through {helper}"
        # the single-call setters must share those helpers, so batched
        # and single application can't diverge
        assert js.count(f"this.{helper}(") >= 2
