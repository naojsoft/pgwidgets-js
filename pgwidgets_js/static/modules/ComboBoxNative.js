"use_strict";

import {Widget} from "./Widget.js";

/**
 * A dropdown select (combo box) widget.
 * Fires the 'activated' callback with the selected index when clicked.
 * @extends Widget
 */
class ComboBoxNative extends Widget {

    /**
     * Creates a new ComboBox widget.
     * @param {Object} [options] - Configuration options.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('select');
        }
        
        this.element.className = 'combobox-native-widget';
        
        // JavaScript hack to bind "this" correctly for our methods
        this.append_text = this.append_text.bind(this);
        this.insert_alpha = this.insert_alpha.bind(this);
        this.delete_alpha = this.delete_alpha.bind(this);
        this.set_text = this.set_text.bind(this);
        this.get_text = this.get_text.bind(this);
        this.get_alpha = this.get_alpha.bind(this);
        this.clear = this.clear.bind(this);
        this._cb_redirect = this._cb_redirect.bind(this);

        this.element.onclick = () => this._cb_redirect('clicked');
        this.element.addEventListener('wheel', (e) => {
            e.preventDefault();
            let idx = this.element.selectedIndex + (e.deltaY > 0 ? 1 : -1);
            idx = Math.min(this.element.options.length - 1, Math.max(0, idx));
            this.element.selectedIndex = idx;
            this._cb_redirect('clicked');
        });

        this.enable_callback('activated');
    }

    /**
     * Appends an option to the end of the dropdown list.
     * @param {string} text - The display text for the option.
     * @param {*} [value=null] - The option value; defaults to the item index.
     */
    append_text(text, value=null) {
        var option = document.createElement("option");
        option.innerHTML = text;
        if (value === null) {
            // default value is the index of the item in the box
            value = this.element.options.length;
        }
        option.value = value;
        this.element.appendChild(option);
    }

    /** Removes all options from the dropdown. */
    clear() {
        this.element.options.length = 0;
    }

    /**
     * Sets the selected option by index.
     * @param {number} idx - The 0-based index to select.
     */
    set_index(idx) {
        this.element.selectedIndex = idx;
    }

    /**
     * Returns the index of the currently selected option.
     * @returns {number} The 0-based selected index, or -1 if none.
     */
    get_index() {
        return this.element.selectedIndex;
    }

    /**
     * Inserts an option in alphabetically sorted order.
     * @param {string} text - The display text for the option.
     * @param {*} [value=null] - The option value; defaults to the item index.
     */
    insert_alpha(text, value=null) {
        var option = document.createElement("option");
        option.textContent = text;
        if (value === null) {
            value = this.element.options.length;
        }
        option.value = value;

        // find insertion point to maintain sorted order
        let opts = this.element.options;
        let inserted = false;
        for (let i = 0; i < opts.length; i++) {
            if (text.localeCompare(opts[i].textContent) < 0) {
                this.element.insertBefore(option, opts[i]);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            this.element.appendChild(option);
        }
    }

    /**
     * Removes the first option matching the given text.
     * @param {string} text - The display text of the option to remove.
     */
    delete_alpha(text) {
        let opts = this.element.options;
        for (let i = 0; i < opts.length; i++) {
            if (opts[i].textContent === text) {
                this.element.removeChild(opts[i]);
                return;
            }
        }
    }

    /**
     * Selects the option matching the given text.
     * @param {string} text - The display text of the option to select.
     */
    set_text(text) {
        let opts = this.element.options;
        for (let i = 0; i < opts.length; i++) {
            if (opts[i].textContent === text) {
                this.element.selectedIndex = i;
                return;
            }
        }
    }

    /**
     * Returns the display text of the currently selected option.
     * @returns {string|null} The selected option text, or null if none selected.
     */
    get_text() {
        let idx = this.element.selectedIndex;
        if (idx < 0) {
            return null;
        }
        return this.element.options[idx].textContent;
    }

    /**
     * Returns the display text of the option at the given index.
     * @param {number} idx - The 0-based index.
     * @returns {string|null} The option text, or null if index is out of range.
     */
    get_alpha(idx) {
        if (idx < 0 || idx >= this.element.options.length) {
            return null;
        }
        return this.element.options[idx].textContent;
    }

    _cb_redirect(action) {
        if (action === 'clicked') {
            let idx = this.element.selectedIndex;
            let text = idx >= 0 ? this.element.options[idx].textContent : null;
            this.make_callback('activated', idx, text);
        }
    }
};    

export { ComboBoxNative };
