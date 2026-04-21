"use_strict";

import {Label} from "./Label.js";

/**
 * A status bar widget — a label with timed message support.
 *
 * set_message(text, duration) displays a message and optionally
 * clears it after `duration` seconds.  clear() removes the current
 * message immediately.
 * @extends Label
 */
class StatusBar extends Label {

    /**
     * Creates a new StatusBar widget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.halign='left'] - Horizontal text alignment.
     */
    constructor(options = {}) {
        super(null, options);
        this.element.classList.remove('label-widget');
        this.element.classList.add('statusbar-widget');

        this._timer = null;

        // JavaScript hack to bind "this" correctly for our methods
        this.set_message = this.set_message.bind(this);
        this.clear = this.clear.bind(this);

        // Start with empty placeholder
        this.set_text('');
    }

    /**
     * Display a message.  If duration is given (in seconds), the
     * message is automatically cleared after that time.
     * @param {string} text - The message text.
     * @param {number|null} [duration=null] - Auto-clear delay in seconds, or null to persist.
     */
    set_message(text, duration = null) {
        if (this._timer !== null) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        this.set_text(text);
        if (duration !== null && duration > 0) {
            this._timer = setTimeout(() => {
                this._timer = null;
                this.set_text('');
            }, duration * 1000);
        }
    }

    /**
     * Clear the current message.
     */
    clear() {
        if (this._timer !== null) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        this.set_text('');
    }
}

export { StatusBar };
