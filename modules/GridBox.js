"use_strict";

import {ContainerWidget} from "./Widget.js";

class GridBox extends ContainerWidget {

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
        this.element.style.gridTemplateRows = 'auto '.repeat(this.rows).trim();
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
        this.element.style.gridTemplateRows = 'auto '.repeat(this.rows).trim();
        this.element.style.gridTemplateColumns = '1fr '.repeat(this.columns).trim();
    }

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

        this.cellMap.set(child, {row: row, col: col});
        super.add_child(child);
        this.element.appendChild(elt);
    }

    remove(child) {
        this.cellMap.delete(child);
        let idx = this.children.indexOf(child);
        if (idx > -1) {
            this.children.splice(idx, 1);
            this.element.removeChild(child.get_element());
        }
    }

    set_row_spacing(px) {
        this.element.style.rowGap = px + 'px';
    }

    set_column_spacing(px) {
        this.element.style.columnGap = px + 'px';
    }

    set_spacing(px) {
        this.element.style.gap = px + 'px';
    }

    get_row_column_count() {
        return [this.rows, this.columns];
    }

    get_widget_at_cell(row, col) {
        for (let [child, pos] of this.cellMap.entries()) {
            if (pos.row === row && pos.col === col) {
                return child;
            }
        }
        return null;
    }

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

    append_row(widgets) {
        let row = this.rows;
        for (let c = 0; c < widgets.length; c++) {
            this.add_widget(widgets[c], row, c);
        }
    }

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

    append_column(widgets) {
        let col = this.columns;
        for (let r = 0; r < widgets.length; r++) {
            this.add_widget(widgets[r], r, col);
        }
    }

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
