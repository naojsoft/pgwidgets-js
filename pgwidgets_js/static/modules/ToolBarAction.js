"use_strict";

import {Widget} from "./Widget.js";

/**
 * A toolbar action that looks like a flat button. Can optionally
 * toggle between pressed and unpressed states. Supports text and/or icon.
 * Fires the 'activated' callback when clicked (with toggle state if toggle mode).
 * @extends Widget
 */
class ToolBarAction extends Widget {

    /**
     * Creates a new ToolBarAction.
     * @param {Object} [options] - Configuration options.
     * @param {string|null} [options.text=null] - Label text.
     * @param {string|null} [options.icon_url=null] - URL of an icon image.
     * @param {number[]|null} [options.iconsize=null] - Icon size as [width, height] in pixels.
     * @param {boolean} [options.toggle=false] - If true, behaves as a toggle button.
     * @param {Menu|null} [options.menu=null] - A Menu widget to pop up when clicked.
     *   Supports click-and-hold (drag to select) and click-to-toggle (click to open,
     *   click again or select to close).
     * @param {ToolBarAction|null} [options.group=null] - Another ToolBarAction to join its
     *   mutual-exclusion group, or null for independent toggle behavior. Implies toggle=true.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'toolbar-action';

        // group management
        let groupOwner = this.get_option(options, 'group', null);
        if (groupOwner !== null) {
            if (groupOwner.group !== null) {
                this.group = groupOwner.group;
            } else {
                // first grouped reference: create the group on the owner
                groupOwner.group = [groupOwner];
                this.group = groupOwner.group;
            }
            this.group.push(this);
            this.toggle = true;
        } else {
            this.group = null;
            this.toggle = this.get_option(options, 'toggle', false);
        }
        this.state = false;

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.get_text = this.get_text.bind(this);
        this.set_icon = this.set_icon.bind(this);
        this.set_state = this.set_state.bind(this);
        this.get_state = this.get_state.bind(this);

        // icon
        this._icon = null;

        let icon_url = this.get_option(options, 'icon_url', null);
        let iconsize = this.get_option(options, 'iconsize', null);
        if (icon_url !== null) {
            this.set_icon(icon_url, iconsize);
        }

        // label
        this._label = document.createElement('span');
        this._label.className = 'toolbar-action-label';
        this.element.appendChild(this._label);

        let text = this.get_option(options, 'text', null);
        if (text !== null) {
            this.set_text(text);
        }

        // menu support
        this._menu = this.get_option(options, 'menu', null);
        this._menuOpen = false;
        this._armed = false;
        this._onDocumentMouseUp = this._onDocumentMouseUp.bind(this);
        this._onDocumentMouseDown = this._onDocumentMouseDown.bind(this);
        this.set_menu = this.set_menu.bind(this);

        if (this._menu) {
            this._setupMenu(this._menu);
        }

        // Mousedown handler for menu popup (always attached; checks _menu)
        this._onElementMouseDown = (e) => {
            if (!this._menu) return;
            e.preventDefault();
            e.stopPropagation();
            if (this._menuOpen && !this._armed) {
                // click on already-open menu in click mode: close it
                this._closeMenu();
            } else {
                this._openMenu();
                this._armed = true;
                document.addEventListener('mouseup', this._onDocumentMouseUp);
            }
        };
        this.element.addEventListener('mousedown', this._onElementMouseDown);

        // Click handler for non-menu actions (always attached; skips if menu)
        this.element.addEventListener('click', () => {
            if (this._menu) return;
            this._handleClick();
        });

        this.enable_callback('activated');
    }

    /**
     * Updates the visual pressed/unpressed state.
     * @private
     */
    _updateVisual() {
        if (this.state) {
            this.element.classList.add('pressed');
        } else {
            this.element.classList.remove('pressed');
        }
    }

    /**
     * Sets the label text.
     * @param {string} text - The text to display.
     */
    set_text(text) {
        this._label.textContent = text;
    }

    /**
     * Returns the current label text.
     * @returns {string} The label text.
     */
    get_text() {
        return this._label.textContent;
    }

    /**
     * Sets the icon image.
     * @param {string} url - URL of the icon.
     * @param {number[]|null} [iconsize=null] - Optional [width, height] in pixels.
     */
    set_icon(url, iconsize = null) {
        if (this._icon === null) {
            this._icon = document.createElement('img');
            this._icon.className = 'toolbar-action-icon';
            this.element.insertBefore(this._icon, this.element.firstChild);
        }
        this._icon.src = url;
        if (iconsize !== null) {
            this._icon.style.width = iconsize[0] + 'px';
            this._icon.style.height = iconsize[1] + 'px';
        }
    }

    /**
     * Sets the toggle state programmatically (does not fire callback).
     * @param {boolean} value - True for pressed, false for unpressed.
     */
    set_state(value) {
        if (value && this.group !== null) {
            for (let btn of this.group) {
                if (btn !== this && btn.state) {
                    btn.state = false;
                    btn._updateVisual();
                }
            }
        }
        this.state = !!value;
        this._updateVisual();
    }

    /**
     * Returns the current toggle state.
     * @returns {boolean} True if pressed, false if unpressed.
     */
    get_state() {
        return this.state;
    }

    /**
     * Handles click/toggle logic (extracted for reuse).
     * @private
     */
    _handleClick() {
        if (this.toggle) {
            if (this.group !== null) {
                if (this.state) {
                    this.state = false;
                    this._updateVisual();
                    this.make_callback('activated', this.state);
                } else {
                    for (let btn of this.group) {
                        if (btn !== this && btn.state) {
                            btn.state = false;
                            btn._updateVisual();
                        }
                    }
                    this.state = true;
                    this._updateVisual();
                    this.make_callback('activated', this.state);
                }
            } else {
                this.state = !this.state;
                this._updateVisual();
                this.make_callback('activated', this.state);
            }
        } else {
            this.make_callback('activated');
        }
    }

    /**
     * Sets the menu for this toolbar action.
     * @param {Menu|null} menu - A Menu widget, or null to remove.
     */
    set_menu(menu) {
        if (this._menuOpen) {
            this._closeMenu();
        }
        this._menu = menu;
        // Remove old menu element if present
        let old = this.element.querySelector('.menu-widget');
        if (old) old.remove();
        if (menu) {
            this._setupMenu(menu);
        }
    }

    /**
     * Attaches a menu element to this action's DOM.
     * @private
     */
    _setupMenu(menu) {
        let menuElt = menu.get_element();
        menuElt.style.display = 'none';
        menuElt.style.position = 'absolute';
        menuElt.style.zIndex = '10000';
        this.element.style.position = 'relative';
        this.element.appendChild(menuElt);

        // auto-close when a menu action is selected
        menuElt.addEventListener('menuaction-select', () => {
            this._closeMenu();
        });
    }

    /**
     * Opens the attached menu below this action.
     * @private
     */
    _openMenu() {
        if (!this._menu) return;
        let menuElt = this._menu.get_element();
        menuElt.style.top = this.element.offsetHeight + 'px';
        menuElt.style.left = '0px';
        menuElt.style.display = '';
        this._menuOpen = true;
        this.element.classList.add('active');
        document.addEventListener('mousedown', this._onDocumentMouseDown);
    }

    /**
     * Closes the attached menu.
     * @private
     */
    _closeMenu() {
        if (!this._menu) return;
        this._menu.get_element().style.display = 'none';
        this._menuOpen = false;
        this._armed = false;
        this.element.classList.remove('active');
        document.removeEventListener('mousedown', this._onDocumentMouseDown);
        document.removeEventListener('mouseup', this._onDocumentMouseUp);
    }

    /**
     * Handles mouseup while armed (drag mode).
     * @private
     */
    _onDocumentMouseUp(e) {
        document.removeEventListener('mouseup', this._onDocumentMouseUp);
        if (!this._armed) return;
        this._armed = false;

        // Released on the toolbar action button itself: switch to click mode
        if (this.element.contains(e.target) &&
            !this._menu.get_element().contains(e.target)) {
            return;
        }

        // Released on a menu action: activate it
        let actionElt = e.target.closest('.menuaction-widget');
        if (actionElt && this.element.contains(actionElt)) {
            actionElt.click();
            return;
        }

        // Released elsewhere: close
        this._closeMenu();
    }

    /**
     * Handles mousedown outside in click mode to close menu.
     * @private
     */
    _onDocumentMouseDown(e) {
        if (!this.element.contains(e.target)) {
            this._closeMenu();
        }
    }
}

export { ToolBarAction };
