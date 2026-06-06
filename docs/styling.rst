Styling with CSS
================

pgwidgets uses standard CSS classes for all widget styling.  You can
customize the appearance of widgets by overriding these classes in your
own stylesheet.


Widget CSS Classes
------------------

Each widget type has its own CSS class name:

.. list-table::
   :header-rows: 1
   :widths: 30 30

   * - Widget
     - CSS Class
   * - Label
     - ``.label-widget``
   * - Button
     - ``.button-widget``
   * - TextEntry
     - ``.text-entry-widget``
   * - TextArea
     - ``.textarea-widget``
   * - VBox
     - ``.vbox-container``
   * - HBox
     - ``.hbox-container``
   * - Splitter
     - ``.splitter-widget``
   * - TabWidget
     - ``.tab-widget``
   * - CheckBox
     - ``.checkbox-widget``
   * - Slider
     - ``.slider-widget``
   * - ProgressBar
     - ``.progress-bar-widget``
   * - TreeView
     - ``.treeview-widget``

The full set of classes can be found in the individual CSS files under
``css/``.


Customizing Defaults
--------------------

Override the CSS classes to change the default appearance of all instances
of a widget type:

.. code-block:: css

   /* Round all buttons and change the default color */
   .button-widget {
       border-radius: 8px;
       background-color: #336699;
       color: white;
   }

   /* Add a subtle shadow to all labels */
   .label-widget {
       text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
   }

   /* Custom scrollbar thumb color */
   .scrollbar-thumb {
       background-color: #888;
       border-radius: 4px;
   }

You can also target specific widgets by adding your own CSS class or ID
to the widget's element:

.. code-block:: javascript

   let btn = new Widgets.Button("Special");
   btn.get_element().classList.add('my-special-button');

.. code-block:: css

   .my-special-button {
       background: linear-gradient(135deg, #667eea, #764ba2);
       color: white;
   }


Programmatic Style Overrides
-----------------------------

pgwidgets provides methods like ``set_color()``, ``set_font()``,
``set_border_width()``, ``resize()``, and ``set_padding()`` that set
**inline styles** on the widget's DOM element.  Inline styles have the
highest CSS specificity, so they override any CSS class rules.

This means:

- CSS classes control the **default** appearance.
- Programmatic methods override **per-instance** when called.

For example:

.. code-block:: css

   /* This sets the default label color */
   .label-widget {
       color: navy;
   }

.. code-block:: javascript

   let a = new Widgets.Label("Uses CSS default");  // navy text
   let b = new Widgets.Label("Overridden");
   b.set_color(null, "red");  // inline style wins — red text

**Properties not set by any programmatic method** are always safe to
style via CSS.  These include ``border-radius``, ``box-shadow``,
``transition``, ``opacity``, ``text-transform``, ``letter-spacing``,
``cursor``, and many others.

The following properties **can** be set by programmatic methods and will
override CSS when called:

.. list-table::
   :header-rows: 1
   :widths: 35 35

   * - Method
     - CSS Properties Affected
   * - ``set_color(bg, fg)``
     - ``background-color``, ``color``
   * - ``set_bg(color)``
     - ``background-color`` (base-class helper; ``null`` clears
       the override)
   * - ``Label.set_valign(align)``
     - ``display: flex; flex-direction: column; justify-content:
       flex-start | center | flex-end`` -- vertical placement
       of the label text
   * - ``Box.set_align(align)``
     - ``align-items`` (cross-axis alignment of Box children;
       orientation-aware)
   * - ``set_font(family, size, weight, style)``
     - ``font-family``, ``font-size``, ``font-weight``, ``font-style``
   * - ``set_border_width(w)``
     - ``border-width``, ``border-style``
   * - ``set_border_color(c)``
     - ``border-color``
   * - ``resize(w, h)``
     - ``width``, ``height``
   * - ``set_min_size(w, h)``
     - ``min-width``, ``min-height`` (``None`` clears that side)
   * - ``set_max_size(w, h)``
     - ``max-width``, ``max-height`` (``None`` clears that side)
   * - ``set_expanding(h, v)``
     - ``flex``, ``align-self``, ``width``/``height`` on the
       requested axes (see :ref:`expanding-size-policy`)
   * - ``set_padding(p)``
     - ``padding``
   * - ``show()`` / ``hide()``
     - ``display``

If you need to override an inline style from CSS, ``!important`` will
work but should be used sparingly:

.. code-block:: css

   /* Force all labels to be navy, even after set_color() */
   .label-widget {
       color: navy !important;
   }

A better approach is to avoid mixing CSS and programmatic styles for the
same property -- use CSS for global theming and programmatic methods for
dynamic per-widget changes.


.. _custom-fonts:

Custom Fonts
------------

Two new application-level methods (added since v0.3.0) let the
Python side push custom font files to the browser and apply a
document-wide default font.  The mechanism is the
``FontFace`` API + ``document.fonts.add()`` plus a small
managed ``<style>`` element that writes CSS variables on
``:root``.

Registering a font
~~~~~~~~~~~~~~~~~~

.. code-block:: python

   app.register_font('Roboto', '/path/to/Roboto-Regular.ttf')
   app.register_font('Roboto', '/path/to/Roboto-Bold.ttf',
                     weight='bold')
   app.register_font('Roboto', '/path/to/Roboto-Italic.ttf',
                     style='italic')

* ``family`` is the CSS ``font-family`` name you'll reference
  from widget ``set_font(...)`` calls or from CSS.  Names are
  passed through verbatim -- pick any case convention and stay
  consistent.
* ``source`` is a path (``str`` or ``os.PathLike``) or raw
  ``bytes`` (e.g. ``font_path.read_bytes()`` or an in-memory
  font from another library).
* ``weight`` accepts CSS keywords (``'normal'``, ``'bold'``,
  ``'bolder'``, ``'lighter'``) or numeric strings (``'100'``
  through ``'1000'``).  The JS handler also translates common
  TTF metadata names like ``thin``, ``light``, ``medium``,
  ``semibold``, ``extrabold``, ``black``, ``heavy``, etc. to
  their numeric equivalents per the CSS Fonts spec, so passing
  weights straight from a font registry usually Just Works.
* ``style`` accepts ``'normal'``, ``'italic'``, or
  ``'oblique'`` (synonyms like ``'roman'`` / ``'slanted'`` get
  normalised too).

Multiple registrations against the same ``family`` with
different ``weight`` / ``style`` combine into a single CSS
font-family with multiple faces -- exactly the same way an
``@font-face`` author would express it.

The bytes are served via the built-in HTTP server at
``/_pgwidgets/font/<id>`` with a long ``Cache-Control:
immutable`` header.  When pgwidgets is embedded behind a Flask
/ nginx stack, the route is served from the same Python process
so it passes through naturally; under pyodide the URL is
relative to ``window.location.href``.

Default font
~~~~~~~~~~~~

.. code-block:: python

   app.set_default_font('Roboto', size=13)

Writes ``--pg-default-font-family``,
``--pg-default-font-size``, ``--pg-default-font-weight`` and
``--pg-default-font-style`` CSS variables on ``:root`` (via a
managed ``<style id="pg-default-font">`` element).  The base
widget stylesheet consumes them on ``body``::

   body {
       font-family: var(--pg-default-font-family, sans-serif);
       font-size:   var(--pg-default-font-size,   13px);
       font-weight: var(--pg-default-font-weight, normal);
       font-style:  var(--pg-default-font-style,  normal);
   }

Anything that doesn't set a font of its own inherits the
default.  Per-widget ``set_font(...)`` still wins via
inline-style specificity, and the fallback values in the
``var(...)`` calls are what you get when ``set_default_font``
is never called -- so existing apps see no behavioural change.

Pass ``family=None`` to clear the default and fall back to the
stylesheet values.

Reconstruction
~~~~~~~~~~~~~~

Font registrations are replayed to every new and reconnecting
session before ``on_connect`` / ``reconstruct`` runs, so a
widget reconstructed with ``set_font(family, ...)`` always
finds the face already declared.

Caveats
~~~~~~~

* Browsers may render fallback text in the brief window
  between the ``register-font`` message arriving and
  ``face.load()`` resolving (standard FOUT behaviour).  For
  most apps this flash is invisible; if it matters you can
  ``await document.fonts.ready`` in your bootstrap.
* The bytes are kept in memory on the Python side for the
  lifetime of the ``Application``.  A 200 KiB TTF is fine; a
  4 MiB color-emoji set might warrant chunking or on-disk
  caching.


Handling CSS Conflicts with Other Libraries
-------------------------------------------

pgwidgets CSS classes are specific (e.g. ``.splitter-widget``,
``.vbox-container``), so direct class name collisions with other libraries
are unlikely.

The more common issue is **broad CSS resets** from other frameworks
(Bootstrap, Tailwind, Normalize.css, etc.) that apply rules to bare
elements like ``div``, ``input``, ``button``, or ``*``.  These can
affect pgwidgets elements in subtle ways -- unexpected margins, different
``box-sizing``, altered font sizes.

Strategies for handling conflicts:

1. **Load order** -- load pgwidgets CSS *after* the framework's CSS so
   that pgwidgets rules take precedence for equal specificity.

2. **CSS layers** -- modern browsers support ``@layer`` to control
   cascade priority:

   .. code-block:: css

      @layer framework, pgwidgets;

      @layer framework {
          @import "bootstrap.min.css";
      }

      @layer pgwidgets {
          @import "Widgets.css";
      }

   Rules in the ``pgwidgets`` layer will always beat the ``framework``
   layer regardless of specificity.

3. **Shadow DOM** -- for full isolation, mount pgwidgets inside a shadow
   root.  No styles leak in or out.  See :doc:`frameworks` for an
   example.

4. **Scoped container** -- reset inherited styles at the pgwidgets
   mount point:

   .. code-block:: css

      .pgwidgets-root {
          all: initial;
          font-family: sans-serif;
          font-size: 14px;
      }

   This prevents the host page's styles from cascading into the
   pgwidgets subtree.

In practice, most integrations work without any special handling.  Try
it first and address specific conflicts as they arise.
