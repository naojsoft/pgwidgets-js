Widget Reference
================

pgwidgets provides a comprehensive set of widgets organized into the
following categories.

Every visual widget inherits from ``Widget``, which provides common methods
for sizing, visibility, fonts, borders, cursors, and tooltips. Every object
(visual or not) inherits from ``Callback``, which provides the event system.

Common Widget Methods
---------------------

All visual widgets support these methods from the ``Widget`` base class:

.. list-table::
   :header-rows: 1
   :widths: 35 65

   * - Method
     - Description
   * - ``resize(width, height)``
     - Set widget size in pixels
   * - ``get_size()``
     - Return current ``[width, height]``
   * - ``set_min_size(width, height)``
     - Set minimum size in pixels.  Pass ``None`` for either
       dimension to leave that constraint unset.
   * - ``set_max_size(width, height)``
     - Set maximum size in pixels.  Pass ``None`` for either
       dimension to leave that constraint unset.
   * - ``set_expanding(horizontal, vertical)``
     - Declare that this widget should expand into available space
       along the given axis/axes (analogous to Qt's
       ``QSizePolicy.Expanding``).  Both default to ``False``.  See
       :ref:`expanding-size-policy` for details and interaction with
       ``Box``'s ``stretch`` parameter.
   * - ``show()`` / ``hide()``
     - Show or hide the widget
   * - ``is_visible()``
     - Return visibility state
   * - ``set_enabled(tf)`` / ``get_enabled()``
     - Enable or disable the widget
   * - ``set_tooltip(msg)`` / ``get_tooltip()``
     - Set or get tooltip text
   * - ``set_font(font, size, weight, style)``
     - Set font properties
   * - ``set_border_width(width)``
     - Set border width in pixels
   * - ``set_border_color(color)``
     - Set border color
   * - ``set_padding(padding)``
     - Set internal padding
   * - ``set_focus()``
     - Give keyboard focus to this widget
   * - ``set_allow_text_selection(tf)``
     - Allow or disallow browser text-select (drag-to-highlight)
       inside this widget.  Off by default for most widgets.
       Form controls (``TextEntry``, ``TextArea``, etc.) and the
       ``treeview`` cell editor always allow selection regardless.
   * - ``add_cursor(name, url, hotspot_x, hotspot_y, size)``
     - Register a custom cursor
   * - ``set_cursor(name)``
     - Activate a registered cursor
   * - ``get_element()``
     - Return the underlying DOM element
   * - ``destroy()``
     - Remove the widget and clean up

Container widgets additionally support ``get_children()``.

.. toctree::
   :maxdepth: 1
   :caption: Categories

   layout
   controls
   text
   display
   menus
   dialogs
   nonvisual
