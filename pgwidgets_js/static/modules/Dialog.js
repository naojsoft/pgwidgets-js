"use_strict";

import {TopLevel} from "./TopLevel.js";
import {VBox, ButtonBox} from "./Box.js";
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
     * @param {boolean} [options.modal=false] - If true, shows a backdrop overlay that blocks interaction with other content.
     * @param {boolean} [options.resizable=true] - Whether the dialog can be resized.
     * @param {boolean} [options.moveable=true] - Whether the dialog can be dragged.
     */
    constructor(title = null, buttons = [], options = {}) {
        if (buttons === null || buttons === undefined) buttons = [];
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
        this.add_widget = this.add_widget.bind(this);
        this.insert_widget = this.insert_widget.bind(this);
        this.set_spacing = this.set_spacing.bind(this);

        // main layout: content area + button bar
        this._vbox = new VBox();
        this._vbox.set_spacing(4);

        this._contentArea = new VBox();
        this._contentArea.set_spacing(4);
        this._vbox.add_widget(this._contentArea, 1);

        // button bar
        this._buttonBox = new ButtonBox({halign: 'right'});
        this._buttonBox.get_element().classList.add('dialog-button-box');
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

    /** Shows the dialog, adding a modal overlay if modal is true. Centers if no position was set. */
    show() {
        if (this._modal) {
            this._overlay = document.createElement('div');
            this._overlay.className = 'dialog-overlay';
            document.body.appendChild(this._overlay);
        }
        // Check if position was already set (via set_position or drag)
        let hasPosition = this.element.style.left !== '' &&
                          this.element.style.top !== '';
        super.show();
        if (!hasPosition) {
            this._centerInViewport();
        }
    }

    /**
     * Centers the dialog in the browser viewport.
     * @private
     */
    _centerInViewport() {
        requestAnimationFrame(() => {
            let rect = this.element.getBoundingClientRect();
            let x = Math.max(0, (window.innerWidth - rect.width) / 2);
            let y = Math.max(0, (window.innerHeight - rect.height) / 2);
            this.set_position(x, y);
        });
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
     * Adds a widget to the dialog's content area.
     * @param {Widget} child - The widget to add.
     * @param {number} [stretch=0] - Stretch factor.
     */
    add_widget(child, stretch = 0) {
        this._contentArea.add_widget(child, stretch);
    }

    /**
     * Inserts a widget at the given index in the dialog's content area.
     * @param {number} index - 0-based position to insert at.
     * @param {Widget} child - The widget to insert.
     * @param {number} [stretch=0] - Stretch factor.
     */
    insert_widget(index, child, stretch = 0) {
        this._contentArea.insert_widget(index, child, stretch);
    }

    /**
     * Sets the spacing between children in the content area.
     * @param {number} [gap=0] - Spacing in pixels.
     */
    set_spacing(gap = 0) {
        this._contentArea.set_spacing(gap);
    }

    /**
     * Returns the content area VBox where the user can add custom widgets.
     * Use add_widget(), insert_widget(), and set_spacing() on the Dialog
     * directly for proper reconstruction support.
     * @returns {VBox} The content area.
     */
    get_content_area() {
        return this._contentArea;
    }

    /**
     * Shows the dialog at the given position, or centered if coordinates are null.
     * @param {number|null} [x=null] - Left position in pixels, or null to center.
     * @param {number|null} [y=null] - Top position in pixels, or null to center.
     */
    popup(x = null, y = null) {
        if (x != null && y != null) {
            this.set_position(x, y);
            if (this._modal) {
                this._overlay = document.createElement('div');
                this._overlay.className = 'dialog-overlay';
                document.body.appendChild(this._overlay);
            }
            super.show();
        } else {
            this.show();
        }
    }

    /**
     * Sets whether the dialog is modal.
     * @param {boolean} tf - If true, the dialog will show a backdrop overlay when visible.
     */
    set_modal(tf) {
        this._modal = tf;
        if (!tf && this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }
    }
}

export { Dialog };
