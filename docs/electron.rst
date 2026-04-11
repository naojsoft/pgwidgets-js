Using pgwidgets with Electron
=============================

pgwidgets runs unchanged inside an `Electron <https://electronjs.org>`_
renderer process, letting you ship native desktop applications.  No
Electron-specific changes are needed in pgwidgets itself -- the Electron
entry point simply creates a ``BrowserWindow`` that loads an HTML file
containing your pgwidgets UI.

Quick Start
-----------

The repository includes a ready-made example:

.. code-block:: bash

   cd examples/electron
   npm install     # one-time
   npm start       # launches the demo in an Electron window

The Electron entry point (``main.js``) creates a ``BrowserWindow`` and loads
an HTML page that imports pgwidgets in the usual way.

Project Structure
-----------------

A minimal pgwidgets Electron project looks like this::

   my-app/
   ├── package.json
   ├── main.js          # Electron main process
   ├── index.html        # pgwidgets UI (renderer process)
   ├── modules/          # pgwidgets JS modules
   │   ├── Widgets.js
   │   └── ...
   └── css/
       └── Widgets.css

``main.js`` needs only a few lines:

.. code-block:: javascript

   const { app, BrowserWindow } = require("electron");
   const path = require("path");

   app.whenReady().then(() => {
       const win = new BrowserWindow({
           width: 800,
           height: 600,
           webPreferences: { nodeIntegration: false, contextIsolation: true },
       });
       win.loadFile("index.html");
   });

``index.html`` loads pgwidgets as it would in any browser page:

.. code-block:: html

   <!DOCTYPE html>
   <html>
   <head>
     <link rel="stylesheet" href="css/Widgets.css" />
   </head>
   <body>
     <script type="module">
       import { Widgets } from "./modules/Widgets.js";

       let top = new Widgets.TopLevel({title: "My App", resizable: true});
       top.resize(600, 400);
       // ... build your UI ...
       top.show();
     </script>
   </body>
   </html>


Packaging for Distribution
--------------------------

During development ``npm start`` is convenient, but for distribution you
want a standalone executable that users can launch by name.  Two tools are
widely used for this.

electron-builder
^^^^^^^^^^^^^^^^

`electron-builder <https://www.electron.build>`_ is the most popular
packaging tool.  It produces platform-specific installers and standalone
executables.

1. Install it as a dev dependency:

   .. code-block:: bash

      npm install --save-dev electron-builder

2. Add a ``build`` section and a ``dist`` script to ``package.json``:

   .. code-block:: json

      {
        "name": "my-pgwidgets-app",
        "version": "1.0.0",
        "main": "main.js",
        "scripts": {
          "start": "electron .",
          "dist": "electron-builder"
        },
        "build": {
          "appId": "com.example.my-pgwidgets-app",
          "productName": "My PGWidgets App",
          "files": [
            "main.js",
            "index.html",
            "modules/**/*",
            "css/**/*"
          ],
          "linux": {
            "target": ["AppImage", "deb"]
          },
          "mac": {
            "target": ["dmg"]
          },
          "win": {
            "target": ["nsis"]
          }
        },
        "devDependencies": {
          "electron": "^30.0.0",
          "electron-builder": "^24.0.0"
        }
      }

3. Build the distributable:

   .. code-block:: bash

      npm run dist

   This produces platform-specific output in the ``dist/`` directory:

   - **Linux**: ``.AppImage`` (portable) and/or ``.deb`` (Debian/Ubuntu)
   - **macOS**: ``.dmg`` containing a ``.app`` bundle
   - **Windows**: ``.exe`` installer (NSIS)

   The resulting executable is named after ``productName`` -- users launch it
   directly without needing Node.js, npm, or the project source tree.

electron-forge
^^^^^^^^^^^^^^

`Electron Forge <https://www.electronforge.io>`_ is the officially
recommended toolchain from the Electron team.  It handles the full
lifecycle: project creation, development, and packaging.

1. Add Forge to an existing project:

   .. code-block:: bash

      npm install --save-dev @electron-forge/cli
      npx electron-forge import

   This rewrites parts of ``package.json`` to use Forge's scripts and adds a
   ``forge.config.js`` file.

2. Run during development:

   .. code-block:: bash

      npm start          # uses Forge under the hood after import

3. Create distributable packages:

   .. code-block:: bash

      npm run make

   Output goes to the ``out/`` directory.  By default Forge produces:

   - **Linux**: ``.deb`` and ``.rpm``
   - **macOS**: ``.zip`` containing a ``.app`` bundle
   - **Windows**: Squirrel installer (``.exe``)

   Additional "makers" can be configured in ``forge.config.js`` for other
   formats (e.g. Flatpak, Snap, DMG).

Which One to Choose
^^^^^^^^^^^^^^^^^^^

Both tools are mature and widely used.  Some guidelines:

- **electron-builder** has more output formats out of the box (AppImage,
  Snap, NSIS, MSI, DMG, pkg, etc.) and extensive configuration via
  ``package.json``.  It is a good choice when you need fine-grained control
  over installer options.

- **electron-forge** is the officially recommended tool and provides a more
  integrated workflow covering the full development lifecycle, including
  plugin-based build pipelines and auto-update support.  It is a good
  choice for new projects or when you want an opinionated, batteries-included
  setup.

For a pgwidgets application that simply needs to be packaged into a
standalone executable, either tool works well.
