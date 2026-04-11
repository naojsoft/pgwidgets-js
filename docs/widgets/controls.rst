Control Widgets
===============

.. _widget-button:

Button
------

Push button with optional icon.

**Constructor:** ``new Widgets.Button(text)``

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_text(text)``
     - Set button label.
   * - ``set_icon(url, size)``
     - Set button icon from image URL.
   * - ``set_color(bg, fg)``
     - Set background and foreground colors.

**Callbacks:**

- ``activated`` -- fired when the button is clicked.

.. code-block:: javascript

   let btn = new Widgets.Button("Save");
   btn.set_icon("icons/save.svg", 16);
   btn.add_callback('activated', (w) => save());

.. _widget-togglebutton:

ToggleButton
------------

Two-state button. Supports exclusive groups.

**Constructor:** ``new Widgets.ToggleButton(text, {group})``

**Options:**

- ``group`` -- group name for mutual exclusion

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_text(text)``
     - Set button label.
   * - ``set_state(value)``
     - Set toggle state (``true``/``false``).
   * - ``get_state()``
     - Return current state.

**Callbacks:**

- ``activated`` -- fired when state changes.

.. code-block:: javascript

   let bold = new Widgets.ToggleButton("B", {group: "format"});
   let italic = new Widgets.ToggleButton("I", {group: "format"});
   bold.add_callback('activated', (w) => {
       console.log("Bold:", w.get_state());
   });

.. _widget-checkbox:

CheckBox
--------

Checkbox with label.

**Constructor:** ``new Widgets.CheckBox(text)``

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_state(tf)``
     - Set checked state.
   * - ``get_state()``
     - Return checked state.

**Callbacks:**

- ``activated`` -- fired when state changes.

.. code-block:: javascript

   let cb = new Widgets.CheckBox("Enable notifications");
   cb.add_callback('activated', (w) => {
       console.log("Checked:", w.get_state());
   });

.. _widget-radiobutton:

RadioButton
-----------

Radio button with exclusive group support.

**Constructor:** ``new Widgets.RadioButton(text, {group})``

**Options:**

- ``group`` -- group name for mutual exclusion

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_text(text)``
     - Set label text.
   * - ``set_state(value)``
     - Set selected state.
   * - ``get_state()``
     - Return selected state.

**Callbacks:**

- ``activated`` -- fired when selection changes.

.. _widget-combobox:

ComboBox
--------

Dropdown with optional editable text, filtering, and scroll limit.

**Constructor:** ``new Widgets.ComboBox({editable, dropdown_limit})``

**Options:**

- ``editable`` -- allow typing in the text field
- ``dropdown_limit`` -- max visible items before scrolling

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``append_text(text)``
     - Add an item to the end.
   * - ``insert_alpha(text)``
     - Insert item in alphabetical order.
   * - ``delete_alpha(text)``
     - Remove item by text.
   * - ``set_text(text)``
     - Set current text/selection.
   * - ``get_text()``
     - Return current text.
   * - ``set_index(idx)``
     - Select item by index.
   * - ``get_index()``
     - Return selected index.
   * - ``get_alpha(idx)``
     - Return text at index.
   * - ``clear()``
     - Remove all items.
   * - ``set_length(numchars)``
     - Set display width in characters.

**Callbacks:**

- ``activated`` -- fired when selection changes.

.. code-block:: javascript

   let combo = new Widgets.ComboBox({editable: false});
   combo.append_text("Option A");
   combo.append_text("Option B");
   combo.set_index(0);
   combo.add_callback('activated', (w) => {
       console.log("Selected:", w.get_text());
   });

.. _widget-slider:

Slider
------

Range slider (integer or float).

**Constructor:** ``new Widgets.Slider({orientation, track, dtype, min, max, step, value, show_value})``

**Options:**

- ``orientation`` -- ``"horizontal"`` or ``"vertical"``
- ``track`` -- continuous tracking while dragging
- ``dtype`` -- ``"int"`` or ``"float"``
- ``min``, ``max``, ``step`` -- range limits and step size
- ``value`` -- initial value
- ``show_value`` -- display the current value

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_value(num)``
     - Set current value.
   * - ``get_value()``
     - Return current value.
   * - ``set_limits(minval, maxval, incrval)``
     - Set range and step.
   * - ``set_tracking(track)``
     - Enable/disable continuous tracking.

**Callbacks:**

- ``activated`` -- fired when value changes.

.. code-block:: javascript

   let slider = new Widgets.Slider({min: 0, max: 100, value: 50});
   slider.add_callback('activated', (w) => {
       console.log("Value:", w.get_value());
   });

.. _widget-spinbox:

SpinBox
-------

Numeric input with increment/decrement buttons.

**Constructor:** ``new Widgets.SpinBox({dtype, min, max, step, value, decimals})``

**Options:**

- ``dtype`` -- ``"int"`` or ``"float"``
- ``min``, ``max``, ``step`` -- range limits and step size
- ``value`` -- initial value
- ``decimals`` -- decimal places to display

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_value(val)``
     - Set current value.
   * - ``get_value()``
     - Return current value.
   * - ``set_limits(minval, maxval, incrval)``
     - Set range and step.
   * - ``set_decimals(num)``
     - Set decimal places.

**Callbacks:**

- ``activated`` -- fired when value changes.

.. _widget-dial:

Dial
----

Rotary knob control.

**Constructor:** ``new Widgets.Dial({track, dtype, min, max, step, value})``

**Options:**

- ``track`` -- continuous tracking while dragging
- ``dtype`` -- ``"int"`` or ``"float"``
- ``min``, ``max``, ``step`` -- range limits and step size
- ``value`` -- initial value

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_value(num)``
     - Set current value.
   * - ``get_value()``
     - Return current value.
   * - ``set_limits(minval, maxval, incrval)``
     - Set range and step.
   * - ``set_tracking(track)``
     - Enable/disable continuous tracking.
   * - ``set_knob_diameter(len_px)``
     - Set knob diameter in pixels.
   * - ``set_icon(url, size)``
     - Set a custom icon on the knob.

**Callbacks:**

- ``activated`` -- fired when value changes.

.. _widget-scrollbar:

ScrollBar
---------

Standalone scrollbar with draggable thumb.

**Constructor:** ``new Widgets.ScrollBar({orientation, thickness})``

**Options:**

- ``orientation`` -- ``"horizontal"`` or ``"vertical"``
- ``thickness`` -- scrollbar thickness in pixels

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_scroll_percent(pct)``
     - Set scroll position (0--1).
   * - ``get_scroll_percent()``
     - Return scroll position.
   * - ``set_thumb_width(pct)``
     - Set thumb width as fraction (0--1).

**Callbacks:**

- ``activated`` -- fired when scroll position changes.

.. _widget-progressbar:

ProgressBar
-----------

Determinate progress indicator.

**Constructor:** ``new Widgets.ProgressBar()``

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``set_value(value)``
     - Set progress (0--1).
   * - ``get_value()``
     - Return current progress.

**Callbacks:** None.

.. code-block:: javascript

   let progress = new Widgets.ProgressBar();
   progress.set_value(0.75);  // 75%
