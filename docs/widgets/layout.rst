Layout Widgets
==============

.. _widget-toplevel:

TopLevel
--------

The root-level container widget. Uses absolute positioning and attaches
to the document body. Typically the outermost widget in a pgwidgets
application.

**Constructor:** ``new Widgets.TopLevel({title, resizable, moveable, closeable})``

**Options:**

- ``title`` -- title bar text (enables the title bar when set)
- ``resizable`` -- enable corner resize grips
- ``moveable`` -- allow dragging by the title bar (defaults to ``true`` if title is set)
- ``closeable`` -- show close button in title bar (defaults to ``true``)

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_widget(child)``
     - Set the single child widget (fills the entire area).
   * - ``set_position(x, y)``
     - Set position in pixels.
   * - ``set_title(title)``
     - Set or create the title bar text.
   * - ``set_moveable(tf)``
     - Enable or disable title bar dragging.
   * - ``raise_()``
     - Bring to the front (highest z-order).
   * - ``lower()``
     - Send to the back (lowest z-order).

**Callbacks:**

- ``move`` -- fired when the widget is dragged to a new position.
- ``close`` -- fired when the close button is clicked.

.. code-block:: javascript

   let top = new Widgets.TopLevel({title: "My App", resizable: true});
   top.resize(800, 600);

   let vbox = new Widgets.VBox({spacing: 8});
   // ... add widgets to vbox ...
   top.set_widget(vbox);
   top.show();

   // Close button handler
   top.add_callback('close', () => top.hide());

.. _widget-vbox:

VBox
----

Vertical box layout. Children are stacked top to bottom.

**Constructor:** ``new Widgets.VBox()``

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``add_widget(child, stretch)``
     - Add a child widget. *stretch* (0 or 1) controls whether it expands.
   * - ``set_spacing(gap)``
     - Set spacing between children in pixels.

**Callbacks:** None (inherits ``resize`` from Widget).

.. code-block:: javascript

   let vbox = new Widgets.VBox();
   vbox.set_spacing(8);
   vbox.set_padding(10);
   vbox.add_widget(label, 0);   // fixed size
   vbox.add_widget(editor, 1);  // stretches to fill

.. _widget-hbox:

HBox
----

Horizontal box layout. Children are placed left to right.

**Constructor:** ``new Widgets.HBox()``

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``add_widget(child, stretch)``
     - Add a child widget. *stretch* controls whether it expands.
   * - ``set_spacing(gap)``
     - Set spacing between children in pixels.

**Callbacks:** None.

.. code-block:: javascript

   let hbox = new Widgets.HBox();
   hbox.set_spacing(4);
   hbox.add_widget(button1, 0);
   hbox.add_widget(button2, 0);

.. _widget-gridbox:

GridBox
-------

Grid layout with row/column placement.

**Constructor:** ``new Widgets.GridBox({rows, columns})``

**Options:**

- ``rows`` -- number of rows
- ``columns`` -- number of columns

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 45 55

   * - Method
     - Description
   * - ``add_widget(child, row, col)``
     - Place a child at the given row and column.
   * - ``set_row_spacing(px)``
     - Set vertical spacing between rows.
   * - ``set_column_spacing(px)``
     - Set horizontal spacing between columns.
   * - ``set_spacing(px)``
     - Set both row and column spacing.
   * - ``get_row_column_count()``
     - Return ``[rows, columns]``.
   * - ``get_widget_at_cell(row, col)``
     - Return the widget at a given cell.
   * - ``insert_row(index, widgets)``
     - Insert a row at *index* with optional widgets.
   * - ``append_row(widgets)``
     - Append a row with optional widgets.
   * - ``delete_row(index)``
     - Delete row at *index*.
   * - ``insert_column(index, widgets)``
     - Insert a column at *index*.
   * - ``append_column(widgets)``
     - Append a column.
   * - ``delete_column(index)``
     - Delete column at *index*.

**Callbacks:** None.

.. code-block:: javascript

   let grid = new Widgets.GridBox({rows: 2, columns: 3});
   grid.set_spacing(4);
   grid.add_widget(label, 0, 0);
   grid.add_widget(entry, 0, 1);

.. _widget-splitter:

Splitter
--------

Resizable split pane (horizontal or vertical).

**Constructor:** ``new Widgets.Splitter({orientation})``

**Options:**

- ``orientation`` -- ``"horizontal"`` (default) or ``"vertical"``

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 45 55

   * - Method
     - Description
   * - ``add_widget(child)``
     - Add a pane.
   * - ``set_sizes(sizes)``
     - Set pane sizes as an array of pixel values.
   * - ``get_sizes()``
     - Return current pane sizes.
   * - ``set_minimum_size(child, min_px)``
     - Set minimum size for a pane.

**Callbacks:**

- ``sizing`` -- fired when pane sizes change.

.. code-block:: javascript

   let splitter = new Widgets.Splitter({orientation: "horizontal"});
   splitter.add_widget(leftPanel);
   splitter.add_widget(rightPanel);
   splitter.set_sizes([200, 400]);

.. _widget-tabwidget:

TabWidget
---------

Tabbed container with switchable pages.

**Constructor:** ``new Widgets.TabWidget({closable, reorderable, tab_position})``

**Options:**

- ``closable`` -- show close buttons on tabs
- ``reorderable`` -- allow tab drag reordering
- ``tab_position`` -- tab bar position (``"top"``, ``"bottom"``, ``"left"``, ``"right"``)

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 45 55

   * - Method
     - Description
   * - ``add_widget(child, options)``
     - Add a tab. *options* can include ``{title: "..."}``
   * - ``show_widget(child)``
     - Switch to the tab containing *child*.
   * - ``close_widget(child)``
     - Close the tab containing *child*.
   * - ``set_index(index)``
     - Switch to tab by index.
   * - ``get_index()``
     - Return current tab index.
   * - ``get_tab_id(child)``
     - Return the tab ID for a child.
   * - ``get_child(tab_id)``
     - Return the child for a tab ID.
   * - ``index_of(child)``
     - Return the index of a child's tab.
   * - ``highlight_tab(child, bgcolor)``
     - Highlight a tab with a background color.
   * - ``set_tab_position(tabpos)``
     - Change tab bar position.

**Callbacks:**

- ``page-switch`` -- fired when the active tab changes.
- ``page-close`` -- fired when a tab is closed.

.. code-block:: javascript

   let tabs = new Widgets.TabWidget({closable: true, tab_position: "top"});
   tabs.add_widget(page1, {title: "First"});
   tabs.add_widget(page2, {title: "Second"});
   tabs.add_callback('page-switch', (w) => console.log("switched"));

.. _widget-stackwidget:

StackWidget
-----------

Stacked pages without tab headers. Only one page is visible at a time.

**Constructor:** ``new Widgets.StackWidget()``

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``add_widget(child, options)``
     - Add a page.
   * - ``show_widget(child)``
     - Show a specific page.
   * - ``set_index(index)``
     - Show page by index.
   * - ``get_index()``
     - Return current page index.

**Callbacks:**

- ``page-switch`` -- fired when the visible page changes.

.. _widget-scrollarea:

ScrollArea
----------

Scrollable viewport wrapping a single child widget.

**Constructor:** ``new Widgets.ScrollArea({hscrollbar, vscrollbar})``

**Options:**

- ``hscrollbar`` -- horizontal scrollbar policy
- ``vscrollbar`` -- vertical scrollbar policy

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_widget(child)``
     - Set the scrollable content widget.

**Callbacks:** None.

.. _widget-frame:

Frame
-----

Titled border container for grouping widgets.

**Constructor:** ``new Widgets.Frame({title})``

**Options:**

- ``title`` -- frame title text

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_widget(child)``
     - Set the content widget.
   * - ``set_title(text)``
     - Change the frame title.

**Callbacks:** None.

.. code-block:: javascript

   let frame = new Widgets.Frame({title: "Settings"});
   frame.set_widget(settingsPanel);

.. _widget-expander:

Expander
--------

Collapsible section with a clickable header.

**Constructor:** ``new Widgets.Expander({title, collapsible, shadow})``

**Options:**

- ``title`` -- header text
- ``collapsible`` -- whether the section can collapse
- ``shadow`` -- show drop shadow

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_widget(child)``
     - Set the content widget.
   * - ``toggleContent()``
     - Toggle collapsed/expanded state.

**Callbacks:** None.

.. _widget-mdiwidget:

MDIWidget
---------

Multiple Document Interface workspace with draggable, resizable sub-windows.

**Constructor:** ``new Widgets.MDIWidget()``

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 45 55

   * - Method
     - Description
   * - ``add_widget(child, options)``
     - Add a sub-window. *options*: ``{title, width, height, icon_url, x, y}``
   * - ``cascade_windows()``
     - Arrange sub-windows in a cascade.
   * - ``tile_windows()``
     - Tile sub-windows to fill the workspace.
   * - ``get_subwin(child)``
     - Return the sub-window object for a child.
   * - ``get_configuration(child)``
     - Return ``{x, y, width, height, title}`` for a child's sub-window.
   * - ``close_child(child)``
     - Close a sub-window.
   * - ``set_resistance(value)``
     - Set edge resistance for sub-window dragging.

**Sub-window methods** (via ``get_subwin(child)``):

.. list-table::
   :header-rows: 1
   :widths: 45 55

   * - Method
     - Description
   * - ``set_title(title)``
     - Change the sub-window title text.
   * - ``set_position(x, y)``
     - Move the sub-window to the given position.

**Callbacks:**

- ``page-switch`` -- fired when the active sub-window changes.
- ``page-close`` -- fired when a sub-window is closed.

.. code-block:: javascript

   let mdi = new Widgets.MDIWidget();
   mdi.add_widget(editor1, {title: "Document 1", x: 10, y: 10});
   mdi.add_widget(editor2, {title: "Document 2", x: 50, y: 50});
   mdi.tile_windows();

   // Change a sub-window title later
   let subwin = mdi.get_subwin(editor1);
   subwin.set_title("Document 1 (modified)");

   // Query sub-window configuration
   let config = mdi.get_configuration(editor1);
   // config = {x: ..., y: ..., width: ..., height: ..., title: "..."}
