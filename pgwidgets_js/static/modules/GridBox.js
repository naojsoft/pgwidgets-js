"use_strict";

import {ContainerWidget} from "./Widget.js";

/**
 * A CSS Grid-based table layout container, similar to Qt's QGridLayout.
 * Widgets are placed at (row, col) positions using 0-based indices.
 * The grid auto-expands when widgets are placed beyond the current bounds.
 * Supports dynamic row/column insertion, appending, and deletion.
 * @extends ContainerWidget
 */
class GridBox extends ContainerWidget {

    /**
     * Creates a new GridBox layout.
     * @param {Object} [options] - Configuration options.
     * @param {number} [options.rows=1] - Initial number of rows.
     * @param {number} [options.columns=1] - Initial number of columns.
     * @param {HTMLElement} [options.element=null] - Optional pre-existing DOM element to use.
     */
    constructor(options={}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'gridbox-widget';

        this.rows = this.get_option(options, 'rows', 1);
        this.columns = this.get_option(options, 'columns', 1);

        this.element.style.display = 'grid';
        this.element.style.gridTemplateRows = '1fr '.repeat(this.rows).trim();
        this.element.style.gridTemplateColumns = '1fr '.repeat(this.columns).trim();

        // map from child -> {row, col} for removal
        this.cellMap = new Map();

        // JavaScript hack to bind "this" correctly for our methods
        this.add_widget = this.add_widget.bind(this);
        this.remove = this.remove.bind(this);
        this.set_row_spacing = this.set_row_spacing.bind(this);
        this.set_column_spacing = this.set_column_spacing.bind(this);
        this.set_spacing = this.set_spacing.bind(this);
        this.get_row_column_count = this.get_row_column_count.bind(this);
        this.get_widget_at_cell = this.get_widget_at_cell.bind(this);
        this.insert_row = this.insert_row.bind(this);
        this.append_row = this.append_row.bind(this);
        this.delete_row = this.delete_row.bind(this);
        this.insert_column = this.insert_column.bind(this);
        this.append_column = this.append_column.bind(this);
        this.delete_column = this.delete_column.bind(this);
    }

    _update_grid() {
        this.element.style.gridTemplateRows = '1fr '.repeat(this.rows).trim();
        this.element.style.gridTemplateColumns = '1fr '.repeat(this.columns).trim();
    }

    /**
     * Adds a widget at the specified grid position. Auto-expands the grid if needed.
     * @param {Widget} child - The widget to add.
     * @param {number} row - 0-based row index.
     * @param {number} col - 0-based column index.
     */
    add_widget(child, row, col) {
        // expand grid if needed
        if (row >= this.rows) {
            this.rows = row + 1;
        }
        if (col >= this.columns) {
            this.columns = col + 1;
        }
        this._update_grid();

        let elt = child.get_element();
        // CSS grid uses 1-based indices
        elt.style.gridRow = (row + 1).toString();
        elt.style.gridColumn = (col + 1).toString();
        elt.style.minWidth = '0';
        elt.style.minHeight = '0';
        elt.style.width = '100%';
        elt.style.height = '100%';
        elt.style.overflow = 'hidden';

        this.cellMap.set(child, {row: row, col: col});
        super.add_child(child);
        this.element.appendChild(elt);

        // The grid cell owns the child's size on both axes.  Wrap
        // resize() so a caller-supplied pixel size doesn't override
        // the stretch once the container is shrunk and re-expanded.
        let origResize = child.resize.bind(child);
        child.resize = function(w, h) {
            origResize(w, h);
            elt.style.width = '100%';
            elt.style.height = '100%';
        };
    }

    /**
     * Removes a widget from the grid.
     * @param {Widget} child - The widget to remove.
     */
    remove(child) {
        this.cellMap.delete(child);
        let idx = this.children.indexOf(child);
        if (idx > -1) {
            this.children.splice(idx, 1);
            this.element.removeChild(child.get_element());
        }
    }

    /**
     * Sets the vertical gap between rows.
     * @param {number} px - Spacing in pixels.
     */
    set_row_spacing(px) {
        this.element.style.rowGap = px + 'px';
    }

    /**
     * Sets the horizontal gap between columns.
     * @param {number} px - Spacing in pixels.
     */
    set_column_spacing(px) {
        this.element.style.columnGap = px + 'px';
    }

    /**
     * Sets both row and column spacing to the same value.
     * @param {number} px - Spacing in pixels.
     */
    set_spacing(px) {
        this.element.style.gap = px + 'px';
    }

    /**
     * Returns the current grid dimensions.
     * @returns {number[]} A [rows, columns] array.
     */
    get_row_column_count() {
        return [this.rows, this.columns];
    }

    /**
     * Returns the widget at the specified grid cell, or null if empty.
     * @param {number} row - 0-based row index.
     * @param {number} col - 0-based column index.
     * @returns {Widget|null} The widget at the cell, or null.
     */
    get_widget_at_cell(row, col) {
        for (let [child, pos] of this.cellMap.entries()) {
            if (pos.row === row && pos.col === col) {
                return child;
            }
        }
        return null;
    }

    /**
     * Inserts a new row at the given index, shifting existing rows down.
     * @param {number} index - 0-based row index where the new row is inserted.
     * @param {Widget[]|null} [widgets=null] - Optional array of widgets to place in the new row.
     */
    insert_row(index, widgets=null) {
        // shift all widgets at or below index down by one row
        for (let [child, pos] of this.cellMap.entries()) {
            if (pos.row >= index) {
                pos.row += 1;
                child.get_element().style.gridRow = (pos.row + 1).toString();
            }
        }
        this.rows += 1;

        // add widgets to the new row if provided
        if (widgets !== null) {
            for (let c = 0; c < widgets.length; c++) {
                this.add_widget(widgets[c], index, c);
            }
        }

        this._update_grid();
    }

    /**
     * Appends a new row at the bottom of the grid.
     * @param {Widget[]} widgets - Array of widgets to place in the new row.
     */
    append_row(widgets) {
        let row = this.rows;
        for (let c = 0; c < widgets.length; c++) {
            this.add_widget(widgets[c], row, c);
        }
    }

    /**
     * Deletes a row and all its widgets, shifting rows below it up.
     * @param {number} index - 0-based row index to delete.
     */
    delete_row(index) {
        // remove all widgets in the target row
        let toRemove = [];
        for (let [child, pos] of this.cellMap.entries()) {
            if (pos.row === index) {
                toRemove.push(child);
            }
        }
        for (let child of toRemove) {
            this.remove(child);
        }

        // shift all widgets below the deleted row up by one
        for (let [child, pos] of this.cellMap.entries()) {
            if (pos.row > index) {
                pos.row -= 1;
                child.get_element().style.gridRow = (pos.row + 1).toString();
            }
        }
        this.rows = Math.max(1, this.rows - 1);
        this._update_grid();
    }
    /**
     * Inserts a new column at the given index, shifting existing columns right.
     * @param {number} index - 0-based column index where the new column is inserted.
     * @param {Widget[]|null} [widgets=null] - Optional array of widgets to place in the new column.
     */
    insert_column(index, widgets=null) {
        // shift all widgets at or to the right of index over by one column
        for (let [child, pos] of this.cellMap.entries()) {
            if (pos.col >= index) {
                pos.col += 1;
                child.get_element().style.gridColumn = (pos.col + 1).toString();
            }
        }
        this.columns += 1;

        // add widgets to the new column if provided
        if (widgets !== null) {
            for (let r = 0; r < widgets.length; r++) {
                this.add_widget(widgets[r], r, index);
            }
        }

        this._update_grid();
    }

    /**
     * Appends a new column at the right side of the grid.
     * @param {Widget[]} widgets - Array of widgets to place in the new column.
     */
    append_column(widgets) {
        let col = this.columns;
        for (let r = 0; r < widgets.length; r++) {
            this.add_widget(widgets[r], r, col);
        }
    }

    /**
     * Deletes a column and all its widgets, shifting columns to the right left.
     * @param {number} index - 0-based column index to delete.
     */
    delete_column(index) {
        // remove all widgets in the target column
        let toRemove = [];
        for (let [child, pos] of this.cellMap.entries()) {
            if (pos.col === index) {
                toRemove.push(child);
            }
        }
        for (let child of toRemove) {
            this.remove(child);
        }

        // shift all widgets to the right of the deleted column left by one
        for (let [child, pos] of this.cellMap.entries()) {
            if (pos.col > index) {
                pos.col -= 1;
                child.get_element().style.gridColumn = (pos.col + 1).toString();
            }
        }
        this.columns = Math.max(1, this.columns - 1);
        this._update_grid();
    }
}

export { GridBox };
