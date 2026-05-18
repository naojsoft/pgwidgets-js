"""
Widget class definitions used to generate Python wrapper classes.

Each entry maps a JS class name to its constructor signature and
public methods.  The 'args' list gives positional constructor args;
'options' lists keyword args that go into the options object.
'methods' maps method names to their parameter names (excluding self/widget).
'callbacks' lists the widget-specific callback actions. In addition,
every widget supports a base 'resize' callback, fired as
(widget, width_px, height_px) whenever its size changes.

This is the canonical source for widget definitions. Language-specific
wrappers (pgwidgets-python, pyodide, etc.) import from here.
"""

# Common methods inherited from Callback base class (non-visual objects)
CALLBACK_METHODS = {
    "destroy": [],
}

# Common methods inherited from Widget base class
WIDGET_METHODS = {
    "get_element": [],
    "set_border_width": ["width"],
    "set_border_color": ["color"],
    "set_min_size": ["width", "height"],
    "set_max_size": ["width", "height"],
    "set_expanding": ["horizontal", "vertical"],
    "get_expanding": [],
    "resize": ["width", "height"],
    "get_size": [],
    "get_position": [],
    "set_padding": ["padding"],
    "set_font": ["font", "size", "weight", "style"],
    "set_enabled": ["tf"],
    "get_enabled": [],
    "set_tooltip": ["msg"],
    "get_tooltip": [],
    "set_allow_text_selection": ["tf"],
    "show": [],
    "hide": [],
    "is_visible": [],
    "set_focus": [],
    "add_cursor": ["name", "url", "hotspot_x", "hotspot_y", "size"],
    "set_cursor": ["name"],
    "destroy": [],
}

# Common methods from ContainerWidget
CONTAINER_METHODS = {
    **WIDGET_METHODS,
    "get_children": [],
    "num_children": [],
    "remove": ["child", "destroy"],
    "remove_widget": ["child", "destroy"],
    "remove_all": ["destroy"],
}

# Common callbacks for all containers
CONTAINER_CALLBACKS = ["child-added", "child-removed"]

# ---- Widget Definitions ----

WIDGETS = {

    # -- Layout containers --

    "Box": {
        "base": "container",
        "args": [],
        "options": ["orientation"],
        "methods": {
            "add_widget": ["child", "stretch"],
            "insert_widget": ["index", "child", "stretch"],
            "set_spacing": ["gap"],
        },
        "callbacks": [*CONTAINER_CALLBACKS],
    },

    "VBox": {
        "base": "container",
        "args": [],
        "options": [],
        "methods": {
            "add_widget": ["child", "stretch"],
            "insert_widget": ["index", "child", "stretch"],
            "set_spacing": ["gap"],
        },
        "callbacks": [*CONTAINER_CALLBACKS],
    },

    "HBox": {
        "base": "container",
        "args": [],
        "options": [],
        "methods": {
            "add_widget": ["child", "stretch"],
            "insert_widget": ["index", "child", "stretch"],
            "set_spacing": ["gap"],
        },
        "callbacks": [*CONTAINER_CALLBACKS],
    },

    "ButtonBox": {
        "base": "container",
        "args": [],
        "options": ["orientation", "halign"],
        "methods": {
            "add_widget": ["child", "stretch"],
            "insert_widget": ["index", "child", "stretch"],
            "set_spacing": ["gap"],
            "set_halign": ["halign"],
        },
        "callbacks": [*CONTAINER_CALLBACKS],
    },

    "FixedLayout": {
        "base": "container",
        "args": [],
        "options": [],
        "methods": {
            "add_widget": ["child", "x", "y"],
        },
        "callbacks": [*CONTAINER_CALLBACKS],
    },

    "GridBox": {
        "base": "container",
        "args": [],
        "options": ["rows", "columns"],
        "methods": {
            "add_widget": ["child", "row", "col"],
            "set_row_spacing": ["px"],
            "set_column_spacing": ["px"],
            "set_spacing": ["px"],
            "get_row_column_count": [],
            "get_widget_at_cell": ["row", "col"],
            "insert_row": ["index", "widgets"],
            "append_row": ["widgets"],
            "delete_row": ["index"],
            "insert_column": ["index", "widgets"],
            "append_column": ["widgets"],
            "delete_column": ["index"],
        },
        "callbacks": [*CONTAINER_CALLBACKS],
    },

    "Splitter": {
        "base": "container",
        "args": [],
        "options": ["orientation"],
        "methods": {
            "add_widget": ["child"],
            "set_sizes": ["sizes"],
            "get_sizes": [],
            "set_minimum_size": ["child", "min_px"],
        },
        "callbacks": [*CONTAINER_CALLBACKS, "sizing"],
    },

    "Frame": {
        "base": "widget",
        "args": [],
        "options": ["title"],
        "methods": {
            "set_widget": ["child"],
            "set_title": ["text"],
            "set_text": ["text"],
            "get_text": [],
        },
        "callbacks": [],
    },

    "Expander": {
        "base": "widget",
        "args": [],
        "options": ["title", "collapsible", "shadow", "bg_color"],
        "methods": {
            "set_widget": ["child"],
            "set_collapsed": ["collapsed"],
            "get_collapsed": [],
            "toggleContent": [],
        },
        "callbacks": ["toggled"],
    },

    "AbstractScrollArea": {
        "base": "widget",
        "args": [],
        "options": ["thickness"],
        "methods": {
            "set_widget": ["child"],
            "set_thumb_percent": ["h_pct", "v_pct"],
            "get_thumb_percent": [],
            "set_scroll_percent": ["h_pct", "v_pct"],
            "get_scroll_percent": [],
            "set_scroll_bar_visibility": ["horizontal", "vertical"],
        },
        "callbacks": ["scrolled", "area-resize"],
    },

    "ScrollArea": {
        "base": "widget",
        "args": [],
        "options": ["hscrollbar", "vscrollbar", "thickness"],
        "methods": {
            "set_widget": ["child"],
            "set_thumb_percent": ["h_pct", "v_pct"],
            "get_thumb_percent": [],
            "set_scroll_percent": ["h_pct", "v_pct"],
            "get_scroll_percent": [],
            "set_scroll_bar_visibility": ["horizontal", "vertical"],
            "set_scroll_position": ["h_pct", "v_pct"],
            "get_scroll_position": [],
        },
        "callbacks": ["scrolled", "area-resize"],
    },

    "TabWidget": {
        "base": "container",
        "args": [],
        "options": ["closable", "reorderable", "tab_position"],
        "methods": {
            "add_widget": ["child", "options"],
            "show_widget": ["child"],
            "close_widget": ["child"],
            "set_index": ["index"],
            "get_index": [],
            "get_tab_id": ["child"],
            "get_child": ["tab_id"],
            "index_of": ["child"],
            "index_to_widget": ["index"],
            "highlight_tab": ["child", "bgcolor"],
            "set_tab_position": ["tabpos"],
        },
        "callbacks": [*CONTAINER_CALLBACKS, "page-switch", "page-close"],
    },

    "StackWidget": {
        "base": "container",
        "args": [],
        "options": [],
        "methods": {
            "add_widget": ["child", "options"],
            "show_widget": ["child"],
            "set_index": ["index"],
            "get_index": [],
            "index_of": ["child"],
            "index_to_widget": ["index"],
        },
        "callbacks": [*CONTAINER_CALLBACKS, "page-switch", "page-close"],
    },

    "MDIWidget": {
        "base": "container",
        "args": [],
        "options": [],
        "methods": {
            "add_widget": ["child", "options"],
            "cascade_windows": [],
            "tile_windows": [],
            "get_subwindows": [],
            "get_subwin": ["child"],
            "get_configuration": ["child"],
            "move_child": ["child", "x", "y"],
            "resize_child": ["child", "width", "height"],
            "get_child_size": ["child"],
            "get_child_position": ["child"],
            "close_child": ["child"],
            "get_index": [],
            "set_index": ["index"],
            "index_of": ["child"],
            "index_to_widget": ["index"],
            "set_resistance": ["value"],
            "set_scroll_position": ["h_pct", "v_pct"],
            "get_scroll_position": [],
        },
        "callbacks": [*CONTAINER_CALLBACKS, "page-switch", "page-close", "scrolled"],
    },

    "MDISubWindow": {
        "base": "widget",
        "args": [],
        "options": ["shadeable"],
        "methods": {
            "set_position": ["x", "y"],
            "move": ["x", "y"],
            "resize": ["width", "height"],
            "set_title": ["title"],
            "raise_": [],
            "lower": [],
            "toggle_minimize": [],
            "toggle_maximize": [],
            "toggle_shade": [],
            "close": [],
            "get_child": [],
        },
        "callbacks": ["move", "resize"],
    },

    # -- Top-level windows --

    "TopLevel": {
        "base": "widget",
        "args": [],
        "options": ["resizable", "title", "icon", "moveable", "closeable",
                    "minimizable", "maximizable", "lowerable", "shadeable"],
        "methods": {
            "set_position": ["x", "y"],
            "set_widget": ["child"],
            "set_title": ["title"],
            "set_icon": ["url"],
            "set_moveable": ["tf"],
            "raise_": [],
            "lower": [],
            "toggle_minimize": [],
            "toggle_maximize": [],
            "toggle_shade": [],
            "set_window_state": ["state"],
            "get_window_state": [],
        },
        "callbacks": ["move", "close", "window-state"],
    },

    "Page": {
        "base": "widget",
        "args": [],
        "options": [],
        "methods": {
            "set_widget": ["child"],
        },
        "callbacks": [],
    },

    "Dialog": {
        "base": "container",
        "args": ["title", "buttons"],
        "options": ["autoclose", "resizable", "moveable", "modal"],
        "methods": {
            "add_widget": ["child", "stretch"],
            "insert_widget": ["index", "child", "stretch"],
            "add_button": ["child", "value"],
            "set_spacing": ["gap"],
            "set_position": ["x", "y"],
            "popup": ["x", "y"],
            "set_modal": ["tf"],
        },
        "callbacks": [*CONTAINER_CALLBACKS, "activated", "move", "close"],
    },

    "ColorWidget": {
        "base": "widget",
        "args": [],
        "options": ["color"],
        "methods": {
            "get_color": [],
            "set_color": ["hex_string"],
        },
        "callbacks": ["pick"],
    },

    "ColorDialog": {
        "base": "widget",
        "args": [],
        "options": ["color", "title", "modal", "moveable"],
        "methods": {
            "get_color": [],
            "set_color": ["hex_string"],
            # Inherited from Dialog on the JS side; redeclare so the
            # Python wrapper exposes them.
            "popup": ["x", "y"],
            "set_position": ["x", "y"],
            "set_modal": ["tf"],
        },
        "callbacks": ["activated", "pick", "move", "close"],
    },

    # -- Buttons --

    "Button": {
        "base": "widget",
        "args": ["text"],
        "options": [],
        "methods": {
            "set_text": ["text"],
            "get_text": [],
            "set_icon": ["url", "size"],
            "get_icon": [],
            "set_color": ["bg", "fg"],
        },
        "callbacks": ["activated"],
    },

    "CheckBox": {
        "base": "widget",
        "args": ["text"],
        "options": [],
        "methods": {
            "set_state": ["tf"],
            "get_state": [],
        },
        "callbacks": ["activated"],
    },

    "RadioButton": {
        "base": "widget",
        "args": ["text"],
        "options": ["group"],
        "methods": {
            "set_text": ["text"],
            "set_state": ["value"],
            "get_state": [],
        },
        "callbacks": ["activated"],
    },

    "ToggleButton": {
        "base": "widget",
        "args": ["text"],
        "options": ["group"],
        "methods": {
            "set_text": ["text"],
            "set_state": ["value"],
            "get_state": [],
        },
        "callbacks": ["activated"],
    },

    # -- Text --

    "Label": {
        "base": "widget",
        "args": ["text"],
        "options": ["halign", "interactive", "menu"],
        "methods": {
            "set_text": ["text"],
            "get_text": [],
            "set_color": ["bg", "fg"],
            "set_halign": ["align"],
            "set_menu": ["menu"],
        },
        "callbacks": ["pointer-down", "pointer-up", "pointer-move",
                      "enter", "leave", "click", "dblclick",
                      "scroll", "key-down", "key-up", "key-press",
                      "focus-in", "focus-out", "drop-start", "drop-end",
                      "drag-over", "drop-progress", "contextmenu"],
    },

    "StatusBar": {
        "base": "widget",
        "args": [],
        "options": ["halign"],
        "methods": {
            "set_message": ["text", "duration"],
            "clear": [],
            "set_color": ["bg", "fg"],
            "set_halign": ["align"],
        },
        "callbacks": [],
    },

    "TextEntry": {
        "base": "widget",
        "args": ["text"],
        "options": ["editable", "linehistory", "password"],
        "methods": {
            "set_text": ["text"],
            "get_text": [],
            "clear": [],
            "set_length": ["numchars"],
        },
        "callbacks": ["activated"],
    },

    "TextEntrySet": {
        "base": "widget",
        "args": ["text"],
        "options": ["label", "editable", "linehistory"],
        "methods": {
            "set_button_text": ["text"],
            "set_text": ["text"],
            "get_text": [],
            "clear": [],
            "set_length": ["numchars"],
        },
        "callbacks": ["activated"],
    },

    "TextArea": {
        "base": "widget",
        "args": ["text"],
        "options": ["wrap", "editable"],
        "methods": {
            "set_text": ["text"],
            "get_text": [],
            "append_text": ["text"],
            "clear": [],
            "set_editable": ["tf"],
            "set_wrap": ["tf"],
            "set_limit": ["numlines"],
            "set_scroll_position": ["h_pct", "v_pct"],
            "get_scroll_position": [],
        },
        "callbacks": ["scrolled"],
    },

    "TextSource": {
        "base": "widget",
        "args": ["text"],
        "options": ["wrap", "line_numbers", "icon_gutter", "editable",
                    "font_family", "font_size"],
        "methods": {
            "set_text": ["text"],
            "get_text": [],
            "get_length": [],
            "get_text_range": ["start_ref", "end_ref"],
            # Public API takes TextBufferRefs (created via create_ref).
            # Live refs auto-track edits, so a ref keeps pointing at
            # the same logical position across insert/delete calls.
            "insert_text": ["ref", "text", "tags"],
            "delete_range": ["start_ref", "end_ref"],
            "clear": [],
            "set_editable": ["tf"],
            "set_wrap": ["mode"],
            "set_line_numbers": ["tf"],
            "set_icon_gutter": ["tf"],
            "set_icon": ["ref", "icon_url"],
            "get_cursor": [],
            "set_cursor": ["ref"],
            "get_selection_range": [],
            "set_selection_range": ["start_ref", "end_ref"],
            # Tags
            "create_tag": ["name", "attrs"],
            "remove_tag_def": ["name"],
            "has_tag": ["name"],
            "apply_tag": ["name", "start_ref", "end_ref"],
            "remove_tag": ["name", "start_ref", "end_ref"],
            "get_tags_at": ["ref"],
            "get_tags_range": ["start_ref", "end_ref"],
            # Live refs
            "create_ref": ["offset", "gravity"],
            "remove_ref": ["ref"],
            "create_named_ref": ["name", "offset", "gravity"],
            "get_named_ref": ["name"],
            "remove_named_ref": ["name"],
            # Private reconstruction helpers (used by pgwidgets-python
            # to restore tag intervals and re-bind named refs after a
            # browser reconnect).  Not part of the user-facing API.
            "_restoreTagIntervals": ["intervals"],
            "_bindNamedRef": ["name", "ref"],
            "_setCursorOffset": ["offset"],
            "_setSelectionOffsets": ["start", "end"],
            "get_ref_start": [],
            "get_ref_end": [],
            "get_ref_bounds": [],
            "get_ref_line_start": ["lineno"],
            "get_ref_line_end": ["lineno"],
            # Undo/redo
            "undo": [],
            "redo": [],
            "can_undo": [],
            "can_redo": [],
            # Find/replace
            "find": ["query", "opts"],
            "find_all": ["query", "opts"],
            "replace": ["query", "replacement", "opts"],
            # Scrolling
            "scroll_to_ref": ["ref"],
            "scroll_to_cursor": [],
            "set_scroll_position": ["h_pct", "v_pct"],
            "get_scroll_position": [],
        },
        "callbacks": ["changed", "cursor_moved", "line_clicked",
                      "icon_clicked", "scrolled"],
    },

    # A live position handle into a TextSource buffer.  Extends the
    # Callback base (non-visual), so it gets a wid and can be passed
    # by reference across the wire.  Refs are normally minted via
    # methods on TextSource (create_ref, create_named_ref, etc.) but
    # the constructor signature is listed here so the remote-interface
    # ``create`` handshake can recreate them with a pre-allocated wid
    # during reconstruction.
    "TextBufferRef": {
        "base": "callback",
        "args": ["buffer", "offset", "gravity"],
        "options": [],
        "methods": {
            "get_offset": [],
            "get_gravity": [],
            "is_valid": [],
            "get_line_column": [],
            "get_line": [],
            "set_offset": ["offset"],
            "set_line": ["lineno"],
            "to_ref": ["other"],
            "copy": [],
            "to_line_start": [],
            "to_line_end": [],
            "to_next_line": [],
            "to_prev_line": [],
            "to_next_char": [],
            "to_prev_char": [],
        },
        "callbacks": ["invalidated"],
    },

    # -- Value widgets --

    "ComboBox": {
        "base": "widget",
        "args": [],
        "options": ["editable", "dropdown_limit"],
        "methods": {
            "append_text": ["text"],
            "insert_alpha": ["text"],
            "delete_alpha": ["text"],
            "set_text": ["text"],
            "get_text": [],
            "set_index": ["idx"],
            "get_index": [],
            "get_alpha": ["idx"],
            "show_text": ["text"],
            "clear": [],
            "set_length": ["numchars"],
        },
        "callbacks": ["activated"],
    },

    "SpinBox": {
        "base": "widget",
        "args": [],
        "options": ["dtype", "min", "max", "step", "value", "decimals"],
        "methods": {
            "set_value": ["val"],
            "get_value": [],
            "set_limits": ["minval", "maxval", "incrval"],
            "set_decimals": ["num"],
        },
        "callbacks": ["activated"],
    },

    "Slider": {
        "base": "widget",
        "args": [],
        "options": ["orientation", "track", "dtype", "min", "max",
                    "step", "value", "show_value", "show_value_position",
                    "decimals"],
        "methods": {
            "set_value": ["num"],
            "get_value": [],
            "set_limits": ["minval", "maxval", "incrval"],
            "set_tracking": ["track"],
            "set_decimals": ["num"],
        },
        "callbacks": ["activated"],
    },

    "Dial": {
        "base": "widget",
        "args": [],
        "options": ["track", "dtype", "min", "max", "step", "value",
                    "show_value", "show_value_position", "decimals"],
        "methods": {
            "set_value": ["num"],
            "get_value": [],
            "set_limits": ["minval", "maxval", "incrval"],
            "set_tracking": ["track"],
            "set_decimals": ["num"],
            "set_knob_diameter": ["len_px"],
            "set_icon": ["url", "size"],
        },
        "callbacks": ["activated"],
    },

    "ScrollBar": {
        "base": "widget",
        "args": [],
        "options": ["orientation", "thickness"],
        "methods": {
            "set_scroll_percent": ["pct"],
            "get_scroll_percent": [],
            "set_thumb_percent": ["pct"],
            "get_thumb_percent": [],
        },
        "callbacks": ["activated"],
    },

    "ProgressBar": {
        "base": "widget",
        "args": [],
        "options": [],
        "methods": {
            "set_value": ["value"],
            "get_value": [],
        },
        "callbacks": [],
    },

    # -- Display --

    "Image": {
        "base": "widget",
        "args": [],
        "options": ["url", "interactive", "use_animation_frame"],
        "methods": {
            "set_image": ["url"],
            "set_binary_image": ["data", "format"],
            "get_draw_context": [],
            "update": [],
        },
        "callbacks": ["pointer-down", "pointer-up", "pointer-move",
                      "enter", "leave", "click", "dblclick",
                      "scroll", "key-down", "key-up", "key-press",
                      "focus-in", "focus-out", "drop-start", "drop-end", "drag-over",
                      "drop-progress", "contextmenu"],
    },

    "TreeView": {
        "base": "widget",
        "args": [],
        "options": ["columns", "show_header", "selection_mode",
                    "alternate_row_colors", "show_grid", "show_row_numbers",
                    "sortable", "allow_text_selection"],
        "methods": {
            "set_columns": ["columns"],
            "set_tree": ["tree"],
            "add_tree": ["tree", "parent"],
            "update_tree": ["tree"],
            "set_data": ["data"],
            "add_item": ["parent", "key", "values"],
            "remove_item": ["path"],
            "remove_items": ["paths"],
            "clear": [],
            "expand_all": [],
            "collapse_all": [],
            "get_expanded": [],
            "get_collapsed": [],
            "expand_item": ["path"],
            "collapse_item": ["path"],
            "get_selected": [],
            "get_subtree": ["status"],
            "set_selected": ["paths"],
            "clear_selection": [],
            "select_path": ["path", "state"],
            "select_paths": ["paths", "state"],
            "select_all": ["state"],
            "set_column_width": ["col_key", "width"],
            "set_optimal_column_widths": [],
            "sort_by_column": ["col_key", "ascending"],
            "scroll_to_path": ["path"],
            "scroll_to_end": [],
            "get_column_count": [],
            "get_row_count": [],
            "set_show_grid": ["tf"],
            "set_show_row_numbers": ["tf"],
            "set_sortable": ["tf"],
            "set_column_editable": ["col_key", "tf"],
            "set_cell": ["path", "col_key", "value"],
            "insert_column": ["column", "before"],
            "append_column": ["column"],
            "delete_column": ["col_key"],
            "insert_row": ["values", "key", "before"],
            "append_row": ["values"],
            "delete_row": ["path_or_key"],
            "set_scroll_position": ["h_pct", "v_pct"],
            "get_scroll_position": [],
        },
        "callbacks": ["activated", "selected", "expanded", "collapsed",
                      "sorted", "cell_edited", "scrolled"],
    },

    "TableView": {
        "base": "widget",
        "args": [],
        "options": ["columns", "show_header", "selection_mode",
                    "alternate_row_colors", "show_grid", "show_row_numbers",
                    "sortable", "allow_text_selection"],
        "methods": {
            "set_columns": ["columns"],
            "set_rows": ["rows"],
            "set_data": ["data"],
            "clear": [],
            "get_selected": [],
            "set_selected": ["items"],
            "select_path": ["path", "state"],
            "select_paths": ["paths", "state"],
            "select_all": ["state"],
            "set_column_width": ["col_index", "width"],
            "set_optimal_column_widths": [],
            "sort_by_column": ["col_index", "ascending"],
            "scroll_to_path": ["path"],
            "scroll_to_end": [],
            "get_column_count": [],
            "get_row_count": [],
            "set_show_grid": ["tf"],
            "set_show_row_numbers": ["tf"],
            "set_sortable": ["tf"],
            "set_column_editable": ["col_index", "tf"],
            "set_cell": ["row", "col_index", "value"],
            "insert_column": ["index", "column"],
            "append_column": ["column"],
            "delete_column": ["index"],
            "insert_row": ["index", "values"],
            "append_row": ["values"],
            "delete_row": ["index"],
            "set_scroll_position": ["h_pct", "v_pct"],
            "get_scroll_position": [],
        },
        "callbacks": ["activated", "selected", "sorted", "cell_edited",
                      "scrolled"],
    },

    "Timer": {
        "base": "callback",
        "args": [],
        "options": ["duration"],
        "methods": {
            "start": ["duration"],
            "stop": [],
            "cancel": [],
            "set": ["duration"],
            "cond_set": ["duration"],
            "is_set": [],
            "elapsed_time": [],
            "time_left": [],
            "set_duration": ["duration"],
            "get_duration": [],
        },
        "callbacks": ["expired", "cancelled"],
    },

    "Canvas": {
        "base": "widget",
        "args": [],
        "options": ["use_animation_frame", "interactive"],
        "methods": {
            "draw_image": ["imgInfo"],
            "get_draw_context": [],
            "update": [],
        },
        "callbacks": ["pointer-down", "pointer-up", "pointer-move",
                      "enter", "leave", "click", "dblclick",
                      "scroll", "key-down", "key-up", "key-press",
                      "focus-in", "focus-out", "drop-start", "drop-end", "drag-over",
                      "contextmenu", "activated"],
    },

    "HtmlView": {
        "base": "widget",
        "args": ["html"],
        "options": [],
        "methods": {
            "set_html": ["html"],
            "get_html": [],
            "append_html": ["html"],
            "clear": [],
            "scroll_to_top": [],
            "scroll_to_bottom": [],
            "set_scroll_position": ["h_pct", "v_pct"],
            "get_scroll_position": [],
        },
        "callbacks": ["scrolled"],
    },

    "VideoWidget": {
        "base": "widget",
        "args": [],
        "options": ["url", "autoplay", "controls", "muted", "loop"],
        "methods": {
            "set_url": ["url"],
            "set_stream": ["stream"],
            "get_video_element": [],
            "play": [],
            "pause": [],
            "stop": [],
            "set_muted": ["tf"],
            "get_muted": [],
            "set_volume": ["vol"],
            "get_volume": [],
            "set_loop": ["tf"],
            "get_loop": [],
            "set_controls": ["tf"],
            "get_controls": [],
            "set_current_time": ["seconds"],
            "get_current_time": [],
            "get_duration": [],
            "get_paused": [],
            "fullscreen": [],
        },
        "callbacks": ["play", "pause", "ended", "error",
                      "timeupdate", "volumechange"],
    },

    "ExternalWidget": {
        "base": "widget",
        "args": [],
        "options": [],
        "methods": {
            "get_content_element": [],
            "set_content": ["html"],
            "clear": [],
        },
        "callbacks": [],
    },

    "FileDialog": {
        "base": "callback",
        "args": [],
        "options": ["mode", "accept"],
        "methods": {
            "open": [],
            "show": [],
            "popup": ["x", "y"],
            "save": ["filename", "data", "mime_type"],
            "set_mode": ["mode"],
            "get_mode": [],
            "set_accept": ["accept"],
            "get_accept": [],
        },
        "callbacks": ["activated", "progress"],
    },

    # -- Menus & Toolbars --

    "MenuBar": {
        "base": "widget",
        "args": [],
        "options": [],
        "methods": {
            "add_menu": ["menu", "name"],
            "add_name": ["name"],
            "get_menu": ["name"],
        },
        "callbacks": [],
    },

    "Menu": {
        "base": "widget",
        "args": [],
        "options": [],
        "methods": {
            "add_widget": ["child"],
            "add_name": ["name", "checkable"],
            "add_menu": ["name", "menu"],
            "add_separator": [],
            "get_menu": ["name"],
            "popup": ["x", "y"],
        },
        "callbacks": [],
    },

    "MenuAction": {
        "base": "widget",
        "args": [],
        "options": ["text", "icon_url", "iconsize", "checkable", "name"],
        "methods": {
            "set_text": ["text"],
            "get_text": [],
            "set_icon": ["url", "iconsize"],
            "set_checked": ["checked"],
            "get_checked": [],
            "set_state": ["tf"],
            "get_state": [],
        },
        "callbacks": ["activated"],
    },

    "ToolBar": {
        "base": "widget",
        "args": [],
        "options": ["orientation"],
        "methods": {
            "add_widget": ["child"],
            "add_separator": [],
            "add_spacer": [],
            "add_action": ["options"],
        },
        "callbacks": [],
    },

    "ToolBarAction": {
        "base": "widget",
        "args": [],
        "options": ["text", "icon_url", "iconsize", "toggle", "group", "menu"],
        "methods": {
            "set_text": ["text"],
            "get_text": [],
            "set_icon": ["url", "iconsize"],
            "set_state": ["value"],
            "get_state": [],
            "set_menu": ["menu"],
        },
        "callbacks": ["activated"],
    },
}
