"""Logging utilities for code running under Pyodide.

Python's default ``StreamHandler`` writes to ``sys.stderr``, which in
the browser ends up in pyodide's hidden buffer rather than the
DevTools console.  ``JsConsoleHandler`` routes records to the
matching ``console.*`` method instead, so log levels keep their
visual styling (red for errors, yellow for warnings, etc.) and the
records show up in the place a developer is already watching.

Typical use::

    import logging
    from pgwidgets_js.pyodide.log import JsConsoleHandler

    logger = logging.getLogger("myapp")
    logger.addHandler(JsConsoleHandler())
    logger.setLevel(logging.DEBUG)
"""

import logging

from js import console


class JsConsoleHandler(logging.Handler):
    """Route Python log records to the matching JS console.* method."""

    def emit(self, record):
        try:
            msg = self.format(record)
        except Exception:
            self.handleError(record)
            return
        if record.levelno >= logging.ERROR:
            console.error(msg)
        elif record.levelno >= logging.WARNING:
            console.warn(msg)
        elif record.levelno >= logging.INFO:
            console.info(msg)
        else:
            console.debug(msg)
