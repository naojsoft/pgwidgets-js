"use_strict";

import {Widget} from "./Widget.js";

/**
 * A rotary dial (knob) widget for selecting numeric values.
 * Supports integer and float data types, optional continuous tracking,
 * and configurable limits. Fires 'activated' callback with the current value.
 * @extends Widget
 */
class Dial extends Widget {

    /**
     * Creates a new Dial widget.
     * @param {Object} [options] - Configuration options.
     * @param {boolean} [options.track=false] - If true, fires callback continuously while dragging;
     *   if false, only fires on mouse release.
     * @param {string} [options.dtype='int'] - Data type: 'int' or 'float'.
     * @param {number} [options.min=0] - Minimum value.
     * @param {number} [options.max=100] - Maximum value.
     * @param {number} [options.step=1] - Step increment.
     * @param {number} [options.value=50] - Initial value.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'dial-widget';

        this.dtype = this.get_option(options, 'dtype', 'int');
        this.min = this.get_option(options, 'min', 0);
        this.max = this.get_option(options, 'max', 100);
        this.step = this.get_option(options, 'step', 1);
        this.value = this.get_option(options, 'value', 50);
        this.track = this.get_option(options, 'track', false);

        // angle range: 210° to 510° (300° sweep, clockwise from lower-left
        // through top to lower-right, gap at bottom)
        this._startAngle = 210;
        this._endAngle = 510;

        // build the knob SVG
        this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this._svg.setAttribute('viewBox', '0 0 100 100');
        this._svg.classList.add('dial-svg');

        // track arc (background)
        this._trackArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this._trackArc.classList.add('dial-track');
        this._svg.appendChild(this._trackArc);

        // value arc (filled portion)
        this._valueArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this._valueArc.classList.add('dial-value-arc');
        this._svg.appendChild(this._valueArc);

        // knob circle
        this._knob = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this._knob.setAttribute('cx', '50');
        this._knob.setAttribute('cy', '50');
        this._knob.setAttribute('r', '35');
        this._knob.classList.add('dial-knob');
        this._svg.appendChild(this._knob);

        // indicator line
        this._indicator = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        this._indicator.setAttribute('x1', '50');
        this._indicator.setAttribute('y1', '50');
        this._indicator.classList.add('dial-indicator');
        this._svg.appendChild(this._indicator);

        // tick marks
        this._ticks = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this._ticks.classList.add('dial-ticks');
        this._svg.appendChild(this._ticks);
        this._buildTicks();

        this.element.appendChild(this._svg);

        // JavaScript hack to bind "this" correctly for our methods
        this.set_value = this.set_value.bind(this);
        this.get_value = this.get_value.bind(this);
        this.set_limits = this.set_limits.bind(this);
        this.set_tracking = this.set_tracking.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);

        this._svg.addEventListener('mousedown', this._onMouseDown);

        this.enable_callback('activated');
        this._updateVisual();
    }

    /**
     * Builds tick marks around the dial arc.
     * @private
     */
    _buildTicks() {
        while (this._ticks.firstChild) {
            this._ticks.removeChild(this._ticks.firstChild);
        }
        const numTicks = 11;
        for (let i = 0; i < numTicks; i++) {
            let frac = i / (numTicks - 1);
            let angle = this._startAngle + frac * (this._endAngle - this._startAngle);
            let rad = angle * Math.PI / 180;
            let cx = 50, cy = 50, r1 = 40, r2 = 45;
            let tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tick.setAttribute('x1', cx + r1 * Math.sin(rad));
            tick.setAttribute('y1', cy - r1 * Math.cos(rad));
            tick.setAttribute('x2', cx + r2 * Math.sin(rad));
            tick.setAttribute('y2', cy - r2 * Math.cos(rad));
            tick.classList.add('dial-tick');
            this._ticks.appendChild(tick);
        }
    }

    /**
     * Computes an SVG arc path between two angles at a given radius.
     * @param {number} startAngle - Start angle in degrees (0 = top).
     * @param {number} endAngle - End angle in degrees.
     * @param {number} radius - Arc radius.
     * @returns {string} SVG path d attribute.
     * @private
     */
    _arcPath(startAngle, endAngle, radius) {
        const cx = 50, cy = 50;
        const startRad = startAngle * Math.PI / 180;
        const endRad = endAngle * Math.PI / 180;
        const x1 = cx + radius * Math.sin(startRad);
        const y1 = cy - radius * Math.cos(startRad);
        const x2 = cx + radius * Math.sin(endRad);
        const y2 = cy - radius * Math.cos(endRad);
        const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
        return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    }

    /**
     * Updates the visual state of the dial to reflect the current value.
     * @private
     */
    _updateVisual() {
        let frac = (this.value - this.min) / (this.max - this.min);
        frac = Math.max(0, Math.min(1, frac));
        let angle = this._startAngle + frac * (this._endAngle - this._startAngle);
        let rad = angle * Math.PI / 180;

        // update indicator line
        let ix = 50 + 30 * Math.sin(rad);
        let iy = 50 - 30 * Math.cos(rad);
        this._indicator.setAttribute('x2', ix);
        this._indicator.setAttribute('y2', iy);

        // update track arc (full range)
        this._trackArc.setAttribute('d',
            this._arcPath(this._startAngle, this._endAngle, 43));

        // update value arc
        if (frac > 0.001) {
            this._valueArc.setAttribute('d',
                this._arcPath(this._startAngle, angle, 43));
        } else {
            this._valueArc.setAttribute('d', '');
        }
    }

    /**
     * Converts a mouse event to a dial value based on angle from center.
     * @param {MouseEvent} e - The mouse event.
     * @returns {number} The computed value.
     * @private
     */
    _eventToValue(e) {
        let rect = this._svg.getBoundingClientRect();
        let cx = rect.left + rect.width / 2;
        let cy = rect.top + rect.height / 2;
        let dx = e.clientX - cx;
        let dy = e.clientY - cy;
        // angle in degrees, 0 = top, clockwise positive
        let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
        if (angle < 0) angle += 360;

        // shift into the start..end range (which wraps past 360)
        if (angle < this._startAngle) angle += 360;

        // clamp to arc range, snapping to nearest end in the dead zone
        if (angle > this._endAngle) {
            let midDead = (this._endAngle + this._startAngle + 360) / 2;
            angle = (angle < midDead) ? this._endAngle : this._startAngle;
        }

        let frac = (angle - this._startAngle) / (this._endAngle - this._startAngle);
        let val = this.min + frac * (this.max - this.min);

        // snap to step
        val = Math.round(val / this.step) * this.step;
        val = Math.min(this.max, Math.max(this.min, val));

        if (this.dtype === 'int') {
            val = Math.round(val);
        }
        return val;
    }

    /** @private */
    _onMouseDown(e) {
        e.preventDefault();
        this.value = this._eventToValue(e);
        this._updateVisual();
        if (this.track) {
            this.make_callback('activated', this.get_value());
        }
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup', this._onMouseUp);
    }

    /** @private */
    _onMouseMove(e) {
        this.value = this._eventToValue(e);
        this._updateVisual();
        if (this.track) {
            this.make_callback('activated', this.get_value());
        }
    }

    /** @private */
    _onMouseUp(e) {
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);
        this.value = this._eventToValue(e);
        this._updateVisual();
        this.make_callback('activated', this.get_value());
    }

    /**
     * Sets the dial value.
     * @param {number} num - The value to set.
     */
    set_value(num) {
        this.value = num;
        this._updateVisual();
    }

    /**
     * Returns the current dial value, cast to the configured dtype.
     * @returns {number} The current value (int or float).
     */
    get_value() {
        let val = this.value;
        if (this.dtype === 'int') {
            val = Math.round(val);
        }
        return val;
    }

    /**
     * Sets whether the dial fires callbacks continuously while dragging.
     * @param {boolean} track - If true, fire continuously; if false, only on release.
     */
    set_tracking(track) {
        this.track = track;
    }

    /**
     * Sets the minimum, maximum, and optional step values. Clamps current value to new range.
     * @param {number} minval - Minimum value.
     * @param {number} maxval - Maximum value.
     * @param {number} [incrval] - Step increment (optional).
     */
    set_limits(minval, maxval, incrval) {
        this.min = minval;
        this.max = maxval;
        if (incrval !== undefined) {
            this.step = incrval;
        }
        this.value = Math.min(this.max, Math.max(this.min, this.value));
        this._buildTicks();
        this._updateVisual();
    }
}

export { Dial };
