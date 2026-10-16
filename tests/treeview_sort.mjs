// Exercise the TreeView sort gate without a DOM.
// Run via tests/test_treeview_sort.py, or directly: node tests/treeview_sort.mjs
//
// _parseColumns / _columnIsSortable / _onHeaderClick / _applySort only
// touch plain objects and Maps, so an instance made with Object.create()
// and the few fields they use is enough; _renderAll and make_callback are
// stubbed because they are the only parts that want a document.
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

function makeTree(columns, sortable = true) {
    const t = Object.create(TreeView.prototype);
    t._parseColumns(columns);
    t._selection = [];
    t._cellSelection = new Set();
    t._cellStyles = new Map();
    t._rowStyles = new Map();
    t._selectionMode = 'single';
    t._sortable = sortable;
    t._sortColKey = null;
    t._sortAscending = true;
    t._headerCells = null;
    t.sorted = [];
    t._renderAll = () => {};
    t.make_callback = (name, ...args) => {
        if (name === 'sorted') t.sorted.push(args);
    };
    t._root = t._makeNode({key: null, values: null, depth: -1,
                           parent: null, expanded: true});
    return t;
}

// the rows arrive in the order the application put them in
function load(t) {
    t._loadDictTree(t._root, {
        a: {__values__: {name: 'bravo',   start: '01:40', note: ''}},
        b: {__values__: {name: 'alpha',   start: '02:02', note: ''}},
        c: {__values__: {name: 'delta',   start: '02:17', note: ''}},
        d: {__values__: {name: 'charlie', start: '04:37', note: ''}},
    });
    return t;
}
const order = (t) => t._childrenView(t._root).map(n => n.values.name);
const insertion = ['bravo', 'alpha', 'delta', 'charlie'];
const byName = ['alpha', 'bravo', 'charlie', 'delta'];

const cols = (noteSortable) => [
    {label: 'Name', key: 'name'},
    {label: 'Start', key: 'start', sortable: false},
    (noteSortable === null
     ? {label: 'Note', key: 'note'}
     : {label: 'Note', key: 'note', sortable: noteSortable}),
];

console.log('column descriptors');
{
    const t = makeTree(cols(false));
    check('an unflagged column inherits the table',
          t._columns[0].sortable === null && t._columnIsSortable(t._columns[0]));
    check('sortable: false is carried through',
          t._columns[1].sortable === false
          && t._columnIsSortable(t._columns[1]) === false);
    const plain = makeTree(['A', 'B']);
    check('a bare string column inherits too',
          plain._columns[0].sortable === null
          && plain._columnIsSortable(plain._columns[0]));
}

console.log('the header gesture');
{
    const t = load(makeTree(cols(null)));
    eq('starts in insertion order', order(t), insertion);
    t._onHeaderClick('name');
    eq('clicking a sortable header sorts', order(t), byName);
    eq('and fires "sorted"', t.sorted, [['name', true]]);
    t._onHeaderClick('name');
    eq('clicking it again reverses', order(t), byName.slice().reverse());
}
{
    const t = load(makeTree(cols(null)));
    t._onHeaderClick('start');
    eq('clicking an opted-out header does nothing', order(t), insertion);
    check('and fires no "sorted"', t.sorted.length === 0, t.sorted);
    check('no sort column is left active', t._sortColKey === null);
}
{
    const t = load(makeTree(cols(true), false));
    t._onHeaderClick('note');
    eq('a column flag cannot widen a non-sortable table',
       order(t), insertion);
}
{
    const t = load(makeTree(cols(false)));
    t.sort_by_column('start', true);
    eq('sort_by_column stays permissive',
       order(t), ['bravo', 'alpha', 'delta', 'charlie']);
    check('...and really is the active sort', t._sortColKey === 'start');
}

// The case this was added for: a note typed into an editable column
// re-sorts the table when that column is the active sort, and the sort
// got there by an accidental header click that looked like a no-op
// because every note was still empty.
console.log('editing a cell under a sort');
{
    const t = load(makeTree(cols(null)));
    t._onHeaderClick('note');
    eq('sorting on an all-empty column changes nothing visible',
       order(t), insertion);
    const node = t._root.children.get('c');
    node.values.note = 'guiding lost';
    if (t._sortColKey === 'note') t._applySortToNode(node.parent);
    check('...until a note is entered, and the row jumps',
          JSON.stringify(order(t)) !== JSON.stringify(insertion), order(t));
}
{
    const t = load(makeTree(cols(false)));
    t._onHeaderClick('note');
    const node = t._root.children.get('c');
    node.values.note = 'guiding lost';
    if (t._sortColKey === 'note') t._applySortToNode(node.parent);
    eq('with the column opted out, the same edit moves nothing',
       order(t), insertion);
}

if (failures) {
    console.log(`\n${failures} JS SORT TEST(S) FAILED`);
    process.exit(1);
}
console.log('\nALL JS SORT TESTS PASSED');
