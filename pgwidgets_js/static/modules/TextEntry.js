"use_strict";

import {Widget} from "./Widget.js";

/**
 * A single-line text input widget.
 * Fires the 'activated' callback when Enter/Return is pressed.
 * Supports line history via up/down arrow keys.
 * @extends Widget
 */
class TextEntry extends Widget {

    /**
     * Creates a new TextEntry widget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.text=''] - Initial text value.
     * @param {boolean} [options.editable=true] - Whether the input is editable.
     * @param {number} [options.linehistory=1] - Number of lines to keep in history.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {text: '', editable: true}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('input');
        }
        this.element.className = 'textentry-widget';

        this.element.type = this.get_option(options, 'password', false) ? 'password' : 'text';
        this.element.readOnly = ! this.get_option(options, 'editable', true);
        this.element.placeholder = '';

        // the input element used by all text methods
        this._input = this.element;

        // line history
        this._historyMax = this.get_option(options, 'linehistory', 1);
        this._history = [];
        this._historyIdx = -1;
        this._historySaved = '';

        // JavaScript hack to bind "this" correctly for our methods
        this.set_text = this.set_text.bind(this);
        this.get_text = this.get_text.bind(this);
        this.clear = this.clear.bind(this);
        this.set_length = this.set_length.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._recordHistory = this._recordHistory.bind(this);

        this._input.addEventListener("keydown", this._onKeyDown);
        this.enable_callback('activated');

        var text = this.get_option(options, 'text', null);
        if (text !== null) {
            this.set_text(text);
        }
    }

    /**
     * Handles keydown events for history navigation and Enter activation.
     * @param {KeyboardEvent} event
     * @private
     */
    _onKeyDown(event) {
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (this._history.length > 0) {
                if (this._historyIdx === -1) {
                    this._historySaved = this._input.value;
                    this._historyIdx = this._history.length - 1;
                } else if (this._historyIdx > 0) {
                    this._historyIdx--;
                }
                this._input.value = this._history[this._historyIdx];
            }
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (this._historyIdx !== -1) {
                if (this._historyIdx < this._history.length - 1) {
                    this._historyIdx++;
                    this._input.value = this._history[this._historyIdx];
                } else {
                    this._historyIdx = -1;
                    this._input.value = this._historySaved;
                }
            }
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            this._recordHistory();
            this.make_callback('activated', this.get_text());
        }
    }

    /**
     * Records the current input text into the history buffer.
     * @private
     */
    _recordHistory() {
        let text = this._input.value;
        if (text !== '') {
            this._history.push(text);
            if (this._history.length > this._historyMax) {
                this._history.shift();
            }
        }
        this._historyIdx = -1;
    }

    /**
     * Sets the input text value.
     * @param {string} text - The text to set.
     */
    set_text(text) {
        this._input.value = text;
    }

    /**
     * Returns the current input text value.
     * @returns {string} The text value.
     */
    get_text() {
        return this._input.value;
    }

    /** Clears the input text. */
    clear() {
        this._input.value = '';
    }

    /**
     * Sets the visible width of the input in character units.
     * @param {number} numchars - Number of characters to show.
     */
    set_length(numchars) {
        this._input.size = numchars;
    }
}

export { TextEntry };
