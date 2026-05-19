"use_strict";

import {Widget} from "./Widget.js";

/**
 * A menu action item that can display text and/or an icon.
 * Fires the 'activated' callback when clicked.
 * @extends Widget
 */
class MenuAction extends Widget {

    /**
     * Creates a new MenuAction.
     * @param {Object} [options] - Configuration options.
     * @param {string|null} [options.text=null] - Label text for the action.
     * @param {string|null} [options.icon_url=null] - URL of an icon image.
     * @param {number[]|null} [options.iconsize=null] - Icon size as [width, height] in pixels.
     * @param {boolean} [options.checkable=false] - Whether the action has a checkbox.
     * @param {string|null} [options.name=null] - Alias for text.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'menuaction-widget';

        this.checkable = this.get_option(options, 'checkable', false);
        this.checked = false;

        // checkbox indicator (hidden unless checkable)
        this._check = document.createElement('span');
        this._check.className = 'menuaction-check';
        this._check.textContent = '';
        this.element.appendChild(this._check);

        // icon
        this._icon = document.createElement('img');
        this._icon.className = 'menuaction-icon';
        this._icon.style.display = 'none';
        this.element.appendChild(this._icon);

        let icon_url = this.get_option(options, 'icon_url', null);
        let iconsize = this.get_option(options, 'iconsize', null);
        if (icon_url !== null) {
            this.set_icon(icon_url, iconsize);
        }

        // label
        this._label = document.createElement('span');
        this._label.className = 'menuaction-label';
        this.element.appendChild(this._label);

        let text = this.get_option(options, 'text', null);
        if (text === null) {
            text = this.get_option(options, 'name', null);
        }
        if (text !== null) {
            this.set_text(text);
        }

        // click handler
        this.element.addEventListener('click', (e) => {
            this._activate();
        });

        this.enable_callback('activated');
    }

    /**
     * Activates this menu action: toggles check state if checkable,
     * fires the 'activated' callback, and dispatches a bubbling
     * 'menuaction-select' event so parent menus can close.
     *
     * Callback signature: handler(widget) for non-checkable actions,
     * handler(widget, checked) for checkable ones.
     */
    _activate() {
        if (this.checkable) {
            this.set_checked(!this.checked);
            this.make_callback('activated', this.checked);
        } else {
            this.make_callback('activated');
        }
        this.element.dispatchEvent(
            new CustomEvent('menuaction-select', { bubbles: true }));
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
        this._icon.src = url;
        this._icon.style.display = '';
        if (iconsize !== null) {
            this._icon.style.width = iconsize[0] + 'px';
            this._icon.style.height = iconsize[1] + 'px';
        }
    }

    /**
     * Sets the checked state (only meaningful if checkable).
     * @param {boolean} checked - Whether the action is checked.
     */
    set_checked(checked) {
        this.checked = checked;
        this._check.textContent = this.checked ? '\u2713' : '';
    }

    /**
     * Returns the checked state.
     * @returns {boolean} Whether the action is checked.
     */
    get_checked() {
        return this.checked;
    }

    /**
     * Alias for set_checked() for API consistency with other toggleable
     * widgets (CheckBox, ToggleButton, RadioButton).
     * @param {boolean} tf - Whether the action is checked.
     */
    set_state(tf) {
        this.set_checked(tf);
    }

    /**
     * Alias for get_checked() for API consistency with other toggleable
     * widgets.
     * @returns {boolean} Whether the action is checked.
     */
    get_state() {
        return this.get_checked();
    }
}

export { MenuAction };
