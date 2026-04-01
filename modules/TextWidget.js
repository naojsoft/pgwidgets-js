"use_strict";

import {Widget} from "./Widget.js";

/**
 * A read-only text display widget. Shows plain text or HTML content.
 * @extends Widget
 */
class Text extends Widget {

    /**
     * Creates a new Text widget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.text=''] - Initial text content.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {text: ''}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'text-widget';

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.set_html = this.set_html.bind(this);

        var text = this.get_option(options, 'text', null);
        if (text !== null) {
            this.set_text(text);
        }
    }

    /**
     * Sets the displayed text content.
     * @param {string} text - The text to display.
     */
    set_text(text) {
        this.element.innerText = text;
    }

    /**
     * Returns the current text content.
     * @returns {string} The text content.
     */
    get_text() {
        return this.element.innerText;
    }

    /**
     * Sets the displayed content as HTML.
     * @param {string} html_text - The HTML string to render.
     */
    set_html(html_text) {
        this.element.innerHTML = html_text;
    }

}

/**
 * A multi-line editable text area widget.
 * @extends Widget
 */
class TextArea extends Widget {

    /**
     * Creates a new TextArea widget.
     * @param {string} [text=''] - Initial text content.
     * @param {Object} [options] - Configuration options.
     * @param {boolean} [options.wrap=false] - Whether to enable word wrapping.
     * @param {boolean} [options.editable=true] - Whether the text area is editable.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(text='', options={wrap: false, editable: true}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('textarea');
        }
        this.element.className = 'textarea-widget';

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.get_text = this.get_text.bind(this);
        this.append_text = this.append_text.bind(this);
        this.set_editable = this.set_editable.bind(this);
        this.set_wrap = this.set_wrap.bind(this);
        this.set_font = this.set_font.bind(this);
        this.set_limit = this.set_limit.bind(this);

        super.init_style();

        this.element.readOnly = ! this.get_option(options, 'editable', true);
        this.element.wrap = this.get_option(options, 'wrap', false) ? 'soft' : 'off';

        if (text) {
            this.set_text(text);
        }
    }

    /**
     * Sets the text area content.
     * @param {string} text - The text to set.
     */
    set_text(text) {
        this.element.value = text;
    }

    /**
     * Returns the current text area content.
     * @returns {string} The text content.
     */
    get_text() {
        return this.element.value;
    }

    /**
     * Appends text to the end of the current content.
     * @param {string} text - The text to append.
     */
    append_text(text) {
        this.element.value += text;
    }

    /**
     * Sets whether the text area is editable.
     * @param {boolean} tf - True for editable, false for read-only.
     */
    set_editable(tf) {
        this.element.readOnly = !tf;
    }

    /**
     * Sets whether word wrapping is enabled.
     * @param {boolean} tf - True to enable wrapping, false to disable.
     */
    set_wrap(tf) {
        this.element.wrap = tf ? 'soft' : 'off';
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

    /**
     * Sets the visible number of text rows.
     * @param {number} numlines - Number of visible rows.
     */
    set_limit(numlines) {
        this.element.rows = numlines;
    }

}

export { Text, TextArea };
