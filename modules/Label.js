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
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(text='', options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'label-widget';

        let halign = this.get_option(options, 'halign', 'left');
        this.element.style.textAlign = halign;

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.get_text = this.get_text.bind(this);
        this.set_color = this.set_color.bind(this);
        this.set_halign = this.set_halign.bind(this);
        this.set_font = this.set_font.bind(this);

        if (text !== '') {
            this.set_text(text);
        }
    }

    /**
     * Sets the label text.
     * @param {string} text - The text to display.
     */
    set_text(text) {
        this.element.innerText = text;
    }

    /**
     * Returns the current label text.
     * @returns {string} The label text.
     */
    get_text() {
        return this.element.innerText;
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

    /**
     * Sets the font family and size.
     * @param {string} font - CSS font family name.
     * @param {number} [size=10] - Font size in points.
     */
    set_font(font, size=10) {
        this.element.style.fontFamily = font;
        this.element.style.fontSize = size + 'pt';
    }
}

export { Label };
