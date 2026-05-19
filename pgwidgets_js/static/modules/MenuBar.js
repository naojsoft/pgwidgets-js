"use_strict";

import {Widget} from "./Widget.js";
import {Menu} from "./Menu.js";

/**
 * A horizontal menu bar widget. Menus are added by name and pop up
 * when the user clicks the corresponding label on the bar.
 * @extends Widget
 */
class MenuBar extends Widget {

    /**
     * Creates a new MenuBar widget.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'menubar-widget';

        this._menus = {};       // name -> { menu, button }
        this._openName = null;  // name of currently open menu, or null
        this._armed = false;    // true while mouse button is held from menubar

        // close any open menu when clicking outside
        this._onDocumentMouseDown = (e) => {
            if (this._destroyed) return;
            if (this.element.contains(e.target)) return;
            // Check if the click is inside any of our dropdown menus
            // (which live in document.body, not inside the menubar).
            for (let name in this._menus) {
                let menuElt = this._menus[name].menu.get_element();
                if (menuElt.contains(e.target)) return;
            }
            this._closeAll();
        };
        document.addEventListener('mousedown', this._onDocumentMouseDown);

        // close menus when a menu action is selected — handled per-menu
        // in add_menu since menus live in document.body, not inside the
        // menubar element.
    }

    destroy() {
        document.removeEventListener('mousedown', this._onDocumentMouseDown);
        super.destroy();
    }

    /**
     * Adds a Menu widget to the bar under the given name.
     * @param {Menu} menu - The Menu widget to associate.
     * @param {string} name - The label displayed on the menu bar.
     */
    add_menu(menu, name) {
        let button = document.createElement('div');
        button.className = 'menubar-item';
        button.textContent = name;

        let container = document.createElement('div');
        container.className = 'menubar-item-container';
        container.appendChild(button);

        let menuElt = menu.get_element();
        menuElt.style.display = 'none';
        menuElt.style.position = 'fixed';
        menuElt.style.zIndex = '1000000';
        document.body.appendChild(menuElt);

        const positionMenu = () => {
            let rect = button.getBoundingClientRect();
            menuElt.style.left = rect.left + 'px';
            menuElt.style.top = rect.bottom + 'px';
        };

        button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this._openName === name && !this._armed) {
                // click on already-open menu in click mode: close it
                this._closeAll();
            } else {
                this._closeAll();
                positionMenu();
                menuElt.style.display = '';
                button.classList.add('active');
                this._openName = name;
                this._armed = true;
                this._armedButton = button;
                document.addEventListener('mouseup', this._onDocumentMouseUp);
            }
        });

        // allow hovering to switch menus when one is already open
        button.addEventListener('mouseenter', () => {
            if (this._openName !== null && this._openName !== name) {
                this._closeAll();
                positionMenu();
                menuElt.style.display = '';
                button.classList.add('active');
                this._openName = name;
                if (this._armed) {
                    this._armedButton = button;
                }
            }
        });

        // Close the menubar when an action inside this menu is selected.
        menuElt.addEventListener('menuaction-select', () => {
            this._closeAll();
        });

        this.element.appendChild(container);
        this._menus[name] = { menu, button };
    }

    /**
     * Creates a new empty Menu and adds it to the bar under the given name.
     * @param {string} name - The label displayed on the menu bar.
     * @returns {Menu} The newly created Menu widget.
     */
    add_name(name) {
        let menu = new Menu();
        this.add_menu(menu, name);
        return menu;
    }

    /**
     * Returns the Menu widget associated with the given name.
     * @param {string} name - The menu bar label.
     * @returns {Menu|null} The Menu widget, or null if not found.
     */
    get_menu(name) {
        let entry = this._menus[name];
        return entry ? entry.menu : null;
    }

    /**
     * Handles mouseup on the document while armed (drag mode).
     * If released on the menubar button, switches to click mode.
     * If released on a menu action, activates it and closes.
     * If released elsewhere, closes all menus.
     * @private
     */
    _onDocumentMouseUp(e) {
        document.removeEventListener('mouseup', this._onDocumentMouseUp);

        if (!this._armed) return;
        this._armed = false;

        // released on the same menubar button: switch to click mode
        if (this._armedButton && this._armedButton.contains(e.target)) {
            return;
        }

        // released on a menu action: activate it (the menuaction-select
        // event will close the menus via the listener above)
        let actionElt = e.target.closest('.menuaction-widget');
        if (actionElt) {
            // Check if the action is inside any of our dropdown menus
            for (let name in this._menus) {
                let menuElt = this._menus[name].menu.get_element();
                if (menuElt.contains(actionElt)) {
                    actionElt.click();
                    return;
                }
            }
        }

        // released elsewhere: close all
        this._closeAll();
    }

    /**
     * Closes any open menu.
     * @private
     */
    _closeAll() {
        for (let name in this._menus) {
            let entry = this._menus[name];
            entry.menu.get_element().style.display = 'none';
            entry.button.classList.remove('active');
        }
        this._openName = null;
    }
}

export { MenuBar };
