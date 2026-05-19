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
     * @param {boolean} [options.show_value=false] - Whether to display the current value.
     * @param {string} [options.show_value_position='r'] - Position of the value label:
     *   'l' (left), 't' (top), 'r' (right), 'b' (bottom).
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {orientation: 'horizontal', track: false}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'slider-widget';

        this._input = document.createElement('input');
        this._input.className = 'slider-input';
        this._input.type = 'range';

        this.dtype = this.get_option(options, 'dtype', 'int');
        this._input.min = this.get_option(options, 'min', 0);
        this._input.max = this.get_option(options, 'max', 100);
        this._input.step = this.get_option(options, 'step', 1);
        this._input.value = this.get_option(options, 'value', 50);

        this.track = this.get_option(options, 'track', false);
        this._showValue = this.get_option(options, 'show_value', false);
        this._showValuePosition = this.get_option(options, 'show_value_position', 'r');
        this._decimals = this.get_option(options, 'decimals', null);

        // value label
        this._valueLabel = document.createElement('span');
        this._valueLabel.className = 'slider-value';

        if (this._showValue) {
            this._applyValuePosition();
        } else {
            this.element.appendChild(this._input);
        }

        // 'input' fires continuously while dragging;
        // 'change' fires only on mouse release
        if (this.track) {
            this._input.addEventListener("input", this._cb_redirect);
        } else {
            this._input.addEventListener("change", this._cb_redirect);
        }
        // always update the label while dragging
        this._input.addEventListener("input", () => this._updateValueLabel());

        this._input.addEventListener('wheel', (e) => {
            e.preventDefault();
            let step = Number(this._input.step) || 1;
            let val = this.get_value() + (e.deltaY < 0 ? step : -step);
            val = Math.min(Number(this._input.max), Math.max(Number(this._input.min), val));
            this._input.value = val;
            this._updateValueLabel();
            this.make_callback('activated', this.get_value());
        });

        this.enable_callback('activated');
        this._updateValueLabel();
    }

    /**
     * Arranges the input and value label according to _showValuePosition.
     * @private
     */
    _applyValuePosition() {
        // Clear existing children
        while (this.element.firstChild) {
            this.element.removeChild(this.element.firstChild);
        }
        let pos = this._showValuePosition;
        if (pos === 't' || pos === 'b') {
            this.element.style.flexDirection = 'column';
            this._valueLabel.style.textAlign = 'center';
        } else {
            this.element.style.flexDirection = 'row';
        }
        if (pos === 'l' || pos === 't') {
            this.element.appendChild(this._valueLabel);
            this.element.appendChild(this._input);
        } else {
            this.element.appendChild(this._input);
            this.element.appendChild(this._valueLabel);
        }
    }

    /**
     * Updates the value label display.
     * @private
     */
    _updateValueLabel() {
        if (this._showValue) {
            let val = this.get_value();
            if (this._decimals != null) {
                this._valueLabel.textContent = val.toFixed(this._decimals);
            } else if (this.dtype === 'float') {
                let decimals = 0;
                let s = String(this._input.step);
                if (s.indexOf('.') !== -1) {
                    decimals = s.split('.')[1].length;
                }
                this._valueLabel.textContent = val.toFixed(decimals);
            } else {
                this._valueLabel.textContent = val;
            }
        }
    }

    _cb_redirect = (event) => {
        this._updateValueLabel();
        this.make_callback('activated', this.get_value());
    }

    /**
     * Sets the slider value.
     * @param {number} num - The value to set.
     */
    set_value(num) {
        this._input.value = num;
        this._updateValueLabel();
    }

    /**
     * Returns the current slider value, cast to the configured dtype.
     * @returns {number} The current value (int or float).
     */
    get_value() {
        let val = Number(this._input.value);
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
        this._input.min = minval;
        this._input.max = maxval;
        if (incrval !== undefined) {
            this._input.step = incrval;
        }
        // clamp current value to new limits
        let val = Number(this._input.value);
        val = Math.min(maxval, Math.max(minval, val));
        this._input.value = val;
        this._updateValueLabel();
    }

    /**
     * Sets whether tracking is enabled.
     * @param {boolean} track - If true, fire continuously; if false, only on release.
     */
    set_tracking(track) {
        if (track === this.track) return;
        // Remove the old listener and add the new one
        if (this.track) {
            this._input.removeEventListener("input", this._cb_redirect);
        } else {
            this._input.removeEventListener("change", this._cb_redirect);
        }
        this.track = track;
        if (this.track) {
            this._input.addEventListener("input", this._cb_redirect);
        } else {
            this._input.addEventListener("change", this._cb_redirect);
        }
    }

    /**
     * Sets the number of decimal places for the value display.
     * Pass null to revert to deriving it from the step value.
     * Has no effect when dtype is 'int' and decimals is null.
     * @param {number|null} num - Decimal places, or null for auto.
     */
    set_decimals(num) {
        this._decimals = (num == null) ? null : Math.max(0, num|0);
        this._updateValueLabel();
    }
}

export { Slider };
