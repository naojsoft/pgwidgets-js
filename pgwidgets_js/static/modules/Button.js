"use_strict";

import {Widget} from "./Widget.js";

/**
 * A clickable button widget with optional icon and text.
 * Fires the 'activated' callback when clicked.
 * @extends Widget
 */
class Button extends Widget {

    /**
     * Creates a new Button widget.
     * @param {string} [text=''] - Button label text.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(text='', options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('button');
        }
        this.element.className = 'button-widget';

        this.iconElement = null;
        this.textElement = document.createElement('span');
        this.textElement.className = 'button-text';
        this.textElement.textContent = text;
        if (text !== '') {
            this.element.appendChild(this.textElement);
        }

        super.init_style();

        this.element.onclick = () => this._cb_redirect('clicked');
        this.enable_callback('activated');
    }

    /**
     * Sets the button label text. Adds or removes the text element as needed.
     * @param {string} text - The label text, or '' to remove text.
     */
    set_text(text) {
        this.textElement.textContent = text;
        if (text !== '' && !this.textElement.parentElement) {
            this.element.appendChild(this.textElement);
        } else if (text === '' && this.textElement.parentElement) {
            this.element.removeChild(this.textElement);
        }
    }

    /**
     * Returns the current button label text.
     * @returns {string} The button text.
     */
    get_text() {
        return this.textElement.textContent;
    }

    /**
     * Sets the button icon from a URL. The icon is displayed above the text.
     * @param {string} icon_url - URL of the icon image.
     * @param {number[]|null} [iconsize=null] - Optional [width, height] in pixels.
     */
    set_icon(icon_url, iconsize=null) {
        if (this.iconElement === null) {
            this.iconElement = document.createElement('img');
            this.iconElement.className = 'button-icon';
            // icon goes before text
            this.element.insertBefore(this.iconElement, this.element.firstChild);
        }
        this.iconElement.src = icon_url;
        if (iconsize !== null) {
            this.iconElement.style.width = iconsize[0] + 'px';
            this.iconElement.style.height = iconsize[1] + 'px';
        } else {
            this.iconElement.style.width = '';
            this.iconElement.style.height = '';
        }
    }

    /**
     * Returns the current icon URL, or null if no icon is set.
     * @returns {string|null} The icon URL.
     */
    get_icon() {
        if (this.iconElement === null) {
            return null;
        }
        return this.iconElement.src;
    }

    /**
     * Sets the background and/or foreground color.  Setting bg uses
     * the `background` shorthand, which clears the default sculpted
     * gradient (and overrides the :hover/:active gradients).  Pass
     * an empty string to revert to the default look.
     *
     * @param {string|null} [bg=null] - Background CSS color, null to
     *   leave unchanged, or "" to revert to the CSS default gradient.
     * @param {string|null} [fg=null] - Foreground (text) CSS color,
     *   null to leave unchanged.
     */
    set_color(bg=null, fg=null) {
        if (bg !== null) {
            // Use the shorthand so the inline rule blanks out
            // background-image (the gradient) and overrides :hover/
            // :active gradient rules from CSS.
            this.element.style.background = bg;
        }
        if (fg !== null) {
            this.element.style.color = fg;
        }
    }

    _cb_redirect(action) {
        if (action === 'clicked') {
            this.make_callback('activated');
        }
    }
}

export { Button };
