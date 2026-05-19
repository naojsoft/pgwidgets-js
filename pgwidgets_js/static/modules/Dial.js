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
     * @param {boolean} [options.show_value=false] - Whether to display the current value.
     * @param {string} [options.show_value_position='b'] - Position of the value label:
     *   'b' (bottom), 'ur' (upper right), 'ul' (upper left), 'lr' (lower right), 'll' (lower left).
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
        this._showValue = this.get_option(options, 'show_value', false);
        this._showValuePosition = this.get_option(options, 'show_value_position', 'b');
        this._decimals = this.get_option(options, 'decimals', null);

        // angle range: 210 to 510 (300 degree sweep, clockwise from lower-left
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

        // knob radius in viewBox units
        this._knobR = 35;

        // clip path to keep any knob icon inside the knob circle
        this._defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        this._clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        this._clipId = 'dial-clip-' + this.wid;
        this._clipPath.setAttribute('id', this._clipId);
        this._clipCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this._clipCircle.setAttribute('cx', '50');
        this._clipCircle.setAttribute('cy', '50');
        this._clipCircle.setAttribute('r', this._knobR);
        this._clipPath.appendChild(this._clipCircle);
        this._defs.appendChild(this._clipPath);
        this._svg.appendChild(this._defs);

        // knob circle
        this._knob = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this._knob.setAttribute('cx', '50');
        this._knob.setAttribute('cy', '50');
        this._knob.setAttribute('r', this._knobR);
        this._knob.classList.add('dial-knob');
        this._svg.appendChild(this._knob);

        // optional icon image displayed inside the knob
        this._knobIcon = null;
        this._knobIconUrl = null;
        this._knobIconSize = null;

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

        // value label
        this._valueLabel = document.createElement('span');
        this._valueLabel.className = 'dial-value';
        if (this._showValue) {
            this.element.appendChild(this._valueLabel);
            this._applyValuePosition();
        }

        this._svg.addEventListener('mousedown', this._onMouseDown);
        this._svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            let val = this.value + (e.deltaY < 0 ? this.step : -this.step);
            val = Math.min(this.max, Math.max(this.min, val));
            if (this.dtype === 'int') {
                val = Math.round(val);
            }
            this.value = val;
            this._updateVisual();
            this.make_callback('activated', this.get_value());
        });

        this.enable_callback('activated');
        this._updateVisual();
    }

    /**
     * Positions the value label according to _showValuePosition.
     * @private
     */
    _applyValuePosition() {
        if (this._showValuePosition === 'b') {
            // Place label below the dial, pulled up into the arc gap
            this.element.style.flexDirection = 'column';
            this._valueLabel.style.position = '';
            this._valueLabel.style.textAlign = 'center';
            this._valueLabel.style.marginTop = '-12%';
            this._valueLabel.style.top = '';
            this._valueLabel.style.bottom = '';
            this._valueLabel.style.left = '';
            this._valueLabel.style.right = '';
            return;
        }
        // Corner positions: overlay the label on the dial
        this.element.style.flexDirection = '';
        this.element.style.position = 'relative';
        this._valueLabel.style.position = 'absolute';
        this._valueLabel.style.textAlign = '';
        // reset all corners
        this._valueLabel.style.top = '';
        this._valueLabel.style.bottom = '';
        this._valueLabel.style.left = '';
        this._valueLabel.style.right = '';
        switch (this._showValuePosition) {
            case 'ul':
                this._valueLabel.style.top = '2px';
                this._valueLabel.style.left = '2px';
                break;
            case 'll':
                this._valueLabel.style.bottom = '2px';
                this._valueLabel.style.left = '2px';
                break;
            case 'lr':
                this._valueLabel.style.bottom = '2px';
                this._valueLabel.style.right = '2px';
                break;
            case 'ur':
            default:
                this._valueLabel.style.top = '2px';
                this._valueLabel.style.right = '2px';
                break;
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
                let s = String(this.step);
                if (s.indexOf('.') !== -1) {
                    decimals = s.split('.')[1].length;
                }
                this._valueLabel.textContent = val.toFixed(decimals);
            } else {
                this._valueLabel.textContent = val;
            }
        }
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

        // keep knob circle and clip in sync with current radius
        this._knob.setAttribute('r', this._knobR);
        this._clipCircle.setAttribute('r', this._knobR);

        // When a knob icon is set, it replaces the default knob circle and
        // indicator — the icon itself rotates with the value and the user
        // is expected to draw their own pointer mark into the image.
        let hasIcon = !!this._knobIcon;
        this._knob.style.display = hasIcon ? 'none' : '';
        this._indicator.style.display = hasIcon ? 'none' : '';

        // update indicator line (stay inside the knob)
        let indLen = Math.max(0, this._knobR - 3);
        let ix = 50 + indLen * Math.sin(rad);
        let iy = 50 - indLen * Math.cos(rad);
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

        // update knob icon, if any — rotate with the dial value. The icon's
        // natural (unrotated) orientation corresponds to the middle of the
        // dial range (pointing straight up).
        if (this._knobIcon) {
            let size = this._knobIconSize != null
                ? this._knobIconSize
                : this._knobR * 2;
            this._knobIcon.setAttribute('x', 50 - size / 2);
            this._knobIcon.setAttribute('y', 50 - size / 2);
            this._knobIcon.setAttribute('width', size);
            this._knobIcon.setAttribute('height', size);
            let rotDeg = angle - 360;
            this._knobIcon.setAttribute('transform',
                `rotate(${rotDeg} 50 50)`);
        }

        this._updateValueLabel();
    }

    /**
     * Converts a pixel length to viewBox units using the current SVG size.
     * The SVG viewBox is fixed at 100x100.
     * @param {number} px - Length in pixels.
     * @returns {number} Length in viewBox units.
     * @private
     */
    _pxToVb(px) {
        let rect = this._svg.getBoundingClientRect();
        let side = Math.min(rect.width, rect.height);
        if (!side) return px;  // fallback: treat as viewBox units
        return px * 100 / side;
    }

    /**
     * Sets the diameter of the knob in pixels.
     * @param {number} len_px - Knob diameter in pixels.
     */
    set_knob_diameter(len_px) {
        let vb = this._pxToVb(len_px);
        // clamp so the knob stays inside the arc (radius 43)
        this._knobR = Math.max(1, Math.min(42, vb / 2));
        this._updateVisual();
    }

    /**
     * Sets an icon image to display inside the knob.
     * If `size` is omitted, the icon fills most of the knob area.
     * Pass `url=null` to remove a previously set icon.
     * @param {string|null} url - Image URL, or null to clear.
     * @param {number} [size] - Icon size in pixels (square).
     */
    set_icon(url, size) {
        if (url == null) {
            if (this._knobIcon) {
                this._svg.removeChild(this._knobIcon);
                this._knobIcon = null;
            }
            this._knobIconUrl = null;
            this._knobIconSize = null;
            this._updateVisual();
            return;
        }
        this._knobIconUrl = url;
        this._knobIconSize = (size != null) ? this._pxToVb(size) : null;
        if (!this._knobIcon) {
            this._knobIcon = document.createElementNS(
                'http://www.w3.org/2000/svg', 'image');
            this._knobIcon.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            this._knobIcon.setAttribute('clip-path', 'url(#' + this._clipId + ')');
            this._knobIcon.classList.add('dial-knob-icon');
            // Insert above knob but below indicator
            this._svg.insertBefore(this._knobIcon, this._indicator);
        }
        this._knobIcon.setAttributeNS(
            'http://www.w3.org/1999/xlink', 'href', url);
        this._knobIcon.setAttribute('href', url);
        this._updateVisual();
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

export { Dial };
