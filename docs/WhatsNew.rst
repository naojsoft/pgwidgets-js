What's New
==========

Recent changes — since ``v0.3.0``
---------------------------------

Custom fonts: ``register-font`` / ``set-default-font``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Two new remote-protocol message types let the Python side push
custom font files to the browser and apply a document-wide
default font.

* ``register-font`` -- the JS handler creates a ``FontFace``,
  awaits its ``load()``, and adds it to ``document.fonts``,
  after which any widget ``set_font(family, ...)`` resolves
  against it.  The accompanying ``url`` is resolved against
  ``window.location.href`` so the same path works under the
  built-in HTTP server, Flask / nginx, and pyodide.
* ``set-default-font`` -- manages a single
  ``<style id="pg-default-font">`` element on ``<head>`` that
  writes ``--pg-default-font-{family,size,weight,style}`` CSS
  variables on ``:root``.  The base ``body`` rule consumes
  those variables with safe fallbacks
  (``sans-serif`` / ``13px`` / ``normal`` / ``normal``), so
  apps that never opt in see no behavioural change.  Per-
  widget ``set_font(...)`` still wins via inline-style
  specificity.

Weight / style normalisation in the JS handler translates
descriptive TTF metadata names -- ``thin``, ``light``,
``medium``, ``semibold``, ``extrabold``, ``black``, ``heavy``,
etc. -- to the numeric CSS values per the CSS Fonts spec, so
fonts shipped with descriptive weight names load without
raising ``Invalid font descriptor`` errors.  Numeric strings
and valid CSS keywords pass through unchanged.

See :ref:`custom-fonts` for the matching Python-side API.

TreeView: column-boundary alignment
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Three related fixes keep the header columns pinned to the body
columns in every case:

* ``_syncScrollbars`` writes ``this._header.style.width =
  this._body.scrollWidth`` so ``1fr`` grid units resolve to
  identical pixel widths in the header and body grids -- a
  body grown to ``max-content`` by wide row content no longer
  drifts wider than the header.
* ``_gridTemplate`` wraps every ``fr`` track in
  ``minmax(0, fr)``.  Without it a single widget cell whose
  content can't shrink (a ``<button>Reset</button>`` or
  ``<select>``) forces its column wider than the matching
  empty-content header track; ``minmax(0, fr)`` lets the
  ``fr`` distribution dominate.  Oversize content is clipped
  by the cell's own ``overflow: hidden``.
* ``_setupColumnResize`` lowers the minimum drag width from
  30 px to 5 px so genuinely small icon / checkbox columns
  (``colwidth: 10`` and similar) can be resized instead of
  inflating to 30 the moment a drag starts.

Image (animation-frame): wrapper div
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Animation-frame ``Image`` mode wraps its canvas in a
``<div class="image-widget">`` and positions the canvas
``absolute; inset: 0; width: 100%; height: 100%``.  The wrapper
sits in the layout chain like any plain block, and absolutely-
positioned children contribute zero to their parent's
auto-resolved size -- so writing ``canvas.width`` /
``canvas.height`` in the resize callback (which the browser
mirrors back as an ``aspect-ratio: auto W/H`` presentational
hint) can no longer feed back into layout.  Resolves the
runaway-vertical-growth feedback loop that ``contain: size`` on
a bare canvas couldn't fully gate.

The wrapper has no width/height of its own -- callers must
give it size via ``set_expanding(True, True)``, packing with
``stretch > 0``, or ``resize(w, h)``.

Box / Widget: respect user-set min sizes
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``Box._applyBoxChildSizing`` (in the ``stretch > 0`` and
``mainExpand`` branches) and ``Widget.set_expanding`` were
both writing ``min-width: 0`` / ``min-height: 0`` unconditionally
to override the browser's default ``min: auto`` on flex items.
Either of them running second silently erased a floor declared
via ``set_min_size``.  Both call sites now guard with
``if (!s.minWidth) s.minWidth = '0'`` so user-set mins survive
regardless of call order.

TreeView / TableView: widget-typed cells
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Column descriptors gained an optional ``widget`` field that
swaps a column's plain-text cells for a real DOM input element:

* ``"checkbox"`` -- ``<input type="checkbox">`` bound to a
  boolean cell value;
* ``"combobox"`` -- ``<select>`` populated from a ``choices``
  array;
* ``"progress"`` -- ``<progress>`` driven by ``min`` / ``max``
  (read-only);
* ``"button"`` -- ``<button>`` whose label is the cell value
  (or the column's ``text`` fallback).

Editable widget cells fire ``cell_edited(widget, path, col_key,
old, new)``; buttons fire a new ``cell_action(widget,
row_values, col_key)`` callback.  Two more column-descriptor
keys gate the per-row widget by row-dict field name:
``enabled_key`` (greys the widget out when the named field is
falsy) and ``visible_key`` (suppresses the widget entirely on
that row -- the cell stays empty).

.. code-block:: javascript

   table.set_columns([
       {label: "Name", key: "NAME", type: "string"},
       {label: "Done", key: "DONE", type: "bool",
        widget: "checkbox", enabled_key: "CAN_EDIT"},
       {label: "",     key: "GO",   type: "string",
        widget: "button", text: "Open",
        visible_key: "OPENABLE"},
   ]);

Cell / row / column / table colour overrides
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Four new override layers paint cells without touching the
underlying data: ``set_cell_color(path, col_key, fg, bg, bold)``,
``set_row_color(path, fg, bg, bold)``, ``set_column_color(col_key,
fg, bg, bold)``, and ``set_table_color(fg, bg, bold)``.
Specificity cascades cell → row → column → table per-channel,
so a row-level fg + column-level bg compose into the same
cell.  Each method also accepts an optional ``bold`` argument
that toggles the cell font weight.

Matching ``clear_*_color`` helpers and ``clear_all_colors()``
drop overrides at any layer.

Cell-level selection and clipboard
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

TreeView / TableView gained two new ``selection_mode`` values --
``"single-cell"`` and ``"multiple-cell"`` -- that let the user
select individual cells rather than whole rows.  Cell selections
fire a new ``cell_selected`` callback with the list of selected
``{path, col_key, value}`` cells.

Widget-level Ctrl/Cmd+C/X/V keyboard handlers feed three new
callbacks: ``copy``, ``cut``, ``paste``.  The
``copy_selection`` / ``cut_selection`` / ``paste_selection``
methods do the same programmatically.  Cell-mode cuts emit a
TSV payload built from the selected cells; row mode emits the
whole row.

``activated`` callback now reports the clicked column
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The ``activated`` callback signature gained a 4th argument:
``(widget, values, path, col_key)``.  Handlers that destructure
the first three keep working; new code can branch on which
column the user double-clicked.

Widget: ``set_bg`` + Label: ``set_valign``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Two small style helpers:

* ``Widget.set_bg(color)`` on the base class -- generic
  background-colour setter, accepts a CSS string or ``null``
  to clear.  Works on transparent containers (Box / Grid /
  ScrollArea) too.
* ``Label.set_valign(align)`` -- ``"top"`` / ``"center"`` /
  ``"bottom"`` vertical placement of the label text within
  whatever vertical space the parent allocates.  Only visible
  when the label is given more height than its text needs.

Box: ``set_align`` (cross-axis)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Boxes (and the ``HBox`` / ``VBox`` shortcuts) gained a single
orientation-aware ``set_align(align)`` method controlling the
cross-axis placement of children:

* horizontal box → ``"top"`` / ``"center"`` / ``"bottom"``;
* vertical box   → ``"left"`` / ``"center"`` / ``"right"``.

Mismatched names raise.  Maps to flex ``align-items`` on the
box element.

----

Recent changes — since ``v0.2.3``
---------------------------------

Chunked binary transport (both directions, raw frames)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The remote interface gained a unified chunked binary transport
that works in both directions and ships raw binary WebSocket
frames by default.  A new ``binary-call-chunked`` announce opens
a transfer; subsequent ``binary-chunk`` messages each carry a
JSON header plus one raw binary frame (or, optionally, an
inline base64 payload).  Optional ``shape`` + ``dtype`` fields on
the announce promote the reassembled payload from a raw
``ArrayBuffer`` to a typed array (``Uint8Array``,
``Float32Array``, …) before dispatch — the JS-side companion to
pgwidgets-python's new :class:`pgwidgets.Buffer` descriptor.

The browser-side file upload path was migrated to the same
envelope.  Drag-and-drop and ``FileDialog`` now read files with
``readAsArrayBuffer`` instead of ``readAsDataURL`` and ship the
bytes via binary frames; the ``payload.files[i].data`` field is
now an ``ArrayBuffer`` (JavaScript side) / ``bytes`` (Python
side) rather than a ``"data:<mime>;base64,…"`` string.  Each
file dict carries an explicit ``encoding`` field (currently
always ``"bytes"``; reserved for future ``"base64"``) so
receivers can branch on it.

**Pre-1.0 API break**: any drop or FileDialog handler that did
``base64.b64decode(data.split(",", 1)[1])`` should now just use
``data`` directly.

Constructor-bind hack removed
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The legacy ``this.foo = this.foo.bind(this)`` constructor lines
were removed from every widget module — 443 line deletions
across 48 files.  The codebase never relied on bare method
references (DOM handlers etc. use arrow wrappers), so the
preemptive binding was redundant.  A handful of places that
*did* register handlers via ``addEventListener("event",
this.method)`` were converted to class-field arrow methods
(``onMouseMove = (e) => { ... }``) so the handler identity is
stable per instance — critical for the paired
``removeEventListener`` to find the same function.

**Pre-1.0 API break**: code outside the library that passed a
pgwidgets method as a bare reference (``setTimeout(button.set_text,
0)``, ``el.addEventListener("click", widget.foo)``, etc.) must
now wrap with an arrow at the call site (``() =>
button.set_text(s)``) or apply ``.bind`` itself.

Wid-collision fix in ``_handleCreate``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

When a class registered in ``classMap`` doesn't extend
``Callback`` (e.g. a plain JS class layered on top of
pgwidgets-js — gingajs's ``Controller`` is one), its constructor
doesn't allocate a wid.  The next widget's ``super()`` would
then auto-assign a wid that the previous Python-allocated widget
was sitting at, silently overwriting it in the registry.
Two complementary safeguards:

- ``_handleCreate`` now bumps ``Callback._nextId`` past
  ``msg.wid`` *before* calling ``new cls(...)``.
- ``Callback``'s constructor skips occupied registry slots when
  allocating, as a defensive backstop.

A binding that only ever uses classes which extend ``Callback``
is safe without either mitigation, but having both removes a
whole class of mysterious "Unknown widget id" errors.

TreeView: per-column ``colwidth``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Column descriptors accept an optional ``colwidth`` field set
initial column widths declaratively::

    tree.set_columns([
        {label: "Name", key: "NAME", type: "string", colwidth: 240},
        {label: "Type", key: "TYPE", type: "string", colwidth: "10em"},
        {label: "Size", key: "SIZE", type: "integer"},   // -> 1fr
    ])

Numbers are treated as pixels; strings pass through as CSS grid
track values.  Columns without ``colwidth`` keep the previous
default of ``"1fr"``.  ``set_column_width(key, w)`` continues to
work for runtime adjustments.

Other improvements
~~~~~~~~~~~~~~~~~~

- ``TextSource`` gained internal ``_setCursorOffset`` /
  ``_setSelectionOffsets`` helpers used by the ref-binding
  machinery on reconstruction.
- For-developers documentation expanded: the "Things That Will
  Bite You" section now covers the wid-collision rule, the
  ``encoding`` field on chunks, atomic chunk emission, indexed
  reassembly, dtype-falls-back-to-ArrayBuffer, and the
  ``f.data``-is-bytes API break.

----

Recent changes — since ``v0.2.1``
---------------------------------

TextSource: TextBufferRef objects replace raw offsets
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

``TextSource`` and ``TextArea`` (which embeds a ``TextSource``) now
take and return ``TextBufferRef`` objects in place of raw character
offsets.  A ref tracks a position in the buffer as edits happen
around it, so a cursor or selection endpoint stays attached to "the
character it was on" rather than being silently shifted by an
unrelated insert.

``TextBufferRef`` is itself a ``Callback`` subclass with a wid, so
refs are first-class objects that cross the WebSocket wire.  This
lets the Python binding return refs from ``create_ref`` /
``get_cursor`` / ``set_cursor`` and pass them straight into other
methods.  Named refs (``create_ref("bookmark1", ...)``) make it
easy to revisit a tracked location, and unused refs are reclaimed
via weak-reference tracking.

New ``TextBufferRef`` navigation / mutation methods include
``next_char``, ``prev_char``, ``next_word``, ``prev_word``,
``line_start``, ``line_end``, ``insert``, ``delete_forward``,
``delete_backward``, and comparison helpers.

Widget: ``map`` lifecycle callback
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Every visual widget now fires a one-shot ``map`` callback the first
time it gains a non-zero visible box on the page.  This is the
right hook for code that needs the widget's real laid-out size
before it can run — for example, generating a server-side bitmap
that exactly matches an ``Image`` widget's flex-allocated size.

``map`` fires reliably across reconnection / reconstruction.  The
``RemoteInterface`` keeps two ``requestAnimationFrame`` backstops
at the end of reconstruction: a visibility-aware re-check, and a
force-fire pass for widgets in detached subtrees (e.g. inactive
``TabWidget`` pages) so handlers run even before the user opens
that tab.

``set_expanding(horizontal, vertical)``
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

New base-class size policy method, mirroring Qt's
``QSizePolicy::Expanding``.  A widget with ``set_expanding(True,
True)`` will fill the available space along both axes inside a
flex container.

Image: native-resolution rendering, no drawImage scaling
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

In ``use_animation_frame`` mode the canvas drawing-buffer is now
pinned to the image's natural size and ``drawImage`` runs at native
scale.  The browser's CSS-box scaling handles display sizing
without us re-encoding pixels — so a server-generated image that
was rendered to match the widget's reported size never gets
re-scaled into a mismatched aspect ratio.

``set_min_size`` / ``set_max_size`` work again in animation mode,
and the canvas can shrink inside a flex container (``min-width:
0``).  After reconstruction, a synthetic ``resize`` and
``area-resize`` are fired at the final layout-settled size so
handlers that regenerate sized content catch up.

Other improvements
~~~~~~~~~~~~~~~~~~

- ``Menu`` popup z-index raised to ``1000000`` so popups stay above
  any ``TopLevel`` that has been ``raise_()``-d a few times
  (``raise_()`` assigns ``max + 1`` across all ``document.body``
  children, including open menus, so a small menu z-index could
  eventually be overtaken).
- ``RadioButton`` defaults to ``sans-serif`` to match
  ``Label`` / ``Menu`` / ``ToolBar`` / ``StatusBar`` / etc.
- New documentation page: :doc:`for-developers`, aimed at someone
  implementing a new language binding or transport.  Covers the
  WebSocket message protocol, serialization rules, widget identity
  and creation, callback subscription, server-side state tracking,
  and the full step-by-step of reconstruction (including the
  subtle passive-vs-user-set-state distinction).
- New project logo.

----

Earlier — since ``v0.1.2``
--------------------------

Major changes
~~~~~~~~~~~~~

TreeView: dict-tree model with stable key paths
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

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
""""""""""""""""""""""""""""

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
"""""""""""""

Within a row, a column whose key is missing (or whose value is
``null``/``undefined``) is "absent" and the preceding present cell
extends across it via CSS grid spans.  Explicit empty strings still
render as their own (empty) cell.  This lets parent rows be terse:
``{NAME: "Documents"}`` with the rest of the columns omitted
renders as a single cell across the row.

New tree methods
""""""""""""""""

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
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

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
""""""""""""""""""""""""""""""""""

Both ``TopLevel`` and ``MDISubWindow`` show a context menu on
right-click of the title bar.  Items are gated by the relevant
options (Raise is always shown; Lower / Shade / Minimize / Maximize
/ Close appear when the corresponding option is enabled).  The menu
supports both click-release and press-drag-release styles, like a
menubar.  Drag (title bar) and resize (corner grips) are now
restricted to the left mouse button so right- and middle-click
gestures don't accidentally move or resize the window.

Image: binary-frame protocol
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

``Image.set_binary_image(format, buffer)`` accepts raw bytes from a
WebSocket binary frame and renders them via a ``Blob`` of the
matching MIME type (``"jpeg"`` / ``"png"`` / ``"webp"`` / ``"gif"``).
This avoids the ~33% base64 overhead of the JSON ``set_image`` path
and is intended for streaming use cases (animation, video frames,
etc.).  The Python side's binding stores the latest frame so it is
replayed on reconnect.

Browser text-select disabled by default
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Drag-to-highlight inside widgets is now disabled by default — it
interferes with row click/drag, shift-click range select, etc.
Form controls (``TextEntry``, ``TextArea``, ``TextSource``,
``TextEntrySet``, the ``treeview`` cell editor) and ``contenteditable``
elements always allow selection regardless.  Per-widget opt-in via
the new ``set_allow_text_selection(tf)`` method on the ``Widget``
base class (or via constructor option on ``TreeView`` / ``TableView``).

Other notable additions
~~~~~~~~~~~~~~~~~~~~~~~

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
~~~~~~~~~

- Sub-widgets created during a widget's constructor (e.g.
  ``ScrollBar`` instances inside ``TreeView``) no longer collide
  with later-allocated Python widget IDs.  ``_handleCreate`` now
  relocates a displaced occupant and reports the new
  ``next_wid`` to the Python side so future allocations skip past
  any auto-allocated IDs.  This was the cause of "callback fires on
  the wrong widget" reports.
