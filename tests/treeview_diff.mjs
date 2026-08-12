// Exercise the real TreeView diff algorithm without a DOM.
// Run via tests/test_treeview_diff.py, or directly: node tests/treeview_diff.mjs
// _diffApply / _mergeValues / _splitNodeData / _addNodeFromDict /
// _dropStylesUnder only touch plain objects and Maps, so an instance
// made with Object.create() and the few fields they use is enough.
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

function makeTree(columns) {
    const t = Object.create(TreeView.prototype);
    t._columns = columns.map(c => ({label: c, key: c, type: 'string'}));
    t._selection = [];
    t._cellStyles = new Map();
    t._rowStyles = new Map();
    t._root = t._makeNode({key: null, values: null, depth: -1,
                           parent: null, expanded: true});
    return t;
}

// snapshot the node structure back out as a plain dict for comparison
function dump(node) {
    const out = {};
    for (const [key, child] of node.children) {
        const kids = dump(child);
        if (Object.keys(kids).length > 0) {
            out[key] = Object.assign({__values__: child.values || {}}, kids);
        } else {
            out[key] = child.values || {};
        }
    }
    return out;
}

const initial = () => ({
    ob1: {__values__: {name: 'ob1'},
          e1: {name: 'e1', seeing: '0.6'},
          e2: {name: 'e2', seeing: '0.8'}},
    ob2: {__values__: {name: 'ob2'}, e9: {name: 'e9', seeing: '1.0'}},
});

console.log('changed-cell update:');
{
    const t = makeTree(['name', 'seeing']);
    t._loadDictTree(t._root, initial());
    const e1 = t._root.children.get('ob1').children.get('e1');
    const spec = initial();
    spec.ob1.e1.seeing = '1.4';
    const changed = t._diffApply(t._root, spec, []);
    eq('one change reported', changed, 1);
    eq('value updated', e1.values.seeing, '1.4');
    check('node identity preserved (expansion/styles survive)',
          t._root.children.get('ob1').children.get('e1') === e1);
}

console.log('additions and removals:');
{
    const t = makeTree(['name', 'seeing']);
    t._loadDictTree(t._root, initial());
    const ob1 = t._root.children.get('ob1');
    const spec = initial();
    delete spec.ob2;
    delete spec.ob1.e1;
    spec.ob1.e3 = {name: 'e3', seeing: '0.9'};
    spec.ob3 = {__values__: {name: 'ob3'}, e5: {name: 'e5'}};
    t._diffApply(t._root, spec, []);
    eq('tree matches the spec', dump(t._root), spec);
    check('surviving parent kept its identity',
          t._root.children.get('ob1') === ob1);
}

console.log('leaf <-> interior transitions:');
{
    const t = makeTree(['name']);
    t._loadDictTree(t._root, {a: {name: 'a'}});
    t._diffApply(t._root, {a: {__values__: {name: 'a'}, kid: {name: 'k'}}}, []);
    eq('leaf gained a child', dump(t._root),
       {a: {__values__: {name: 'a'}, kid: {name: 'k'}}});
    t._diffApply(t._root, {a: {name: 'a'}}, []);
    eq('interior lost its children', dump(t._root), {a: {name: 'a'}});
}

console.log('value keys dropped when absent:');
{
    const t = makeTree(['name', 'seeing']);
    t._loadDictTree(t._root, {a: {name: 'a', seeing: '0.5'}});
    t._diffApply(t._root, {a: {name: 'a'}}, []);
    eq('stale key removed', dump(t._root), {a: {name: 'a'}});
}

console.log('no-op diff:');
{
    const t = makeTree(['name', 'seeing']);
    t._loadDictTree(t._root, initial());
    eq('reports zero changes', t._diffApply(t._root, initial(), []), 0);
}

console.log('removed nodes drop selection and styles:');
{
    const t = makeTree(['name', 'seeing']);
    t._loadDictTree(t._root, initial());
    const ob2 = t._root.children.get('ob2');
    const e9 = ob2.children.get('e9');
    t._selection = [e9];
    t._cellStyles.set(JSON.stringify(['ob2', 'e9']) + '|seeing', {fg: 'red'});
    t._cellStyles.set(JSON.stringify(['ob1', 'e1']) + '|seeing', {fg: 'green'});
    t._rowStyles.set(JSON.stringify(['ob2']), {bg: 'grey'});
    const spec = initial();
    delete spec.ob2;
    t._diffApply(t._root, spec, []);
    eq('selection dropped', t._selection.length, 0);
    check('descendant cell style dropped',
          !t._cellStyles.has(JSON.stringify(['ob2', 'e9']) + '|seeing'));
    check('unrelated cell style kept',
          t._cellStyles.has(JSON.stringify(['ob1', 'e1']) + '|seeing'));
    check('row style dropped', t._rowStyles.size === 0);
}

console.log('flat rows (update_data spec form):');
{
    const t = makeTree(['a']);
    t._loadDictTree(t._root, {row0: {a: 'one'}, row1: {a: 'two'}});
    const row0 = t._root.children.get('row0');
    const spec = {row0: {a: 'one'}, row1: {a: 'CHANGED'}, row2: {a: 'three'}};
    t._diffApply(t._root, spec, []);
    eq('rows reconciled', dump(t._root), spec);
    check('untouched row kept identity', t._root.children.get('row0') === row0);
}

console.log('batched set_colors:');
{
    const t = makeTree(['name', 'seeing']);
    t._columnStyles = new Map();
    t._tableStyle = null;
    t._loadDictTree(t._root, initial());
    let renders = 0;
    t._renderAll = () => { renders++; };
    t.set_colors({
        cells: [{path: ['ob1', 'e1'], col_key: 'seeing', fg: 'red'},
                {path: ['ob1', 'e2'], col_key: 'seeing', fg: 'green'},
                {path: ['nope'], col_key: 'seeing', fg: 'blue'}],
        rows: [{path: ['ob2'], bg: 'grey'}],
        columns: [{col_key: 'name', fg: '#333'}],
        table: {fg: '#000'},
    });
    eq('renders once for the whole batch', renders, 1);
    eq('cells applied', t._cellStyles.size, 2);
    check('unknown path skipped',
          !t._cellStyles.has(JSON.stringify(['nope']) + '|seeing'));
    eq('row applied', t._rowStyles.size, 1);
    eq('column applied', t._columnStyles.size, 1);
    eq('table applied', t._tableStyle.fg, '#000');

    // an entry with no channels clears that override
    t.set_colors({cells: [{path: ['ob1', 'e1'], col_key: 'seeing'}]});
    eq('null entry clears', t._cellStyles.size, 1);

    // clear:true resets every layer first
    t.set_colors({clear: true, cells: [{path: ['ob1', 'e1'],
                                        col_key: 'seeing', fg: 'red'}]});
    eq('clear resets others', t._rowStyles.size, 0);
    eq('clear keeps the new entry', t._cellStyles.size, 1);
    check('clear drops the table layer', t._tableStyle === null);
}

console.log('render suspension (batch):');
{
    const t = makeTree(['name', 'seeing']);
    t._loadDictTree(t._root, initial());
    let renders = 0;
    t._renderAllNow = () => { renders++; };

    // a burst outside a batch renders per call
    t.set_cell(['ob1', 'e1'], 'seeing', '1.1');
    t.set_cell(['ob1', 'e2'], 'seeing', '1.2');
    eq('unbatched renders per call', renders, 2);

    renders = 0;
    t._suspendRender(true);
    t.set_cell(['ob1', 'e1'], 'seeing', '2.1');
    t.set_cell(['ob1', 'e2'], 'seeing', '2.2');
    t.set_cell_color(['ob1', 'e1'], 'seeing', 'red');
    eq('nothing renders while suspended', renders, 0);
    t._suspendRender(false);
    eq('one render on resume', renders, 1);
    eq('the writes still landed',
       t._root.children.get('ob1').children.get('e1').values.seeing, '2.1');

    // nesting: only the outermost resume renders
    renders = 0;
    t._suspendRender(true);
    t._suspendRender(true);
    t.set_cell(['ob1', 'e1'], 'seeing', '3.1');
    t._suspendRender(false);
    eq('inner resume does not render', renders, 0);
    t._suspendRender(false);
    eq('outer resume renders once', renders, 1);

    // resuming with nothing pending must not render
    renders = 0;
    t._suspendRender(true);
    t._suspendRender(false);
    eq('no spurious render', renders, 0);
}

console.log(failures === 0 ? '\nALL JS DIFF TESTS PASSED'
                           : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
