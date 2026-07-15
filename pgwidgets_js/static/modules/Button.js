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

        // hover highlight colors (see set_hover); null = no hover override
        this._hoverBg = null;
        this._hoverFg = null;
        this._hoverInstalled = false;
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

    /**
     * Give this button a hover highlight: while the pointer is over the
     * button its background/foreground switch to the supplied colors,
     * reverting on mouse-out.  Mirrors the qt/gtk backends' per-button
     * hover.  Pass ``(null, null)`` or empty strings to clear it.
     *
     * Implemented with mouseenter/mouseleave that swap (and restore) the
     * inline style, because an inline base background set via set_color
     * would otherwise win over a CSS ``:hover`` rule.
     *
     * @param {string|null} [bg=null] - Hover background CSS color.
     * @param {string|null} [fg=null] - Hover foreground (text) CSS color.
     */
    set_hover(bg=null, fg=null) {
        this._hoverBg = (bg === '') ? null : bg;
        this._hoverFg = (fg === '') ? null : fg;
        if (!this._hoverInstalled) {
            this._hoverInstalled = true;
            this.element.addEventListener('mouseenter',
                                          () => this._applyHover());
            this.element.addEventListener('mouseleave',
                                          () => this._restoreHover());
        }
    }

    _applyHover() {
        if (this._hoverBg === null && this._hoverFg === null) {
            return;
        }
        // remember whatever inline colors are in effect (e.g. a base color
        // from set_color, or '' for the default look) so we can restore them
        this._savedBg = this.element.style.background;
        this._savedFg = this.element.style.color;
        if (this._hoverBg !== null) {
            this.element.style.background = this._hoverBg;
        }
        if (this._hoverFg !== null) {
            this.element.style.color = this._hoverFg;
        }
    }

    _restoreHover() {
        if (this._savedBg !== undefined) {
            this.element.style.background = this._savedBg;
            this._savedBg = undefined;
        }
        if (this._savedFg !== undefined) {
            this.element.style.color = this._savedFg;
            this._savedFg = undefined;
        }
    }

    _cb_redirect(action) {
        if (action === 'clicked') {
            this.make_callback('activated');
        }
    }
}

export { Button };
