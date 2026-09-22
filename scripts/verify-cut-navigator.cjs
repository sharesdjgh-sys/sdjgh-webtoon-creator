/* eslint-disable @typescript-eslint/no-require-imports -- Offline component harness. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), React = require('react');
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/visual/CutNavigator.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { module: mod, exports: mod.exports, require });
const Navigator = mod.exports.default;
function all(node, test) {
  if (!node || typeof node !== 'object') return [];
  return [...(test(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(child => all(child, test))];
}
let selected;
const onNavigate = id => { selected = id; };
const cuts = Array.from({ length: 12 }, (_, i) => ({ id: `cut-${i}`, description: `Scene ${i}` }));
let tree = Navigator({ cuts, onNavigate });
assert.ok(tree.props.className.includes('sticky'));
assert.equal(all(tree, n => n.type === 'button').length, 13);
assert.ok(all(tree, n => n.props?.className?.includes('overflow-x-auto')).length);
all(tree, n => n.type === 'button')[7].props.onClick(); assert.equal(selected, 'cut-7');
all(tree, n => n.type === 'select')[0].props.onChange({ target: { value: 'cut-3' } }); assert.equal(selected, 'cut-3');
cuts.push({ id: 'new-ai-cut', description: 'New scene' });
tree = Navigator({ cuts, onNavigate });
all(tree, n => n.type === 'button').at(-1).props.onClick(); assert.equal(selected, 'new-ai-cut');
tree = Navigator({ cuts: cuts.slice(1), onNavigate });
all(tree, n => n.type === 'button')[0].props.onClick(); assert.equal(selected, 'cut-1', 'deleted cuts do not leave stale index targets');
tree = Navigator({ cuts: [{ id: 'other-episode', description: '' }], onNavigate });
all(tree, n => n.type === 'button')[0].props.onClick(); assert.equal(selected, 'other-episode');
assert.equal(Navigator({ cuts: [], onNavigate }), null);
const page = fs.readFileSync('src/app/project/[id]/episodes/page.tsx', 'utf8');
assert.ok(page.indexOf('<CutNavigator') > page.indexOf('{visualError &&'));
assert.ok(page.includes('cutCards.current.get(cutId)'));
assert.ok(page.includes('cutCards.current.delete(cut.id)'));
assert.ok(page.includes('scroll-mt-40'));
assert.ok(page.includes('prefers-reduced-motion: reduce'));
console.log('PASS: 12+ cuts, stable ID navigation, AI append, deletion, episode switching, empty state and sticky navigation');
