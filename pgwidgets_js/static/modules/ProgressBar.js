"use_strict";

import {Widget} from "./Widget.js";

/**
 * A horizontal progress bar widget displaying a value from 0% to 100%.
 * @extends Widget
 */
class ProgressBar extends Widget {

    /**
     * Creates a new ProgressBar widget.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'progressbar-widget';

        this.fill = document.createElement('div');
        this.fill.className = 'progressbar-fill';
        this.element.appendChild(this.fill);

        this.label = document.createElement('span');
        this.label.className = 'progressbar-label';
        this.element.appendChild(this.label);

        this.value = 0;

        this._display();
    }

    _display() {
        let pct = this.value * 100;
        this.fill.style.width = pct + '%';
        this.label.textContent = Math.round(pct) + '%';
    }

    /**
     * Sets the progress value.
     * @param {number} value - A float between 0 (0%) and 1 (100%).
     */
    set_value(value) {
        this.value = Math.max(0, Math.min(1, value));
        this._display();
    }

    /**
     * Returns the current progress value.
     * @returns {number} A float between 0 and 1.
     */
    get_value() {
        return this.value;
    }
}

export { ProgressBar };
