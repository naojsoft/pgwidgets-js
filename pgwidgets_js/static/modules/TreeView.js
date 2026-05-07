"use strict";

import {Widget} from "./Widget.js";
import {ScrollBar} from "./ScrollBar.js";

/**
 * A tree/table view widget similar to Qt's QTreeWidget.
 *
 * Tree data is stored as a hierarchy of dicts.  Each child of an
 * interior node is keyed by a unique string identifier; that key is
 * the node's stable identity.  Paths to nodes are arrays of those
 * keys, and they remain valid no matter how the visible tree is
 * sorted.
 *
 * Leaf shape: `{COL_KEY: value, ...}` (all values are primitives).
 * Interior shape with no own values: `{childKey: <subdict>, ...}`.
 * Interior shape with own values: `{__values__: {COL_KEY: ...},
 * childKey: <subdict>, ...}`.
 *
 * The first column auto-displays the node's dict key when the row
 * doesn't supply a value for it; this means interiors typically need
 * no `__values__` at all — their dict key is their label.
 *
 * @extends Widget
 */
class TreeView extends Widget {

    /**
     * @param {Object} [options]
     * @param {Array} [options.columns=[]] - Column descriptors.  Each
     *   entry is either a plain string (label; type defaults to
     *   'string', auto key generated) or an object
     *   { label, type, key, editable, halign, icon_size }.  Supported
     *   types: 'string' (alias 'str'), 'integer' (alias 'int'),
     *   'float' (alias 'number'), 'boolean' (renders ✓ when truthy),
     *   and 'icon' (cell value is a URL or data: URL used as the
     *   image source).  halign is 'left' | 'center' | 'right';
     *   default depends on type (numeric → right, boolean/icon →
     *   center, otherwise left).  Each column gets a stable string
     *   key — auto-generated as `_col0`, `_col1`, ... if not supplied.
     * @param {boolean} [options.show_header=true]
     * @param {string} [options.selection_mode='single'] - 'single', 'multiple', or 'none'.
     * @param {boolean} [options.alternate_row_colors=false]
     * @param {boolean} [options.sortable=false]
     * @param {boolean} [options.show_grid=false]
     * @param {boolean} [options.show_row_numbers=false]
     * @param {boolean} [options.allow_text_selection=false] - When
     *   false (default), drag-to-highlight text inside cells is
     *   disabled.  Set to true to allow normal browser text
     *   selection (useful when users need to copy cell text).
     * @param {HTMLElement} [options.element=null]
     */
    constructor(options = {}) {
        super();
        this.element = this.get_option(options, 'element', null);
        if (this.element == null) {
            this.element = document.createElement('div');
        }
        this.element.className = 'treeview-widget';

        this._columns = [];
        this._parseColumns(this.get_option(options, 'columns', []));
        this._showHeader = this.get_option(options, 'show_header', true);
        this._selectionMode = this.get_option(options, 'selection_mode', 'single');
        this._alternateRowColors = this.get_option(options, 'alternate_row_colors', false);
        this._showGrid = this.get_option(options, 'show_grid', false);
        if (this._showGrid) {
            this.element.classList.add('treeview-grid');
        }
        this._showRowNumbers = this.get_option(options, 'show_row_numbers', false);
        this._sortable = this.get_option(options, 'sortable', false);
        // Text selection (drag-to-highlight inside cells) is off by
        // default for all widgets via the Widget base class.  Opt in
        // via the standard set_allow_text_selection() method, or pass
        // allow_text_selection: true at construction.
        if (this.get_option(options, 'allow_text_selection', false)) {
            this.set_allow_text_selection(true);
        }

        this._colWidths = this._columns.map(() => '1fr');

        // Sort state.  _sortColKey is the key of the active sort
        // column (null = no sort).  When set, every node's
        // _sortedView caches the sorted view of its children;
        // node.children itself stays in canonical (insertion) order.
        this._sortColKey = null;
        this._sortAscending = true;

        this._editor = null;
        this._editInfo = null;

        for (let name of ['activated', 'selected', 'expanded', 'collapsed',
                          'sorted', 'cell_edited', 'scrolled']) {
            this.enable_callback(name);
        }

        // Implicit root.  Children Map is keyed by string ids.
        this._root = this._makeNode({
            key: null,
            values: null,
            depth: -1,
            parent: null,
            expanded: true,
        });
        this._selection = [];

        // -- Header --
        // The header lives inside a clipping wrapper so it can be
        // wider than the visible widget (matching the body's
        // max-content width) and translated horizontally to track
        // body scroll.  Hide via the wrapper so the inner header's
        // grid template is unaffected.
        this._headerClip = document.createElement('div');
        this._headerClip.className = 'treeview-header-clip';
        this._header = document.createElement('div');
        this._header.className = 'treeview-header';
        if (!this._showHeader || this._columns.length === 0) {
            this._headerClip.style.display = 'none';
        }
        this._headerClip.appendChild(this._header);
        this.element.appendChild(this._headerClip);
        this._buildHeader();

        // -- Scrollable body area (grid: viewport + scrollbars) --
        this._bodyArea = document.createElement('div');
        this._bodyArea.className = 'treeview-body-area';
        this.element.appendChild(this._bodyArea);

        this._viewport = document.createElement('div');
        this._viewport.className = 'treeview-viewport';
        this._bodyArea.appendChild(this._viewport);

        this._body = document.createElement('div');
        this._body.className = 'treeview-body';
        this._viewport.appendChild(this._body);

        this._vScrollBar = new ScrollBar({orientation: 'vertical'});
        this._hScrollBar = new ScrollBar({orientation: 'horizontal'});
        this._vScrollBar.get_element().classList.add('treeview-vbar');
        this._hScrollBar.get_element().classList.add('treeview-hbar');

        this._corner = document.createElement('div');
        this._corner.className = 'treeview-corner';

        this._bodyArea.appendChild(this._vScrollBar.get_element());
        this._bodyArea.appendChild(this._hScrollBar.get_element());
        this._bodyArea.appendChild(this._corner);

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

        this._viewport.addEventListener('scroll', () => this._syncFromScroll());
        this._viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            this._viewport.scrollTop += e.deltaY;
            this._viewport.scrollLeft += e.deltaX;
            this._syncFromScroll();
        });

        this._scrollTimer = null;
        this._scrollReady = false;

        this._syncScrollbars = this._syncScrollbars.bind(this);
        this._resizeObserver = new ResizeObserver(() => this._syncScrollbars());
        this._resizeObserver.observe(this._viewport);
        this._resizeObserver.observe(this._body);

        this.element.tabIndex = 0;
        this.element.addEventListener('keydown', (e) => this._onKeyDown(e));

        // Bind public methods
        for (let name of [
            'set_tree', 'add_tree', 'update_tree', 'set_data',
            'add_item', 'remove_item', 'remove_items', 'clear',
            'expand_all', 'collapse_all', 'get_expanded', 'get_collapsed',
            'expand_item', 'collapse_item',
            'get_selected', 'get_subtree',
            'set_selected', 'clear_selection',
            'select_path', 'select_paths', 'select_all',
            'set_column_width', 'set_optimal_column_widths',
            'sort_by_column', 'scroll_to_path', 'scroll_to_end',
            'set_scroll_position', 'get_scroll_position',
            'get_column_count', 'get_row_count',
            'set_show_grid', 'set_show_row_numbers', 'set_sortable',
            'set_column_editable', 'set_cell',
            'insert_column', 'append_column', 'delete_column',
            'insert_row', 'append_row', 'delete_row',
        ]) {
            this[name] = this[name].bind(this);
        }
        requestAnimationFrame(() => { this._scrollReady = true; });
    }

    // -- Internal: node factory --

    _makeNode({key, values, depth, parent, expanded}) {
        return {
            key: key,                  // string key in parent's children Map
            values: values,            // dict of column values, or null
            children: new Map(),       // canonical: insertion order
            sortedView: null,          // array of children in sort order
            expanded: expanded !== undefined ? expanded : true,
            depth: depth,
            element: null,
            parent: parent,
        };
    }

    // -- Column parsing --

    _parseColumns(raw) {
        let autoIdx = 0;
        this._columns = raw.map((c, i) => {
            if (typeof c === 'string') {
                return { label: c, type: 'string', editable: false,
                         key: '_col' + (autoIdx++), halign: 'left' };
            }
            let type = TreeView._normalizeType(c.type);
            let key = c.key;
            if (!key) key = '_col' + (autoIdx++);
            return {
                label: c.label || '',
                type: type,
                editable: !!c.editable,
                key: key,
                halign: TreeView._normalizeHalign(c.halign, type),
                icon_size: c.icon_size,
            };
        });
    }

    static _normalizeHalign(halign, type) {
        if (halign === 'left' || halign === 'center' || halign === 'right') {
            return halign;
        }
        if (type === 'integer' || type === 'float') return 'right';
        if (type === 'boolean' || type === 'icon')  return 'center';
        return 'left';
    }

    static _normalizeType(t) {
        if (!t) return 'string';
        switch (t) {
            case 'str':     return 'string';
            case 'int':     return 'integer';
            case 'number':  return 'float';
            case 'bool':    return 'boolean';
            case 'string':
            case 'integer':
            case 'float':
            case 'boolean':
            case 'icon':
                return t;
            default:
                return 'string';
        }
    }

    /** Find the column descriptor for a key.  Returns null if unknown. */
    _columnByKey(key) {
        for (let col of this._columns) {
            if (col.key === key) return col;
        }
        return null;
    }

    /** Find the column index for a key.  Returns -1 if unknown. */
    _columnIndex(key) {
        for (let i = 0; i < this._columns.length; i++) {
            if (this._columns[i].key === key) return i;
        }
        return -1;
    }

    // -- Column grid template --

    _gridTemplate() {
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

        if (this._showRowNumbers) {
            let rn = document.createElement('div');
            rn.className = 'treeview-header-spacer treeview-rownum-header';
            this._header.appendChild(rn);
        }

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
            cell._colKey = this._columns[i].key;
            this._headerCells.push(cell);

            // Mirror the column's resolved halign on the header so its
            // label aligns the same way as the data cells below it.
            // The halign is whatever _normalizeHalign produced — the
            // user's explicit choice if given, otherwise the type
            // default (right for numeric, center for boolean/icon,
            // left otherwise).  CSS handles the per-halign layout.
            let halign = this._columns[i].halign || 'left';
            cell.classList.add('treeview-halign-' + halign);

            let labelSpan = document.createElement('span');
            labelSpan.className = 'treeview-header-label';
            labelSpan.textContent = this._columns[i].label;
            cell.appendChild(labelSpan);

            let indicator = document.createElement('span');
            indicator.className = 'treeview-sort-indicator';
            cell.appendChild(indicator);

            cell.addEventListener('click', (e) => {
                if (e.target.classList.contains('treeview-resize-handle')) return;
                this._onHeaderClick(this._columns[i].key);
            });

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
            let cells = this._header.querySelectorAll('.treeview-header-cell');
            startWidthA = cells[colIndex].getBoundingClientRect().width;
            startWidthB = cells[colIndex + 1].getBoundingClientRect().width;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    _onHeaderClick(colKey) {
        if (!this._sortable) return;
        let ascending = (this._sortColKey === colKey) ? !this._sortAscending : true;
        this.sort_by_column(colKey, ascending);
        this.make_callback('sorted', colKey, ascending);
    }

    _updateSortIndicators() {
        if (!this._headerCells) return;
        for (let i = 0; i < this._headerCells.length; i++) {
            let ind = this._headerCells[i].querySelector('.treeview-sort-indicator');
            if (!ind) continue;
            if (this._columns[i].key === this._sortColKey) {
                ind.textContent = this._sortAscending ? '▲' : '▼';
                ind.classList.add('treeview-sort-indicator-active');
            } else {
                ind.textContent = '';
                ind.classList.remove('treeview-sort-indicator-active');
            }
        }
    }

    // -- Sort --

    /**
     * Build a sorted view for *node*'s children using the current
     * sort criterion.  Sets node.sortedView to an array of children
     * in display order (canonical Map untouched).  No-op if no sort
     * is active.
     * @private
     */
    _applySortToNode(node) {
        if (this._sortColKey == null) {
            node.sortedView = null;
            return;
        }
        if (node.children.size === 0) {
            node.sortedView = null;
            return;
        }
        node.sortedView = this._sortChildren(node, this._sortColKey,
                                             this._sortAscending);
    }

    _applySort() {
        if (this._sortColKey == null) {
            this._walkNodes(this._root, (n) => { n.sortedView = null; });
            return;
        }
        this._walkNodesIncludingRoot(this._root, (n) => {
            this._applySortToNode(n);
        });
    }

    _sortChildren(node, colKey, ascending) {
        let col = this._columnByKey(colKey);
        let colType = col ? col.type : 'string';
        let arr = [...node.children.values()];
        arr.sort((a, b) => {
            let va = this._cellValue(a, this._columnIndex(colKey));
            let vb = this._cellValue(b, this._columnIndex(colKey));
            if (va == null) va = '';
            if (vb == null) vb = '';
            let cmp;
            if (colType === 'integer' || colType === 'float') {
                let parse = colType === 'integer' ? parseInt : parseFloat;
                let na = typeof va === 'number' ? va : parse(va, 10);
                let nb = typeof vb === 'number' ? vb : parse(vb, 10);
                if (isNaN(na) && isNaN(nb)) cmp = 0;
                else if (isNaN(na)) cmp = 1;
                else if (isNaN(nb)) cmp = -1;
                else cmp = na - nb;
            } else if (colType === 'boolean') {
                cmp = (!!va) - (!!vb);
            } else {
                cmp = String(va).localeCompare(String(vb), undefined, {sensitivity: 'base'});
            }
            return ascending ? cmp : -cmp;
        });
        return arr;
    }

    // -- Public API --

    set_columns(columns) {
        this._parseColumns(columns);
        this._colWidths = this._columns.map(() => '1fr');
        this._sortColKey = null;
        if (this._showHeader && this._columns.length > 0) {
            this._headerClip.style.display = '';
        }
        this._buildHeader();
        this._renderAll();
    }

    /**
     * Replace the tree with a hierarchical dict.  See class doc
     * for shape conventions.
     * @param {Object} tree
     */
    set_tree(tree) {
        this.clear();
        this._loadDictTree(this._root, tree);
        this._applySort();
        this._renderAll();
    }

    /**
     * Replace the tree, preserving selection wherever possible.
     * Selected paths that still resolve in the new tree stay
     * selected; paths that no longer exist are dropped.
     *
     * (Phase 1: structurally a set_tree + selection restore.  A
     * future implementation can compute the diff between current
     * and new trees and apply minimal updates.)
     *
     * @param {Object} tree
     */
    update_tree(tree) {
        let paths = this._selection.map(n => this._pathOfNode(n));
        this.set_tree(tree);
        this._restoreSelectionByPaths(paths);
    }

    /**
     * Merge a hierarchical dict into the existing tree under *parent*.
     * Keys that already exist are replaced (subtree-deep); new keys
     * are appended.  Selection is preserved by path: selected nodes
     * whose paths still resolve in the merged tree stay selected;
     * paths that no longer exist (because the replaced subtree no
     * longer contains them) are silently dropped.
     *
     * @param {Object} tree
     * @param {Array<string>|null} [parent=null] - Parent path (array
     *   of keys), or null for root.
     */
    add_tree(tree, parent = null) {
        let parentNode = parent == null ? this._root : this._nodeAtPath(parent);
        if (!parentNode) return;
        let paths = this._selection.map(n => this._pathOfNode(n));
        this._loadDictTree(parentNode, tree);
        this._applySort();
        this._renderAll();
        this._restoreSelectionByPaths(paths);
    }

    /**
     * Re-resolve each path against the current tree and rebuild
     * this._selection from the survivors.  If any selections were
     * dropped, fire a 'selected' callback so user code can react.
     * @private
     */
    _restoreSelectionByPaths(paths) {
        let restored = [];
        for (let p of paths) {
            if (!p) continue;
            let n = this._nodeAtPath(p);
            if (n) restored.push(n);
        }
        let dropped = restored.length !== paths.length;
        this._selection = restored;
        this._updateSelectionDisplay();
        if (dropped) {
            this.make_callback('selected', this.get_selected());
        }
    }

    /**
     * Populate from a flat array of rows.  Each row is either a dict
     * of column-key → value, or an array of values matching column
     * order.  Synthetic keys (`row0`, `row1`, ...) are generated
     * internally so paths and reconstruction work uniformly.
     * @param {Array} data
     */
    set_data(data) {
        this.clear();
        for (let i = 0; i < data.length; i++) {
            let row = data[i];
            let values;
            if (Array.isArray(row)) {
                values = {};
                for (let c = 0; c < this._columns.length && c < row.length; c++) {
                    values[this._columns[c].key] = row[c];
                }
            } else if (row != null && typeof row === 'object') {
                values = row;
            } else {
                values = {};
                if (this._columns.length > 0) {
                    values[this._columns[0].key] = row;
                }
            }
            let key = 'row' + i;
            let node = this._makeNode({
                key: key, values: values, depth: 0,
                parent: this._root, expanded: false,
            });
            this._root.children.set(key, node);
        }
        this._applySort();
        this._renderAll();
    }

    /**
     * Add a single child under a parent.
     * @param {Array<string>|null} parent - Parent path (array of keys).
     * @param {string} key - Key for the new child.
     * @param {Object} values - Column values dict, or a child subtree
     *   if it contains nested dicts.
     * @returns {Array<string>} The path of the new node.
     */
    add_item(parent, key, values) {
        let parentNode = parent == null ? this._root : this._nodeAtPath(parent);
        if (!parentNode) return null;
        this._addNodeFromDict(parentNode, key, values || {});
        this._applySortToNode(parentNode);
        this._renderAll();
        return this._pathOfNode(parentNode.children.get(key));
    }

    /**
     * Remove a node by path.
     * @param {Array<string>} path
     */
    remove_item(path) {
        let node = this._resolveNode(path);
        if (!node || !node.parent) return;
        node.parent.children.delete(node.key);
        this._applySortToNode(node.parent);
        this._selection = this._selection.filter(n => n !== node);
        this._renderAll();
    }

    /**
     * Remove multiple nodes by their key paths.
     * @param {Array<Array<string>>} paths
     */
    remove_items(paths) {
        // Sort so deeper paths come first (so removing a parent doesn't
        // invalidate child paths still in the queue).
        let sorted = paths.slice().sort((a, b) => b.length - a.length);
        let touched = new Set();
        for (let path of sorted) {
            let node = this._nodeAtPath(path);
            if (!node || !node.parent) continue;
            node.parent.children.delete(node.key);
            touched.add(node.parent);
            this._selection = this._selection.filter(n => n !== node);
        }
        for (let p of touched) this._applySortToNode(p);
        this._renderAll();
    }

    clear() {
        this._root.children = new Map();
        this._root.sortedView = null;
        this._selection = [];
        this._body.innerHTML = '';
    }

    expand_all() {
        this._walkNodes(this._root, (node) => {
            if (node.children.size > 0) node.expanded = true;
        });
        this._renderAll();
    }

    collapse_all() {
        this._walkNodes(this._root, (node) => {
            if (node.children.size > 0) node.expanded = false;
        });
        this._renderAll();
    }

    get_expanded() {
        let paths = [];
        this._walkNodes(this._root, (node) => {
            if (node.children.size > 0 && node.expanded) {
                paths.push(this._pathOfNode(node));
            }
        });
        return paths;
    }

    get_collapsed() {
        let paths = [];
        this._walkNodes(this._root, (node) => {
            if (node.children.size > 0 && !node.expanded) {
                paths.push(this._pathOfNode(node));
            }
        });
        return paths;
    }

    expand_item(path) {
        let node = this._resolveNode(path);
        if (node && node.children.size > 0) {
            node.expanded = true;
            this._renderAll();
            this.make_callback('expanded', node.values,
                               this._pathOfNode(node));
        }
    }

    collapse_item(path) {
        let node = this._resolveNode(path);
        if (node && node.children.size > 0) {
            node.expanded = false;
            this._renderAll();
            this.make_callback('collapsed', node.values,
                               this._pathOfNode(node));
        }
    }

    get_selected() {
        return this._selection.map(n => ({
            path: this._pathOfNode(n),
            values: n.values,
        }));
    }

    /**
     * Return a dict-tree (same shape as accepted by set_tree)
     * containing a subset of the tree.
     *
     * @param {string|Array<string>} [status='all'] - selector.
     *
     *   If a string: 'all', 'selected', 'expanded', or 'collapsed'.
     *
     *   'all' returns the whole tree.  Otherwise, the result
     *   includes every "matching" node plus all of its descendants,
     *   plus the ancestors needed to keep the tree connected.
     *
     *   - 'selected':  matches are the currently selected nodes.
     *   - 'expanded':  matches are interior nodes with expanded=true.
     *   - 'collapsed': matches are interior nodes with expanded=false.
     *
     *   So 'selected' on an interior brings every leaf under it
     *   along; 'expanded' on a folder includes the entire subtree
     *   rooted at that folder.
     *
     *   If an array: a key path.  The match is the single node at
     *   that path; the result includes that node, all its
     *   descendants down to leaf nodes, and the ancestors needed to
     *   keep the result rooted at the tree root — same shape as the
     *   string-status cases.  Throws if the path does not resolve.
     *
     * @returns {Object} A dict-tree that can be round-tripped back
     *   through set_tree.
     */
    get_subtree(status = 'all') {
        let included = null;
        if (status !== 'all') {
            let matches = new Set();
            if (Array.isArray(status)) {
                let node = this._nodeAtPath(status);
                if (!node) {
                    throw new Error("get_subtree: path does not resolve: "
                                    + JSON.stringify(status));
                }
                matches.add(node);
            } else if (status === 'selected') {
                for (let n of this._selection) matches.add(n);
            } else if (status === 'expanded') {
                this._walkNodes(this._root, (n) => {
                    if (n.children.size > 0 && n.expanded) {
                        matches.add(n);
                    }
                });
            } else if (status === 'collapsed') {
                this._walkNodes(this._root, (n) => {
                    if (n.children.size > 0 && !n.expanded) {
                        matches.add(n);
                    }
                });
            } else {
                throw new Error("get_subtree: unknown status '"
                                + status + "'");
            }
            // Include matches and all their descendants...
            included = new Set();
            for (let m of matches) {
                included.add(m);
                this._walkNodes(m, (n) => included.add(n));
            }
            // ...plus ancestors so the result is a connected tree.
            for (let inc of [...included]) {
                let p = inc.parent;
                while (p && p !== this._root) {
                    included.add(p);
                    p = p.parent;
                }
            }
        }
        return this._serializeChildren(this._root, included);
    }

    /** @private Serialize children of *node* as {key: serializedNode, ...}. */
    _serializeChildren(node, filter) {
        let result = {};
        for (let [key, child] of node.children) {
            if (filter !== null && !filter.has(child)) continue;
            result[key] = this._serializeNode(child, filter);
        }
        return result;
    }

    /** @private Serialize one node into the value-form usable in a parent dict. */
    _serializeNode(node, filter) {
        let isInterior = node.children.size > 0;
        if (!isInterior) {
            // Leaf — values dict (copy so caller can't mutate state).
            return node.values
                ? Object.assign({}, node.values)
                : {};
        }
        let childrenOnly = this._serializeChildren(node, filter);
        if (node.values && Object.keys(node.values).length > 0) {
            // Interior with own column data — use __values__ sentinel.
            return Object.assign({__values__:
                                  Object.assign({}, node.values)},
                                 childrenOnly);
        }
        return childrenOnly;
    }

    /**
     * Clear all selection.  Fires the 'selected' callback with an
     * empty list.
     */
    clear_selection() {
        this._selection = [];
        this._updateSelectionDisplay();
        this.make_callback('selected', this.get_selected());
    }

    set_selected(paths) {
        if (paths == null) {
            this._selection = [];
        } else if (!Array.isArray(paths)) {
            this._selection = [];
        } else {
            // Could be a single path or an array of paths.
            let isSingle = paths.length === 0
                || (typeof paths[0] === 'string');
            if (isSingle) {
                let node = this._nodeAtPath(paths);
                this._selection = node ? [node] : [];
            } else {
                this._selection = paths
                    .map(p => this._nodeAtPath(p))
                    .filter(n => n != null);
            }
        }
        this._updateSelectionDisplay();
        this.make_callback('selected', this.get_selected());
    }

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

    select_all(state) {
        if (state) {
            this._selection = [];
            this._walkNodes(this._root, (n) => this._selection.push(n));
        } else {
            this._selection = [];
        }
        this._updateSelectionDisplay();
        this.make_callback('selected', this.get_selected());
    }

    /**
     * Set the width of a column by key.
     * @param {string} colKey
     * @param {number|string} width - Pixel width or CSS value.
     */
    set_column_width(colKey, width) {
        let i = this._columnIndex(colKey);
        if (i < 0) return;
        this._colWidths[i] = typeof width === 'number' ? width + 'px' : width;
        this._applyGridTemplate();
    }

    set_optimal_column_widths() {
        if (!this.element.isConnected) {
            requestAnimationFrame(() => this.set_optimal_column_widths());
            return;
        }
        let numCols = this._columns.length;
        if (numCols === 0) return;

        let measure = document.createElement('div');
        measure.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit;';
        this.element.appendChild(measure);

        let widths = new Array(numCols).fill(0);
        for (let i = 0; i < numCols; i++) {
            measure.textContent = this._columns[i].label;
            widths[i] = Math.max(widths[i], measure.offsetWidth + 30);
        }
        this._walkNodes(this._root, (node) => {
            for (let i = 0; i < numCols; i++) {
                let val = this._cellValue(node, i);
                if (val == null) val = '';
                let colType = this._columns[i].type;
                if (colType === 'icon') {
                    let size = this._columns[i].icon_size || 16;
                    widths[i] = Math.max(widths[i], size + 12);
                } else if (colType === 'boolean') {
                    measure.textContent = '✓';
                    widths[i] = Math.max(widths[i], measure.offsetWidth + 12);
                } else {
                    measure.textContent = String(val);
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
     * Sort all levels by the given column.
     * @param {string} colKey
     * @param {boolean} [ascending=true]
     */
    sort_by_column(colKey, ascending = true) {
        if (this._columnByKey(colKey) == null) {
            this._sortColKey = null;
        } else {
            this._sortColKey = colKey;
            this._sortAscending = !!ascending;
        }
        this._applySort();
        this._updateSortIndicators();
        this._renderAll();
    }

    /**
     * Scroll to the row at the given path, expanding ancestors.
     * @param {Array<string>} path
     */
    scroll_to_path(path) {
        let node = this._root;
        for (let i = 0; i < path.length - 1; i++) {
            if (!node.children.has(path[i])) return;
            node = node.children.get(path[i]);
            if (node.children.size > 0) node.expanded = true;
        }
        let target = this._nodeAtPath(path);
        if (!target) return;
        this._renderAll();
        this._scrollToNode(target);
    }

    scroll_to_end() {
        let vp = this._viewport;
        vp.scrollTop = this._body.scrollHeight - vp.clientHeight;
        this._syncFromScroll();
    }

    // -- Internal: data loading --

    /**
     * Load a dict-shaped tree under *parent*.  Each top-level entry
     * becomes a child of parent; existing children with the same
     * key are replaced.
     * @private
     */
    _loadDictTree(parent, tree) {
        if (tree == null || typeof tree !== 'object') return;
        for (let [key, data] of Object.entries(tree)) {
            // Drop existing same-key child first.
            parent.children.delete(key);
            this._addNodeFromDict(parent, String(key), data);
        }
    }

    /**
     * Add a single dict-shaped node as a child of *parent* under the
     * given key.  Detection rules for leaf vs interior:
     *   - has __values__ key → interior with own column data
     *   - empty dict → interior with no children (more useful default
     *     than a value-less leaf)
     *   - any value is a non-array object → interior; primitive entries
     *     in the same dict become the interior's own values (no
     *     __values__ sentinel needed)
     *   - else (all primitives) → leaf (the dict IS the values)
     * @private
     */
    _addNodeFromDict(parent, key, data) {
        let values, childData;
        if (data == null) {
            values = null;
            childData = null;
        } else if (typeof data !== 'object' || Array.isArray(data)) {
            // Primitive or array — treat as a single-column leaf.
            values = {};
            if (this._columns.length > 0) {
                values[this._columns[0].key] = data;
            }
            childData = null;
        } else if ('__values__' in data) {
            values = data.__values__ || null;
            childData = {};
            for (let [k, v] of Object.entries(data)) {
                if (k !== '__values__') childData[k] = v;
            }
        } else if (Object.keys(data).length === 0) {
            // Empty dict → empty interior (folder with no contents).
            values = null;
            childData = {};
        } else {
            // Mixed/leaf: split primitives (own values) from object
            // children.  If any object children are present, this is
            // an interior whose primitives become its __values__;
            // otherwise it's a pure leaf.
            let ownValues = null;
            let kids = null;
            for (let [k, v] of Object.entries(data)) {
                if (v !== null && typeof v === 'object'
                        && !Array.isArray(v)) {
                    if (kids == null) kids = {};
                    kids[k] = v;
                } else {
                    if (ownValues == null) ownValues = {};
                    ownValues[k] = v;
                }
            }
            if (kids != null) {
                values = ownValues;
                childData = kids;
            } else {
                values = ownValues;
                childData = null;
            }
        }

        let isInterior = childData !== null;
        let node = this._makeNode({
            key: key,
            values: values,
            depth: parent.depth + 1,
            parent: parent,
            expanded: isInterior,
        });
        parent.children.set(key, node);

        if (childData) {
            for (let [childKey, childValue] of Object.entries(childData)) {
                this._addNodeFromDict(node, String(childKey), childValue);
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

    _syncRowNumberHeader(rowCount) {
        if (!this._showRowNumbers) return;
        let hdr = this._header.querySelector('.treeview-rownum-header');
        if (!hdr) return;
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

        if (this._showRowNumbers) {
            let rn = document.createElement('span');
            rn.className = 'treeview-rownum';
            rn.textContent = String(visibleIndex + 1);
            row.appendChild(rn);
        }

        let indent = document.createElement('span');
        indent.className = 'treeview-indent';
        indent.style.paddingLeft = (node.depth * 16) + 'px';
        row.appendChild(indent);

        let toggle = document.createElement('span');
        toggle.className = 'treeview-toggle';
        if (node.children.size > 0) {
            toggle.textContent = node.expanded ? '▾' : '▸';
            toggle.classList.add('treeview-toggle-active');
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                node.expanded = !node.expanded;
                this._renderAll();
                if (node.expanded) {
                    this.make_callback('expanded', node.values,
                                       this._pathOfNode(node));
                } else {
                    this.make_callback('collapsed', node.values,
                                       this._pathOfNode(node));
                }
            });
        }
        row.appendChild(toggle);

        // Data cells.  Auto-span: a present cell extends across following
        // columns whose value is missing.  Explicit empty strings are
        // present and render as their own (empty) cell.
        let numCols = this._columns.length;
        let i = 0;
        while (i < numCols) {
            let cell = document.createElement('span');
            cell.className = 'treeview-cell';
            cell._colIndex = i;
            cell._colKey = this._columns[i].key;
            let present = this._cellPresent(node, i);
            let val = this._cellValue(node, i);
            if (val === undefined) val = '';

            let span = 1;
            if (present) {
                while (i + span < numCols
                        && !this._cellPresent(node, i + span)) {
                    span++;
                }
            }
            if (span > 1) cell.style.gridColumn = 'span ' + span;

            let colDef = this._columns[i];
            if (colDef.halign && colDef.halign !== 'left') {
                cell.style.textAlign = colDef.halign;
            }

            let colType = colDef.type;
            let editable = colDef.editable && colType !== 'icon';

            if (colType === 'icon' && val) {
                let img = document.createElement('img');
                img.className = 'treeview-icon';
                img.src = val;
                let size = colDef.icon_size || 16;
                img.width = size;
                img.height = size;
                cell.appendChild(img);
            } else if (colType === 'boolean') {
                cell.textContent = val ? '✓' : '';
                cell.title = val ? 'true' : 'false';
            } else {
                cell.textContent = val != null ? String(val) : '';
                cell.title = cell.textContent;
            }

            if (editable) {
                cell.classList.add('treeview-cell-editable');
                cell.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    this._startEdit(node, i, cell);
                });
            }
            row.appendChild(cell);
            i += span;
        }

        row.addEventListener('click', (e) => this._onRowClick(e, node));
        row.addEventListener('dblclick', (e) => {
            this.make_callback('activated', node.values,
                               this._pathOfNode(node));
        });

        return row;
    }

    // -- Selection --

    _onRowClick(e, node) {
        if (this._selectionMode === 'none') return;

        if (this._selectionMode === 'multiple' && (e.ctrlKey || e.metaKey)) {
            let idx = this._selection.indexOf(node);
            if (idx >= 0) {
                this._selection.splice(idx, 1);
            } else {
                this._selection.push(node);
            }
        } else if (this._selectionMode === 'multiple' && e.shiftKey) {
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

    // -- Keyboard --

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
            if (node.children.size > 0 && !node.expanded) {
                node.expanded = true;
                this._renderAll();
                this.make_callback('expanded', node.values,
                                   this._pathOfNode(node));
            }
            break;
        case 'ArrowLeft':
            e.preventDefault();
            if (node.children.size > 0 && node.expanded) {
                node.expanded = false;
                this._renderAll();
                this.make_callback('collapsed', node.values,
                                   this._pathOfNode(node));
            } else if (node.parent && node.parent !== this._root) {
                this._selection = [node.parent];
                this._updateSelectionDisplay();
                this._scrollToNode(node.parent);
                this.make_callback('selected', this.get_selected());
            }
            break;
        case 'Enter':
            e.preventDefault();
            this.make_callback('activated', node.values,
                               this._pathOfNode(node));
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

    // -- Scrollbar sync --

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
            this._hScrollBar.set_thumb_percent(Math.min(1, vw / Math.max(1, cw)));
        }
        if (showV) {
            this._vScrollBar.set_thumb_percent(Math.min(1, vh / Math.max(1, ch)));
        }
        this._syncFromScroll();
    }

    set_scroll_position(h_pct, v_pct) {
        let maxX = this._body.scrollWidth - this._viewport.clientWidth;
        let maxY = this._body.scrollHeight - this._viewport.clientHeight;
        if (maxX > 0) this._viewport.scrollLeft = h_pct * maxX;
        if (maxY > 0) this._viewport.scrollTop = v_pct * maxY;
        this._scrollSilent = true;
        this._syncFromScroll();
        this._scrollSilent = false;
    }

    get_scroll_position() {
        let maxX = this._body.scrollWidth - this._viewport.clientWidth;
        let maxY = this._body.scrollHeight - this._viewport.clientHeight;
        return [
            maxX > 0 ? this._viewport.scrollLeft / maxX : 0,
            maxY > 0 ? this._viewport.scrollTop / maxY : 0,
        ];
    }

    _syncFromScroll() {
        let maxScrollX = this._body.scrollWidth - this._viewport.clientWidth;
        let maxScrollY = this._body.scrollHeight - this._viewport.clientHeight;
        let hPct = maxScrollX > 0 ? this._viewport.scrollLeft / maxScrollX : 0;
        let vPct = maxScrollY > 0 ? this._viewport.scrollTop / maxScrollY : 0;
        if (maxScrollX > 0) this._hScrollBar.set_scroll_percent(hPct);
        if (maxScrollY > 0) this._vScrollBar.set_scroll_percent(vPct);
        // Mirror horizontal scroll to the header so columns stay
        // aligned with their data.  Using transform is compositor-
        // cheap and skips a layout pass on every scroll tick.
        this._header.style.transform =
            `translateX(${-this._viewport.scrollLeft}px)`;
        if (this._scrollTimer) clearTimeout(this._scrollTimer);
        if (this._scrollReady && !this._scrollSilent) {
            this._scrollTimer = setTimeout(() => {
                this._scrollTimer = null;
                this.make_callback('scrolled', hPct, vPct);
            }, 150);
        }
    }

    // -- Path helpers --

    _nodeAtPath(path) {
        if (!Array.isArray(path)) return null;
        let node = this._root;
        for (let key of path) {
            if (!node.children.has(key)) return null;
            node = node.children.get(key);
        }
        return node === this._root ? null : node;
    }

    _pathOfNode(node) {
        let path = [];
        while (node && node.parent) {
            if (node.key == null) return null;
            path.unshift(node.key);
            node = node.parent;
        }
        return path;
    }

    _resolveNode(ref) {
        if (ref == null) return null;
        if (Array.isArray(ref)) return this._nodeAtPath(ref);
        return ref;
    }

    // -- Cell value & traversal helpers --

    /**
     * Is column *i* "present" on *node*?  Auto-spanning treats absent
     * cells as eligible to be absorbed by a preceding present cell.
     * @private
     */
    _cellPresent(node, i) {
        let val = this._cellValue(node, i);
        return val !== undefined && val !== null;
    }

    /**
     * Fetch the displayed value for column i on node.  Falls back to
     * the node's dict key for column 0 when the row supplies no value.
     * Returns undefined when truly absent (eligible for auto-span).
     * @private
     */
    _cellValue(node, i) {
        if (i < 0 || i >= this._columns.length) return undefined;
        let colKey = this._columns[i].key;
        if (node.values != null && typeof node.values === 'object'
                && !Array.isArray(node.values)
                && colKey in node.values) {
            return node.values[colKey];
        }
        // First column falls back to the node's dict key.
        if (i === 0 && node.key != null) return node.key;
        return undefined;
    }

    _walkNodes(node, fn) {
        // Walk all descendants of *node*, NOT including the root itself.
        let view = this._childrenView(node);
        for (let child of view) {
            fn(child);
            this._walkNodes(child, fn);
        }
    }

    _walkNodesIncludingRoot(node, fn) {
        fn(node);
        let view = this._childrenView(node);
        for (let child of view) {
            this._walkNodesIncludingRoot(child, fn);
        }
    }

    _walkVisible(node, fn) {
        if (node !== this._root) fn(node);
        if (node.expanded) {
            for (let child of this._childrenView(node)) {
                this._walkVisible(child, fn);
            }
        }
    }

    _childrenView(node) {
        return node.sortedView || [...node.children.values()];
    }

    _getVisibleNodes() {
        let nodes = [];
        this._walkVisible(this._root, (n) => nodes.push(n));
        return nodes;
    }

    // -- Grid / editing / row & column ops --

    get_column_count() {
        return this._columns.length;
    }

    get_row_count() {
        return this._root.children.size;
    }

    set_sortable(tf) {
        this._sortable = !!tf;
    }

    set_show_grid(tf) {
        this._showGrid = !!tf;
        this.element.classList.toggle('treeview-grid', this._showGrid);
    }

    set_show_row_numbers(tf) {
        this._showRowNumbers = !!tf;
        this._buildHeader();
        this._renderAll();
    }

    /**
     * Mark a column as editable (or not).
     * @param {string} colKey
     * @param {boolean} tf
     */
    set_column_editable(colKey, tf) {
        let col = this._columnByKey(colKey);
        if (!col) return;
        col.editable = !!tf;
        this._renderAll();
    }

    /**
     * Set a single cell's value.
     * @param {Array<string>} path - Path of keys to the row.
     * @param {string} colKey
     * @param {*} value
     */
    set_cell(path, colKey, value) {
        let node = this._nodeAtPath(path);
        if (!node) return;
        if (node.values == null) node.values = {};
        node.values[colKey] = value;
        // Re-sort the parent if the changed column is the active sort.
        if (this._sortColKey === colKey) {
            this._applySortToNode(node.parent);
        }
        this._renderAll();
    }

    /**
     * Insert a column before the given column key (or append if before
     * is null).
     * @param {string|Object} column
     * @param {string|null} [before=null] - Key of the column to insert
     *   before.  `null` appends.
     */
    insert_column(column, before = null) {
        let parsed;
        let autoIdx = this._columns.length;
        if (typeof column === 'string') {
            parsed = { label: column, type: 'string', editable: false,
                       key: '_col' + autoIdx, halign: 'left' };
        } else {
            let type = TreeView._normalizeType(column.type);
            parsed = {
                label: column.label || '',
                type: type,
                editable: !!column.editable,
                key: column.key || ('_col' + autoIdx),
                halign: TreeView._normalizeHalign(column.halign, type),
                icon_size: column.icon_size,
            };
        }
        let insertAt = this._columns.length;
        if (before != null) {
            let idx = this._columnIndex(before);
            if (idx >= 0) insertAt = idx;
        }
        this._columns.splice(insertAt, 0, parsed);
        this._colWidths.splice(insertAt, 0, '1fr');
        this._buildHeader();
        this._renderAll();
    }

    append_column(column) {
        this.insert_column(column, null);
    }

    /**
     * Delete a column by key.  Removes that key from every row.
     * @param {string} colKey
     */
    delete_column(colKey) {
        let idx = this._columnIndex(colKey);
        if (idx < 0) return;
        this._columns.splice(idx, 1);
        this._colWidths.splice(idx, 1);
        if (this._sortColKey === colKey) {
            this._sortColKey = null;
            this._applySort();
        }
        this._walkNodes(this._root, (node) => {
            if (node.values && typeof node.values === 'object'
                    && !Array.isArray(node.values)) {
                delete node.values[colKey];
            }
        });
        this._buildHeader();
        this._renderAll();
    }

    /**
     * Insert a row at the top level.
     * @param {Object} values - Dict of column-key → value (or array
     *   of values matching column order).
     * @param {string|null} [key=null] - Stable key for the row.
     *   Auto-generated if null.
     * @param {string|null} [before=null] - Key of an existing row to
     *   insert before.  null appends.
     * @returns {Array<string>} The path of the new row.
     */
    insert_row(values, key = null, before = null) {
        if (key == null) {
            // Find a free auto-key
            let i = this._root.children.size;
            do {
                key = 'row' + i;
                i++;
            } while (this._root.children.has(key));
        }
        // Coerce array → dict using column order
        if (Array.isArray(values)) {
            let dict = {};
            for (let c = 0; c < this._columns.length && c < values.length; c++) {
                dict[this._columns[c].key] = values[c];
            }
            values = dict;
        }
        let node = this._makeNode({
            key: key, values: values, depth: 0,
            parent: this._root, expanded: false,
        });
        if (before != null && this._root.children.has(before)) {
            // Rebuild the Map preserving insertion order with insertion
            // before the named key.
            let newMap = new Map();
            for (let [k, v] of this._root.children) {
                if (k === before) newMap.set(key, node);
                newMap.set(k, v);
            }
            this._root.children = newMap;
        } else {
            this._root.children.set(key, node);
        }
        this._applySortToNode(this._root);
        this._renderAll();
        return [key];
    }

    /**
     * Append a row at the top level.
     * @param {Object|Array} values
     * @returns {Array<string>} The path of the new row.
     */
    append_row(values) {
        return this.insert_row(values, null, null);
    }

    /**
     * Delete a row.  Accepts either a path (array of keys) for a
     * deeper node, or a single key for a top-level row.
     * @param {Array<string>|string} pathOrKey
     */
    delete_row(pathOrKey) {
        let path;
        if (Array.isArray(pathOrKey)) {
            path = pathOrKey;
        } else {
            path = [pathOrKey];
        }
        this.remove_item(path);
    }

    // -- Inline cell editing --

    _startEdit(node, colIndex, cell) {
        if (this._editor) this._commitEdit();

        let colKey = this._columns[colIndex].key;
        let oldValue = (node.values != null
                        && typeof node.values === 'object'
                        && !Array.isArray(node.values)
                        && colKey in node.values)
            ? node.values[colKey] : '';
        if (oldValue == null) oldValue = '';

        let input = document.createElement('input');
        input.type = 'text';
        input.className = 'treeview-cell-editor';
        input.value = String(oldValue);

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
            e.stopPropagation();
        });
        input.addEventListener('blur', () => this._commitEdit());
    }

    _commitEdit() {
        if (!this._editor || !this._editInfo) return;
        let { node, colIndex, oldValue, cell } = this._editInfo;
        let raw = this._editor.value;
        let colDef = this._columns[colIndex];
        let colType = colDef.type;
        let colKey = colDef.key;
        let newValue = raw;
        if (colType === 'integer') {
            let n = parseInt(raw, 10);
            newValue = isNaN(n) ? oldValue : n;
        } else if (colType === 'float') {
            let n = parseFloat(raw);
            newValue = isNaN(n) ? oldValue : n;
        } else if (colType === 'boolean') {
            let s = String(raw).trim().toLowerCase();
            if (s === 'true' || s === '1' || s === 'yes' || s === 'y') {
                newValue = true;
            } else if (s === 'false' || s === '0' || s === 'no'
                       || s === 'n' || s === '') {
                newValue = false;
            } else {
                newValue = oldValue;
            }
        }
        this._editor = null;
        this._editInfo = null;
        if (node.values == null) node.values = {};
        let changed = node.values[colKey] !== newValue;
        node.values[colKey] = newValue;
        this._restoreCell(cell, newValue);
        if (changed) {
            // Re-sort the parent if the edited column is active sort
            if (this._sortColKey === colKey) {
                this._applySortToNode(node.parent);
            }
            this.make_callback('cell_edited',
                this._pathOfNode(node), colKey, oldValue, newValue);
        }
    }

    _cancelEdit() {
        if (!this._editor || !this._editInfo) return;
        let { oldValue, cell } = this._editInfo;
        this._editor = null;
        this._editInfo = null;
        this._restoreCell(cell, oldValue);
    }

    _restoreCell(cell, value) {
        if (!cell) return;
        let colIndex = cell._colIndex;
        let colType = colIndex != null && colIndex < this._columns.length
            ? this._columns[colIndex].type : 'string';
        if (colType === 'boolean') {
            cell.textContent = value ? '✓' : '';
            cell.title = value ? 'true' : 'false';
        } else {
            cell.textContent = value != null ? String(value) : '';
            cell.title = cell.textContent;
        }
    }
}

export { TreeView };
