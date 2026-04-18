"use_strict";

import {Widget} from "./Widget.js";
import {MenuAction} from "./MenuAction.js";

/**
 * A popup menu widget containing menu actions, checkboxes, separators,
 * and submenus arranged in a vertical panel.
 * @extends Widget
 */
class Menu extends Widget {

    /**
     * Creates a new Menu widget.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'menu-widget';

        this._items = [];

        // JavaScript hack to bind "this" correctly for our methods
        this.add_widget = this.add_widget.bind(this);
        this.add_name = this.add_name.bind(this);
        this.add_menu = this.add_menu.bind(this);
        this.add_separator = this.add_separator.bind(this);
        this.popup = this.popup.bind(this);
        this._closeSubmenus = this._closeSubmenus.bind(this);

        // auto-hide when a menu action is selected (for popup menus)
        this.element.addEventListener('menuaction-select', () => {
            this._closeSubmenus();
            this.element.style.display = 'none';
        });
    }

    /**
     * Appends a widget to the menu.
     * @param {Widget} child - The widget to add (e.g. MenuAction, CheckBox).
     */
    add_widget(child) {
        this._items.push(child);
        this.element.appendChild(child.get_element());
    }

    /**
     * Creates a MenuAction with the given name and adds it to the menu.
     * @param {string} name - The label for the menu action.
     * @param {boolean} [checkable=false] - Whether the action has a checkbox.
     * @returns {MenuAction} The newly created MenuAction.
     */
    add_name(name, checkable = false) {
        let action = new MenuAction({name: name, checkable: checkable});
        this.add_widget(action);
        return action;
    }

    /**
     * Adds a submenu under the given name.
     * @param {string} name - The label for the submenu entry.
     * @param {Menu|null} [menu=null] - The submenu Menu widget, or null to create a new one.
     * @returns {Menu} The submenu Menu widget.
     */
    add_menu(name, menu = null) {
        if (menu === null) {
            menu = new Menu();
        }

        let item = document.createElement('div');
        item.className = 'menu-submenu-item';

        let label = document.createElement('span');
        label.className = 'menu-submenu-label';
        label.textContent = name;
        item.appendChild(label);

        let arrow = document.createElement('span');
        arrow.className = 'menu-submenu-arrow';
        arrow.textContent = '\u25B6';
        item.appendChild(arrow);

        let menuElt = menu.get_element();
        menuElt.classList.add('menu-submenu');
        menuElt.style.display = 'none';
        item.appendChild(menuElt);

        item.addEventListener('mouseenter', () => {
            this._closeSubmenus();
            menuElt.style.display = '';
        });

        item.addEventListener('mouseleave', (e) => {
            if (!item.contains(e.relatedTarget)) {
                menuElt.style.display = 'none';
            }
        });

        this._items.push(menu);
        this.element.appendChild(item);
        return menu;
    }

    /**
     * Adds a horizontal separator line to the menu.
     */
    add_separator() {
        let sep = document.createElement('div');
        sep.className = 'menu-separator';
        this.element.appendChild(sep);
    }

    /**
     * Pops up the menu. If x and y are provided, positions the menu there;
     * otherwise positions at the mouse cursor or top-left.
     * @param {number} [x] - Left position in pixels.
     * @param {number} [y] - Top position in pixels.
     */
    popup(x, y) {
        // Ensure the menu is in the document body for standalone popups
        if (!document.body.contains(this.element)) {
            document.body.appendChild(this.element);
        }
        if (x !== undefined && y !== undefined) {
            this.element.style.left = x + 'px';
            this.element.style.top = y + 'px';
        }
        this.element.style.display = '';

        // Close on outside click (one-time listener)
        let onOutsideClick = (e) => {
            if (!this.element.contains(e.target)) {
                this.element.style.display = 'none';
                document.removeEventListener('mousedown', onOutsideClick);
            }
        };
        // Defer so the current click doesn't immediately close it
        requestAnimationFrame(() => {
            document.addEventListener('mousedown', onOutsideClick);
        });
    }

    /**
     * Closes all open submenus within this menu.
     * @private
     */
    _closeSubmenus() {
        let subs = this.element.querySelectorAll(':scope > .menu-submenu-item > .menu-submenu');
        for (let sub of subs) {
            sub.style.display = 'none';
        }
    }
}

export { Menu };
