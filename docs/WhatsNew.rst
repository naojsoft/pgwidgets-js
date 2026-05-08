What's New
==========

Significant changes since the last tagged release (``v0.1.2``).

Major changes
-------------

TreeView: dict-tree model with stable key paths
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``TreeView`` (and its subclass ``TableView``) now stores tree data as
a hierarchy of dicts keyed by stable string identifiers.  Paths to
nodes are arrays of those keys, so a path stays valid no matter how
the visible tree is sorted.

.. code-block:: javascript

   tree.set_tree({
       "Documents": {
           "report.pdf": {TYPE: "PDF",  SIZE: 2400},
           "notes.txt":  {TYPE: "Text", SIZE: 12},
       },
       "Pictures": {
           "photo.jpg": {TYPE: "JPEG", SIZE: 3200},
       },
   });

The first column auto-displays the node's dict key when the row
supplies no value for it, so most interiors need no explicit values
at all.  Mixed dicts (primitives plus nested objects) split
automatically: the primitives become the interior's own column
values; the objects become its children.  An ``__values__`` sentinel
is available for the rare case where the split is ambiguous.  See
:ref:`widget-treeview` for the full reference.

Column descriptors and types
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Columns now carry a stable ``key`` (auto-generated as ``_col0``,
``_col1`` ... if not supplied), and a richer set of types:
``"string"`` (alias ``"str"``), ``"integer"`` (alias ``"int"``),
``"float"`` (alias ``"number"``), ``"boolean"`` (renders ✓ when
truthy), and ``"icon"``.  An ``halign`` field controls horizontal
alignment with sensible per-type defaults (numeric → right,
boolean / icon → center, otherwise left).

All per-column / per-row methods now take a key (not an index):
``set_column_width(col_key, width)``,
``sort_by_column(col_key, ascending)``,
``insert_column(column, before=null)``, ``delete_column(col_key)``,
``set_cell(path, col_key, value)``, etc.

Auto-spanning
^^^^^^^^^^^^^

Within a row, a column whose key is missing (or whose value is
``null``/``undefined``) is "absent" and the preceding present cell
extends across it via CSS grid spans.  Explicit empty strings still
render as their own (empty) cell.  This lets parent rows be terse:
``{NAME: "Documents"}`` with the rest of the columns omitted
renders as a single cell across the row.

New tree methods
^^^^^^^^^^^^^^^^

- ``add_tree(tree, parent=null)`` -- merge a dict-tree under a
  parent path; existing same-key children are replaced subtree-deep.
- ``update_tree(tree)`` -- replace the tree, but preserve selection
  by path (previously ``set_tree`` cleared selection unconditionally).
- ``get_subtree(status)`` -- return a dict-tree containing
  ``"all"``, ``"selected"``, ``"expanded"``, or ``"collapsed"``
  nodes (with descendants and ancestors so the result is connected).
- ``clear_selection()`` -- explicit method to drop all selection.
- ``set_sortable(tf)`` -- toggle click-to-sort.

Window controls (TopLevel and MDISubWindow)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``TopLevel`` now supports the same window controls that
``MDISubWindow`` has, plus a "shade" (roll up to title bar) state
on both.

New ``TopLevel`` options (all default ``false`` except
``shadeable`` which defaults ``true``):

- ``minimizable`` -- show a minimize button.  Minimized windows
  auto-stack along the bottom of the viewport, wrapping rows when
  full.
- ``maximizable`` -- show a maximize button.  Maximize fills the
  browser viewport (snapshot at click time; doesn't follow viewport
  resizes).
- ``lowerable`` -- show a send-to-back button.
- ``shadeable`` -- allow rolling up to just the title bar.  Default
  ``true``.  Available from the right-click context menu and via
  double-click on the title bar.
- ``icon`` -- URL or ``data:`` URI for a title-bar icon.

New methods: ``set_icon(url)``, ``toggle_minimize()``,
``toggle_maximize()``, ``toggle_shade()``,
``set_window_state(state)``, ``get_window_state()``.

New callback: ``window-state`` -- fires with the new state name
(``"normal"``, ``"shaded"``, ``"minimized"``, ``"maximized"``).
The Python side syncs this so window state survives reconnect.

``MDIWidget.add_widget`` accepts ``shadeable`` (default ``true``).
Sub-windows gain ``toggle_shade()`` and the right-click context menu.
The active (topmost) sub-window's title bar is now drawn slightly
lighter, like the active tab in a TabWidget.

Right-click title-bar context menu
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Both ``TopLevel`` and ``MDISubWindow`` show a context menu on
right-click of the title bar.  Items are gated by the relevant
options (Raise is always shown; Lower / Shade / Minimize / Maximize
/ Close appear when the corresponding option is enabled).  The menu
supports both click-release and press-drag-release styles, like a
menubar.  Drag (title bar) and resize (corner grips) are now
restricted to the left mouse button so right- and middle-click
gestures don't accidentally move or resize the window.

Image: binary-frame protocol
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``Image.set_binary_image(format, buffer)`` accepts raw bytes from a
WebSocket binary frame and renders them via a ``Blob`` of the
matching MIME type (``"jpeg"`` / ``"png"`` / ``"webp"`` / ``"gif"``).
This avoids the ~33% base64 overhead of the JSON ``set_image`` path
and is intended for streaming use cases (animation, video frames,
etc.).  The Python side's binding stores the latest frame so it is
replayed on reconnect.

Browser text-select disabled by default
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Drag-to-highlight inside widgets is now disabled by default — it
interferes with row click/drag, shift-click range select, etc.
Form controls (``TextEntry``, ``TextArea``, ``TextSource``,
``TextEntrySet``, the ``treeview`` cell editor) and ``contenteditable``
elements always allow selection regardless.  Per-widget opt-in via
the new ``set_allow_text_selection(tf)`` method on the ``Widget``
base class (or via constructor option on ``TreeView`` / ``TableView``).

Other notable additions
-----------------------

- ``MenuAction`` ``activated`` callback signature simplified.  Old:
  ``handler(widget, text, checked)``.  New: ``handler(widget)`` for
  non-checkable actions; ``handler(widget, checked)`` for checkable
  ones.  The label can still be queried via ``widget.get_text()``.
  *This is a breaking change for any handler that took the text arg.*
- ``Button.set_color(bg)`` now uses the ``background`` shorthand so
  the requested colour shows through the new sculpted gradient and
  ``:hover`` / ``:active`` rules.  Pass an empty string to revert.
- New ``WindowMenu`` shared helper module powers both context menus.
- ``Widget`` base class now adds a ``pgwidgets-widget`` class to
  every widget element and exposes ``set_allow_text_selection``.
- Restyled widgets: sans-serif default, sculpted buttons, distinct
  slider/dial thumbs, etc.
- ``ScrollArea`` and ``AbstractScrollArea`` improvements; new
  ``set_thumb_percent`` API and shared scrollbar code.
- ``Box`` / ``GridBox`` layout fixes: rigid ``stretch=0`` children,
  cells that re-flow on resize, ``set_min_size`` / ``set_max_size``
  on layout containers.
- Reconstruction hardening: ``MenuBar`` menus rebuild correctly,
  ``TabWidget`` tab removal respects state, ``MDISubWindow`` is
  restored properly.
- ``ComboBox`` auto-selects the first item; dropdown raised above
  modal dialogs.
- ``StatusBar`` widget added; ``Label`` interactive + context menu.
- ``FixedLayout`` container added: places children at fixed
  ``(x, y)`` offsets at their natural size (or whatever
  ``resize()`` set).  See :ref:`widget-fixedlayout`.

Bug fixes
---------

- Sub-widgets created during a widget's constructor (e.g.
  ``ScrollBar`` instances inside ``TreeView``) no longer collide
  with later-allocated Python widget IDs.  ``_handleCreate`` now
  relocates a displaced occupant and reports the new
  ``next_wid`` to the Python side so future allocations skip past
  any auto-allocated IDs.  This was the cause of "callback fires on
  the wrong widget" reports.
