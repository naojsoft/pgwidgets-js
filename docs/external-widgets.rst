Embedding Third-Party Libraries
================================

pgwidgets provides an ``ExternalWidget`` class for embedding content from
third-party JavaScript libraries -- such as Plotly charts, Bokeh plots, or
Leaflet maps -- into pgwidgets layout containers.

ExternalWidget participates in pgwidgets layout like any other widget
(stretch factors, spacing, resize callbacks), but its content area is
managed by external code.

Basic Usage
-----------

Create an ``ExternalWidget``, add it to a container, and pass its content
element to the third-party library's rendering function:

.. code-block:: javascript

   let chart = new Widgets.ExternalWidget();
   vbox.add_widget(chart, 1);  // stretch=1 fills available space

   // Render into the content element
   SomeLibrary.render(chart.get_content_element(), data);

The content element is a ``<div>`` that fills the widget's area.  Use
``get_content_element()`` (not ``get_element()``) so that the outer wrapper
styling is preserved.

Handling Resize
^^^^^^^^^^^^^^^

The base ``Widget`` class installs a ``ResizeObserver`` that fires a
``resize`` callback whenever the widget's element changes size.  This is
useful for libraries that need explicit resize notification:

.. code-block:: javascript

   chart.add_callback('resize', (widget, width, height) => {
       SomeLibrary.resize(chart.get_content_element());
   });

Many libraries can also handle resize automatically when configured
correctly (see the Plotly and Bokeh examples below).


Using with Plotly
-----------------

`Plotly.js <https://plotly.com/javascript/>`_ is a high-level charting
library.  Include it from a CDN or install via npm.

.. code-block:: html

   <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>

Basic Example
^^^^^^^^^^^^^

.. code-block:: javascript

   import { Widgets } from "./Widgets.js";

   let top = new Widgets.TopLevel({title: "Plotly Demo", resizable: true});
   top.resize(700, 500);

   let vbox = new Widgets.VBox({spacing: 8, padding: 10});

   let label = new Widgets.Label("Plotly chart in a pgwidgets layout");

   let chart = new Widgets.ExternalWidget();

   vbox.add_widget(label, 0);
   vbox.add_widget(chart, 1);
   top.set_widget(vbox);
   top.show();

   // Render the Plotly chart
   let data = [{
       x: [1, 2, 3, 4, 5],
       y: [1, 4, 9, 16, 25],
       type: 'scatter',
       mode: 'lines+markers',
       name: 'y = x^2'
   }];

   let layout = {
       title: 'Simple Plot',
       margin: {l: 50, r: 20, t: 40, b: 40}
   };

   Plotly.newPlot(chart.get_content_element(), data, layout,
                  {responsive: true});

Setting ``responsive: true`` in the Plotly config causes it to track
its container's size automatically via its own ``ResizeObserver``.  No
manual resize wiring is needed.

Multiple Charts in a Splitter
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Because ``ExternalWidget`` is a regular pgwidgets widget, you can use it
with any layout container:

.. code-block:: javascript

   let splitter = new Widgets.Splitter({orientation: 'horizontal'});

   let left_chart = new Widgets.ExternalWidget();
   let right_chart = new Widgets.ExternalWidget();
   splitter.add_widget(left_chart, 1);
   splitter.add_widget(right_chart, 1);
   top.set_widget(splitter);
   top.show();

   Plotly.newPlot(left_chart.get_content_element(),
                  [{x: [1,2,3], y: [2,5,3], type: 'bar'}],
                  {title: 'Bar Chart', margin: {t: 40, b: 40}},
                  {responsive: true});

   Plotly.newPlot(right_chart.get_content_element(),
                  [{values: [30, 50, 20], labels: ['A','B','C'], type: 'pie'}],
                  {title: 'Pie Chart', margin: {t: 40, b: 40}},
                  {responsive: true});

When the user drags the splitter, both charts resize automatically.


Using with Bokeh
----------------

`Bokeh <https://bokeh.org>`_ is a Python-oriented visualization library
that also provides a standalone JavaScript API (BokehJS).  Include it
from a CDN:

.. code-block:: html

   <script src="https://cdn.bokeh.org/bokeh/release/bokeh-3.7.3.min.js"></script>
   <script src="https://cdn.bokeh.org/bokeh/release/bokeh-api-3.7.3.min.js"></script>

Basic Example
^^^^^^^^^^^^^

.. code-block:: javascript

   import { Widgets } from "./Widgets.js";

   let top = new Widgets.TopLevel({title: "Bokeh Demo", resizable: true});
   top.resize(700, 500);

   let vbox = new Widgets.VBox({spacing: 8, padding: 10});

   let label = new Widgets.Label("Bokeh chart in a pgwidgets layout");

   let chart = new Widgets.ExternalWidget();

   vbox.add_widget(label, 0);
   vbox.add_widget(chart, 1);
   top.set_widget(vbox);
   top.show();

   // Create a Bokeh figure using the BokehJS API
   let p = Bokeh.Plotting.figure({
       title: "Simple Plot",
       sizing_mode: "stretch_both",
       x_axis_label: "x",
       y_axis_label: "y",
   });

   p.line([1, 2, 3, 4, 5], [1, 4, 9, 16, 25],
          {legend_label: "y = x^2", line_width: 2});

   Bokeh.Plotting.show(p, chart.get_content_element());

Setting ``sizing_mode: "stretch_both"`` tells Bokeh to fill and track its
container element automatically.

Embedding from Python (Pyodide)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

When using pgwidgets with Pyodide, you can generate Bokeh plots in Python
and embed them into an ``ExternalWidget``:

.. code-block:: python

   from pgwidgets_js.pyodide import Widgets
   from bokeh.plotting import figure
   from bokeh.embed import components

   top = Widgets.TopLevel(title="Bokeh + Pyodide", resizable=True)
   top.resize(700, 500)

   vbox = Widgets.VBox(spacing=8, padding=10)
   chart = Widgets.ExternalWidget()
   vbox.add_widget(chart, 1)
   top.set_widget(vbox)
   top.show()

   # Create the Bokeh figure in Python
   p = figure(title="Sine Wave", sizing_mode="stretch_both")
   import numpy as np
   x = np.linspace(0, 10, 100)
   p.line(x, np.sin(x), line_width=2)

   # Embed into the ExternalWidget
   from js import Bokeh
   Bokeh.Plotting.show(p, chart.get_content_element())


Other Libraries
---------------

The same pattern works with any library that renders into a DOM element:

- **Leaflet** -- ``L.map(chart.get_content_element())``
- **D3** -- ``d3.select(chart.get_content_element()).append("svg")...``
- **Chart.js** -- append a ``<canvas>`` to the content element and pass it
  to ``new Chart(canvas, config)``
- **Three.js** -- ``renderer.domElement`` can be appended to the content
  element

For libraries that don't track container resize on their own, wire up the
``resize`` callback:

.. code-block:: javascript

   chart.add_callback('resize', (widget, width, height) => {
       myLibrary.resize(width, height);
   });
