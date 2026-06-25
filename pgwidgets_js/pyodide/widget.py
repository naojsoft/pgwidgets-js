"""
Pyodide widget wrapper - provides Pythonic access to pgwidgets JS classes
running in the same browser context.
"""

from pyodide.ffi import create_proxy, to_js
from js import Object, Widgets

from pgwidgets_js.defs import (WIDGETS, WIDGET_METHODS, CONTAINER_METHODS,
                                CALLBACK_METHODS)

# Registry of built widget subclasses, keyed by JS class name.  Populated
# by build_widget_class().  Used by _from_js_val() so that a widget
# *returned* from a JS call is wrapped in its proper subclass (with the
# full method set) rather than a bare Widget shell.
_WIDGET_CLASSES = {}

# Registry of live widget *instances*, keyed by their JS ``wid``.
# Populated in Widget.__init__ and consulted by _from_js_val so that a
# widget crossing back from JS (e.g. the child delivered to a
# ``page-switch`` callback) resolves to its *original* Python wrapper --
# preserving object identity and any subclass mix-ins (e.g. Ginga's
# WidgetMixin, which adds ``extdata``).  Mirrors the wid->widget map the
# websocket backend keeps.  Entries are removed in destroy().
_WIDGET_INSTANCES = {}


def _wid_key(js_obj):
    """Return a stable dict key for a JS widget's ``wid`` (or None)."""
    try:
        wid = js_obj.wid
    except Exception:
        return None
    if wid is None:
        return None
    # normalize numeric wids (JS numbers may arrive as float)
    try:
        return int(wid)
    except (TypeError, ValueError):
        return wid


def _to_js_val(val):
    """Convert a Python value to a JS-compatible value.
    Widgets are unwrapped to their JS object, dicts/lists are deeply converted."""
    if isinstance(val, Widget):
        return val._js
    if isinstance(val, (bytes, bytearray, memoryview)):
        # Buffer-protocol types: convert to a real JS Uint8Array.
        # Without this, the value crosses the boundary as a PyProxy,
        # which breaks consumers like ``new Blob([buffer], …)`` in
        # Image.set_binary_image — the proxy gets stringified instead
        # of treated as bytes, producing a corrupt blob.
        return to_js(val)
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
    # Newer Pyodide maps JS ``null`` (and ``undefined``) to a ``JsNull``
    # sentinel rather than Python ``None``.  Normalize it so that callers'
    # ``x is None`` checks work (e.g. Menu.get_menu returning null).
    if type(val).__name__ in ('JsNull', 'JsUndefined'):
        return None
    # Detect JS Callback/Widget objects (they have 'add_callback' and 'wid')
    if hasattr(val, 'add_callback') and hasattr(val, 'wid'):
        # If this widget already has a Python wrapper (it was created on
        # the Python side), return that original object so identity and
        # subclass mix-ins (e.g. Ginga's WidgetMixin / extdata) survive
        # the round-trip through JS.
        existing = _WIDGET_INSTANCES.get(_wid_key(val))
        if existing is not None:
            return existing
        # Otherwise (a widget created purely in JS): wrap in the proper
        # built subclass when known, else fall back to a bare Widget.
        try:
            js_class_name = val.constructor.name
        except Exception:
            js_class_name = 'Widget'
        cls = _WIDGET_CLASSES.get(js_class_name, Widget)
        wrapper = object.__new__(cls)
        wrapper._js = val
        wrapper._js_class_name = js_class_name
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

        # Build JS constructor args.  Fill the declared positional slots
        # from positional args first, then from any same-named keyword
        # arg (e.g. ``Dialog(title=..., buttons=...)``); unfilled slots
        # are ``None`` placeholders.  Without the kwarg mapping such a
        # kwarg would be mistaken for a ``set_<name>`` setter call and
        # fail when no such setter exists.
        js_args = []
        for i, name in enumerate(pos_names):
            if i < len(args):
                js_args.append(args[i])
            elif name in kwargs:
                js_args.append(kwargs.pop(name))
            else:
                js_args.append(None)

        # Remaining positional args (beyond the declared slots) become
        # options, in declared order.
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

        # Convert args and build options object.  Keep the positional
        # slots when an options dict follows (so it lands after the last
        # positional arg, not in one); otherwise trim trailing None
        # placeholders.
        converted_args = [_to_js_val(a) for a in js_args]
        if options:
            converted_args.append(_to_js_val(options))
        else:
            while converted_args and converted_args[-1] is None:
                converted_args.pop()

        # Construct the JS widget
        js_class = getattr(Widgets, js_class_name)
        self._js = js_class.new(*converted_args)
        self._js_class_name = js_class_name
        self._proxies = []  # prevent GC of callback proxies

        # Register so this widget resolves back to *this* object when it
        # crosses the JS->Python boundary in a callback (see _from_js_val).
        key = _wid_key(self._js)
        if key is not None:
            _WIDGET_INSTANCES[key] = self

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
        # enable_callback first (mirrors the websocket RemoteInterface
        # path): besides registering the action it auto-wires DOM
        # listeners for drag/drop callbacks (see Widget.enable_callback).
        self._js.enable_callback(action)
        self._js.add_callback(action, proxy)

    def add_callback(self, action, handler, *extra_args, **extra_kwargs):
        """Register a callback. The handler receives
        (widget, *callback_args, *extra_args, **extra_kwargs)."""
        def wrapper(w, *args):
            py_args = [_from_js_val(a) for a in args]
            handler(self, *py_args, *extra_args, **extra_kwargs)
        proxy = create_proxy(wrapper)
        self._proxies.append(proxy)
        # enable_callback first (mirrors the websocket RemoteInterface
        # path): besides registering the action it auto-wires DOM
        # listeners for drag/drop callbacks (see Widget.enable_callback).
        self._js.enable_callback(action)
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

    def destroy(self):
        # drop our identity-registry entry, then destroy the JS widget
        try:
            _WIDGET_INSTANCES.pop(_wid_key(self._js), None)
        except Exception:
            pass
        self._call("destroy")

    def __repr__(self):
        return f"<{self._js_class_name}>"


def _make_method(method_name, param_names=()):
    """Create a method that calls through to the JS widget.

    Accepts either positional or keyword arguments — keyword args
    are bound by name using *param_names* (from defs.py) and
    appended in declared order.  This lets users write either
    ``box.add_widget(w, stretch=1)`` or ``box.add_widget(w, 1)``.
    """
    pnames = tuple(param_names)

    def method(self, *args, **kwargs):
        if not kwargs:
            return self._call(method_name, *args)
        # Map kwargs to positional slots by name.  Unknown kwargs
        # are an error (matches Python's normal call semantics).
        if not pnames:
            raise TypeError(
                f"{method_name}() takes no keyword arguments "
                f"(got {sorted(kwargs)!r})")
        result = list(args)
        used = set()
        for i, pname in enumerate(pnames):
            if i < len(args):
                if pname in kwargs:
                    raise TypeError(
                        f"{method_name}() got multiple values for "
                        f"argument {pname!r}")
                continue
            if pname in kwargs:
                result.append(kwargs[pname])
                used.add(pname)
        leftover = set(kwargs) - used
        if leftover:
            raise TypeError(
                f"{method_name}() got unexpected keyword "
                f"argument(s) {sorted(leftover)!r}")
        return self._call(method_name, *result)

    method.__name__ = method_name
    method.__qualname__ = f"Widget.{method_name}"
    return method


# Ensure the base Widget class implements *every* common widget method
# declared in WIDGET_METHODS, not just the hand-written subset above.
# This matters because widgets *returned* from a JS call may be wrapped
# in a bare Widget shell (see _from_js_val) when their JS constructor
# name does not match a built subclass (e.g. a minified CDN bundle); the
# bare shell must still expose set_tooltip, set_min_size, set_focus, etc.
for _mname, _params in WIDGET_METHODS.items():
    if not hasattr(Widget, _mname):
        setattr(Widget, _mname, _make_method(_mname, _params))


# Pyodide-specific overrides for methods whose Python-friendly
# signature differs from the underlying JS method, or that need
# special argument conversion.  Maps (js_class, method_name)
# -> python_function.  Currently empty: every method's args match
# directly between Python and JS.
CUSTOM_METHODS = {}


def build_widget_class(js_class, defn):
    """Build a Widget subclass from a definition."""
    attrs = {}

    # Pick the base-method set for this widget, mirroring how the
    # sync pgwidgets-python side does it: container widgets get the
    # full container API; callback-only widgets (Timer, FileDialog)
    # get a smaller set; everything else gets the standard Widget
    # API.  Without this, base methods like set_focus / set_tooltip
    # / set_min_size / set_allow_text_selection are missing on
    # subclasses.
    base = defn.get("base")
    if base == "container":
        base_methods = CONTAINER_METHODS
    elif base == "callback":
        base_methods = CALLBACK_METHODS
    else:
        base_methods = WIDGET_METHODS

    # Generate wrappers for every base method that isn't already
    # explicitly defined on Widget.  Per-widget entries override.
    for method_name, param_names in base_methods.items():
        if method_name in attrs:
            continue
        # Skip names already defined as real methods on Widget.
        if hasattr(Widget, method_name) and not method_name.startswith("_"):
            continue
        attrs[method_name] = _make_method(method_name, param_names)

    # Add per-widget methods (override any base entries with same name).
    for method_name, param_names in defn.get("methods", {}).items():
        attrs[method_name] = _make_method(method_name, param_names)

    # Apply pyodide-specific custom overrides last (e.g. methods whose
    # Python signature differs from the underlying JS signature).
    for (wc, mn), func in CUSTOM_METHODS.items():
        if wc == js_class:
            attrs[mn] = func

    # Custom __init__ that passes the class name
    def __init__(self, *args, **kwargs):
        Widget.__init__(self, js_class, *args, **kwargs)
    attrs["__init__"] = __init__

    # expose the definition so callers can introspect declared callbacks
    # (mirrors the sync backend): ginga's has_callback() consults
    # ``_defn["callbacks"]`` to decide whether to wire e.g. 'page-close'
    attrs["_defn"] = defn

    cls = type(js_class, (Widget,), attrs)
    # register so widgets returned from JS calls can be wrapped in their
    # proper subclass (see _from_js_val)
    _WIDGET_CLASSES[js_class] = cls
    return cls


def build_all_widget_classes():
    """Build all widget classes from definitions. Returns a dict."""
    classes = {}
    for js_class, defn in WIDGETS.items():
        classes[js_class] = build_widget_class(js_class, defn)
    return classes
