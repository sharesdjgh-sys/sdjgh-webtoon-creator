/* eslint-disable @typescript-eslint/no-require-imports -- Offline storage migration tests. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const crypto = require('node:crypto');
const values = new Map(), cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const mod = { exports: {} }; cache.set(file, mod.exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: mod, exports: mod.exports, crypto, Event, console,
    window: { dispatchEvent() {} },
    localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    require(name) {
      if (name === '@/lib/fileSystemStorage') return { saveProjectToFile: async () => {} };
      if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
      return require(name);
    },
  });
  return mod.exports;
}
const storage = load('src/lib/storage.ts');
const addresses = load('src/lib/projectAddress.ts');
const first = storage.createProject({ title: 'Test', author: '', genre: '', targetCompetition: '', deadline: '' });
assert.match(first.shortId, /^[a-z0-9]{8}$/);
assert.notEqual(first.id, first.shortId);
assert.equal(storage.getProject(first.shortId).id, first.id);
assert.equal(storage.projectHref(first.id, 'episodes'), `/p/${first.shortId}/episodes`);
storage.updateProject(first.id, { title: 'Renamed' });
assert.equal(storage.getProject(first.id).shortId, first.shortId);
const legacy = { ...first, id: '333631bb-dca9-4adc-82ce-81ec9352cff5', shortId: undefined,
  episodes: [{ episodeNumber: 1, cuts: [{ id: 'cut1', characterIds: [], sceneImageAssetId: 'keep-image' }] }] };
values.set('webtoon_projects', JSON.stringify([first, legacy]));
const migrated = storage.getProjects();
assert.equal(migrated[0].shortId, first.shortId);
assert.match(migrated[1].shortId, /^[a-z0-9]{8}$/);
assert.equal(migrated[1].id, legacy.id);
assert.equal(migrated[1].episodes[0].cuts[0].sceneImageAssetId, 'keep-image');
assert.equal(storage.getProjects()[1].shortId, migrated[1].shortId, 'reload preserves alias');
assert.equal(storage.getProject(legacy.id).id, storage.getProject(migrated[1].shortId).id, 'old and short URLs address the same project');
const conflicting = addresses.ensureProjectAddresses([{ id: 'a', shortId: 'aaaaaaaa' }, { id: 'b', shortId: 'aaaaaaaa' }, { id: 'c', shortId: '../oops' }]);
assert.equal(conflicting[0].shortId, 'aaaaaaaa');
assert.equal(new Set(conflicting.map(p => p.shortId)).size, 3);
assert.ok(conflicting.every(p => /^[a-z0-9]{8}$/.test(p.shortId)));
storage.saveProjects([migrated[1], migrated[0]]);
assert.equal(storage.getProject(legacy.id).shortId, migrated[1].shortId, 'reorder/import preserves stored aliases');
assert.equal(storage.getProject('missing'), null);
const route = fs.readFileSync('src/app/p/[id]/[stage]/page.tsx', 'utf8');
assert.ok(route.includes('Promise.resolve({ id: project.id })'), 'existing pages receive the canonical media owner ID');
for (const stage of ['idea', 'characters', 'world', 'story', 'script', 'episodes', 'submit']) {
  assert.ok(route.includes(`/project/[id]/${stage}/page`));
  assert.ok(fs.existsSync(`src/app/project/[id]/${stage}/page.tsx`), 'legacy route stays available');
}
console.log('PASS: new and legacy short URLs, stable rename/reload/import, collision repair, canonical IDs and media preservation');
