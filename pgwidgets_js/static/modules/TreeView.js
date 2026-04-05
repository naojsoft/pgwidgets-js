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

        // Column widths in fr units (default 1fr each)
        this._colWidths = this._columns.map(() => '1fr');

        // Sort state: which column is sorted and in which direction
        this._sortColumn = -1;       // -1 = no active sort
        this._sortAscending = true;

        // Enable callbacks
        for (let name of ['activated', 'selected', 'expanded', 'collapsed']) {
            this.enable_callback(name);
        }

        // Implicit root node — never rendered
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

        // Content wrapper — rows go here, sized naturally
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

        // Scrollbar callbacks — scroll the content
        this._vScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this._body.scrollHeight - this._viewport.clientHeight;
            this._viewport.scrollTop = pct * maxScroll;
        });
        this._hScrollBar.add_callback('activated', (w, pct) => {
            let maxScroll = this._body.scrollWidth - this._viewport.clientWidth;
            this._viewport.scrollLeft = pct * maxScroll;
        });

        // Mouse wheel
        this._viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            this._viewport.scrollTop += e.deltaY;
            this._viewport.scrollLeft += e.deltaX;
            this._syncFromScroll();
        });

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
        this.clear = this.clear.bind(this);
        this.expand_all = this.expand_all.bind(this);
        this.collapse_all = this.collapse_all.bind(this);
        this.get_selected = this.get_selected.bind(this);
        this.set_selected = this.set_selected.bind(this);
        this.sort_by_column = this.sort_by_column.bind(this);
    }

    // ── Column parsing ─────────────────────────────────────────────

    /**
     * Normalise the columns option into [{label, type}, ...].
     * Accepts plain strings or {label, type} objects.
     */
    _parseColumns(raw) {
        this._columns = raw.map(c => {
            if (typeof c === 'string') {
                return { label: c, type: 'string' };
            }
            return { label: c.label || '', type: c.type || 'string' };
        });
    }

    // ── Column grid template ──────────────────────────────────────

    _gridTemplate() {
        // indent + toggle columns, then data columns
        let cols = '16px 18px ' + this._colWidths.join(' ');
        return cols;
    }

    _applyGridTemplate() {
        let tpl = this._gridTemplate();
        this._header.style.gridTemplateColumns = tpl;
        for (let row of this._body.querySelectorAll('.treeview-row')) {
            row.style.gridTemplateColumns = tpl;
        }
    }

    // ── Header ──────────────────────────────────────���─────────────

    _buildHeader() {
        this._header.innerHTML = '';
        this._header.style.gridTemplateColumns = this._gridTemplate();

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

    // ── Public API ────────────────────────────────────────────────

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
     * @param {Object|null} parent - Parent node (null for top-level).
     * @param {Array} values - Column values.
     * @returns {Object} The new node (use as parent for sub-items).
     */
    add_item(parent, values) {
        if (parent == null) parent = this._root;
        let node = {
            values: Array.isArray(values) ? values : [values],
            children: [],
            expanded: false,
            depth: parent.depth + 1,
            element: null,
            parent: parent,
        };
        parent.children.push(node);
        this._applySort();
        this._renderAll();
        return node;
    }

    /**
     * Remove an item and all its descendants.
     * @param {Object} node - The node to remove.
     */
    remove_item(node) {
        if (!node || !node.parent) return;
        let siblings = node.parent.children;
        let idx = siblings.indexOf(node);
        if (idx >= 0) siblings.splice(idx, 1);
        // Remove from selection
        this._selection = this._selection.filter(n => n !== node);
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
     * Expand a specific node.
     * @param {Object} node
     */
    expand_item(node) {
        if (node && node.children.length > 0) {
            node.expanded = true;
            this._renderAll();
            this.make_callback('expanded', node.values);
        }
    }

    /**
     * Collapse a specific node.
     * @param {Object} node
     */
    collapse_item(node) {
        if (node && node.children.length > 0) {
            node.expanded = false;
            this._renderAll();
            this.make_callback('collapsed', node.values);
        }
    }

    /**
     * Get the currently selected item(s).
     * @returns {Array} Array of value arrays for selected nodes.
     */
    get_selected() {
        return this._selection.map(n => n.values);
    }

    /**
     * Set the selection to a specific node.
     * @param {Object|null} node - Node to select (null to clear).
     */
    set_selected(node) {
        this._selection = node ? [node] : [];
        this._updateSelectionDisplay();
        this.make_callback('selected', this.get_selected());
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

    // ── Internal: data loading ────────────────────────────────────

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

    // ── Internal: rendering ───────────────────────────────────────

    _renderAll() {
        this._body.innerHTML = '';
        let visibleIndex = 0;
        this._walkVisible(this._root, (node) => {
            let row = this._createRow(node, visibleIndex);
            this._body.appendChild(row);
            node.element = row;
            visibleIndex++;
        });
        this._syncScrollbars();
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
                    this.make_callback('expanded', node.values);
                } else {
                    this.make_callback('collapsed', node.values);
                }
            });
        }
        row.appendChild(toggle);

        // Data cells
        let numCols = Math.max(this._columns.length, node.values.length, 1);
        for (let i = 0; i < numCols; i++) {
            let cell = document.createElement('span');
            cell.className = 'treeview-cell';
            let val = i < node.values.length ? node.values[i] : '';
            cell.textContent = val != null ? String(val) : '';
            cell.title = cell.textContent;
            row.appendChild(cell);
        }

        // Click to select
        row.addEventListener('click', (e) => this._onRowClick(e, node));
        row.addEventListener('dblclick', (e) => {
            this.make_callback('activated', node.values);
        });

        return row;
    }

    // ── Internal: selection ───────────────────────────────────────

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

    // ── Internal: keyboard ────────────────────────────────────────

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
                this.make_callback('expanded', node.values);
            }
            break;
        case 'ArrowLeft':
            e.preventDefault();
            if (node.children.length > 0 && node.expanded) {
                node.expanded = false;
                this._renderAll();
                this.make_callback('collapsed', node.values);
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
        if (node.element) {
            node.element.scrollIntoView({ block: 'nearest' });
        }
    }

    // ── Internal: scrollbar sync ───────────────────────────────────

    /** Update scrollbar thumb sizes and visibility based on content vs viewport size. */
    _syncScrollbars() {
        let vw = this._viewport.clientWidth;
        let vh = this._viewport.clientHeight;
        let cw = this._body.scrollWidth;
        let ch = this._body.scrollHeight;

        let showH = cw > vw + 1;
        let showV = ch > vh + 1;

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

    /** Sync scrollbar positions from the viewport's current scroll offset. */
    _syncFromScroll() {
        let maxScrollX = this._body.scrollWidth - this._viewport.clientWidth;
        let maxScrollY = this._body.scrollHeight - this._viewport.clientHeight;

        if (maxScrollX > 0) {
            this._hScrollBar.set_scroll_percent(this._viewport.scrollLeft / maxScrollX);
        }
        if (maxScrollY > 0) {
            this._vScrollBar.set_scroll_percent(this._viewport.scrollTop / maxScrollY);
        }
    }

    // ── Internal: tree traversal helpers ──────────────────────────

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
                cmp = String(va).localeCompare(String(vb));
            }
            return ascending ? cmp : -cmp;
        });
    }
}

export { TreeView };
