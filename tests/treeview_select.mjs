// Exercise the TreeView selection setters without a DOM.
// Run via tests/test_treeview_select.py, or directly:
//   node tests/treeview_select.mjs
// select_path / select_paths / select_all only touch _selection and the
// node tree, so an instance made with Object.create() and a stubbed
// _updateSelectionDisplay is enough.
//
// These guard the `state = true` defaults.  A bridge that forwards only
// the arguments it was given (as the Python proxy does for
// ``select_path(path)``) passes `undefined` otherwise, and the call
// silently does nothing -- or, for select_all(), clears the selection.
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

function makeTree() {
    const t = Object.create(TreeView.prototype);
    t._columns = [{label: 'Name', key: 'name', type: 'string'}];
    t._selection = [];
    t._cellStyles = new Map();
    t._rowStyles = new Map();
    t._root = t._makeNode({key: null, values: null, depth: -1,
                           parent: null, expanded: true});
    t._updateSelectionDisplay = () => {};   // no DOM in this harness
    t._renderAll = () => {};
    t._renderAllNow = () => {};
    t.add_tree({Messier: {M31: {name: 'M31'}, M42: {name: 'M42'}},
                NGC: {N1275: {name: 'N1275'}}});
    return t;
}

// what is selected, as sorted paths
function sel(t) {
    return t._selection.map(n => t._pathOfNode(n)).sort();
}

{
    // --- select_path -----------------------------------------------------
    let t = makeTree();
    t.select_path(['Messier', 'M31']);
    eq('select_path() with no state selects', sel(t), [['Messier', 'M31']]);

    t = makeTree();
    t.select_path(['Messier', 'M31'], true);
    eq('select_path(..., true) selects', sel(t), [['Messier', 'M31']]);

    t.select_path(['Messier', 'M31'], false);
    eq('select_path(..., false) deselects', sel(t), []);

    t = makeTree();
    t.select_path(['Messier', 'nope']);
    eq('select_path() on a bad path is a no-op', sel(t), []);

    // --- select_paths ----------------------------------------------------
    t = makeTree();
    t.select_paths([['Messier', 'M31'], ['NGC', 'N1275']]);
    eq('select_paths() with no state selects both', sel(t),
       [['Messier', 'M31'], ['NGC', 'N1275']]);

    t.select_paths([['Messier', 'M31']], false);
    eq('select_paths(..., false) deselects', sel(t), [['NGC', 'N1275']]);

    // --- select_all ------------------------------------------------------
    t = makeTree();
    t.select_all();
    check('select_all() with no state selects everything',
          t._selection.length === 5, `got ${t._selection.length}`);

    t.select_all(false);
    eq('select_all(false) clears', sel(t), []);

    // --- what the selection accessors then report ------------------------
    t = makeTree();
    t.select_path(['Messier', 'M31']);
    eq('get_selected() reports the row', t.get_selected().map(d => d.path),
       [['Messier', 'M31']]);
    const sub = t.get_subtree('selected');
    check("get_subtree('selected') reports the row",
          JSON.stringify(sub).includes('M31'), JSON.stringify(sub));
}

console.log(failures === 0 ? '\nALL JS SELECT TESTS PASSED'
                           : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
