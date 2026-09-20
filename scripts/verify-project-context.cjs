const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('src/lib/projectContext.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const moduleResult = { exports: {} };
new Function('exports', 'module', compiled)(moduleResult.exports, moduleResult);
const { buildProjectContext } = moduleResult.exports;
const project = {
  title: '작품', genre: '미스터리', author: 'PRIVATE_AUTHOR',
  story: { setting: '밤에는 복도 위치가 바뀐다' }, artDirection: { preset: 'clean-webtoon', custom: '' },
  ideaChat: [{ role: 'user', content: 'PRIVATE_CHAT' }],
  characters: [{ name: '지우', role: '주인공', appearance: '검은 머리', personality: '호기심',
    visualProfile: { hair: '반묶음' }, imageAssetId: 'PRIVATE_IMAGE' }],
  episodes: [{ episodeNumber: 1, title: '시작', synopsis: '음악실의 비밀', script: '문이 열린다',
    cuts: [{ description: '문 앞의 지우', dialogue: '누구야?' }] }],
};
const context = buildProjectContext(project);
assert.equal(JSON.parse(context).characters[0].visualProfile.hair, '반묶음');
assert.ok(context.includes('문 앞의 지우'));
assert.ok(!context.includes('PRIVATE_'));
const longProject = { ...project, episodes: Array.from({ length: 50 }, () => ({ ...project.episodes[0],
  cuts: Array.from({ length: 100 }, () => ({ description: '가'.repeat(2000), dialogue: '나'.repeat(1000) })) })) };
assert.ok(buildProjectContext(longProject).length <= 48000);
assert.ok(buildProjectContext(longProject).includes('일부 자료 생략'));
assert.doesNotThrow(() => buildProjectContext({ ...project, characters: [], episodes: [] }));
console.log('PASS: context includes continuity data, excludes metadata, handles empty projects and bounds payload size');
