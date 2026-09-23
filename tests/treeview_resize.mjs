// Exercise header-divider column resizing without a real DOM.
// Run via tests/test_treeview_resize.py, or directly:
//   node tests/treeview_resize.mjs
//
// _setupColumnResize only reads the header cells' rendered widths and
// writes _colWidths, so a stub header plus a tiny document shim for the
// mousemove/mouseup listeners is enough.
//
// These guard the qt-style (QHeaderView "Interactive") semantics: a drag
// resizes the column to the divider's left and nothing else.  The old
// behaviour was splitter-style -- every pixel gained came out of the next
// column -- so widening one column ate its neighbour down to the 5px
// floor before any column to the right would move.
import { TreeView } from '../pgwidgets_js/static/modules/TreeView.js';

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log(`  ok   ${name}`); }
    else { failures++; console.log(`  FAIL ${name}`, extra ?? ''); }
}
function eq(name, a, b) {
    check(name, JSON.stringify(a) === JSON.stringify(b),
          `\n     got      ${JSON.stringify(a)}\n     expected ${JSON.stringify(b)}`);
}

// --- minimal element shim, enough for _buildHeader to run headless
function el(tag) {
    const e = {
        tagName: tag, className: '', innerHTML: '', textContent: '',
        style: {}, children: [], _on: {},
        appendChild(c) { e.children.push(c); return c; },
        addEventListener(type, fn) { e._on[type] = fn; },
    };
    e.classList = {
        add(c) { e.className = (e.className + ' ' + c).trim(); },
        contains(c) { return e.className.split(/\s+/).includes(c); },
    };
    return e;
}

function findByClass(root, cls) {
    const out = [];
    (function walk(n) {
        for (const c of n.children || []) {
            if ((c.className || '').split(/\s+/).includes(cls)) out.push(c);
            walk(c);
        }
    })(root);
    return out;
}

// --- minimal document shim: the drag installs its move/up handlers here
const docListeners = {};
globalThis.document = {
    createElement: el,
    addEventListener(type, fn) { (docListeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
        docListeners[type] = (docListeners[type] || []).filter(f => f !== fn);
    },
};
function fire(type, ev) {
    for (const fn of [...(docListeners[type] || [])]) fn(ev);
}
function listenerCount(type) { return (docListeners[type] || []).length; }

// `declared` is what _colWidths holds; `rendered` is what those tracks
// actually measure on screen (an 'fr' track renders at some pixel width).
function makeTree(declared, rendered) {
    const t = Object.create(TreeView.prototype);
    t._columns = declared.map((w, i) => ({label: 'c' + i, key: 'c' + i,
                                          type: 'string'}));
    t._colWidths = declared.slice();
    t._applyGridTemplate = () => {};
    t._syncScrollbars = () => { t.__synced = (t.__synced || 0) + 1; };
    t._header = {
        querySelectorAll: () => rendered.map(w => ({
            getBoundingClientRect: () => ({width: w}),
        })),
    };
    return t;
}

function grab(t, colIndex, atX) {
    let down;
    const handle = {addEventListener: (type, fn) => {
        if (type === 'mousedown') down = fn;
    }};
    t._setupColumnResize(handle, colIndex);
    down({clientX: atX, preventDefault() {}, stopPropagation() {}});
}

function total(t) {
    return t._colWidths.reduce((a, w) => a + parseFloat(w), 0);
}

{
    // --- dragging right widens only the grabbed column ------------------
    let t = makeTree(['100px', '80px', '120px'], [100, 80, 120]);
    grab(t, 0, 500);
    fire('mousemove', {clientX: 540});
    eq('drag right widens only the grabbed column',
       t._colWidths, ['140px', '80px', '120px']);
    check('the table grows by the drag distance', total(t) === 340,
          `total ${total(t)}`);
    check('the scrollbar is resynced', t.__synced > 0);
    fire('mouseup', {});

    // --- dragging left narrows only the grabbed column -------------------
    t = makeTree(['100px', '80px', '120px'], [100, 80, 120]);
    grab(t, 0, 500);
    fire('mousemove', {clientX: 470});
    eq('drag left narrows only the grabbed column',
       t._colWidths, ['70px', '80px', '120px']);
    fire('mouseup', {});

    // --- a middle divider leaves everything else alone -------------------
    t = makeTree(['100px', '80px', '120px'], [100, 80, 120]);
    grab(t, 1, 0);
    fire('mousemove', {clientX: 25});
    eq('middle divider moves only its own column',
       t._colWidths, ['100px', '105px', '120px']);
    fire('mouseup', {});

    // --- 'fr' tracks are pinned to their rendered width on mousedown -----
    t = makeTree(['1fr', '1fr', '1fr'], [90, 90, 90]);
    grab(t, 0, 0);
    fire('mousemove', {clientX: 10});
    eq('fr columns are pinned so they do not drift',
       t._colWidths, ['100px', '90px', '90px']);
    fire('mouseup', {});

    // --- the 5px floor still applies -------------------------------------
    t = makeTree(['40px', '80px'], [40, 80]);
    grab(t, 0, 0);
    fire('mousemove', {clientX: -400});
    eq('a column cannot be dragged below the 5px floor',
       t._colWidths, ['5px', '80px']);
    check('its neighbour is untouched at the floor',
          t._colWidths[1] === '80px');
    fire('mouseup', {});

    // --- listeners are released on mouseup -------------------------------
    t = makeTree(['100px', '80px'], [100, 80]);
    const moveBefore = listenerCount('mousemove');
    grab(t, 0, 0);
    check('drag installs its handlers',
          listenerCount('mousemove') === moveBefore + 1);
    fire('mouseup', {});
    check('mouseup releases them',
          listenerCount('mousemove') === moveBefore,
          `${listenerCount('mousemove')} left`);
}

{
    // --- every column gets a divider, the last one included -------------
    const t = Object.create(TreeView.prototype);
    t._columns = [0, 1, 2].map(i => ({label: 'c' + i, key: 'c' + i,
                                      type: 'string', halign: 'left'}));
    t._colWidths = ['100px', '80px', '120px'];
    t._showRowNumbers = false;
    t._sortable = false;
    t._header = el('div');
    t._gridTemplate = () => '';
    t._updateSortIndicators = () => {};
    t._applyHeaderFont = () => {};
    t._applyGridTemplate = () => {};
    t._syncScrollbars = () => {};
    t._buildHeader();

    const cells = findByClass(t._header, 'treeview-header-cell');
    const handles = findByClass(t._header, 'treeview-resize-handle');
    check('a header cell per column', cells.length === 3,
          `got ${cells.length}`);
    check('a divider per column, last one included', handles.length === 3,
          `got ${handles.length}`);

    // the last column's divider resizes the last column
    t._header.querySelectorAll = () =>
        [100, 80, 120].map(w => ({getBoundingClientRect: () => ({width: w})}));
    const last = cells[2].children.find(
        c => (c.className || '').includes('treeview-resize-handle'));
    last._on.mousedown({clientX: 0, preventDefault() {}, stopPropagation() {}});
    fire('mousemove', {clientX: 45});
    eq('dragging the last divider widens the last column',
       t._colWidths, ['100px', '80px', '165px']);
    fire('mouseup', {});

    // a click on the handle must not sort the column
    let sorted = 0;
    t._onHeaderClick = () => { sorted++; };
    t._isCellMode = () => false;
    cells[2]._on.click({target: last, shiftKey: false, ctrlKey: false,
                        metaKey: false});
    check('a click on the divider does not sort', sorted === 0);
}

console.log(failures === 0 ? '\nALL JS RESIZE TESTS PASSED'
                           : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
