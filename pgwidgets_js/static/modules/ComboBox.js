"use_strict";

import {Widget} from "./Widget.js";

/**
 * A combo box widget combining a text input with a dropdown list of options.
 * When editable (default false), the user can type freely or pick from the list.
 * When not editable, the user can only pick from the list.
 * Fires the 'activated' callback on selection or Enter (when editable).
 * @extends Widget
 */
class ComboBox extends Widget {

    /**
     * Creates a new ComboBox widget.
     * @param {Object} [options] - Configuration options.
     * @param {boolean} [options.editable=false] - Whether the user can type free text.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'combobox-widget';

        this._editable = this.get_option(options, 'editable', false);
        this._dropdownLimit = this.get_option(options, 'dropdown_limit', 0);
        this._items = [];

        // text input
        this._input = document.createElement('input');
        this._input.type = 'text';
        this._input.className = 'combobox-input';
        this._input.size = 1;
        this._fixedSize = false;
        this._input.readOnly = !this._editable;
        this.element.appendChild(this._input);

        // dropdown button
        this._button = document.createElement('div');
        this._button.className = 'combobox-button';
        this._button.innerHTML = '&#9660;';
        this.element.appendChild(this._button);

        // dropdown list (appended to body to avoid overflow clipping)
        this._dropdown = document.createElement('div');
        this._dropdown.className = 'combobox-dropdown';
        this._dropdown.style.display = 'none';
        document.body.appendChild(this._dropdown);

        this._selectedIdx = -1;
        // Tracks whether set_index has been called explicitly.  When
        // false, appending the first item auto-selects it so the
        // combobox displays a sensible value.  set_index() and
        // user-driven selections set this to true; clear() resets it.
        this._indexExplicit = false;

        // toggle dropdown on button or input click (input click only for non-editable)
        this._button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this._toggleDropdown();
        });
        if (!this._editable) {
            this._input.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this._toggleDropdown();
            });
        }

        // Enter key fires activated
        this._input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._hideDropdown();
                this.make_callback('activated', this.get_index(), this.get_text());
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this._dropdown.style.display === 'none') {
                    this._showDropdown();
                }
            } else if (e.key === 'Escape') {
                this._hideDropdown();
            }
        });

        // filter dropdown as user types (editable mode only)
        if (this._editable) {
            this._input.addEventListener('input', () => {
                this._showDropdown(this._input.value);
            });
        }

        // scroll to cycle through items
        this._input.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (this._items.length === 0) return;
            let idx = this._selectedIdx + (e.deltaY > 0 ? 1 : -1);
            idx = Math.min(this._items.length - 1, Math.max(0, idx));
            this._selectedIdx = idx;
            this._input.value = this._items[idx];
            this._autoSize();
            this.make_callback('activated', idx, this._items[idx]);
        });

        // close dropdown when clicking outside
        document.addEventListener('mousedown', (e) => {
            if (!this.element) return;
            if (!this.element.contains(e.target) &&
                !this._dropdown.contains(e.target)) {
                this._hideDropdown();
            }
        });

        this.enable_callback('activated');
    }

    /**
     * Rebuilds the dropdown list, optionally filtering by a string.
     * @param {string|null} [filter=null] - Filter text; null shows all items.
     * @private
     */
    _buildDropdown(filter = null) {
        this._dropdown.innerHTML = '';
        let filterLower = filter ? filter.toLowerCase() : null;

        for (let i = 0; i < this._items.length; i++) {
            let text = this._items[i];
            if (filterLower && text.toLowerCase().indexOf(filterLower) === -1) {
                continue;
            }
            let item = document.createElement('div');
            item.className = 'combobox-item';
            item.textContent = text;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this._selectedIdx = i;
                this._input.value = text;
                this._hideDropdown();
                this.make_callback('activated', i, text);
            });
            this._dropdown.appendChild(item);
        }
    }

    /** @private */
    _showDropdown(filter = null) {
        this._buildDropdown(filter);
        if (this._dropdown.children.length > 0) {
            let rect = this.element.getBoundingClientRect();
            this._dropdown.style.left = rect.left + 'px';
            this._dropdown.style.top = rect.bottom + 'px';
            this._dropdown.style.width = rect.width + 'px';
            this._dropdown.style.display = '';

            // apply dropdown_limit by measuring item height
            if (this._dropdownLimit > 0 && this._dropdown.children.length > this._dropdownLimit) {
                let itemH = this._dropdown.children[0].offsetHeight;
                this._dropdown.style.maxHeight = (itemH * this._dropdownLimit) + 'px';
            } else {
                this._dropdown.style.maxHeight = '';
            }
        }
    }

    /** @private */
    _hideDropdown() {
        this._dropdown.style.display = 'none';
    }

    /** @private */
    _toggleDropdown() {
        if (this._dropdown.style.display === 'none') {
            this._showDropdown();
        } else {
            this._hideDropdown();
        }
    }

    /** @private */
    _autoSize() {
        if (this._fixedSize) return;
        let maxLen = this._input.value.length || 1;
        for (let item of this._items) {
            if (item.length > maxLen) maxLen = item.length;
        }
        this._input.size = maxLen;
    }

    /**
     * Appends an option to the list.
     * @param {string} text - The display text for the option.
     */
    append_text(text) {
        let wasEmpty = this._items.length === 0;
        this._items.push(text);
        if (wasEmpty && !this._indexExplicit) {
            this._selectedIdx = 0;
            this._input.value = text;
        }
        this._autoSize();
    }

    /**
     * Inserts an option in alphabetically sorted order.
     * @param {string} text - The display text for the option.
     */
    insert_alpha(text) {
        let wasEmpty = this._items.length === 0;
        let inserted = false;
        for (let i = 0; i < this._items.length; i++) {
            if (text.localeCompare(this._items[i]) < 0) {
                this._items.splice(i, 0, text);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            this._items.push(text);
        }
        if (wasEmpty && !this._indexExplicit) {
            this._selectedIdx = 0;
            this._input.value = this._items[0];
        }
        this._autoSize();
    }

    /**
     * Removes the first option matching the given text.
     * @param {string} text - The text of the option to remove.
     */
    delete_alpha(text) {
        let idx = this._items.indexOf(text);
        if (idx !== -1) {
            this._items.splice(idx, 1);
            this._autoSize();
        }
    }

    /**
     * Sets the input text value.
     * @param {string} text - The text to set.
     */
    set_text(text) {
        this._input.value = text;
        let idx = this._items.indexOf(text);
        if (idx !== -1) {
            this._selectedIdx = idx;
        }
        this._autoSize();
    }

    /**
     * Returns the current input text value.
     * @returns {string} The text value.
     */
    get_text() {
        return this._input.value;
    }

    /**
     * Selects the option at the given index.
     * @param {number} idx - The 0-based index to select.
     */
    set_index(idx) {
        // Mark explicit even if idx is out of range — the caller's
        // intent is to control selection, so disable auto-select.
        this._indexExplicit = true;
        if (idx >= 0 && idx < this._items.length) {
            this._selectedIdx = idx;
            this._input.value = this._items[idx];
            this._autoSize();
        }
    }

    /**
     * Returns the index of the currently selected option, or -1 if
     * the text does not match any option.
     * @returns {number} The 0-based index, or -1.
     */
    get_index() {
        return this._items.indexOf(this._input.value);
    }

    /**
     * Returns the text of the option at the given index.
     * @param {number} idx - The 0-based index.
     * @returns {string|null} The option text, or null if out of range.
     */
    get_alpha(idx) {
        if (idx < 0 || idx >= this._items.length) {
            return null;
        }
        return this._items[idx];
    }

    /**
     * Shows the item matching the given text. If found in the items list,
     * selects it. Otherwise, if editable, sets the input to the text.
     * @param {string} text - The text to show.
     */
    show_text(text) {
        let idx = this._items.indexOf(text);
        if (idx !== -1) {
            this._selectedIdx = idx;
            this._input.value = text;
        } else if (this._editable) {
            this._input.value = text;
        }
        this._autoSize();
    }

    /** Removes all options and clears the input. */
    clear() {
        this._items = [];
        this._selectedIdx = -1;
        this._indexExplicit = false;
        this._input.value = '';
        this._autoSize();
    }

    /**
     * Sets the visible width of the input in character units.
     * @param {number} numchars - Number of characters to show.
     */
    set_length(numchars) {
        this._input.size = numchars;
        this._fixedSize = true;
    }
}

export { ComboBox };
