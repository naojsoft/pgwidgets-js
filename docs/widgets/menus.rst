Menu & Toolbar Widgets
======================

``MenuBar``, ``Menu`` and ``ToolBar`` are container widgets: the menu
actions, submenus and toolbar items they hold (added via ``add_name`` /
``add_menu`` / ``add_action`` / ``add_widget``) are reported by the
standard container API -- ``get_children()`` / ``num_children()`` /
``remove(...)``.  Separators and spacers are not widgets and are not
included.

.. _widget-menubar:

MenuBar
-------

Horizontal menu bar, typically placed at the top of a window.

**Constructor:** ``new Widgets.MenuBar()``

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``add_menu(menu, name)``
     - Add a Menu with a display name.
   * - ``add_name(name)``
     - Add a menu by name (creates and returns a new Menu).
   * - ``get_menu(name)``
     - Return the Menu object for a given name.

**Callbacks:** None.

.. code-block:: javascript

   let menubar = new Widgets.MenuBar();
   let fileMenu = menubar.add_name("File");
   fileMenu.add_name("Open");
   fileMenu.add_name("Save");
   fileMenu.add_separator();
   fileMenu.add_name("Quit");

.. _widget-menu:

Menu
----

Dropdown menu with actions, sub-menus, and separators.

**Constructor:** ``new Widgets.Menu()``

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``add_widget(child)``
     - Add a MenuAction or other widget.
   * - ``add_name(name, checkable)``
     - Add a named action (returns the MenuAction).
   * - ``add_menu(name, menu)``
     - Add a sub-menu.
   * - ``add_separator()``
     - Add a visual separator.
   * - ``popup()``
     - Show as a context menu at the current pointer position.

**Callbacks:** None.

.. code-block:: javascript

   let menu = new Widgets.Menu();
   let openAction = menu.add_name("Open");
   openAction.add_callback('activated', (w) => openFile());
   menu.add_separator();
   let checkItem = menu.add_name("Auto-save", true);

.. _widget-menuaction:

MenuAction
----------

A single action item inside a Menu.

**Constructor:** ``new Widgets.MenuAction({text, icon_url, iconsize, checkable, name})``

**Options:**

- ``text`` -- display text
- ``icon_url`` -- icon image URL
- ``iconsize`` -- icon size in pixels
- ``checkable`` -- whether the action has a check state
- ``name`` -- internal name

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_text(text)`` / ``get_text()``
     - Set or get display text.
   * - ``set_icon(url, iconsize)``
     - Set icon.
   * - ``set_checked(checked)`` / ``get_checked()``
     - Set or get check state (if checkable).

**Callbacks:**

- ``activated`` -- fired when the action is clicked.  Handler
  signature is ``handler(widget)`` for non-checkable actions and
  ``handler(widget, checked)`` for checkable ones (the boolean is
  the new checked state).

.. _widget-toolbar:

ToolBar
-------

Toolbar with buttons, toggles, spacers, and separators.

**Constructor:** ``new Widgets.ToolBar({orientation})``

**Options:**

- ``orientation`` -- ``"horizontal"`` (default) or ``"vertical"``

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``add_widget(child)``
     - Add any widget to the toolbar.
   * - ``add_separator()``
     - Add a visual separator.
   * - ``add_spacer()``
     - Add a flexible spacer.
   * - ``add_action(options)``
     - Add a ToolBarAction (returns the action).

**Callbacks:** None.

.. code-block:: javascript

   let toolbar = new Widgets.ToolBar();
   let newBtn = toolbar.add_action({text: "New", icon_url: "icons/new.svg"});
   toolbar.add_separator();
   let boldBtn = toolbar.add_action({text: "B", toggle: true, group: "fmt"});

.. _widget-toolbaraction:

ToolBarAction
-------------

A button/toggle inside a ToolBar.

**Constructor:** ``new Widgets.ToolBarAction({text, icon_url, iconsize, toggle, group})``

**Options:**

- ``text`` -- display text
- ``icon_url`` -- icon image URL
- ``iconsize`` -- icon size in pixels
- ``toggle`` -- two-state toggle mode
- ``group`` -- exclusive group name

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_text(text)`` / ``get_text()``
     - Set or get display text.
   * - ``set_icon(url, iconsize)``
     - Set icon.
   * - ``set_state(value)`` / ``get_state()``
     - Set or get toggle state.

**Callbacks:**

- ``activated`` -- fired when the action is clicked or toggled.
