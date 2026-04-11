"""
Pyodide widget wrapper - provides Pythonic access to pgwidgets JS classes
running in the same browser context.
"""

from pyodide.ffi import create_proxy, to_js
from js import Object, Widgets

from pgwidgets_js.defs import WIDGETS


def _to_js_val(val):
    """Convert a Python value to a JS-compatible value.
    Widgets are unwrapped to their JS object, dicts/lists are deeply converted."""
    if isinstance(val, Widget):
        return val._js
    if isinstance(val, dict):
        converted = {k: _to_js_val(v) for k, v in val.items()}
        return to_js(converted, dict_converter=Object.fromEntries)
    if isinstance(val, (list, tuple)):
        return to_js([_to_js_val(v) for v in val])
    return val


def _from_js_val(val):
    """Convert a JS return value back to Python.
    JS Widget instances are wrapped in a Python Widget shell."""
    if val is None or val is Widgets:
        return val
    # Detect JS Callback/Widget objects (they have 'add_callback' and 'wid')
    if hasattr(val, 'add_callback') and hasattr(val, 'wid'):
        wrapper = object.__new__(Widget)
        wrapper._js = val
        try:
            wrapper._js_class_name = val.constructor.name
        except Exception:
            wrapper._js_class_name = 'Widget'
        wrapper._proxies = []
        return wrapper
    # Check if it's a JsProxy with .to_py()
    if hasattr(val, 'to_py'):
        try:
            return val.to_py()
        except Exception:
            return val
    return val


class Widget:
    """Base class for all Pyodide widget wrappers."""

    def __init__(self, js_class_name, *args, **kwargs):
        defn = WIDGETS.get(js_class_name, {})
        pos_names = defn.get("args", [])
        opt_names = defn.get("options", [])

        # Build JS constructor args
        js_args = list(args[:len(pos_names)])

        # Remaining positional args become options
        for i, val in enumerate(args[len(pos_names):]):
            if i < len(opt_names):
                kwargs[opt_names[i]] = val

        # Separate options kwargs from setter kwargs
        options = {}
        setter_kwargs = {}
        for k, v in kwargs.items():
            if k in opt_names:
                options[k] = v
            else:
                setter_kwargs[k] = v

        # Convert args and build options object
        converted_args = [_to_js_val(a) for a in js_args]
        if options:
            converted_args.append(_to_js_val(options))

        # Construct the JS widget
        js_class = getattr(Widgets, js_class_name)
        self._js = js_class.new(*converted_args)
        self._js_class_name = js_class_name
        self._proxies = []  # prevent GC of callback proxies

        # Apply remaining kwargs as setter calls
        for k, v in setter_kwargs.items():
            setter = f"set_{k}"
            if hasattr(self._js, setter):
                getattr(self._js, setter)(_to_js_val(v))
            else:
                raise TypeError(
                    f"{js_class_name}() got unexpected keyword "
                    f"argument '{k}'")

    def _call(self, method, *args):
        """Call a method on the JS widget."""
        converted = [_to_js_val(a) for a in args]
        result = getattr(self._js, method)(*converted)
        return _from_js_val(result)

    def on(self, action, handler, *extra_args, **extra_kwargs):
        """Register a callback. The handler receives
        (*callback_args, *extra_args, **extra_kwargs) - no widget arg."""
        def wrapper(w, *args):
            py_args = [_from_js_val(a) for a in args]
            handler(*py_args, *extra_args, **extra_kwargs)
        proxy = create_proxy(wrapper)
        self._proxies.append(proxy)
        self._js.add_callback(action, proxy)

    def add_callback(self, action, handler, *extra_args, **extra_kwargs):
        """Register a callback. The handler receives
        (widget, *callback_args, *extra_args, **extra_kwargs)."""
        def wrapper(w, *args):
            py_args = [_from_js_val(a) for a in args]
            handler(self, *py_args, *extra_args, **extra_kwargs)
        proxy = create_proxy(wrapper)
        self._proxies.append(proxy)
        self._js.add_callback(action, proxy)

    # -- Common Widget methods --

    def get_element(self):
        return self._js.get_element()

    def set_border_width(self, width):
        self._call("set_border_width", width)

    def set_border_color(self, color):
        self._call("set_border_color", color)

    def resize(self, width, height):
        self._call("resize", width, height)

    def get_size(self):
        return self._call("get_size")

    def set_padding(self, padding):
        self._call("set_padding", padding)

    def set_font(self, font, size=None, weight=None, style=None):
        self._call("set_font", font, size, weight, style)

    def set_enabled(self, tf):
        self._call("set_enabled", tf)

    def get_enabled(self):
        return self._call("get_enabled")

    def show(self):
        self._call("show")

    def hide(self):
        self._call("hide")

    def is_visible(self):
        return self._call("is_visible")

    def __repr__(self):
        return f"<{self._js_class_name}>"


def _make_method(method_name):
    """Create a method that calls through to the JS widget."""
    def method(self, *args):
        return self._call(method_name, *args)
    method.__name__ = method_name
    method.__qualname__ = f"Widget.{method_name}"
    return method


def build_widget_class(js_class, defn):
    """Build a Widget subclass from a definition."""
    attrs = {}

    # Add specific methods from the definition
    for method_name in defn.get("methods", {}):
        attrs[method_name] = _make_method(method_name)

    # Custom __init__ that passes the class name
    def __init__(self, *args, **kwargs):
        Widget.__init__(self, js_class, *args, **kwargs)
    attrs["__init__"] = __init__

    cls = type(js_class, (Widget,), attrs)
    return cls


def build_all_widget_classes():
    """Build all widget classes from definitions. Returns a dict."""
    classes = {}
    for js_class, defn in WIDGETS.items():
        classes[js_class] = build_widget_class(js_class, defn)
    return classes
