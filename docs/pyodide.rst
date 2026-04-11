Using with Pyodide / PyScript
=============================

pgwidgets can be used directly from Python in the browser via
`Pyodide <https://pyodide.org>`_ or `PyScript <https://pyscript.net>`_.
The ``pgwidgets_js.pyodide`` module provides Pythonic wrappers with normal
construction syntax, automatic type conversion, and callback management.

No WebSocket server is needed -- everything runs in the browser.

Pyodide Example
---------------

.. code-block:: python

   from pgwidgets_js.pyodide import Widgets

   top = Widgets.TopLevel(title="Hello", resizable=True)
   top.resize(400, 300)

   vbox = Widgets.VBox(spacing=8, padding=10)

   label = Widgets.Label("Click the button!")
   button = Widgets.Button("Click me")
   button.on("activated", lambda: label.set_text("Clicked!"))

   vbox.add_widget(button, 0)
   vbox.add_widget(label, 1)
   top.set_widget(vbox)
   top.show()

HTML Loader (Pyodide)
---------------------

.. code-block:: html

   <!DOCTYPE html>
   <html>
   <head>
     <link rel="stylesheet" href="Widgets.css" />
     <script src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"></script>
   </head>
   <body>
     <script type="module">
       let pyodide = await loadPyodide();
       await pyodide.loadPackage("micropip");
       let micropip = pyodide.pyimport("micropip");
       await micropip.install("pgwidgets-js");

       await pyodide.runPythonAsync(`
         from pgwidgets_js.pyodide import Widgets
         # ... your app code here ...
       `);
     </script>
   </body>
   </html>

HTML Loader (PyScript)
----------------------

.. code-block:: text

   <!DOCTYPE html>
   <html>
   <head>
     <link rel="stylesheet" href="Widgets.css" />
     <link rel="stylesheet" href="https://pyscript.net/releases/2024.1.1/core.css" />
     <script type="module" src="https://pyscript.net/releases/2024.1.1/core.js"></script>
   </head>
   <body>
     <script type="py">
       from pgwidgets_js.pyodide import Widgets
       # ... your app code here ...
     </script>
   </body>
   </html>

API Differences
---------------

The Pyodide wrappers mirror the JavaScript API with a few Pythonic
conveniences:

- Constructor options are passed as keyword arguments:
  ``Widgets.TopLevel(title="Hello", resizable=True)``
- Use ``widget.on(action, callback)`` as a shorthand for ``add_callback``
- Python lambdas and functions work directly as callbacks -- no manual
  proxy creation needed

The same Python code works with both Pyodide and PyScript; only the HTML
loader differs. See ``examples/pyodide_demo.html`` for a minimal example
and ``examples/all_widgets_pyodide.html`` for a full demo.
