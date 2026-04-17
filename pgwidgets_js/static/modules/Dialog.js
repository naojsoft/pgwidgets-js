"use_strict";

import {TopLevel} from "./TopLevel.js";
import {VBox, HBox} from "./Box.js";
import {Button} from "./Button.js";

/**
 * A dialog widget built on TopLevel. Contains a content area (VBox) and
 * an optional row of buttons. Fires 'activated' callback with the value
 * associated with the clicked button.
 * @extends TopLevel
 */
class Dialog extends TopLevel {

    /**
     * Creates a new Dialog.
     * @param {string|null} [title=null] - Dialog title (passed to TopLevel).
     * @param {Array} [buttons=[]] - Array of [text, value] tuples for dialog buttons.
     * @param {Object} [options] - Configuration options.
     * @param {boolean} [options.autoclose=false] - If true, hides the dialog when a button is clicked.
     * @param {boolean} [options.resizable=true] - Whether the dialog can be resized.
     * @param {boolean} [options.moveable=true] - Whether the dialog can be dragged.
     */
    constructor(title = null, buttons = [], options = {}) {
        let topOptions = Object.assign({}, options);
        if (title !== null) {
            topOptions.title = title;
        }
        super(topOptions);

        this.element.classList.add('dialog-widget');

        this._autoclose = this.get_option(options, 'autoclose', false);
        this._modal = this.get_option(options, 'modal', false);
        this._overlay = null;
        if (this._modal) {
            this.element.classList.add('dialog-modal');
        }

        // JavaScript hack to bind "this" correctly for our methods
        this.get_content_area = this.get_content_area.bind(this);

        // main layout: content area + button bar
        this._vbox = new VBox();
        this._vbox.set_spacing(4);

        this._contentArea = new VBox();
        this._contentArea.set_spacing(4);
        this._vbox.add_widget(this._contentArea, 1);

        // button bar
        this._buttonBox = new HBox();
        this._buttonBox.get_element().className = 'dialog-button-box';
        this._buttonBox.set_spacing(6);

        for (let [text, value] of buttons) {
            let btn = new Button(text);
            btn.add_callback('activated', () => {
                this.make_callback('activated', value);
                if (this._autoclose) {
                    this.hide();
                }
            });
            this._buttonBox.add_widget(btn, 0);
        }

        if (buttons.length > 0) {
            this._vbox.add_widget(this._buttonBox, 0);
        }

        this.set_widget(this._vbox);
        this.enable_callback('activated');
    }

    /** Shows the dialog, adding a modal overlay if modal is true. */
    show() {
        if (this._modal) {
            this._overlay = document.createElement('div');
            this._overlay.className = 'dialog-overlay';
            document.body.appendChild(this._overlay);
        }
        super.show();
    }

    /** Hides the dialog, removing the modal overlay if present. */
    hide() {
        super.hide();
        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }
    }

    /**
     * Returns the content area VBox where the user can add custom widgets.
     * @returns {VBox} The content area.
     */
    get_content_area() {
        return this._contentArea;
    }
}

export { Dialog };
