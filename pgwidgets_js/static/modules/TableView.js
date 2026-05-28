"use strict";

import {TreeView} from "./TreeView.js";

/**
 * A tabular data view, similar to Qt's QTableView. TableView is a thin
 * subclass of TreeView that defaults to a table-style presentation:
 * header on, grid lines on, flat rows. The full TreeView API (sorting,
 * column resizing, selection, etc.) is available; in addition, column
 * descriptors may set `editable: true` to allow inline cell editing
 * via dblclick, which fires the 'cell_edited' callback as
 * (widget, path, col, old_value, new_value).
 *
 * @extends TreeView
 */
class TableView extends TreeView {

    /**
     * @param {Object} [options] - All TreeView options are accepted.
     *   `show_header` and `show_grid` default to true.
     */
    constructor(options = {}) {
        let merged = Object.assign(
            { show_header: true, show_grid: true },
            options);
        super(merged);
        this.element.classList.add('tableview-widget');

    }

    /**
     * Populate the table from a flat array of rows. Alias for set_data.
     * @param {Array[]} rows
     */
    set_rows(rows) {
        this.set_data(rows);
    }

    /**
     * Insert a row at the given visible position (0-based).
     * Overrides TreeView's (values, key, before) signature with
     * the positional one TableView's defs.py promises and that
     * the cross-backend wrappers (qtw/gtk/pgw) expect.
     *
     * @param {number} index - 0-based row position; out-of-range
     *   values clamp to append.
     * @param {Object|Array} values - Row data (dict keyed by
     *   column key, or positional array).
     * @returns {Array<string>} The path of the new row.
     */
    insert_row(index, values) {
        // Resolve "insert at position N" to "insert before the
        // row currently at position N" (or append if N >= length).
        let visible = this._getVisibleNodes();
        let before = (index >= 0 && index < visible.length)
            ? visible[index].key : null;
        return super.insert_row(values, null, before);
    }

    /**
     * Append a row.  Bypasses our positional ``insert_row`` and
     * goes straight to the parent's append path so the auto-keyed
     * insertion lands at the end.
     *
     * @param {Object|Array} values
     * @returns {Array<string>} The path of the new row.
     */
    append_row(values) {
        return super.insert_row(values, null, null);
    }

    /**
     * Delete the row at the given visible position (0-based).
     * Overrides TreeView's path-or-key signature.
     *
     * @param {number} index - 0-based row position.
     */
    delete_row(index) {
        let visible = this._getVisibleNodes();
        if (index < 0 || index >= visible.length) return;
        return super.delete_row(visible[index].key);
    }
}

export { TableView };
