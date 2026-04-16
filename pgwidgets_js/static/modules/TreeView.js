"use strict";

import {Widget} from "./Widget.js";
import {ScrollBar} from "./ScrollBar.js";

/**
 * A tree/table view widget similar to Qt's QTreeWidget.
 * Displays hierarchical or flat tabular data with column headers,
 * expand/collapse, selection, column resizing, and optional
 * alternating row colours.
 *
 * @extends Widget
 */
class TreeView extends Widget {

    /**
     * @param {Object} [options]
     * @param {Array} [options.columns=[]] - Column descriptors. Each entry
     *   is either a plain string (label, type defaults to 'string') or an
     *   object { label, type } where type is 'string' or 'number'.
     * @param {boolean} [options.show_header=true] - Show the header row.
     * @param {string} [options.selection_mode='single'] - 'single', 'multi', or 'none'.
     * @param {boolean} [options.alternate_row_colors=false] - Shade even rows.
     * @param {boolean} [options.show_grid=false] - Draw grid lines between
     *   cells and rows (table-style appearance).
     * @param {HTMLElement} [options.element=null] - Optional pre-existing element.
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'treeview-widget';

        this._columns = [];      // normalised: [{label, type}, ...]
        this._parseColumns(this.get_option(options, 'columns', []));
        this._showHeader = this.get_option(options, 'show_header', true);
        this._selectionMode = this.get_option(options, 'selection_mode', 'single');
        this._alternateRowColors = this.get_option(options, 'alternate_row_colors', false);
        this._showGrid = this.get_option(options, 'show_grid', false);
        if (this._showGrid) {
            this.element.classList.add('treeview-grid');
        }
        this._showRowNumbers = this.get_option(options, 'show_row_numbers', false);

        // Column widths in fr units (default 1fr each)
        this._colWidths = this._columns.map(() => '1fr');

        // Sort state: which column is sorted and in which direction
        this._sortColumn = -1;       // -1 = no active sort
        this._sortAscending = true;

        // Active inline editor (if any)
        this._editor = null;
        this._editInfo = null;  // {node, col, oldValue}

        // Enable callbacks
        for (let name of ['activated', 'selected', 'expanded', 'collapsed',
                          'sorted', 'cell_edited']) {
            this.enable_callback(name);
        }

        // Implicit root node - never rendered
        this._root = { values: [], children: [], expanded: true, depth: -1,
                        element: null, parent: null };
        this._selection = [];   // currently selected nodes

        // -- Header --
        this._header = document.createElement('div');
        this._header.className = 'treeview-header';
        if (!this._showHeader || this._columns.length === 0) {
            this._header.style.display = 'none';
        }
        this.element.appendChild(this._header);
        this._buildHeader();

        // -- Scrollable body area (grid: viewport + scrollbars) --
        this._bodyArea = document.createElement('div');
        this._bodyArea.className = 'treeview-body-area';
        this.element.appendChild(this._bodyArea);

        // Viewport clips the content
        this._viewport = document.createElement('div');
        this._viewport.className = 'treeview-viewport';
        this._bodyArea.appendChild(this._viewport);

        // Content wrapper - rows go here, sized naturally
        this._body = document.createElement('div');
        this._body.className = 'treeview-body';
        this._viewport.appendChild(this._body);

        // ScrollBar widgets
        this._vScrollBar = new ScrollBar({orientation: 'vertical'});
        this._hScrollBar = new ScrollBar({orientation: 'horizontal'});
        this._vScrollBar.get_element().classList.add('treeview-vbar');
        this._hScrollBar.get_element().classList.add('treeview-hbar');

        this._corner = document.createElement('div');
        this._corner.className = 'treeview-corner';

        this._bodyArea.appendChild(this._vScrollBar.get_element());
        this._bodyArea.appendChild(this._hScrollBar.get_element());
        this._bodyArea.appendChild(this._corner);

        // Scrollbar callbacks - scroll the content
        this._vScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this._body.scrollHeight - this._viewport.clientHeight;
            this._viewport.scrollTop = pct * maxScroll;
            this._syncFromScroll();
        });
        this._hScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this._body.scrollWidth - this._viewport.clientWidth;
            this._viewport.scrollLeft = pct * maxScroll;
            this._syncFromScroll();
        });

        // native scroll (e.g. touch, programmatic)
        this._viewport.addEventListener('scroll', () => this._syncFromScroll());

        // Mouse wheel
        this._viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            this._viewport.scrollTop += e.deltaY;
            this._viewport.scrollLeft += e.deltaX;
            this._syncFromScroll();
        });

        this._scrollTimer = null;
        this._scrollReady = false;

        // Observe size changes
        this._syncScrollbars = this._syncScrollbars.bind(this);
        this._resizeObserver = new ResizeObserver(() => this._syncScrollbars());
        this._resizeObserver.observe(this._viewport);
        this._resizeObserver.observe(this._body);

        // Keyboard handling
        this.element.tabIndex = 0;
        this.element.addEventListener('keydown', (e) => this._onKeyDown(e));

        // Bind public methods
        this.set_tree = this.set_tree.bind(this);
        this.set_data = this.set_data.bind(this);
        this.add_item = this.add_item.bind(this);
        this.remove_item = this.remove_item.bind(this);
        this.update_tree = this.update_tree.bind(this);
        this.remove_items = this.remove_items.bind(this);
        this.clear = this.clear.bind(this);
        this.expand_all = this.expand_all.bind(this);
        this.collapse_all = this.collapse_all.bind(this);
        this.get_expanded = this.get_expanded.bind(this);
        this.get_collapsed = this.get_collapsed.bind(this);
        this.get_selected = this.get_selected.bind(this);
        this.set_selected = this.set_selected.bind(this);
        this.set_column_width = this.set_column_width.bind(this);
        this.select_path = this.select_path.bind(this);
        this.select_paths = this.select_paths.bind(this);
        this.select_all = this.select_all.bind(this);
        this.set_optimal_column_widths = this.set_optimal_column_widths.bind(this);
        this.sort_by_column = this.sort_by_column.bind(this);
        this.scroll_to_path = this.scroll_to_path.bind(this);
        this.scroll_to_end = this.scroll_to_end.bind(this);
        this.set_scroll_position = this.set_scroll_position.bind(this);
        this.get_column_count = this.get_column_count.bind(this);
        this.get_row_count = this.get_row_count.bind(this);
        this.set_show_grid = this.set_show_grid.bind(this);
        this.set_show_row_numbers = this.set_show_row_numbers.bind(this);
        this.set_column_editable = this.set_column_editable.bind(this);
        this.set_cell = this.set_cell.bind(this);
        this.insert_column = this.insert_column.bind(this);
        this.append_column = this.append_column.bind(this);
        this.delete_column = this.delete_column.bind(this);
        this.insert_row = this.insert_row.bind(this);
        this.append_row = this.append_row.bind(this);
        this.delete_row = this.delete_row.bind(this);
        requestAnimationFrame(() => { this._scrollReady = true; });
    }

    // -- Column parsing --

    /**
     * Normalise the columns option into [{label, type}, ...].
     * Accepts plain strings or {label, type} objects.
     */
    _parseColumns(raw) {
        this._columns = raw.map(c => {
            if (typeof c === 'string') {
                return { label: c, type: 'string', editable: false };
            }
            let col = {
                label: c.label || '',
                type: c.type || 'string',
                editable: !!c.editable,
            };
            if (c.icon_size) col.icon_size = c.icon_size;
            return col;
        });
    }

    // -- Column grid template --

    _gridTemplate() {
        // optional row-number gutter, then indent + toggle, then data columns
        let cols = '';
        if (this._showRowNumbers) cols += 'min-content ';
        cols += '16px 18px ' + this._colWidths.join(' ');
        return cols;
    }

    _applyGridTemplate() {
        let tpl = this._gridTemplate();
        this._header.style.gridTemplateColumns = tpl;
        for (let row of this._body.querySelectorAll('.treeview-row')) {
            row.style.gridTemplateColumns = tpl;
        }
    }

    // -- Header --

    _buildHeader() {
        this._header.innerHTML = '';
        this._header.style.gridTemplateColumns = this._gridTemplate();

        // Optional row-number column header
        if (this._showRowNumbers) {
            let rn = document.createElement('div');
            rn.className = 'treeview-header-spacer treeview-rownum-header';
            this._header.appendChild(rn);
        }

        // Spacers for indent + toggle
        let sp1 = document.createElement('div');
        sp1.className = 'treeview-header-spacer';
        this._header.appendChild(sp1);
        let sp2 = document.createElement('div');
        sp2.className = 'treeview-header-spacer';
        this._header.appendChild(sp2);

        this._headerCells = [];

        for (let i = 0; i < this._columns.length; i++) {
            let cell = document.createElement('div');
            cell.className = 'treeview-header-cell';
            this._headerCells.push(cell);

            let labelSpan = document.createElement('span');
            labelSpan.className = 'treeview-header-label';
            labelSpan.textContent = this._columns[i].label;
            cell.appendChild(labelSpan);

            let indicator = document.createElement('span');
            indicator.className = 'treeview-sort-indicator';
            cell.appendChild(indicator);

            // Click to sort
            cell.addEventListener('click', (e) => {
                // Ignore if the click was on the resize handle
                if (e.target.classList.contains('treeview-resize-handle')) return;
                this._onHeaderClick(i);
            });

            // Resize handle
            if (i < this._columns.length - 1) {
                let handle = document.createElement('div');
                handle.className = 'treeview-resize-handle';
                cell.appendChild(handle);
                this._setupColumnResize(handle, i);
            }

            this._header.appendChild(cell);
        }

        this._updateSortIndicators();
    }

    _setupColumnResize(handle, colIndex) {
        let startX, startWidthA, startWidthB;

        const onMouseMove = (e) => {
            let dx = e.clientX - startX;
            let newA = Math.max(30, startWidthA + dx);
            let newB = Math.max(30, startWidthB - dx);
            this._colWidths[colIndex] = newA + 'px';
            this._colWidths[colIndex + 1] = newB + 'px';
            this._applyGridTemplate();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startX = e.clientX;
            // Measure current pixel widths of the two adjacent columns
            let cells = this._header.querySelectorAll('.treeview-header-cell');
            startWidthA = cells[colIndex].getBoundingClientRect().width;
            startWidthB = cells[colIndex + 1].getBoundingClientRect().width;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    _onHeaderClick(colIndex) {
        if (this._sortColumn === colIndex) {
            // Same column: toggle direction
            this._sortAscending = !this._sortAscending;
        } else {
            // New column: sort ascending
            this._sortColumn = colIndex;
            this._sortAscending = true;
        }
        this._applySort();
        this._updateSortIndicators();
        this._renderAll();
        this.make_callback('sorted', this._sortColumn, this._sortAscending);
    }

    _updateSortIndicators() {
        if (!this._headerCells) return;
        for (let i = 0; i < this._headerCells.length; i++) {
            let indicator = this._headerCells[i].querySelector('.treeview-sort-indicator');
            if (i === this._sortColumn) {
                indicator.textContent = this._sortAscending ? ' ▲' : ' ▼';
            } else {
                indicator.textContent = '';
            }
        }
    }

    /** Apply the current sort recursively to all levels. */
    _applySort() {
        if (this._sortColumn < 0) return;
        this._sortRecursive(this._root, this._sortColumn, this._sortAscending);
    }

    _sortRecursive(node, colIndex, ascending) {
        if (node.children.length > 0) {
            this._sortChildren(node, colIndex, ascending);
            for (let child of node.children) {
                this._sortRecursive(child, colIndex, ascending);
            }
        }
    }

    // -- Public API --

    /**
     * Set columns (replaces existing header).
     * @param {string[]} columns - Array of column header labels.
     */
    set_columns(columns) {
        this._parseColumns(columns);
        this._colWidths = this._columns.map(() => '1fr');
        this._sortColumn = -1;
        if (this._showHeader && this._columns.length > 0) {
            this._header.style.display = '';
        }
        this._buildHeader();
        this._renderAll();
    }

    /**
     * Populate from a hierarchical data structure.
     * Each node: { values: [...], children: [...] }
     * @param {Object[]} data - Array of root-level nodes.
     */
    set_tree(data) {
        this.clear();
        for (let item of data) {
            this._addNodeFromData(this._root, item);
        }
        this._applySort();
        this._renderAll();
    }

    /**
     * Populate from a flat array of rows (no tree structure).
     * @param {Array[]} data - Array of row arrays.
     */
    set_data(data) {
        this.clear();
        for (let row of data) {
            let values = Array.isArray(row) ? row : [row];
            this._root.children.push({
                values: values,
                children: [],
                expanded: false,
                depth: 0,
                element: null,
                parent: this._root,
            });
        }
        this._applySort();
        this._renderAll();
    }

    /**
     * Add a single item.
     * @param {Object|Array|null} parent - Parent node, index path, or null for top-level.
     * @param {Array} values - Column values.
     * @returns {Array} The index path of the new node.
     */
    add_item(parent, values) {
        let parentNode = this._resolveNode(parent) || this._root;
        let node = {
            values: Array.isArray(values) ? values : [values],
            children: [],
            expanded: false,
            depth: parentNode.depth + 1,
            element: null,
            parent: parentNode,
        };
        parentNode.children.push(node);
        this._applySort();
        this._renderAll();
        return this._pathOfNode(node);
    }

    /**
     * Remove an item and all its descendants.
     * @param {Object|Array} node - The node or index path to remove.
     */
    remove_item(node) {
        node = this._resolveNode(node);
        if (!node || !node.parent) return;
        let siblings = node.parent.children;
        let idx = siblings.indexOf(node);
        if (idx >= 0) siblings.splice(idx, 1);
        // Remove from selection
        this._selection = this._selection.filter(n => n !== node);
        this._renderAll();
    }

    /**
     * Batch add or update items with a single re-render.
     * Each entry is an object:
     *   { path: [...], values: [...] }
     *     - If the path resolves to an existing node, its values are updated.
     *     - If the path does not exist but its parent does, a new child is added.
     *       The last element of the path is ignored for adds (appended at end).
     *   { parent: [...], values: [...] }
     *     - Adds a new child under parent (null/omitted for top-level).
     *   { parent: [...], values: [...], children: [...] }
     *     - Adds a subtree. children follows the same format as set_tree data.
     * @param {Array} items - Array of update/add descriptors.
     */
    update_tree(items) {
        for (let item of items) {
            if (item.path) {
                let node = this._nodeAtPath(item.path);
                if (node) {
                    // Update existing node
                    node.values = Array.isArray(item.values) ? item.values : [item.values];
                } else {
                    // Path doesn't exist - add under parent (all but last index)
                    let parentPath = item.path.slice(0, -1);
                    let parentNode = parentPath.length > 0
                        ? this._nodeAtPath(parentPath) : this._root;
                    if (parentNode) {
                        this._addNodeFromData(parentNode,
                            { values: item.values, children: item.children });
                    }
                }
            } else {
                // Add under parent
                let parentNode = item.parent
                    ? this._nodeAtPath(item.parent) : this._root;
                if (!parentNode) parentNode = this._root;
                this._addNodeFromData(parentNode,
                    { values: item.values, children: item.children });
            }
        }
        this._applySort();
        this._renderAll();
    }

    /**
     * Remove multiple items by path with a single re-render.
     * Paths are sorted deepest-first and highest-index-first so that
     * removals don't invalidate subsequent paths.
     * @param {Array} paths - Array of index paths.
     */
    remove_items(paths) {
        // Sort: longer paths first, then by last index descending
        let sorted = paths.slice().sort((a, b) => {
            if (a.length !== b.length) return b.length - a.length;
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) return b[i] - a[i];
            }
            return 0;
        });

        for (let path of sorted) {
            let node = this._nodeAtPath(path);
            if (!node || !node.parent) continue;
            let siblings = node.parent.children;
            let idx = siblings.indexOf(node);
            if (idx >= 0) siblings.splice(idx, 1);
            this._selection = this._selection.filter(n => n !== node);
        }
        this._renderAll();
    }

    /** Remove all items. */
    clear() {
        this._root.children = [];
        this._selection = [];
        this._body.innerHTML = '';
    }

    /** Expand all branch nodes. */
    expand_all() {
        this._walkNodes(this._root, (node) => {
            if (node.children.length > 0) node.expanded = true;
        });
        this._renderAll();
    }

    /** Collapse all branch nodes. */
    collapse_all() {
        this._walkNodes(this._root, (node) => {
            if (node.children.length > 0) node.expanded = false;
        });
        this._renderAll();
    }

    /**
     * Get paths of all expanded branch nodes.
     * @returns {Array} Array of index paths.
     */
    get_expanded() {
        let paths = [];
        this._walkNodes(this._root, (node) => {
            if (node.children.length > 0 && node.expanded) {
                paths.push(this._pathOfNode(node));
            }
        });
        return paths;
    }

    /**
     * Get paths of all collapsed branch nodes.
     * @returns {Array} Array of index paths.
     */
    get_collapsed() {
        let paths = [];
        this._walkNodes(this._root, (node) => {
            if (node.children.length > 0 && !node.expanded) {
                paths.push(this._pathOfNode(node));
            }
        });
        return paths;
    }

    /**
     * Expand a specific node.
     * @param {Object|Array} node - Node or index path.
     */
    expand_item(node) {
        node = this._resolveNode(node);
        if (node && node.children.length > 0) {
            node.expanded = true;
            this._renderAll();
            this.make_callback('expanded', node.values, this._pathOfNode(node));
        }
    }

    /**
     * Collapse a specific node.
     * @param {Object|Array} node - Node or index path.
     */
    collapse_item(node) {
        node = this._resolveNode(node);
        if (node && node.children.length > 0) {
            node.expanded = false;
            this._renderAll();
            this.make_callback('collapsed', node.values, this._pathOfNode(node));
        }
    }

    /**
     * Get the currently selected item(s).
     * @returns {Array} Array of {path, values} objects.
     */
    get_selected() {
        return this._selection.map(n => ({
            path: this._pathOfNode(n),
            values: n.values,
        }));
    }

    /**
     * Set the selection.
     * @param {Array} items - Array of node objects or index paths.
     *   A single path/node may be passed directly (not wrapped in an array).
     *   Pass null or [] to clear.
     */
    set_selected(items) {
        if (items == null) {
            this._selection = [];
        } else if (!Array.isArray(items)) {
            // single node object
            this._selection = [items];
        } else if (items.length > 0 && typeof items[0] === 'number') {
            // single path like [0, 2]
            let node = this._resolveNode(items);
            this._selection = node ? [node] : [];
        } else {
            // array of paths or nodes
            this._selection = items
                .map(ref => this._resolveNode(ref))
                .filter(n => n != null);
        }
        this._updateSelectionDisplay();
        this.make_callback('selected', this.get_selected());
    }

    /**
     * Select or deselect the node at the given path.
     * @param {Array} path - Index path.
     * @param {boolean} state - true to select, false to deselect.
     */
    select_path(path, state) {
        let node = this._nodeAtPath(path);
        if (!node) return;
        let idx = this._selection.indexOf(node);
        if (state && idx < 0) {
            this._selection.push(node);
        } else if (!state && idx >= 0) {
            this._selection.splice(idx, 1);
        }
        this._updateSelectionDisplay();
        this.make_callback('selected', this.get_selected());
    }

    /**
     * Select or deselect multiple nodes by path.
     * @param {Array} paths - Array of index paths.
     * @param {boolean} state - true to select, false to deselect.
     */
    select_paths(paths, state) {
        for (let path of paths) {
            let node = this._nodeAtPath(path);
            if (!node) continue;
            let idx = this._selection.indexOf(node);
            if (state && idx < 0) {
                this._selection.push(node);
            } else if (!state && idx >= 0) {
                this._selection.splice(idx, 1);
            }
        }
        this._updateSelectionDisplay();
        this.make_callback('selected', this.get_selected());
    }

    /**
     * Select or deselect all nodes.
     * @param {boolean} state - true to select all, false to deselect all.
     */
    select_all(state) {
        if (state) {
            this._selection = [];
            this._walkNodes(this._root, (node) => this._selection.push(node));
        } else {
            this._selection = [];
        }
        this._updateSelectionDisplay();
        this.make_callback('selected', this.get_selected());
    }

    /**
     * Set the width of a single column.
     * @param {number} colIndex - Column index (0-based).
     * @param {number|string} width - Pixel width (number) or CSS value (e.g. '2fr').
     */
    set_column_width(colIndex, width) {
        if (colIndex < 0 || colIndex >= this._colWidths.length) return;
        this._colWidths[colIndex] = typeof width === 'number' ? width + 'px' : width;
        this._applyGridTemplate();
    }

    /**
     * Auto-size all columns to fit their content.
     * Measures the widest cell in each column (including the header)
     * and sets pixel widths accordingly.
     */
    set_optimal_column_widths() {
        let numCols = this._columns.length;
        if (numCols === 0) return;

        // Create an off-screen measurement container
        let measure = document.createElement('div');
        measure.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit;';
        this.element.appendChild(measure);

        let widths = new Array(numCols).fill(0);

        // Measure header labels
        for (let i = 0; i < numCols; i++) {
            measure.textContent = this._columns[i].label;
            // header has padding(6px each side) + sort indicator space
            widths[i] = Math.max(widths[i], measure.offsetWidth + 30);
        }

        // Measure all rows
        this._walkNodes(this._root, (node) => {
            for (let i = 0; i < numCols; i++) {
                let val = i < node.values.length ? node.values[i] : '';
                let colType = i < this._columns.length ? this._columns[i].type : 'string';
                if (colType === 'icon') {
                    let size = this._columns[i].icon_size || 16;
                    widths[i] = Math.max(widths[i], size + 12);
                } else {
                    measure.textContent = val != null ? String(val) : '';
                    // cell padding: 6px each side
                    widths[i] = Math.max(widths[i], measure.offsetWidth + 12);
                }
            }
        });

        this.element.removeChild(measure);

        for (let i = 0; i < numCols; i++) {
            this._colWidths[i] = widths[i] + 'px';
        }
        this._applyGridTemplate();
    }

    /**
     * Sort all levels by a column.
     * @param {number} colIndex - Column index to sort by.
     * @param {boolean} [ascending=true]
     */
    sort_by_column(colIndex, ascending = true) {
        this._sortColumn = colIndex;
        this._sortAscending = ascending;
        this._applySort();
        this._updateSortIndicators();
        this._renderAll();
    }

    /**
     * Scroll so the node at the given path is visible.
     * Expands ancestor nodes if needed.
     * @param {Array} path - Index path, e.g. [0, 2, 1].
     */
    scroll_to_path(path) {
        // Expand all ancestors so the target is visible
        let node = this._root;
        for (let i = 0; i < path.length - 1; i++) {
            let idx = path[i];
            if (idx < 0 || idx >= node.children.length) return;
            node = node.children[idx];
            if (node.children.length > 0) node.expanded = true;
        }
        let target = this._nodeAtPath(path);
        if (!target) return;
        this._renderAll();
        this._scrollToNode(target);
    }

    /** Scroll to the last visible row. */
    scroll_to_end() {
        let vp = this._viewport;
        vp.scrollTop = this._body.scrollHeight - vp.clientHeight;
        this._syncFromScroll();
    }

    // -- Internal: data loading --

    _addNodeFromData(parent, data) {
        let values = data.values || [];
        let node = {
            values: values,
            children: [],
            expanded: data.expanded !== undefined ? data.expanded : true,
            depth: parent.depth + 1,
            element: null,
            parent: parent,
        };
        parent.children.push(node);
        if (data.children) {
            for (let child of data.children) {
                this._addNodeFromData(node, child);
            }
        }
        return node;
    }

    // -- Internal: rendering --

    _renderAll() {
        this._body.innerHTML = '';
        let visibleIndex = 0;
        this._walkVisible(this._root, (node) => {
            let row = this._createRow(node, visibleIndex);
            this._body.appendChild(row);
            node.element = row;
            visibleIndex++;
        });
        this._syncRowNumberHeader(visibleIndex);
        this._syncScrollbars();
    }

    /**
     * Keep the header's row-number column the same width as the body's
     * row-number column. The two are separate CSS grids, so we plant a
     * visibility-hidden placeholder in the header cell whose text width
     * matches the widest visible row number.
     * @private
     */
    _syncRowNumberHeader(rowCount) {
        if (!this._showRowNumbers) return;
        let hdr = this._header.querySelector('.treeview-rownum-header');
        if (!hdr) return;
        // Use the largest row number (or "1" if empty) as the placeholder.
        let placeholder = String(Math.max(1, rowCount));
        hdr.innerHTML = '';
        let span = document.createElement('span');
        span.className = 'treeview-rownum';
        span.style.visibility = 'hidden';
        span.textContent = placeholder;
        hdr.appendChild(span);
    }

    _createRow(node, visibleIndex) {
        let row = document.createElement('div');
        row.className = 'treeview-row';
        if (this._alternateRowColors && visibleIndex % 2 === 1) {
            row.classList.add('treeview-row-alt');
        }
        if (this._selection.includes(node)) {
            row.classList.add('treeview-row-selected');
        }
        row.style.gridTemplateColumns = this._gridTemplate();
        row._node = node;

        // Optional row-number cell
        if (this._showRowNumbers) {
            let rn = document.createElement('span');
            rn.className = 'treeview-rownum';
            rn.textContent = String(visibleIndex + 1);
            row.appendChild(rn);
        }

        // Indent spacer
        let indent = document.createElement('span');
        indent.className = 'treeview-indent';
        indent.style.paddingLeft = (node.depth * 16) + 'px';
        row.appendChild(indent);

        // Expand/collapse toggle
        let toggle = document.createElement('span');
        toggle.className = 'treeview-toggle';
        if (node.children.length > 0) {
            toggle.textContent = node.expanded ? '▾' : '▸';
            toggle.classList.add('treeview-toggle-active');
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                node.expanded = !node.expanded;
                this._renderAll();
                if (node.expanded) {
                    this.make_callback('expanded', node.values, this._pathOfNode(node));
                } else {
                    this.make_callback('collapsed', node.values, this._pathOfNode(node));
                }
            });
        }
        row.appendChild(toggle);

        // Data cells
        let numCols = Math.max(this._columns.length, node.values.length, 1);
        for (let i = 0; i < numCols; i++) {
            let cell = document.createElement('span');
            cell.className = 'treeview-cell';
            cell._colIndex = i;
            let val = i < node.values.length ? node.values[i] : '';
            let colType = i < this._columns.length ? this._columns[i].type : 'string';
            let editable = i < this._columns.length && this._columns[i].editable
                           && colType !== 'icon';

            if (colType === 'icon' && val) {
                let img = document.createElement('img');
                img.className = 'treeview-icon';
                img.src = val;
                let size = this._columns[i].icon_size || 16;
                img.width = size;
                img.height = size;
                cell.appendChild(img);
            } else {
                cell.textContent = val != null ? String(val) : '';
                cell.title = cell.textContent;
            }

            if (editable) {
                cell.classList.add('treeview-cell-editable');
                cell.addEventListener('dblclick', (e) => {
                    // Editable cells: dblclick starts editing instead of
                    // firing the row's 'activated' callback.
                    e.stopPropagation();
                    this._startEdit(node, i, cell);
                });
            }
            row.appendChild(cell);
        }

        // Click to select
        row.addEventListener('click', (e) => this._onRowClick(e, node));
        row.addEventListener('dblclick', (e) => {
            this.make_callback('activated', node.values);
        });

        return row;
    }

    // -- Internal: selection --

    _onRowClick(e, node) {
        if (this._selectionMode === 'none') return;

        if (this._selectionMode === 'multi' && (e.ctrlKey || e.metaKey)) {
            // Toggle this node in selection
            let idx = this._selection.indexOf(node);
            if (idx >= 0) {
                this._selection.splice(idx, 1);
            } else {
                this._selection.push(node);
            }
        } else if (this._selectionMode === 'multi' && e.shiftKey) {
            // Range select
            if (this._selection.length > 0) {
                let visible = this._getVisibleNodes();
                let anchor = visible.indexOf(this._selection[0]);
                let current = visible.indexOf(node);
                if (anchor >= 0 && current >= 0) {
                    let start = Math.min(anchor, current);
                    let end = Math.max(anchor, current);
                    this._selection = visible.slice(start, end + 1);
                }
            } else {
                this._selection = [node];
            }
        } else {
            this._selection = [node];
        }

        this._updateSelectionDisplay();
        this.make_callback('selected', this.get_selected());
    }

    _updateSelectionDisplay() {
        for (let row of this._body.querySelectorAll('.treeview-row')) {
            if (this._selection.includes(row._node)) {
                row.classList.add('treeview-row-selected');
            } else {
                row.classList.remove('treeview-row-selected');
            }
        }
    }

    // -- Internal: keyboard --

    _onKeyDown(e) {
        if (this._selection.length === 0) return;
        let visible = this._getVisibleNodes();
        let current = visible.indexOf(this._selection[this._selection.length - 1]);
        if (current < 0) return;

        let node = visible[current];

        switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            if (current < visible.length - 1) {
                this._selection = [visible[current + 1]];
                this._updateSelectionDisplay();
                this._scrollToNode(visible[current + 1]);
                this.make_callback('selected', this.get_selected());
            }
            break;
        case 'ArrowUp':
            e.preventDefault();
            if (current > 0) {
                this._selection = [visible[current - 1]];
                this._updateSelectionDisplay();
                this._scrollToNode(visible[current - 1]);
                this.make_callback('selected', this.get_selected());
            }
            break;
        case 'ArrowRight':
            e.preventDefault();
            if (node.children.length > 0 && !node.expanded) {
                node.expanded = true;
                this._renderAll();
                this.make_callback('expanded', node.values, this._pathOfNode(node));
            }
            break;
        case 'ArrowLeft':
            e.preventDefault();
            if (node.children.length > 0 && node.expanded) {
                node.expanded = false;
                this._renderAll();
                this.make_callback('collapsed', node.values, this._pathOfNode(node));
            } else if (node.parent && node.parent !== this._root) {
                // Navigate to parent
                this._selection = [node.parent];
                this._updateSelectionDisplay();
                this._scrollToNode(node.parent);
                this.make_callback('selected', this.get_selected());
            }
            break;
        case 'Enter':
            e.preventDefault();
            this.make_callback('activated', node.values);
            break;
        }
    }

    _scrollToNode(node) {
        if (!node.element) return;
        let vp = this._viewport;
        let rowTop = node.element.offsetTop;
        let rowBottom = rowTop + node.element.offsetHeight;
        if (rowTop < vp.scrollTop) {
            vp.scrollTop = rowTop;
        } else if (rowBottom > vp.scrollTop + vp.clientHeight) {
            vp.scrollTop = rowBottom - vp.clientHeight;
        }
        this._syncFromScroll();
    }

    // -- Internal: scrollbar sync --

    /** Update scrollbar thumb sizes and visibility based on content vs viewport size. */
    _syncScrollbars() {
        let vw = this._viewport.clientWidth;
        let vh = this._viewport.clientHeight;
        let cw = this._body.scrollWidth;
        let ch = this._body.scrollHeight;

        let showH = cw > vw + 1;
        let showV = ch > vh + 1;

        if (!this._hScrollBar || !this._hScrollBar.get_element()) return;
        this._hScrollBar.get_element().style.display = showH ? '' : 'none';
        this._vScrollBar.get_element().style.display = showV ? '' : 'none';
        this._corner.style.display = (showH && showV) ? '' : 'none';

        if (showH) {
            this._hScrollBar.set_thumb_width(Math.min(1, vw / Math.max(1, cw)));
        }
        if (showV) {
            this._vScrollBar.set_thumb_width(Math.min(1, vh / Math.max(1, ch)));
        }

        this._syncFromScroll();
    }

    /**
     * Sets the scroll position using percentages (0–1).
     * @param {number} h_pct - Horizontal scroll percentage.
     * @param {number} v_pct - Vertical scroll percentage.
     */
    set_scroll_position(h_pct, v_pct) {
        let maxX = this._body.scrollWidth - this._viewport.clientWidth;
        let maxY = this._body.scrollHeight - this._viewport.clientHeight;
        if (maxX > 0) this._viewport.scrollLeft = h_pct * maxX;
        if (maxY > 0) this._viewport.scrollTop = v_pct * maxY;
        this._scrollSilent = true;
        this._syncFromScroll();
        this._scrollSilent = false;
    }

    /**
     * Returns the current scroll position as [h_pct, v_pct] (0–1).
     * @returns {number[]}
     */
    get_scroll_position() {
        let maxX = this._body.scrollWidth - this._viewport.clientWidth;
        let maxY = this._body.scrollHeight - this._viewport.clientHeight;
        return [
            maxX > 0 ? this._viewport.scrollLeft / maxX : 0,
            maxY > 0 ? this._viewport.scrollTop / maxY : 0,
        ];
    }

    /** Sync scrollbar positions from the viewport's current scroll offset. */
    _syncFromScroll() {
        let maxScrollX = this._body.scrollWidth - this._viewport.clientWidth;
        let maxScrollY = this._body.scrollHeight - this._viewport.clientHeight;

        let hPct = maxScrollX > 0 ? this._viewport.scrollLeft / maxScrollX : 0;
        let vPct = maxScrollY > 0 ? this._viewport.scrollTop / maxScrollY : 0;

        if (maxScrollX > 0) this._hScrollBar.set_scroll_percent(hPct);
        if (maxScrollY > 0) this._vScrollBar.set_scroll_percent(vPct);

        if (this._scrollTimer) clearTimeout(this._scrollTimer);
        if (this._scrollReady && !this._scrollSilent) {
            this._scrollTimer = setTimeout(() => {
                this._scrollTimer = null;
                this.make_callback('scrolled', hPct, vPct);
            }, 150);
        }
    }

    // -- Internal: path helpers --

    /**
     * Resolve an index path (e.g. [0, 2, 1]) to the internal node.
     * Returns null if the path is invalid.
     */
    _nodeAtPath(path) {
        let node = this._root;
        for (let idx of path) {
            if (idx < 0 || idx >= node.children.length) return null;
            node = node.children[idx];
        }
        return node === this._root ? null : node;
    }

    /**
     * Return the index path from root to the given node.
     */
    _pathOfNode(node) {
        let path = [];
        while (node && node.parent) {
            let idx = node.parent.children.indexOf(node);
            if (idx < 0) return null;
            path.unshift(idx);
            node = node.parent;
        }
        return path;
    }

    /**
     * Accept either a node object or an index-path array.
     * Returns the internal node, or null.
     */
    _resolveNode(ref) {
        if (ref == null) return null;
        if (Array.isArray(ref)) return this._nodeAtPath(ref);
        return ref;
    }

    // -- Internal: tree traversal helpers --

    _walkNodes(node, fn) {
        if (node !== this._root) fn(node);
        for (let child of node.children) {
            this._walkNodes(child, fn);
        }
    }

    _walkVisible(node, fn) {
        if (node !== this._root) fn(node);
        if (node.expanded) {
            for (let child of node.children) {
                this._walkVisible(child, fn);
            }
        }
    }

    _getVisibleNodes() {
        let nodes = [];
        this._walkVisible(this._root, (n) => nodes.push(n));
        return nodes;
    }

    // -- Public API: grid, editing, row/column ops --

    /**
     * @returns {number} The number of columns.
     */
    get_column_count() {
        return this._columns.length;
    }

    /**
     * @returns {number} The number of top-level rows.
     */
    get_row_count() {
        return this._root.children.length;
    }


    /**
     * Toggle grid lines between cells and rows.
     * @param {boolean} tf
     */
    set_show_grid(tf) {
        this._showGrid = !!tf;
        this.element.classList.toggle('treeview-grid', this._showGrid);
    }

    /**
     * Show or hide the row-number gutter on the left.
     * @param {boolean} tf
     */
    set_show_row_numbers(tf) {
        this._showRowNumbers = !!tf;
        this._buildHeader();
        this._renderAll();
    }

    /**
     * Mark a column as editable (or not). Editable cells enter inline-edit
     * mode when the user double-clicks them.
     * @param {number} colIndex
     * @param {boolean} tf
     */
    set_column_editable(colIndex, tf) {
        if (colIndex < 0 || colIndex >= this._columns.length) return;
        this._columns[colIndex].editable = !!tf;
        this._renderAll();
    }

    /**
     * Set a single cell's value. Fires no callback.
     * @param {Object|Array} rowRef - Node, top-level row index, or index path.
     * @param {number} colIndex
     * @param {*} value
     */
    set_cell(rowRef, colIndex, value) {
        let node;
        if (typeof rowRef === 'number') {
            node = this._root.children[rowRef];
        } else {
            node = this._resolveNode(rowRef);
        }
        if (!node) return;
        while (node.values.length <= colIndex) node.values.push('');
        node.values[colIndex] = value;
        this._renderAll();
    }

    /**
     * Insert a new column at the given index. Existing rows get an empty
     * value inserted at that position.
     * @param {number} index
     * @param {string|Object} column - Column descriptor (string or object).
     */
    insert_column(index, column) {
        if (index < 0) index = 0;
        if (index > this._columns.length) index = this._columns.length;
        // Parse the single column the same way _parseColumns does
        let parsed;
        if (typeof column === 'string') {
            parsed = { label: column, type: 'string', editable: false };
        } else {
            parsed = {
                label: column.label || '',
                type: column.type || 'string',
                editable: !!column.editable,
            };
            if (column.icon_size) parsed.icon_size = column.icon_size;
        }
        this._columns.splice(index, 0, parsed);
        this._colWidths.splice(index, 0, '1fr');
        if (this._sortColumn >= index) this._sortColumn++;
        this._walkNodes(this._root, (node) => {
            while (node.values.length < index) node.values.push('');
            node.values.splice(index, 0, '');
        });
        this._buildHeader();
        this._renderAll();
    }

    /**
     * Append a column at the end. See insert_column.
     * @param {string|Object} column
     */
    append_column(column) {
        this.insert_column(this._columns.length, column);
    }

    /**
     * Delete the column at the given index. Values at that index are
     * removed from every row.
     * @param {number} index
     */
    delete_column(index) {
        if (index < 0 || index >= this._columns.length) return;
        this._columns.splice(index, 1);
        this._colWidths.splice(index, 1);
        if (this._sortColumn === index) {
            this._sortColumn = -1;
        } else if (this._sortColumn > index) {
            this._sortColumn--;
        }
        this._walkNodes(this._root, (node) => {
            if (index < node.values.length) {
                node.values.splice(index, 1);
            }
        });
        this._buildHeader();
        this._renderAll();
    }

    /**
     * Insert a new top-level row at the given index.
     * @param {number} index
     * @param {Array} values
     * @returns {Array} The index path of the new row.
     */
    insert_row(index, values) {
        if (index < 0) index = 0;
        if (index > this._root.children.length) index = this._root.children.length;
        let node = {
            values: Array.isArray(values) ? values.slice() : [values],
            children: [],
            expanded: false,
            depth: 0,
            element: null,
            parent: this._root,
        };
        this._root.children.splice(index, 0, node);
        this._renderAll();
        return [index];
    }

    /**
     * Append a new top-level row.
     * @param {Array} values
     * @returns {Array} The index path of the new row.
     */
    append_row(values) {
        return this.insert_row(this._root.children.length, values);
    }

    /**
     * Delete a top-level row.
     * @param {number} index - Row index, or an index path.
     */
    delete_row(index) {
        let node;
        if (Array.isArray(index)) {
            node = this._nodeAtPath(index);
        } else {
            node = this._root.children[index];
        }
        if (!node) return;
        this.remove_item(node);
    }

    // -- Internal: inline cell editing --

    /** @private */
    _startEdit(node, colIndex, cell) {
        if (this._editor) this._commitEdit();

        let oldValue = colIndex < node.values.length ? node.values[colIndex] : '';
        let colType = colIndex < this._columns.length
            ? this._columns[colIndex].type : 'string';

        let input = document.createElement('input');
        input.type = 'text';
        input.className = 'treeview-cell-editor';
        input.value = oldValue != null ? String(oldValue) : '';

        // Replace cell contents with the editor
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();
        input.select();

        this._editor = input;
        this._editInfo = { node, colIndex, oldValue, cell };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._commitEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this._cancelEdit();
            }
            e.stopPropagation();  // don't let row keys hijack
        });
        input.addEventListener('blur', () => this._commitEdit());
    }

    /** @private */
    _commitEdit() {
        if (!this._editor || !this._editInfo) return;
        let { node, colIndex, oldValue, cell } = this._editInfo;
        let raw = this._editor.value;
        let colType = colIndex < this._columns.length
            ? this._columns[colIndex].type : 'string';
        let newValue = raw;
        if (colType === 'number') {
            let n = parseFloat(raw);
            newValue = isNaN(n) ? oldValue : n;
        }
        // Clear first to avoid reentry via blur
        this._editor = null;
        this._editInfo = null;
        while (node.values.length <= colIndex) node.values.push('');
        let changed = node.values[colIndex] !== newValue;
        node.values[colIndex] = newValue;
        // Restore the cell in place rather than rebuilding the whole body;
        // a full _renderAll here disturbs browser state (dblclick tracking)
        // and discards unrelated scroll/focus context.
        this._restoreCell(cell, newValue);
        if (changed) {
            this.make_callback('cell_edited',
                this._pathOfNode(node), colIndex, oldValue, newValue);
        }
    }

    /** @private */
    _cancelEdit() {
        if (!this._editor || !this._editInfo) return;
        let { oldValue, cell } = this._editInfo;
        this._editor = null;
        this._editInfo = null;
        this._restoreCell(cell, oldValue);
    }

    /** @private Replace editor with plain text content in the given cell. */
    _restoreCell(cell, value) {
        if (!cell) return;
        cell.textContent = value != null ? String(value) : '';
        cell.title = cell.textContent;
    }

    _sortChildren(node, colIndex, ascending) {
        let colType = colIndex < this._columns.length
            ? this._columns[colIndex].type : 'string';

        node.children.sort((a, b) => {
            let va = colIndex < a.values.length ? a.values[colIndex] : '';
            let vb = colIndex < b.values.length ? b.values[colIndex] : '';
            if (va == null) va = '';
            if (vb == null) vb = '';
            let cmp;
            if (colType === 'number') {
                let na = typeof va === 'number' ? va : parseFloat(va);
                let nb = typeof vb === 'number' ? vb : parseFloat(vb);
                // push NaN to the end
                if (isNaN(na) && isNaN(nb)) cmp = 0;
                else if (isNaN(na)) cmp = 1;
                else if (isNaN(nb)) cmp = -1;
                else cmp = na - nb;
            } else {
                cmp = String(va).localeCompare(String(vb), undefined, {sensitivity: 'base'});
            }
            return ascending ? cmp : -cmp;
        });
    }
}

export { TreeView };
