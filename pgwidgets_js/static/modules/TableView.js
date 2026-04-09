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

        this.set_rows = this.set_rows.bind(this);
    }

    /**
     * Populate the table from a flat array of rows. Alias for set_data.
     * @param {Array[]} rows
     */
    set_rows(rows) {
        this.set_data(rows);
    }
}

export { TableView };
