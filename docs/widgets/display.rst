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

**Constructor:** ``new Widgets.TreeView({columns, show_header, selection_mode, alternate_row_colors, show_grid, show_row_numbers})``

**Options:**

- ``columns`` -- array of column definitions
- ``show_header`` -- show column headers
- ``selection_mode`` -- ``"single"`` or ``"multiple"``
- ``alternate_row_colors`` -- zebra striping
- ``show_grid`` -- show grid lines
- ``show_row_numbers`` -- show row numbers

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 45 55

   * - Method
     - Description
   * - ``set_columns(columns)``
     - Set column definitions.
   * - ``set_tree(data)``
     - Set hierarchical tree data.
   * - ``set_data(data)``
     - Set flat data.
   * - ``add_item(parent, values)``
     - Add an item under *parent*.
   * - ``remove_item(node)``
     - Remove an item.
   * - ``update_tree(items)``
     - Batch update items.
   * - ``remove_items(paths)``
     - Batch remove by paths.
   * - ``clear()``
     - Remove all items.
   * - ``expand_all()`` / ``collapse_all()``
     - Expand or collapse the entire tree.
   * - ``get_selected()`` / ``set_selected(items)``
     - Get or set selection.
   * - ``select_path(path, state)``
     - Select/deselect by path.
   * - ``sort_by_column(col_index, ascending)``
     - Sort by column.
   * - ``scroll_to_path(path)`` / ``scroll_to_end()``
     - Scroll to a row.
   * - ``set_cell(row, col_index, value)``
     - Update a single cell.
   * - ``insert_row(index, values)`` / ``append_row(values)`` / ``delete_row(index)``
     - Row manipulation.
   * - ``insert_column(index, column)`` / ``append_column(column)`` / ``delete_column(index)``
     - Column manipulation.
   * - ``set_column_width(col_index, width)``
     - Set column width.
   * - ``set_optimal_column_widths()``
     - Auto-size all columns.
   * - ``set_show_grid(tf)`` / ``set_show_row_numbers(tf)``
     - Toggle grid/row numbers.
   * - ``set_column_editable(col_index, tf)``
     - Make a column editable.

**Callbacks:**

- ``activated`` -- row double-clicked or Enter pressed.
- ``selected`` -- selection changed.
- ``expanded`` / ``collapsed`` -- tree node expanded or collapsed.
- ``cell_edited`` -- a cell value was edited.

.. _widget-tableview:

TableView
---------

Flat table (no hierarchy) with columns, sorting, and multi-selection.
Shares the same column/row API as TreeView but without tree-specific
methods.

**Constructor:** ``new Widgets.TableView({columns, show_header, selection_mode, alternate_row_colors, show_grid, show_row_numbers})``

**Options:** Same as TreeView.

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 45 55

   * - Method
     - Description
   * - ``set_columns(columns)``
     - Set column definitions.
   * - ``set_rows(rows)``
     - Set row data.
   * - ``set_data(data)``
     - Set data.
   * - ``clear()``
     - Remove all rows.
   * - ``get_selected()`` / ``set_selected(items)``
     - Get or set selection.
   * - ``sort_by_column(col_index, ascending)``
     - Sort by column.
   * - ``set_cell(row, col_index, value)``
     - Update a single cell.
   * - ``insert_row(index, values)`` / ``append_row(values)`` / ``delete_row(index)``
     - Row manipulation.
   * - ``insert_column(index, column)`` / ``append_column(column)`` / ``delete_column(index)``
     - Column manipulation.
   * - ``set_column_width(col_index, width)``
     - Set column width.
   * - ``set_optimal_column_widths()``
     - Auto-size all columns.
   * - ``set_column_editable(col_index, tf)``
     - Make a column editable.

**Callbacks:**

- ``activated`` -- row double-clicked or Enter pressed.
- ``selected`` -- selection changed.
- ``cell_edited`` -- a cell value was edited.
