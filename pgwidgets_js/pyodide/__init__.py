"""
pgwidgets Pyodide bindings - use pgwidgets directly in Pyodide (browser).

No WebSocket server needed. Widgets are created as JS objects in the
same browser context.

Usage:
    from pgwidgets_js.pyodide import TopLevel, VBox, Button, Label

    top = TopLevel(title="Hello", resizable=True)
    top.resize(400, 300)

    vbox = VBox(spacing=8)
    btn = Button("Click me")
    label = Label("Hello from Pyodide!")

    btn.on("activated", lambda: label.set_text("Clicked!"))

    vbox.add_widget(btn, 0)
    vbox.add_widget(label, 1)
    top.set_widget(vbox)
    top.show()
"""

from pgwidgets_js.pyodide.widget import build_all_widget_classes, Widget

# Build and export all widget classes at module level
_classes = build_all_widget_classes()
globals().update(_classes)

__all__ = list(_classes.keys()) + ["Widget"]
