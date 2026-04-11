Getting Started
===============

Installation
------------

Standalone (no tooling)
^^^^^^^^^^^^^^^^^^^^^^^

Copy the repository and include it directly in your HTML:

.. code-block:: html

   <link rel="stylesheet" href="path/to/Widgets.css" />
   <script type="module">
     import { Widgets } from "path/to/Widgets.js";
     // ...
   </script>

npm
^^^

.. code-block:: bash

   npm install pgwidgets
   # or install directly from GitHub:
   npm install github:naojsoft/pgwidgets

Then in your bundled app:

.. code-block:: javascript

   import { Widgets } from "pgwidgets";
   import "pgwidgets/Widgets.css";

pip (Python asset package)
^^^^^^^^^^^^^^^^^^^^^^^^^^

The ``pgwidgets-js`` package on PyPI distributes the JavaScript assets for
use with Python servers (e.g. the remote WebSocket interface):

.. code-block:: bash

   pip install pgwidgets-js

Basic Usage
-----------

Every pgwidgets application follows the same pattern:

1. Create a top-level window.
2. Create layout containers and widgets.
3. Add widgets to containers.
4. Wire up callbacks.
5. Show the window.

.. code-block:: javascript

   import { Widgets } from "./Widgets.js";

   // 1. Top-level window
   let top = new Widgets.TopLevel({title: "My App", resizable: true});
   top.resize(500, 400);

   // 2. Layout + widgets
   let vbox = new Widgets.VBox();
   vbox.set_spacing(8);
   vbox.set_padding(10);

   let label = new Widgets.Label("Hello, world!");
   let button = new Widgets.Button("Press me");

   // 3. Pack
   vbox.add_widget(label, 0);
   vbox.add_widget(button, 0);
   top.set_widget(vbox);

   // 4. Callbacks
   button.add_callback('activated', (widget) => {
       label.set_text("Button was pressed!");
   });

   // 5. Show
   top.show();

Running the Examples
--------------------

Start a local web server from the repository root:

.. code-block:: bash

   python -m http.server --bind localhost 8000

Then open any example in your browser:

- ``http://localhost:8000/examples/all_widgets.html`` -- MDI workspace showcasing every widget
- ``http://localhost:8000/examples/all_widgets_pyodide.html`` -- Same demo via Pyodide
- ``http://localhost:8000/examples/all_widgets_pyscript.html`` -- Same demo via PyScript
- ``http://localhost:8000/examples/pyodide_demo.html`` -- Minimal Pyodide example
- ``http://localhost:8000/examples/treeview.html`` -- TreeView with icons and sorting
- ``http://localhost:8000/examples/mdi_widget.html`` -- MDI with cascade/tile
- ``http://localhost:8000/examples/dialog.html`` -- Modal and non-modal dialogs
- ``http://localhost:8000/examples/colordialog.html`` -- Color picker dialog
- ``http://localhost:8000/examples/combobox.html`` -- ComboBox variants
- ``http://localhost:8000/examples/splitter.html`` -- Resizable split panes
- ``http://localhost:8000/examples/tab_widget.html`` -- Tabbed interface

Building Desktop Apps with Electron
------------------------------------

pgwidgets runs unchanged inside an Electron renderer process, letting you
ship native desktop apps.  See :doc:`electron` for a full guide including
packaging for distribution.
