"use_strict";

import {Widget} from "./Widget.js";

/**
 * A numeric spin box widget with up/down buttons, similar to Qt's QSpinBox/QDoubleSpinBox.
 * Supports integer and float data types, keyboard arrow keys, and direct text entry.
 * Fires 'activated' callback with the current value on change.
 * @extends Widget
 */
class SpinBox extends Widget {

    /**
     * Creates a new SpinBox widget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.dtype='int'] - Data type: 'int' or 'float'.
     * @param {number} [options.min=0] - Minimum value.
     * @param {number} [options.max=99] - Maximum value.
     * @param {number} [options.step=1] - Step increment for up/down buttons.
     * @param {number} [options.value] - Initial value (defaults to min).
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'spinbox-widget';

        this.dtype = this.get_option(options, 'dtype', 'int');
        this.minval = this.get_option(options, 'min', 0);
        this.maxval = this.get_option(options, 'max', 99);
        this.incrval = this.get_option(options, 'step', 1);
        this.value = this.get_option(options, 'value', this.minval);

        // inner container holds the input + buttons, right-aligned
        let inner = document.createElement('div');
        inner.className = 'spinbox-inner';

        // build the input field
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'spinbox-input';
        inner.appendChild(this.input);

        // build the button container
        let btnContainer = document.createElement('div');
        btnContainer.className = 'spinbox-buttons';

        this.upButton = document.createElement('button');
        this.upButton.className = 'spinbox-up';
        this.upButton.innerHTML = '&#9650;';
        btnContainer.appendChild(this.upButton);

        this.downButton = document.createElement('button');
        this.downButton.className = 'spinbox-down';
        this.downButton.innerHTML = '&#9660;';
        btnContainer.appendChild(this.downButton);

        inner.appendChild(btnContainer);
        this.element.appendChild(inner);

        // JavaScript hack to bind "this" correctly for our methods
        this.set_value = this.set_value.bind(this);
        this.get_value = this.get_value.bind(this);
        this.set_limits = this.set_limits.bind(this);
        this._step = this._step.bind(this);
        this._on_input = this._on_input.bind(this);

        this.upButton.addEventListener('click', () => this._step(1));
        this.downButton.addEventListener('click', () => this._step(-1));
        this.input.addEventListener('change', this._on_input);
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this._step(1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this._step(-1);
            }
        });

        this.enable_callback('activated');
        this._display();
    }

    _clamp(val) {
        return Math.min(this.maxval, Math.max(this.minval, val));
    }

    _parse(str) {
        if (this.dtype === 'float') {
            return parseFloat(str);
        }
        return parseInt(str, 10);
    }

    _display() {
        if (this.dtype === 'float') {
            // show enough decimals to match the step precision
            let decimals = 0;
            let s = String(this.incrval);
            if (s.indexOf('.') !== -1) {
                decimals = s.split('.')[1].length;
            }
            this.input.value = this.value.toFixed(decimals);
        } else {
            this.input.value = this.value;
        }
    }

    _step(direction) {
        let newVal = this.value + direction * this.incrval;
        newVal = this._clamp(newVal);
        if (this.dtype === 'int') {
            newVal = Math.round(newVal);
        }
        if (newVal !== this.value) {
            this.value = newVal;
            this._display();
            this.make_callback('activated', this.value);
        }
    }

    _on_input(e) {
        let parsed = this._parse(this.input.value);
        if (isNaN(parsed)) {
            this._display();
            return;
        }
        parsed = this._clamp(parsed);
        if (this.dtype === 'int') {
            parsed = Math.round(parsed);
        }
        this.value = parsed;
        this._display();
        this.make_callback('activated', this.value);
    }

    /**
     * Sets the spin box value, clamped to the configured limits.
     * @param {number} val - The value to set.
     */
    set_value(val) {
        val = this._clamp(val);
        if (this.dtype === 'int') {
            val = Math.round(val);
        }
        this.value = val;
        this._display();
    }

    /**
     * Returns the current spin box value.
     * @returns {number} The current value.
     */
    get_value() {
        return this.value;
    }

    /**
     * Sets the minimum, maximum, and optional step values. Clamps current value to new range.
     * @param {number} minval - Minimum value.
     * @param {number} maxval - Maximum value.
     * @param {number} [incrval] - Step increment (optional).
     */
    set_limits(minval, maxval, incrval) {
        this.minval = minval;
        this.maxval = maxval;
        if (incrval !== undefined) {
            this.incrval = incrval;
        }
        this.value = this._clamp(this.value);
        this._display();
    }
}

export { SpinBox };
