Non-Visual Widgets
==================

.. _widget-timer:

Timer
-----

A non-visual timer object. Extends ``Callback`` directly (no DOM element).

**Constructor:** ``new Widgets.Timer({duration})``

**Options:**

- ``duration`` -- timer duration in seconds

**Methods:**

.. list-table::
   :header-rows: 1
   :widths: 40 60

   * - Method
     - Description
   * - ``start(duration)``
     - Start the timer. Optional *duration* overrides the default.
   * - ``stop()``
     - Stop the timer and fire ``expired``.
   * - ``cancel()``
     - Cancel the timer and fire ``cancelled``.
   * - ``is_set()``
     - Return whether the timer is running.
   * - ``elapsed_time()``
     - Return elapsed time in seconds.
   * - ``time_left()``
     - Return remaining time in seconds.
   * - ``set_duration(duration)``
     - Set default duration.
   * - ``get_duration()``
     - Return default duration.

**Callbacks:**

- ``expired`` -- fired when the timer completes.
- ``cancelled`` -- fired when the timer is cancelled.

.. code-block:: javascript

   let timer = new Widgets.Timer({duration: 5.0});
   timer.add_callback('expired', (w) => {
       console.log("Timer finished!");
   });
   timer.start();

   // Check status
   console.log("Running:", timer.is_set());
   console.log("Elapsed:", timer.elapsed_time());
