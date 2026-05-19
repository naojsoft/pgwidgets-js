"use_strict";

import {Widget} from "./Widget.js";

/**
 * A simple text label widget with configurable alignment, color, and font.
 * @extends Widget
 */
class Label extends Widget {

    /**
     * Creates a new Label widget.
     * @param {string} [text=''] - Initial label text.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.halign='left'] - Horizontal text alignment: 'left', 'center', or 'right'.
     * @param {boolean} [options.interactive=false] - If true, wire up
     *   pointer, mouse, keyboard, focus, and drag-drop events so the
     *   label can act as a clickable/hoverable element.
     * @param {Menu} [options.menu=null] - If a Menu widget is given,
     *   the label acts as a context-menu activator: pressing the mouse
     *   on the label pops the menu just below the label, and the
     *   menu can be navigated by drag-and-release or click-then-click,
     *   matching MenuBar behavior.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(text=null, options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'label-widget';

        let halign = this.get_option(options, 'halign', 'left');
        this.element.style.textAlign = halign;

        if (this.get_option(options, 'interactive', false)) {
            this._initInteractiveEvents({focusable: true});
        }

        let menu = this.get_option(options, 'menu', null);
        if (menu !== null && menu !== undefined) {
            this.set_menu(menu);
        }

        if (text !== null && text !== undefined) {
            this.set_text(text);
        }
    }

    /**
     * Attach a Menu widget to this label as a context menu.  The menu
     * pops up just below the label on mouse-down and behaves like a
     * MenuBar dropdown: mouse-up on a menu action activates it,
     * mouse-up on the label leaves the menu open in click mode (to be
     * dismissed by clicking outside or selecting an item), and mouse-up
     * elsewhere closes it without selecting.
     * @param {Menu|null} menu - The Menu widget to attach, or null to detach.
     */
    set_menu(menu) {
        if (this._menu) {
            this.element.removeEventListener('mousedown',
                                             this._onMenuMouseDown);
            this.element.removeEventListener('contextmenu',
                                             this._suppressContextMenu);
            document.removeEventListener('mousedown',
                                         this._onMenuOutsideMouseDown);
            this.element.classList.remove('label-widget-menu');
            this._menu = null;
        }
        if (!menu) return;
        // Mark the label so CSS can apply menu-style cursor.
        this.element.classList.add('label-widget-menu');
        this._menu = menu;
        this._menuOpen = false;
        this._menuArmed = false;

        let menuElt = menu.get_element();
        menuElt.style.display = 'none';
        menuElt.style.position = 'fixed';
        menuElt.style.zIndex = '1000000';
        if (!document.body.contains(menuElt)) {
            document.body.appendChild(menuElt);
        }

        // Suppress native context menu so right-click can drive ours.
        this._suppressContextMenu = (e) => { e.preventDefault(); };
        this.element.addEventListener('contextmenu',
                                      this._suppressContextMenu);

        // Pop up on any mouse press over the label (left or right).
        this._onMenuMouseDown = (e) => {
            if (e.button !== 0 && e.button !== 2) return;
            e.preventDefault();
            e.stopPropagation();
            if (this._menuOpen && !this._menuArmed) {
                // Already open in click mode — pressing on label closes.
                this._closeMenu();
                return;
            }
            this._openMenu();
            this._menuArmed = true;
            document.addEventListener('mouseup', this._onMenuMouseUp);
        };
        this.element.addEventListener('mousedown', this._onMenuMouseDown);

        // Clicking outside (when not armed) closes the menu.
        document.addEventListener('mousedown',
                                  this._onMenuOutsideMouseDown);

        // Selecting a menu action closes the menu.
        menuElt.addEventListener('menuaction-select', () => {
            this._closeMenu();
        });
    }

    /** @private */
    _openMenu() {
        let menuElt = this._menu.get_element();
        let rect = this.element.getBoundingClientRect();
        menuElt.style.left = rect.left + 'px';
        menuElt.style.top = rect.bottom + 'px';
        menuElt.style.display = '';
        this._menuOpen = true;
    }

    /** @private */
    _closeMenu() {
        if (!this._menu) return;
        this._menu.get_element().style.display = 'none';
        this._menuOpen = false;
        this._menuArmed = false;
    }

    /** @private */
    _onMenuMouseUp = (e) => {
        document.removeEventListener('mouseup', this._onMenuMouseUp);
        if (!this._menuArmed) return;
        this._menuArmed = false;

        // Released on the label itself: switch to click mode (stay open).
        if (this.element.contains(e.target)) {
            return;
        }
        // Released on a menu action: activate it.
        let actionElt = e.target.closest('.menuaction-widget');
        if (actionElt && this._menu.get_element().contains(actionElt)) {
            actionElt.click();
            return;
        }
        // Released elsewhere: close.
        this._closeMenu();
    }

    /** @private */
    _onMenuOutsideMouseDown(e) {
        if (this._menuArmed) return;
        if (!this._menuOpen) return;
        if (this.element.contains(e.target)) return;
        if (this._menu.get_element().contains(e.target)) return;
        this._closeMenu();
    }

    destroy() {
        if (this._menu) {
            this.set_menu(null);
        }
        super.destroy();
    }

    /**
     * Sets the label text.
     * @param {string} text - The text to display.
     */
    set_text(text) {
        this._text = text;
        // Use a non-breaking space when empty so the element
        // retains one line of height in flex layouts.
        this.element.innerHTML = text || '&nbsp;';
    }

    /**
     * Returns the current label text.
     * @returns {string} The label text.
     */
    get_text() {
        return this._text;
    }

    /**
     * Sets the background and/or foreground color.
     * @param {string|null} [bg=null] - Background CSS color, or null to leave unchanged.
     * @param {string|null} [fg=null] - Foreground (text) CSS color, or null to leave unchanged.
     */
    set_color(bg=null, fg=null) {
        if (bg !== null) {
            this.element.style.backgroundColor = bg;
        }
        if (fg !== null) {
            this.element.style.color = fg;
        }
    }

    /**
     * Sets the horizontal text alignment.
     * @param {string} align - Alignment value: 'left', 'center', or 'right'.
     */
    set_halign(align) {
        this.element.style.textAlign = align;
    }

}

export { Label };
