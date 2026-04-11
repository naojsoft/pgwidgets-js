Remote Interface
================

pgwidgets can be controlled from a Python server over WebSocket using the
`pgwidgets-python <https://github.com/naojsoft/pgwidgets-python>`_ package.
The browser page connects to the server, which sends JSON messages to create
widgets, call methods, and receive callbacks.

Setup
-----

Install the Python remote package:

.. code-block:: bash

   pip install pgwidgets-python

Synchronous Example
-------------------

.. code-block:: python

   from pgwidgets.sync import Application

   app = Application()
   app.start()
   W = app.get_widgets()
   app.wait_for_connection()

   top = W.TopLevel(title="Remote App", resizable=True)
   top.resize(400, 300)

   vbox = W.VBox(spacing=8)
   btn = W.Button("Click me")
   status = W.Label("Ready")

   btn.on("activated", lambda: status.set_text("Clicked!"))

   vbox.add_widget(btn, 0)
   vbox.add_widget(status, 1)
   top.set_widget(vbox)
   top.show()

   app.run()

Async Example
-------------

.. code-block:: python

   import asyncio
   from pgwidgets.asynchronous import Application

   async def main():
       app = Application()
       await app.start()
       W = app.get_widgets()
       await app.wait_for_connection()

       top = W.TopLevel(title="Async App", resizable=True)
       top.resize(400, 300)

       vbox = W.VBox(spacing=8)
       btn = W.Button("Press me")
       label = W.Label("Waiting...")

       btn.on("activated", lambda: label.set_text("Pressed!"))

       vbox.add_widget(btn, 0)
       vbox.add_widget(label, 1)
       top.set_widget(vbox)
       top.show()

       await app.run()

   asyncio.run(main())

How It Works
------------

1. The Python server starts a WebSocket server.
2. The browser page includes ``Widgets.js`` and connects via the
   ``RemoteInterface`` class.
3. The Python side sends JSON commands (``create``, ``call``, ``destroy``)
   and the browser executes them.
4. When a widget fires a callback, the browser sends the event back over
   the WebSocket to the Python server.

The protocol is language-agnostic -- any WebSocket client that speaks the
JSON protocol can drive the UI.
