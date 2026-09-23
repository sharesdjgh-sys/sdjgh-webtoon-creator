/* eslint-disable @typescript-eslint/no-require-imports -- Offline dialog and typography tests. */
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), React = require('react'), assert = require('node:assert/strict');
let state = false, ri = 0, effects = [], shown = 0, closed = 0, focused = 0;
const refs = [], cache = new Map(), browser = { document: { body: { style: { overflow: 'auto' } } } };
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { module: mod, exports: mod.exports, window: browser, require(name) {
      if (name === 'react') return { ...React, useState: () => [state, value => { state = value; }], useRef: initial => refs[ri++] ?? (refs[ri - 1] = { current: initial }), useEffect: fn => effects.push(fn) };
      if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
      return require(name);
    } });
  return mod.exports;
}
const Picker = load('src/components/visual/BalloonStylePicker.tsx').default;
const props = { element: { id: 'text', type: 'speech', text: 'hello', width: 400, height: 200, x: 30, y: 40, rotation: 0, zIndex: 0, fontSize: 22 }, onChange: changes => { props.element = { ...props.element, ...changes }; } };
const render = () => { ri = 0; effects = []; return Picker(props); };
function all(node, test) { if (!node || typeof node !== 'object') return []; return [...(test(node) ? [node] : []), ...React.Children.toArray(node.props?.children).flatMap(n => all(n, test))]; }
let tree = render();
const trigger = all(tree, n => n.props?.['aria-haspopup'] === 'dialog')[0];
trigger.props.ref.current = { focus: () => focused++ };
trigger.props.onClick(); tree = render();
const dialog = all(tree, n => n.type === 'dialog')[0];
dialog.props.ref.current = { showModal: () => shown++, close: () => closed++ };
const cleanup = effects[0](); assert.equal(shown, 1); assert.equal(browser.document.body.style.overflow, 'hidden');
const cards = all(dialog, n => n.type === 'button' && n.props['aria-pressed'] !== undefined);
assert.equal(cards.length, 11);
for (const card of cards) {
  const sample = React.Children.toArray(card.props.children)[0];
  const svg = sample.type(sample.props);
  assert.equal(svg.type, 'svg', 'each choice has a rendered balloon illustration');
  const markup = all(svg, n => n.props?.dangerouslySetInnerHTML)[0].props.dangerouslySetInnerHTML.__html;
  assert.equal(markup.length > 0, sample.props.value !== 'none');
  card.props.onClick();
  assert.equal(props.element.fontSize, 22); assert.equal(props.element.text, 'hello'); assert.equal(props.element.x, 30);
  assert.equal(props.element.balloonStyle, sample.props.value);
}
let prevented = false, stopped = false;
dialog.props.onCancel({ preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
assert.ok(prevented && stopped, 'Escape must not close the parent comparison dialog');
assert.equal(state, false); cleanup(); assert.equal(closed, 1); assert.equal(focused, 1); assert.equal(browser.document.body.style.overflow, 'auto');
const text = load('src/lib/storyboardText.ts');
for (const type of ['speech', 'caption']) {
  const element = { ...props.element, type, fontSize: undefined };
  assert.equal(text.defaultElementFontSize(element), 35);
  assert.equal(text.layoutStoryboardText(element, 'sans-serif').fontSize, 35);
  assert.equal(text.layoutStoryboardText({ ...element, fontSize: 22 }, 'sans-serif').fontSize, 22);
  assert.ok(text.layoutStoryboardText({ ...element, width: 45, height: 25 }, 'sans-serif').fontSize < 35);
}
console.log('PASS: eleven SVG choices, selection preserves lettering, nested Escape/focus/scroll cleanup, 35px defaults and small-balloon fitting');
const undersized = { ...props.element, type: 'speech', balloonStyle: 'normal', width: 220, height: 70, x: 300, y: 300, fontSize: undefined, text: 'This is a complete sentence that needs a larger balloon.' };
assert.ok(text.layoutStoryboardText(undersized, 'sans-serif').fontSize < 20);
const original = JSON.stringify(undersized);
for (const style of ['normal', 'thought', 'shout', 'whisper', 'rounded', 'none', 'radiant', 'burst', 'rough', 'broadcast', 'connected']) {
  for (const [width, height] of [[900, 1500], [1200, 1200], [1000, 1300], [900, 1900]]) {
    const type = style === 'rounded' || style === 'none' ? 'caption' : 'speech';
    const result = text.sizeBalloonForFont({ ...undersized, type, balloonStyle: style }, width, height, 'sans-serif');
    assert.equal(text.layoutStoryboardText(result, 'sans-serif').fontSize, 35, style + ' ' + width + 'x' + height + ' -> ' + result.width + 'x' + result.height);
    assert.ok(!text.overlayOutsideCanvas(result, width, height));
    assert.equal(result.text, undersized.text);
    assert.ok(result.width > undersized.width);
    assert.equal(JSON.stringify(text.sizeBalloonForFont(result, width, height, 'sans-serif')), JSON.stringify(result));
  }
}
assert.equal(JSON.stringify(undersized), original, 'sizing must not mutate saved lettering');
const tooLong = text.sizeBalloonForFont({ ...undersized, text: 'very long dialogue '.repeat(200) }, 300, 250, 'sans-serif');
assert.ok(!text.overlayOutsideCanvas(tooLong, 300, 250));
assert.ok(text.layoutStoryboardText(tooLong, 'sans-serif').fontSize < 35, 'impossible text stays bounded so the editor can warn');
console.log('PASS: initially sub-20px balloons grow to 35px across eleven styles and four canvas sizes without clipping, truncation or saved-data mutation');
