Integrating with Web Frameworks
================================

pgwidgets widgets are standard DOM elements and can be embedded in any
web framework.  Every widget exposes its root DOM element via
``get_element()``, which you can append to whatever container the framework
provides.

The key points:

- **Skip TopLevel** -- ``TopLevel``, ``Dialog``, and ``Page`` use absolute
  positioning for free-floating windows.  All other widgets (layout
  containers, controls, display widgets) use normal CSS flow/flexbox and
  embed naturally.
- **Mount on init, destroy on teardown** -- append
  ``widget.get_element()`` when the component mounts, call
  ``widget.destroy()`` when it unmounts.
- **Load Widgets.css** -- the pgwidgets stylesheet must be available on the
  page (see :doc:`styling` for notes on CSS conflicts).


Vanilla JavaScript
------------------

Without any framework, mount a pgwidgets tree into any element:

.. code-block:: javascript

   import { Widgets } from "./Widgets.js";

   let vbox = new Widgets.VBox({spacing: 8, padding: 10});
   let btn = new Widgets.Button("Click me");
   let label = new Widgets.Label("Ready");
   btn.add_callback('activated', () => label.set_text("Clicked!"));

   vbox.add_widget(btn, 0);
   vbox.add_widget(label, 0);

   document.getElementById('my-container').appendChild(vbox.get_element());


React
-----

Use a ``ref`` to get the mount point and ``useEffect`` for lifecycle
management:

.. code-block:: jsx

   import { useRef, useEffect } from "react";
   import { Widgets } from "pgwidgets";

   export default function PGWidgetsPanel() {
       const containerRef = useRef(null);

       useEffect(() => {
           let vbox = new Widgets.VBox({spacing: 8, padding: 10});
           let btn = new Widgets.Button("Click me");
           let label = new Widgets.Label("Ready");
           btn.add_callback('activated', () => label.set_text("Clicked!"));

           vbox.add_widget(btn, 0);
           vbox.add_widget(label, 0);

           containerRef.current.appendChild(vbox.get_element());

           return () => vbox.destroy();  // cleanup on unmount
       }, []);

       return <div ref={containerRef} />;
   }


Vue
---

Use a template ref with ``onMounted`` / ``onUnmounted``:

.. code-block:: html

   <template>
     <div ref="container"></div>
   </template>

   <script setup>
   import { ref, onMounted, onUnmounted } from "vue";
   import { Widgets } from "pgwidgets";

   const container = ref(null);
   let vbox = null;

   onMounted(() => {
       vbox = new Widgets.VBox({spacing: 8, padding: 10});
       let btn = new Widgets.Button("Click me");
       let label = new Widgets.Label("Ready");
       btn.add_callback("activated", () => label.set_text("Clicked!"));

       vbox.add_widget(btn, 0);
       vbox.add_widget(label, 0);

       container.value.appendChild(vbox.get_element());
   });

   onUnmounted(() => {
       if (vbox) vbox.destroy();
   });
   </script>


Angular
-------

Use ``ViewChild`` to access the mount element:

.. code-block:: typescript

   import { Component, ViewChild, ElementRef,
            AfterViewInit, OnDestroy } from "@angular/core";
   import { Widgets } from "pgwidgets";

   @Component({
       selector: "app-pgwidgets-panel",
       template: '<div #pgContainer></div>',
   })
   export class PGWidgetsPanelComponent implements AfterViewInit, OnDestroy {
       @ViewChild("pgContainer") container!: ElementRef;
       private vbox: any;

       ngAfterViewInit() {
           this.vbox = new Widgets.VBox({spacing: 8, padding: 10});
           let btn = new Widgets.Button("Click me");
           let label = new Widgets.Label("Ready");
           btn.add_callback("activated", () => label.set_text("Clicked!"));

           this.vbox.add_widget(btn, 0);
           this.vbox.add_widget(label, 0);

           this.container.nativeElement.appendChild(this.vbox.get_element());
       }

       ngOnDestroy() {
           if (this.vbox) this.vbox.destroy();
       }
   }


Svelte
------

Use ``bind:this`` and Svelte's lifecycle functions:

.. code-block:: html

   <script>
   import { onMount, onDestroy } from "svelte";
   import { Widgets } from "pgwidgets";

   let container;
   let vbox;

   onMount(() => {
       vbox = new Widgets.VBox({spacing: 8, padding: 10});
       let btn = new Widgets.Button("Click me");
       let label = new Widgets.Label("Ready");
       btn.add_callback("activated", () => label.set_text("Clicked!"));

       vbox.add_widget(btn, 0);
       vbox.add_widget(label, 0);

       container.appendChild(vbox.get_element());
   });

   onDestroy(() => {
       if (vbox) vbox.destroy();
   });
   </script>

   <div bind:this={container}></div>


Bootstrap
---------

Bootstrap is a CSS framework rather than a component framework, so
integration is straightforward -- embed pgwidgets elements inside
Bootstrap's grid:

.. code-block:: html

   <link rel="stylesheet" href="bootstrap.min.css" />
   <link rel="stylesheet" href="Widgets.css" />

   <div class="container">
     <div class="row">
       <div class="col-8" id="pg-area"></div>
       <div class="col-4">
         <p>Sidebar content managed by Bootstrap</p>
       </div>
     </div>
   </div>

   <script type="module">
     import { Widgets } from "./Widgets.js";

     let vbox = new Widgets.VBox({spacing: 8, padding: 10});
     // ... build widget tree ...
     document.getElementById('pg-area').appendChild(vbox.get_element());
   </script>

If Bootstrap's CSS resets affect pgwidgets appearance, see :doc:`styling`
for strategies to handle conflicts.


Shadow DOM Isolation
--------------------

For cases where full CSS isolation is needed (e.g. embedding pgwidgets
in a page with aggressive global styles), you can mount into a Shadow DOM:

.. code-block:: javascript

   let host = document.getElementById('pg-host');
   let shadow = host.attachShadow({mode: 'open'});

   // Load pgwidgets CSS inside the shadow root
   let link = document.createElement('link');
   link.rel = 'stylesheet';
   link.href = 'path/to/Widgets.css';
   shadow.appendChild(link);

   // Build and mount the widget tree
   let vbox = new Widgets.VBox({spacing: 8, padding: 10});
   // ... add widgets ...
   shadow.appendChild(vbox.get_element());

Shadow DOM prevents styles from leaking in or out, giving complete
isolation between pgwidgets and the host page's styles.
