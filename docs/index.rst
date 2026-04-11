pgwidgets-js
============

A native JavaScript widget toolkit with Qt/GTK-style layout and controls.
No frameworks. No build step. No dependencies.

pgwidgets brings desktop-style UI controls to the browser. If you have used
Qt, GTK, or Tkinter, the API will feel familiar: create widgets, pack them
into layout containers, and wire up callbacks.

.. code-block:: javascript

   import { Widgets } from "./Widgets.js";

   let top = new Widgets.TopLevel({title: "Hello", resizable: true});
   top.resize(400, 300);

   let vbox = new Widgets.VBox();
   vbox.set_spacing(8);

   let label = new Widgets.Label("Click the button!");
   let button = new Widgets.Button("Click me");
   button.add_callback('activated', () => label.set_text("Clicked!"));

   vbox.add_widget(button, 0);
   vbox.add_widget(label, 1);
   top.set_widget(vbox);
   top.show();

.. toctree::
   :maxdepth: 2
   :caption: Contents

   getting-started
   widgets/index
   callbacks
   external-widgets
   remote
   pyodide
   electron
