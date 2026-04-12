"""
pgwidgets Pyodide bindings - use pgwidgets directly in Pyodide (browser).

No WebSocket server needed. Widgets are created as JS objects in the
same browser context.

Usage:
    from pgwidgets_js.pyodide import Widgets

    top = Widgets.TopLevel(title="Hello", resizable=True)
    top.resize(400, 300)

    vbox = Widgets.VBox(spacing=8)
    btn = Widgets.Button("Click me")
    label = Widgets.Label("Hello from Pyodide!")

    btn.on("activated", lambda: label.set_text("Clicked!"))

    vbox.add_widget(btn, 0)
    vbox.add_widget(label, 1)
    top.set_widget(vbox)
    top.show()
"""

from pgwidgets_js.pyodide.widget import build_all_widget_classes, Widget  # noqa: F401

# Build and export all widget classes at module level
_classes = build_all_widget_classes()
globals().update(_classes)


class _WidgetNamespace:
    """Namespace that exposes all widget classes as attributes,
    e.g. Widgets.MenuBar(), Widgets.Button("OK")."""
    pass


Widgets = _WidgetNamespace()
for _name, _cls in _classes.items():
    setattr(Widgets, _name, _cls)

__all__ = list(_classes.keys()) + ["Widget", "Widgets"]
