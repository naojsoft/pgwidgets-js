"use_strict";

import {Widget} from "./Widget.js";
import {VBox, HBox} from "./Box.js";
import {Label} from "./Label.js";
import {TextEntry} from "./TextEntry.js";
import {SpinBox} from "./SpinBox.js";

/**
 * An embeddable color chooser widget similar to QColorDialog's picker area.
 * Provides a saturation-value picker, hue strip, color preview,
 * and numeric inputs for HSV, RGB, and hex.
 *
 * Callbacks:
 * - 'pick': fired when the user changes the color interactively,
 *   with (widget, color_hex_string).
 * @extends Widget
 */
class ColorWidget extends Widget {

    /**
     * Creates a new ColorWidget.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.color='#ff0000'] - Initial color as a hex string.
     */
    constructor(options = {}) {
        super();
        this.element = document.createElement('div');
        this.element.className = 'colorwidget';

        // internal HSV state (h: 0-360, s: 0-1, v: 0-1)
        this._h = 0;
        this._s = 1;
        this._v = 1;
        this._updating = false;

        this._buildUI();

        this.enable_callback('pick');

        let initColor = this.get_option(options, 'color', '#ff0000');
        this.set_color(initColor);
    }

    /** @private */
    _buildUI() {
        let topRow = new HBox();
        topRow.set_spacing(8);

        // --- SV picker canvas ---
        this._svSize = 200;
        this._svCanvas = document.createElement('canvas');
        this._svCanvas.className = 'colordialog-sv-canvas';
        this._svCanvas.width = this._svSize;
        this._svCanvas.height = this._svSize;
        this._svCtx = this._svCanvas.getContext('2d');

        // SV picker cursor
        this._svCursor = document.createElement('div');
        this._svCursor.className = 'colordialog-sv-cursor';

        let svContainer = document.createElement('div');
        svContainer.className = 'colordialog-sv-container';
        svContainer.style.width = this._svSize + 'px';
        svContainer.style.height = this._svSize + 'px';
        svContainer.appendChild(this._svCanvas);
        svContainer.appendChild(this._svCursor);

        // SV mouse handling
        let svDrag = false;
        const svPick = (e) => {
            let rect = this._svCanvas.getBoundingClientRect();
            let x = Math.max(0, Math.min(this._svSize - 1, e.clientX - rect.left));
            let y = Math.max(0, Math.min(this._svSize - 1, e.clientY - rect.top));
            this._s = x / (this._svSize - 1);
            this._v = 1 - y / (this._svSize - 1);
            this._updateFromHSV(true);
        };
        svContainer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            svDrag = true;
            svPick(e);
        });
        document.addEventListener('mousemove', (e) => {
            if (svDrag) svPick(e);
        });
        document.addEventListener('mouseup', () => { svDrag = false; });

        // --- Hue strip canvas ---
        this._hueWidth = 24;
        this._hueCanvas = document.createElement('canvas');
        this._hueCanvas.className = 'colordialog-hue-canvas';
        this._hueCanvas.width = this._hueWidth;
        this._hueCanvas.height = this._svSize;
        this._hueCtx = this._hueCanvas.getContext('2d');

        // Hue cursor
        this._hueCursor = document.createElement('div');
        this._hueCursor.className = 'colordialog-hue-cursor';

        let hueContainer = document.createElement('div');
        hueContainer.className = 'colordialog-hue-container';
        hueContainer.style.width = this._hueWidth + 'px';
        hueContainer.style.height = this._svSize + 'px';
        hueContainer.appendChild(this._hueCanvas);
        hueContainer.appendChild(this._hueCursor);

        // Hue mouse handling
        let hueDrag = false;
        const huePick = (e) => {
            let rect = this._hueCanvas.getBoundingClientRect();
            let y = Math.max(0, Math.min(this._svSize - 1, e.clientY - rect.top));
            this._h = (y / (this._svSize - 1)) * 360;
            this._updateFromHSV(true);
        };
        hueContainer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            hueDrag = true;
            huePick(e);
        });
        document.addEventListener('mousemove', (e) => {
            if (hueDrag) huePick(e);
        });
        document.addEventListener('mouseup', () => { hueDrag = false; });

        // --- Right panel: preview + inputs ---
        let rightPanel = new VBox();
        rightPanel.set_spacing(4);

        // Color preview
        let previewRow = new HBox();
        previewRow.set_spacing(4);

        this._newSwatch = document.createElement('div');
        this._newSwatch.className = 'colordialog-swatch';
        this._oldSwatch = document.createElement('div');
        this._oldSwatch.className = 'colordialog-swatch';
        this._oldSwatch.style.backgroundColor = '#ff0000';

        let newLabel = new Label("New");
        newLabel.set_halign("center");
        let oldLabel = new Label("Old");
        oldLabel.set_halign("center");

        let newBox = new VBox();
        newBox.set_spacing(2);
        newBox.add_widget(newLabel, 0);
        let newSwatchWrap = document.createElement('div');
        newSwatchWrap.style.display = 'flex';
        newSwatchWrap.style.justifyContent = 'center';
        newSwatchWrap.appendChild(this._newSwatch);
        let newSwatchWidget = { get_element: () => newSwatchWrap };
        newBox.add_widget(newSwatchWidget, 0);

        let oldBox = new VBox();
        oldBox.set_spacing(2);
        oldBox.add_widget(oldLabel, 0);
        let oldSwatchWrap = document.createElement('div');
        oldSwatchWrap.style.display = 'flex';
        oldSwatchWrap.style.justifyContent = 'center';
        oldSwatchWrap.appendChild(this._oldSwatch);
        let oldSwatchWidget = { get_element: () => oldSwatchWrap };
        oldBox.add_widget(oldSwatchWidget, 0);

        previewRow.add_widget(newBox, 1);
        previewRow.add_widget(oldBox, 1);
        rightPanel.add_widget(previewRow, 0);

        // HSV inputs
        let hsvLabel = new Label("HSV");
        hsvLabel.set_font("sans-serif", 11, "bold");
        rightPanel.add_widget(hsvLabel, 0);

        let hRow = new HBox();
        hRow.set_spacing(4);
        hRow.add_widget(new Label("H:"), 0);
        this._hSpin = new SpinBox({min: 0, max: 360, step: 1, value: 0});
        this._hSpin.add_callback('activated', (w, val) => {
            if (!this._updating) { this._h = val; this._updateFromHSV(true); }
        });
        hRow.add_widget(this._hSpin, 1);
        rightPanel.add_widget(hRow, 0);

        let sRow = new HBox();
        sRow.set_spacing(4);
        sRow.add_widget(new Label("S:"), 0);
        this._sSpin = new SpinBox({min: 0, max: 100, step: 1, value: 100});
        this._sSpin.add_callback('activated', (w, val) => {
            if (!this._updating) { this._s = val / 100; this._updateFromHSV(true); }
        });
        sRow.add_widget(this._sSpin, 1);
        rightPanel.add_widget(sRow, 0);

        let vRow = new HBox();
        vRow.set_spacing(4);
        vRow.add_widget(new Label("V:"), 0);
        this._vSpin = new SpinBox({min: 0, max: 100, step: 1, value: 100});
        this._vSpin.add_callback('activated', (w, val) => {
            if (!this._updating) { this._v = val / 100; this._updateFromHSV(true); }
        });
        vRow.add_widget(this._vSpin, 1);
        rightPanel.add_widget(vRow, 0);

        // RGB inputs
        let rgbLabel = new Label("RGB");
        rgbLabel.set_font("sans-serif", 11, "bold");
        rightPanel.add_widget(rgbLabel, 0);

        let rRow = new HBox();
        rRow.set_spacing(4);
        rRow.add_widget(new Label("R:"), 0);
        this._rSpin = new SpinBox({min: 0, max: 255, step: 1, value: 255});
        this._rSpin.add_callback('activated', (w, val) => {
            if (!this._updating) this._setFromRGB(true);
        });
        rRow.add_widget(this._rSpin, 1);
        rightPanel.add_widget(rRow, 0);

        let gRow = new HBox();
        gRow.set_spacing(4);
        gRow.add_widget(new Label("G:"), 0);
        this._gSpin = new SpinBox({min: 0, max: 255, step: 1, value: 0});
        this._gSpin.add_callback('activated', (w, val) => {
            if (!this._updating) this._setFromRGB(true);
        });
        gRow.add_widget(this._gSpin, 1);
        rightPanel.add_widget(gRow, 0);

        let bRow = new HBox();
        bRow.set_spacing(4);
        bRow.add_widget(new Label("B:"), 0);
        this._bSpin = new SpinBox({min: 0, max: 255, step: 1, value: 0});
        this._bSpin.add_callback('activated', (w, val) => {
            if (!this._updating) this._setFromRGB(true);
        });
        bRow.add_widget(this._bSpin, 1);
        rightPanel.add_widget(bRow, 0);

        // Hex input
        let hexRow = new HBox();
        hexRow.set_spacing(4);
        hexRow.add_widget(new Label("#"), 0);
        this._hexEntry = new TextEntry({text: 'ff0000'});
        this._hexEntry.set_length(7);
        this._hexEntry.add_callback('activated', (w, text) => {
            if (!this._updating) {
                let hex = text.replace(/^#/, '');
                if (/^[0-9a-fA-F]{6}$/.test(hex)) {
                    let rgb = this._hexToRGB('#' + hex);
                    let hsv = this._rgbToHSV(rgb[0], rgb[1], rgb[2]);
                    this._h = hsv[0]; this._s = hsv[1]; this._v = hsv[2];
                    this._updateFromHSV(true);
                }
            }
        });
        hexRow.add_widget(this._hexEntry, 1);
        rightPanel.add_widget(hexRow, 0);

        // Wrap raw DOM elements as widget-like objects for the HBox
        let svWidget = { get_element: () => svContainer };
        let hueWidget = { get_element: () => hueContainer };

        topRow.add_widget(svWidget, 0);
        topRow.add_widget(hueWidget, 0);
        topRow.add_widget(rightPanel, 1);

        // Pack topRow into our element
        this.element.appendChild(topRow.get_element());

        // Draw initial hue strip
        this._drawHueStrip();
    }

    /**
     * Sets the color from a hex string.
     * @param {string} hex - Color as '#rrggbb'.
     */
    set_color(hex) {
        let rgb = this._hexToRGB(hex);
        let hsv = this._rgbToHSV(rgb[0], rgb[1], rgb[2]);
        this._h = hsv[0];
        this._s = hsv[1];
        this._v = hsv[2];
        this._oldSwatch.style.backgroundColor = hex;
        this._updateFromHSV(false);
    }

    /**
     * Returns the currently selected color as a hex string.
     * @returns {string} Color as '#rrggbb'.
     */
    get_color() {
        return this._hexFromHSV();
    }

    /** @private */
    _updateFromHSV(firePick) {
        this._updating = true;

        let rgb = this._hsvToRGB(this._h, this._s, this._v);
        let hex = this._rgbToHex(rgb[0], rgb[1], rgb[2]);

        // update canvases
        this._drawSVCanvas();
        this._drawHueStrip();

        // update cursors
        let svX = this._s * (this._svSize - 1);
        let svY = (1 - this._v) * (this._svSize - 1);
        this._svCursor.style.left = svX + 'px';
        this._svCursor.style.top = svY + 'px';

        let hueY = (this._h / 360) * (this._svSize - 1);
        this._hueCursor.style.top = hueY + 'px';

        // update swatches
        this._newSwatch.style.backgroundColor = hex;

        // update spinboxes
        this._hSpin.set_value(Math.round(this._h));
        this._sSpin.set_value(Math.round(this._s * 100));
        this._vSpin.set_value(Math.round(this._v * 100));
        this._rSpin.set_value(rgb[0]);
        this._gSpin.set_value(rgb[1]);
        this._bSpin.set_value(rgb[2]);

        // update hex entry
        this._hexEntry.set_text(hex.substring(1));

        this._updating = false;

        if (firePick) {
            this.make_callback('pick', hex);
        }
    }

    /** @private */
    _setFromRGB(firePick) {
        let r = this._rSpin.get_value();
        let g = this._gSpin.get_value();
        let b = this._bSpin.get_value();
        let hsv = this._rgbToHSV(r, g, b);
        this._h = hsv[0];
        this._s = hsv[1];
        this._v = hsv[2];
        this._updateFromHSV(firePick);
    }

    /** @private */
    _drawSVCanvas() {
        let ctx = this._svCtx;
        let size = this._svSize;
        let imgData = ctx.createImageData(size, size);
        let data = imgData.data;
        for (let y = 0; y < size; y++) {
            let v = 1 - y / (size - 1);
            for (let x = 0; x < size; x++) {
                let s = x / (size - 1);
                let rgb = this._hsvToRGB(this._h, s, v);
                let idx = (y * size + x) * 4;
                data[idx] = rgb[0];
                data[idx + 1] = rgb[1];
                data[idx + 2] = rgb[2];
                data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }

    /** @private */
    _drawHueStrip() {
        let ctx = this._hueCtx;
        let w = this._hueWidth;
        let h = this._svSize;
        let imgData = ctx.createImageData(w, h);
        let data = imgData.data;
        for (let y = 0; y < h; y++) {
            let hue = (y / (h - 1)) * 360;
            let rgb = this._hsvToRGB(hue, 1, 1);
            for (let x = 0; x < w; x++) {
                let idx = (y * w + x) * 4;
                data[idx] = rgb[0];
                data[idx + 1] = rgb[1];
                data[idx + 2] = rgb[2];
                data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }

    // --- Color conversion utilities ---

    /** @private */
    _hsvToRGB(h, s, v) {
        h = ((h % 360) + 360) % 360;
        let c = v * s;
        let x = c * (1 - Math.abs((h / 60) % 2 - 1));
        let m = v - c;
        let r, g, b;
        if (h < 60)       { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else               { r = c; g = 0; b = x; }
        return [
            Math.round((r + m) * 255),
            Math.round((g + m) * 255),
            Math.round((b + m) * 255)
        ];
    }

    /** @private */
    _rgbToHSV(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        let max = Math.max(r, g, b);
        let min = Math.min(r, g, b);
        let d = max - min;
        let h = 0;
        if (d !== 0) {
            if (max === r)      h = 60 * (((g - b) / d) % 6);
            else if (max === g) h = 60 * ((b - r) / d + 2);
            else                h = 60 * ((r - g) / d + 4);
        }
        if (h < 0) h += 360;
        let s = max === 0 ? 0 : d / max;
        return [h, s, max];
    }

    /** @private */
    _rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(c =>
            c.toString(16).padStart(2, '0')).join('');
    }

    /** @private */
    _hexFromHSV() {
        let rgb = this._hsvToRGB(this._h, this._s, this._v);
        return this._rgbToHex(rgb[0], rgb[1], rgb[2]);
    }

    /** @private */
    _hexToRGB(hex) {
        let rgbMatch = hex.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
        if (rgbMatch) {
            return [
                parseInt(rgbMatch[1], 10),
                parseInt(rgbMatch[2], 10),
                parseInt(rgbMatch[3], 10)
            ];
        }
        hex = hex.replace(/^#/, '');
        return [
            parseInt(hex.substring(0, 2), 16),
            parseInt(hex.substring(2, 4), 16),
            parseInt(hex.substring(4, 6), 16)
        ];
    }
}

export { ColorWidget };
