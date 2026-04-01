"use_strict";

import {Widget} from "./Widget.js";

/**
 * A slider (range input) widget for selecting numeric values.
 * Supports integer and float data types, optional continuous tracking,
 * and configurable limits. Fires 'activated' callback with the current value.
 * @extends Widget
 */
class Slider extends Widget {

    /**
     * Creates a new Slider widget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.orientation='horizontal'] - Slider orientation (currently only horizontal).
     * @param {boolean} [options.track=false] - If true, fires callback continuously while dragging;
     *   if false, only fires on mouse release.
     * @param {string} [options.dtype='int'] - Data type: 'int' or 'float'.
     * @param {number} [options.min=0] - Minimum value.
     * @param {number} [options.max=100] - Maximum value.
     * @param {number} [options.step=1] - Step increment.
     * @param {number} [options.value=50] - Initial value.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {orientation: 'horizontal', track: false}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('input');
        }
        this.element.className = 'slider-widget';
        this.element.type = 'range';

        this.dtype = this.get_option(options, 'dtype', 'int');
        this.element.min = this.get_option(options, 'min', 0);
        this.element.max = this.get_option(options, 'max', 100);
        this.element.step = this.get_option(options, 'step', 1);
        this.element.value = this.get_option(options, 'value', 50);

        this.track = this.get_option(options, 'track', false);

        // JavaScript hack to bind "this" correctly for our methods
        this.set_value = this.set_value.bind(this);
        this.get_value = this.get_value.bind(this);
        this.set_limits = this.set_limits.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        // 'input' fires continuously while dragging;
        // 'change' fires only on mouse release
        if (this.track) {
            this.element.addEventListener("input", this._cb_redirect);
        } else {
            this.element.addEventListener("change", this._cb_redirect);
        }
        this.enable_callback('activated');
    }

    _cb_redirect(event) {
        this.make_callback('activated', this.get_value());
    }

    /**
     * Sets the slider value.
     * @param {number} num - The value to set.
     */
    set_value(num) {
        this.element.value = num;
    }

    /**
     * Returns the current slider value, cast to the configured dtype.
     * @returns {number} The current value (int or float).
     */
    get_value() {
        let val = Number(this.element.value);
        if (this.dtype === 'int') {
            val = Math.round(val);
        }
        return val;
    }

    /**
     * Sets the minimum, maximum, and optional step values. Clamps current value to new range.
     * @param {number} minval - Minimum value.
     * @param {number} maxval - Maximum value.
     * @param {number} [incrval] - Step increment (optional).
     */
    set_limits(minval, maxval, incrval) {
        this.element.min = minval;
        this.element.max = maxval;
        if (incrval !== undefined) {
            this.element.step = incrval;
        }
        // clamp current value to new limits
        let val = Number(this.element.value);
        val = Math.min(maxval, Math.max(minval, val));
        this.element.value = val;
    }
}

export { Slider };
