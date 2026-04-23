Callback System
===============

Every pgwidgets object inherits from the ``Callback`` base class, which
provides a consistent event system across all widgets.

Core API
--------

``enable_callback(action)``
    Register a new callback action type on this object. Widgets call this
    internally for their supported actions.

``add_callback(action, cb_fn)``
    Add a listener for *action*. The function receives ``(widget, ...args)``
    when triggered. Throws if *action* has not been enabled.

``remove_callback(action, cb_fn)``
    Remove a previously added listener.

``clear_callback(action)``
    Remove all listeners for *action*.

``make_callback(action, ...args)``
    Fire all listeners for *action*, passing *args* after the widget reference.
    Widgets call this internally when events occur.

``has_callback(action)``
    Returns ``true`` if *action* has been enabled on this object.

Example
-------

.. code-block:: javascript

   let button = new Widgets.Button("Click me");

   // add_callback: first arg is always the widget itself
   button.add_callback('activated', (widget) => {
       console.log("Button clicked!", widget.wid);
   });

   // Multiple listeners on the same action
   button.add_callback('activated', (widget) => {
       document.title = "Clicked!";
   });

   // Remove a specific listener
   function myHandler(widget) { /* ... */ }
   button.add_callback('activated', myHandler);
   button.remove_callback('activated', myHandler);

Common Callbacks
----------------

All visual widgets support:

- **resize** -- fired as ``(widget, width_px, height_px)`` whenever the
  widget's size changes.
- **child-added** -- fired on container widgets when a child is added.
- **child-removed** -- fired on container widgets when a child is removed.

Interactive widgets (Image, Canvas) support pointer and keyboard events:

- **pointer-down**, **pointer-up**, **pointer-move** -- mouse/touch events
- **enter**, **leave** -- pointer enters/leaves the widget
- **click**, **dblclick** -- click events
- **scroll** -- scroll wheel
- **key-down**, **key-up**, **key-press** -- keyboard events
- **focus-in**, **focus-out** -- focus changes
- **contextmenu** -- right-click context menu

Drop Events
-----------

Image and Canvas widgets support drag-and-drop file events:

- **drop-start** -- a file drop has begun
- **drop-progress** -- progress update during file reading
- **drop-end** -- file data is available
- **drag-over** -- a dragged item is hovering over the widget

Widget-Specific Callbacks
-------------------------

Each widget documents its own callback actions. Common patterns:

- **activated** -- the primary action (button click, value change, selection)
- **page-switch** -- tab, stack, or MDI page changed
- **page-close** -- tab or MDI sub-window closed
- **expired**, **cancelled** -- timer events
- **pick** -- color selected
- **changed**, **cursor_moved** -- text editor events
- **child-added** -- child widget added to a container
- **child-removed** -- child widget removed from a container
- **sizing** -- splitter pane sizes changed
- **toggled** -- expander collapsed/expanded
- **scrolled** -- scroll position changed (ScrollArea, MDIWidget)
- **cell_edited** -- table/tree cell edited by user

See the individual widget reference pages for the full list of callbacks
each widget supports.
