Display Widgets
===============

.. _widget-image:

Image
-----

Image display widget with optional interactive pointer/keyboard events.

**Constructor:** ``new Widgets.Image({url, interactive, use_animation_frame})``

**Options:**

- ``url`` -- initial image URL
- ``interactive`` -- enable pointer and keyboard events
- ``use_animation_frame`` -- throttle updates to animation frame rate

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_image(url)``
     - Set image from URL or data URI.
   * - ``set_binary_image(format, buffer)``
     - Set image from a raw ``ArrayBuffer`` or ``Uint8Array``
       received as a binary WebSocket frame.  ``format`` is one
       of ``"jpeg"``, ``"png"``, ``"webp"``, or ``"gif"``; the
       buffer is wrapped in a ``Blob`` of the matching MIME type
       and rendered.  Used by the Python-side
       ``Image.set_binary_image`` to skip base64 framing for
       streaming use cases.
   * - ``get_draw_context()``
     - Return a 2D canvas drawing context for overlay drawing.
   * - ``update()``
     - Flush pending draw operations.

**Callbacks:**

- ``pointer-down``, ``pointer-up``, ``pointer-move`` -- mouse/touch
- ``enter``, ``leave`` -- pointer enters/leaves
- ``click``, ``dblclick`` -- click events
- ``scroll`` -- scroll wheel
- ``key-down``, ``key-up``, ``key-press`` -- keyboard
- ``focus-in``, ``focus-out`` -- focus changes
- ``drop-start``, ``drop-end``, ``drop-progress``, ``drag-over`` -- file drag-and-drop
- ``contextmenu`` -- right-click

.. code-block:: javascript

   let img = new Widgets.Image({interactive: true});
   img.set_image("photo.jpg");
   img.add_callback('click', (w, ev) => {
       console.log("Clicked at:", ev.data_x, ev.data_y);
   });

.. _widget-canvas:

Canvas
------

HTML5 canvas for custom drawing with interactive events.

**Constructor:** ``new Widgets.Canvas({use_animation_frame, interactive})``

**Options:**

- ``use_animation_frame`` -- throttle updates to animation frame rate
- ``interactive`` -- enable pointer and keyboard events

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``draw_image(imgInfo)``
     - Draw an image onto the canvas.
   * - ``get_draw_context()``
     - Return the 2D canvas drawing context.
   * - ``update()``
     - Flush pending draw operations.

**Callbacks:**

- ``pointer-down``, ``pointer-up``, ``pointer-move`` -- mouse/touch
- ``enter``, ``leave`` -- pointer enters/leaves
- ``click``, ``dblclick`` -- click events
- ``scroll`` -- scroll wheel
- ``key-down``, ``key-up``, ``key-press`` -- keyboard
- ``focus-in``, ``focus-out`` -- focus changes
- ``drop-start``, ``drop-end``, ``drag-over`` -- file drag-and-drop
- ``contextmenu`` -- right-click
- ``activated`` -- general activation

.. code-block:: javascript

   let canvas = new Widgets.Canvas({interactive: true});
   canvas.resize(640, 480);
   let ctx = canvas.get_draw_context();
   ctx.fillStyle = "red";
   ctx.fillRect(10, 10, 100, 50);
   canvas.update();

.. _widget-colorwidget:

ColorWidget
-----------

Inline color swatch with optional picker.

**Constructor:** ``new Widgets.ColorWidget({color})``

**Options:**

- ``color`` -- initial color as hex string (e.g. ``"#ff0000"``)

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``get_color()``
     - Return current color as hex string.
   * - ``set_color(hex_string)``
     - Set color.

**Callbacks:**

- ``pick`` -- fired when a color is selected.

.. code-block:: javascript

   let cw = new Widgets.ColorWidget({color: "#3366cc"});
   cw.add_callback('pick', (w) => {
       console.log("Color:", w.get_color());
   });

.. _widget-videowidget:

VideoWidget
-----------

Video display widget with playback controls. Supports video files via URL
and live streams via WebRTC or ``getUserMedia``.

**Constructor:** ``new Widgets.VideoWidget({url, autoplay, controls, muted, loop})``

**Options:**

- ``url`` -- initial video URL
- ``autoplay`` -- start playback automatically
- ``controls`` -- show native browser playback controls
- ``muted`` -- start muted
- ``loop`` -- loop playback

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 45 55

   * - Method
     - Description
   * - ``set_url(url)``
     - Set video source from a URL (mp4, webm, etc.).
   * - ``set_stream(stream)``
     - Set a MediaStream as the source (WebRTC, getUserMedia).
   * - ``get_video_element()``
     - Return the underlying ``<video>`` DOM element.
   * - ``play()`` / ``pause()`` / ``stop()``
     - Playback controls. Stop resets to the beginning.
   * - ``set_muted(tf)`` / ``get_muted()``
     - Mute state.
   * - ``set_volume(vol)`` / ``get_volume()``
     - Volume (0.0 to 1.0).
   * - ``set_loop(tf)`` / ``get_loop()``
     - Loop state.
   * - ``set_controls(tf)`` / ``get_controls()``
     - Show/hide native browser controls.
   * - ``set_current_time(seconds)`` / ``get_current_time()``
     - Seek position.
   * - ``get_duration()``
     - Total duration in seconds.
   * - ``get_paused()``
     - Whether playback is paused.
   * - ``fullscreen()``
     - Request fullscreen display.

**Callbacks:**

- ``play`` -- playback started.
- ``pause`` -- playback paused.
- ``ended`` -- playback reached the end.
- ``error`` -- a playback error occurred.
- ``timeupdate`` -- playback position changed (receives current time, duration).
- ``volumechange`` -- volume or mute state changed.

.. code-block:: javascript

   // Video file
   let video = new Widgets.VideoWidget({url: "demo.mp4", controls: true});
   vbox.add_widget(video, 1);

   // WebRTC stream
   let cam = new Widgets.VideoWidget({autoplay: true, muted: true});
   navigator.mediaDevices.getUserMedia({video: true})
       .then(stream => cam.set_stream(stream));

.. _widget-externalwidget:

ExternalWidget
--------------

A container for embedding third-party library content (Plotly charts,
Bokeh plots, Leaflet maps, etc.) into pgwidgets layouts. See
:doc:`../external-widgets` for full examples.

**Constructor:** ``new Widgets.ExternalWidget()``

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``get_content_element()``
     - Return the inner DOM element for third-party libraries to render into.
   * - ``set_content(html)``
     - Set inner HTML content directly.
   * - ``clear()``
     - Remove all content.

**Callbacks:** None (inherits ``resize`` from Widget).

.. code-block:: javascript

   let chart = new Widgets.ExternalWidget();
   vbox.add_widget(chart, 1);

   Plotly.newPlot(chart.get_content_element(), data, layout,
                  {responsive: true});

   // If the library needs explicit resize notification:
   chart.add_callback('resize', () => {
       Plotly.Plots.resize(chart.get_content_element());
   });

.. _widget-treeview:

TreeView
--------

Hierarchical tree/table with columns, sorting, icons, and multi-selection.
Tree data is stored as a hierarchy of dicts keyed by stable string
identifiers; paths are arrays of those keys, so a path stays valid no
matter how the visible tree is sorted.

**Constructor:** ``new Widgets.TreeView({columns, show_header,
selection_mode, alternate_row_colors, show_grid, show_row_numbers,
sortable, allow_text_selection})``

**Column descriptors:** each column is a string (label only) or an
object with the following keys:

- ``label`` -- header text.
- ``key`` -- stable string identifier for the column.  All
  per-column methods take a key.  Auto-generated if omitted
  (``_col0``, ``_col1``, ...).
- ``type`` -- one of ``"string"`` (alias ``"str"``), ``"integer"``
  (alias ``"int"``), ``"float"`` (alias ``"number"``), ``"boolean"``
  (renders ✓ when truthy), or ``"icon"`` (cell value is a URL or
  ``data:`` URL used as the image source).
- ``halign`` -- ``"left"`` / ``"center"`` / ``"right"``.  Default
  depends on type: numeric → right, boolean / icon → center,
  otherwise left.
- ``editable`` -- whether cells in the column can be edited via
  double-click.
- ``icon_size`` -- pixel size for icon columns (default 16).

**Tree shape (set_tree):**

The tree is a JS object keyed by stable string identifiers.  Each
sub-object is detected as either:

- a **leaf** -- all values primitive; the dict IS the row's
  column-key → value mapping;
- an **interior** -- any value is a nested object; the entries
  become children, keyed by their dict key.  Primitive entries in
  the same dict are taken as the interior's own column values;
- an **interior with explicit values** -- when ambiguity could
  arise, an ``__values__`` sentinel can hold the interior's column
  values explicitly;
- an **empty interior** -- ``{}`` (a folder with no contents).

The first column auto-displays the node's dict key when the row
supplies no value for it, so most interiors need no
``__values__`` at all.

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 45 55

   * - Method
     - Description
   * - ``set_columns(columns)``
     - Set column definitions.
   * - ``set_tree(tree)``
     - Replace the tree with a dict-shaped hierarchy.  Selection is
       cleared.
   * - ``add_tree(tree, parent=null)``
     - Merge a dict-tree under the given parent path.  Existing
       same-key children are replaced subtree-deep.  Selections
       whose paths still resolve survive; vanished paths are
       dropped.
   * - ``update_tree(tree)``
     - Replace the tree but preserve selections by path.
   * - ``set_data(data)``
     - Flat-table data.  Each row is a dict (preferred) or an
       array; arrays are mapped to column keys in order.  Synthetic
       row keys (``row0``, ``row1``, ...) are generated internally.
   * - ``add_item(parent, key, values)``
     - Add a single child under a parent path.
   * - ``remove_item(path)`` / ``remove_items(paths)``
     - Remove by path (array of keys) or in batch.
   * - ``clear()``
     - Remove all rows (preserves columns).
   * - ``expand_all()`` / ``collapse_all()``
     - Expand or collapse the entire tree.
   * - ``expand_item(path)`` / ``collapse_item(path)``
     - Expand or collapse a single node by key path.
   * - ``get_selected()`` / ``set_selected(paths)``
     - Get or set selection.  ``set_selected`` accepts a single
       path or an array of paths.
   * - ``clear_selection()``
     - Drop all selection.  Fires the ``selected`` callback with
       an empty list.
   * - ``select_path(path, state)`` / ``select_paths(paths, state)``
     - Select or deselect by key path(s).
   * - ``select_all(state)``
     - Select or deselect all nodes.
   * - ``get_subtree(status='all')``
     - Return a dict-tree containing a subset.  ``status`` is
       ``"all"``, ``"selected"``, ``"expanded"``, or ``"collapsed"``.
       Each match brings its descendants along; ancestors are
       included so the result is a connected tree.
       Round-trippable through ``set_tree``.
   * - ``sort_by_column(col_key, ascending)``
     - Sort by column key.  The underlying tree retains insertion
       order; only the displayed view is sorted.
   * - ``scroll_to_path(path)`` / ``scroll_to_end()``
     - Scroll to a row.
   * - ``set_cell(path, col_key, value)``
     - Update a single cell.
   * - ``insert_row(values, key=null, before=null)``
     - Top-level row insert with optional explicit key and
       optional sibling-key for placement.
   * - ``append_row(values)`` / ``delete_row(path_or_key)``
     - Row manipulation.
   * - ``insert_column(column, before=null)`` / ``append_column(column)`` / ``delete_column(col_key)``
     - Column manipulation.  ``before`` is a column key.
   * - ``set_column_width(col_key, width)``
     - Set column width.
   * - ``set_optimal_column_widths()``
     - Auto-size all columns.
   * - ``set_show_grid(tf)`` / ``set_show_row_numbers(tf)`` / ``set_sortable(tf)``
     - Toggle grid lines, row numbers, and click-to-sort.
   * - ``set_column_editable(col_key, tf)``
     - Make a column editable.

**Auto-spanning:** within a row, a column whose key is missing is
"absent" and the preceding present cell extends across it via CSS
grid spans.  Explicit empty strings render as their own (empty)
cell.  This lets parent rows be terse: ``{NAME: "Documents"}``
(with the rest of the columns omitted) renders as a single cell
across the row.

**Callbacks:**

- ``activated`` -- handler signature ``(widget, values, path)``;
  fires on row double-click or Enter.
- ``selected`` -- selection changed; handler receives an array of
  ``{path, values}`` objects.
- ``expanded`` / ``collapsed`` -- handler ``(widget, values, path)``.
- ``cell_edited`` -- ``(widget, path, col_key, oldValue, newValue)``.
- ``sorted`` -- ``(widget, col_key, ascending)``.
- ``scrolled`` -- ``(widget, h_pct, v_pct)``.

.. code-block:: javascript

   let tree = new Widgets.TreeView({
       columns: [
           {label: "Name", key: "NAME", type: "string"},
           {label: "Type", key: "TYPE", type: "string"},
           {label: "Size", key: "SIZE", type: "integer"},
       ],
       sortable: true,
   });
   tree.set_tree({
       "Documents": {
           "report.pdf": {TYPE: "PDF",  SIZE: 2400},
           "notes.txt":  {TYPE: "Text", SIZE: 12},
       },
       "Pictures": {
           "__values__": {TYPE: "Folder"},
           "photo.jpg":  {TYPE: "JPEG", SIZE: 3200},
       },
   });
   tree.add_callback('activated',
       (w, values, path) => console.log("opened", path, values));

.. _widget-tableview:

TableView
---------

Flat table (no hierarchy).  Subclass of TreeView with table-style
defaults (header on, grid lines on).  Shares the full TreeView API
including key-based per-column / per-row methods, sortable toggling,
and the same column descriptors.

**Constructor:** ``new Widgets.TableView({columns, show_header,
selection_mode, alternate_row_colors, show_grid, show_row_numbers,
sortable, allow_text_selection})``

``set_data`` (or its alias ``set_rows``) accepts either a list of
dicts (preferred) or a list of positional arrays:

.. code-block:: javascript

   let table = new Widgets.TableView({
       columns: [
           {label: "Name",       key: "NAME",   type: "string"},
           {label: "Department", key: "DEPT",   type: "string"},
           {label: "Salary",     key: "SALARY", type: "integer"},
       ],
       sortable: true,
   });
   table.set_data([
       {NAME: "Alice", DEPT: "Engineering", SALARY: 95000},
       {NAME: "Bob",   DEPT: "Marketing",   SALARY: 72000},
   ]);
   table.append_row({NAME: "Carol", DEPT: "Sales", SALARY: 71000});
   table.sort_by_column("SALARY", false);  // descending

**Callbacks:**

- ``activated`` -- ``(widget, values, path)``; fires on row
  double-click or Enter.
- ``selected`` -- ``(widget, items)`` where each item is
  ``{path, values}``.
- ``cell_edited`` -- ``(widget, path, col_key, oldValue, newValue)``.
- ``sorted``, ``scrolled`` -- as for TreeView.
