"use_strict";

import {Dialog} from "./Dialog.js";
import {ColorWidget} from "./ColorWidget.js";
import {Button} from "./Button.js";

/**
 * A color chooser dialog similar to QColorDialog.
 * Wraps a ColorWidget in a Dialog with OK/Cancel buttons.
 *
 * Callbacks:
 * - 'activated': fired when OK is clicked, with (widget, color_hex_string).
 * - 'pick': fired when the user changes the color interactively, with (widget, color_hex_string).
 * @extends Dialog
 */
class ColorDialog extends Dialog {

    /**
     * Creates a new ColorDialog.
     * @param {Object} [options] - Configuration options.
     * @param {string} [options.color='#ff0000'] - Initial color as a hex string.
     * @param {string} [options.title='Choose Color'] - Dialog title.
     * @param {boolean} [options.modal=false] - Whether the dialog is modal.
     * @param {boolean} [options.moveable=true] - Whether the dialog can be dragged.
     */
    constructor(options = {}) {
        let title = options.title || 'Choose Color';
        // pass empty buttons; we build our own OK/Cancel
        super(title, [], Object.assign({
            autoclose: false, moveable: true
        }, options));

        this.element.classList.add('colordialog-widget');

        // Create the embedded color picker widget
        this._colorWidget = new ColorWidget({
            color: options.color || '#ff0000'
        });

        // Forward pick callbacks from the inner widget
        this._colorWidget.add_callback('pick', (w, hex) => {
            this.make_callback('pick', hex);
        });

        let area = this.get_content_area();
        area.set_padding(8);
        area.set_spacing(6);
        area.add_widget(this._colorWidget, 1);

        this._buildButtons();

        this.enable_callback('activated');
        this.enable_callback('pick');

        this.resize(420, 390);
    }

    /** @private */
    _buildButtons() {
        this._buttonBox.set_spacing(6);

        let okBtn = new Button("OK");
        okBtn.add_callback('activated', () => {
            this.make_callback('activated', this.get_color());
            this.hide();
        });

        let cancelBtn = new Button("Cancel");
        cancelBtn.add_callback('activated', () => {
            this.hide();
        });

        this._buttonBox.add_widget(okBtn, 0);
        this._buttonBox.add_widget(cancelBtn, 0);
        this._vbox.add_widget(this._buttonBox, 0);
    }

    /**
     * Sets the dialog color from a hex string.
     * @param {string} hex - Color as '#rrggbb'.
     */
    set_color(hex) {
        this._colorWidget.set_color(hex);
    }

    /**
     * Returns the currently selected color as a hex string.
     * @returns {string} Color as '#rrggbb'.
     */
    get_color() {
        return this._colorWidget.get_color();
    }
}

export { ColorDialog };
