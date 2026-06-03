Layout Widgets
==============

.. _widget-toplevel:

TopLevel
--------

The root-level container widget. Uses absolute positioning and attaches
to the document body. Typically the outermost widget in a pgwidgets
application.

**Constructor:** ``new Widgets.TopLevel({title, icon, resizable,
moveable, closeable, minimizable, maximizable, lowerable,
shadeable})``

**Options:**

- ``title`` -- title bar text (enables the title bar when set).
- ``icon`` -- URL or ``data:`` URI shown at the left edge of the
  title bar.  Defaults to ``null`` (hidden).
- ``resizable`` -- enable corner resize grips.
- ``moveable`` -- allow dragging by the title bar (defaults to
  ``true`` when ``title`` is set).
- ``closeable`` -- show close button (default ``true``).
- ``minimizable`` -- show minimize button (default ``false``).
  Minimized windows auto-stack along the bottom of the viewport.
- ``maximizable`` -- show maximize button (default ``false``).
  Maximize fills the browser viewport (snapshot at click time;
  doesn't follow viewport resizes).
- ``lowerable`` -- show send-to-back button (default ``false``).
- ``shadeable`` -- allow rolling up to just the title bar (default
  ``true``).  Available from the right-click context menu and via
  double-click on the title bar.

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
   * - ``set_icon(url)``
     - Set or clear the title-bar icon.  Pass ``null`` to hide.
   * - ``set_moveable(tf)``
     - Enable or disable title bar dragging.
   * - ``raise_()`` / ``lower()``
     - Bring to the front / send to the back (z-order).
   * - ``toggle_minimize()`` / ``toggle_maximize()`` / ``toggle_shade()``
     - Switch the named state on or off.
   * - ``set_window_state(state)`` / ``get_window_state()``
     - Canonical state setter / getter.  States are ``"normal"``,
       ``"shaded"``, ``"minimized"``, ``"maximized"``.

**Callbacks:**

- ``move`` -- fired when the widget is dragged to a new position.
- ``close`` -- fired when the close button is clicked.
- ``window-state`` -- fires with the new state name when minimize /
  maximize / shade transitions occur.  The Python side wraps this
  in ``WIDGET_CALLBACK_SYNC`` so the state survives reconnect.

**Window controls:**

Title-bar buttons appear only for the options enabled at
construction.  The right-click context menu lists the applicable
actions (Raise, Lower, Shade, Minimize, Maximize, Close) and
supports both click-release and press-drag-release styles, like a
menubar.  Title-bar drag and corner-grip resize are bound to the
left mouse button (button 0) so right-click and middle-click are
free for other gestures.

.. code-block:: javascript

   let top = new Widgets.TopLevel({
       title: "My App", icon: "/icons/app.svg",
       resizable: true,
       minimizable: true, maximizable: true,
       lowerable: true, shadeable: true,
   });
   top.resize(800, 600);

   let vbox = new Widgets.VBox({spacing: 8});
   // ... add widgets to vbox ...
   top.set_widget(vbox);
   top.show();

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
   * - ``set_align(align)``
     - Cross-axis alignment of children.  For a vertical box
       this is the horizontal axis -- accepts ``"left"`` /
       ``"center"`` / ``"right"``.  Maps to flex
       ``align-items``.

**Callbacks:** ``child-added``, ``child-removed`` (from ContainerWidget).

.. code-block:: javascript

   let vbox = new Widgets.VBox();
   vbox.set_spacing(8);
   vbox.set_padding(10);
   vbox.set_align("center");    // centre children horizontally
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
   * - ``set_align(align)``
     - Cross-axis alignment of children.  For a horizontal box
       this is the vertical axis -- accepts ``"top"`` /
       ``"center"`` / ``"bottom"``.  Maps to flex
       ``align-items``.

**Callbacks:** ``child-added``, ``child-removed``.

.. code-block:: javascript

   let hbox = new Widgets.HBox();
   hbox.set_spacing(4);
   hbox.set_align("center");      // centre children vertically
   hbox.add_widget(button1, 0);
   hbox.add_widget(button2, 0);

.. _expanding-size-policy:

Expanding size policy
---------------------

Beyond ``Box``'s per-child ``stretch`` argument, every widget carries
an *expanding* policy that any container respects.  This mirrors Qt's
``QSizePolicy.Expanding`` and is the simplest way to say "this widget
should fill the space it's given" without caring which container it
ends up in.

**Signature:** ``widget.set_expanding(horizontal=false, vertical=false)``

Both flags default to ``False``.  Each one asks the widget to grow
into the available space along that axis.  Concretely, on the
requested axes the call writes ``flex: 1 1 auto``, ``align-self:
stretch``, ``min-{width,height}: 0`` and ``{width,height}: 100%``,
which works inside any flex parent (``Box``, ``Splitter``, ``TabWidget``
content, ``ScrollArea``, ``Frame``, …) and also inside a non-flex
parent.

Typical patterns:

.. code-block:: javascript

   // Image fills its tab page in both directions
   img.set_expanding(true, true);
   tab.add_tab(img, "Frames");

   // Status label stretches horizontally but stays its natural height
   label.set_expanding(true, false);
   hbox.add_widget(label);  // stretch=0; expanding still wins

   // Vertical sidebar fills the column but keeps its natural width
   sidebar.set_expanding(false, true);

**Order independence.** ``set_expanding`` may be called either before
or after the widget is added to its parent.  The flags are stored on
the widget and ``Box.add_widget`` consults them as a fallback when
its own ``stretch`` argument is 0; calling ``set_expanding`` after
the widget is already parented simply rewrites the inline CSS to
match.

**Interaction with Box stretch.**  When ``add_widget(child, stretch=N)``
is called with ``N > 0``, the explicit ``stretch`` wins over
``set_expanding`` on the main axis — it's the more specific
per-container override and also carries a proportion (``stretch=2``
vs. ``stretch=1`` for proportional growth).  ``set_expanding`` still
controls the cross axis and any non-Box parents.

**Image with use_animation_frame.** A canvas's intrinsic size is its
drawing-buffer (``width``/``height`` attributes), so without an
explicit policy it lays out at the bitmap size and may collapse to
0×0 inside a non-stretch container (e.g. a fresh tab page).  Call
``set_expanding(true, true)`` to make it fill, or
``set_min_size(w, h)`` to pin a specific size — both work directly
on the Image, no wrapper container required.

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

**Callbacks:** ``child-added``, ``child-removed``.

.. code-block:: javascript

   let grid = new Widgets.GridBox({rows: 2, columns: 3});
   grid.set_spacing(4);
   grid.add_widget(label, 0, 0);
   grid.add_widget(entry, 0, 1);

.. _widget-fixedlayout:

FixedLayout
-----------

Simple absolute-positioning container.  Children are placed at fixed
``(x, y)`` pixel offsets within the container and rendered at their
natural size unless ``resize()`` has been called on them, in which
case the explicit size sticks.  Useful for static panels with
hand-laid widgets — HUDs, calibration overlays, fixed-position forms.

**Constructor:** ``new Widgets.FixedLayout()``

**Options:** *(none)*

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 45 55

   * - Method
     - Description
   * - ``add_widget(child, x, y)``
     - Add *child* at the given pixel offset from the container's
       content edge.
   * - ``remove(child, destroy=false)``
     - Remove *child*; optionally destroy it.  Inherited from
       ``ContainerWidget``.
   * - ``remove_all(destroy=false)``
     - Remove every child.

**Callbacks:** ``child-added``, ``child-removed``.

.. code-block:: javascript

   let panel = new Widgets.FixedLayout();
   panel.add_widget(new Widgets.Label("Status"), 8, 8);
   let ok = new Widgets.Button("OK");
   ok.resize(80, 28);             // explicit size — overrides natural
   panel.add_widget(ok, 8, 40);

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

- ``child-added``, ``child-removed`` -- container child events.
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

- ``child-added``, ``child-removed`` -- container child events.
- ``page-switch`` -- fired when the active tab changes. Handler receives ``(widget, child, index)``.
- ``page-close`` -- fired when a tab close button is clicked.

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

- ``child-added``, ``child-removed`` -- container child events.
- ``page-switch`` -- fired when the visible page changes.
- ``page-close`` -- fired when a page is closed.

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

**Callbacks:** ``scrolled``.

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

**Callbacks:** ``toggled`` -- fired when the section is collapsed or expanded.

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
     - Add a sub-window.  *options*:
       ``{title, width, height, icon_url, x, y, shadeable}``.
       ``shadeable`` defaults to ``true``.
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
   * - ``get_children()``
     - Return content widgets (not sub-windows).
   * - ``get_subwindows()``
     - Return the MDISubWindow objects.
   * - ``move_child(child, x, y)``
     - Move a child's sub-window.
   * - ``resize_child(child, width, height)``
     - Resize a child's sub-window.
   * - ``get_child_size(child)``
     - Return ``[width, height]`` of a child's sub-window.
   * - ``get_child_position(child)``
     - Return ``[x, y]`` of a child's sub-window.
   * - ``index_of(child)``
     - Return the index of a child.
   * - ``index_to_widget(index)``
     - Return the child at an index.

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
   * - ``move(x, y)``
     - Alias for set_position.
   * - ``raise_()`` / ``lower()``
     - Bring sub-window to front / send to back within the
       workspace.
   * - ``toggle_minimize()`` / ``toggle_maximize()``
     - Switch between normal and minimized / maximized states.
   * - ``toggle_shade()``
     - Roll up to just the title bar in place (only effective
       when ``shadeable`` was passed for this sub-window).

**Active sub-window highlight:** the topmost sub-window's title bar
is drawn slightly lighter (CSS class ``.mdi-active``), like the
active tab in a TabWidget.  This updates automatically as
``raise_()`` / ``lower()`` are called or sub-windows are added /
removed.

**Right-click context menu:** title-bar right-click pops a menu
with Raise, Lower, Shade (when ``shadeable``), Minimize, Maximize,
and Close.  Same press-drag-release semantics as the menubar.

**Callbacks:**

- ``child-added``, ``child-removed`` -- container child events.
- ``page-switch`` -- fired when the active sub-window changes.
- ``page-close`` -- fired when a sub-window is closed.
- ``scrolled`` -- fired when the workspace is scrolled.

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
