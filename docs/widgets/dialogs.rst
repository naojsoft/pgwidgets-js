Dialog Widgets
==============

.. _widget-dialog:

Dialog
------

Modal or non-modal dialog with configurable buttons.

**Constructor:** ``new Widgets.Dialog(title, buttons, {autoclose, resizable, moveable, modal})``

**Arguments:**

- ``title`` -- dialog title
- ``buttons`` -- array of button labels (e.g. ``["OK", "Cancel"]``)

**Options:**

- ``autoclose`` -- close dialog when a button is pressed
- ``resizable`` -- allow resizing
- ``moveable`` -- allow dragging
- ``modal`` -- modal overlay

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``get_content_area()``
     - Return the content container to add widgets into.

**Callbacks:**

- ``activated`` -- fired with the button label when a button is pressed.

.. code-block:: javascript

   let dlg = new Widgets.Dialog("Confirm", ["OK", "Cancel"], {
       modal: true, autoclose: true
   });
   dlg.resize(300, 150);

   let content = dlg.get_content_area();
   let label = new Widgets.Label("Are you sure?");
   content.add_widget(label, 1);

   dlg.add_callback('activated', (w, btn) => {
       console.log("User chose:", btn);
   });
   dlg.show();

.. _widget-colordialog:

ColorDialog
-----------

Color picker dialog with SV plane, hue strip, and RGB/HSV/hex inputs.

**Constructor:** ``new Widgets.ColorDialog({color, title, modal, moveable})``

**Options:**

- ``color`` -- initial color as hex string
- ``title`` -- dialog title
- ``modal`` -- modal overlay
- ``moveable`` -- allow dragging

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``get_color()``
     - Return selected color as hex string.
   * - ``set_color(hex_string)``
     - Set the current color.

**Callbacks:**

- ``activated`` -- fired when OK/Cancel is pressed.
- ``pick`` -- fired when the color changes interactively.

.. code-block:: javascript

   let picker = new Widgets.ColorDialog({color: "#ff6600", modal: true});
   picker.add_callback('activated', (w, btn) => {
       if (btn === "OK") {
           console.log("Chosen color:", w.get_color());
       }
   });
   picker.show();

.. _widget-filedialog:

FileDialog
----------

File open/save dialog. Uses the browser's native file picker for opening
and programmatic download for saving. This is a non-visual (Callback-based)
object.

**Constructor:** ``new Widgets.FileDialog({mode, accept})``

**Options:**

- ``mode`` -- ``"open"`` or ``"save"``
- ``accept`` -- file type filter (e.g. ``".png,.jpg,image/*"``)

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 45 55

   * - Method
     - Description
   * - ``open()``
     - Show the file-open picker.
   * - ``save(filename, data, mime_type)``
     - Trigger a file download.
   * - ``set_mode(mode)`` / ``get_mode()``
     - Set or get mode.
   * - ``set_accept(accept)`` / ``get_accept()``
     - Set or get file type filter.

**Callbacks:**

- ``activated`` -- fired when a file is selected (open) or saved.
- ``progress`` -- fired with progress updates during file reading.

.. code-block:: javascript

   let fd = new Widgets.FileDialog({mode: "open", accept: ".txt,.csv"});
   fd.add_callback('activated', (w, fileData) => {
       console.log("File loaded:", fileData.name);
   });
   fd.open();
