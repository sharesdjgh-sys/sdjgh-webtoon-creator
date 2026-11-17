'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWebtoonStore } = require('./webtoon-store.cjs');

const identity = userId => ({ userId, registrationId: '73464e70-0e4d-4bbd-b852-e964b7cb442c' });
const projectId = 'e1d80b73-cf6d-4e75-9e9c-25eca39883cc';
const imageId = 'media-c47b93d0-7df5-4c6f-abd4-242133b31873';
const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
const metadata = { ownerId: 'char-1', ownerType: 'character', createdAt: '2026-11-03T00:00:00.000Z' };
const project = () => ({ id: projectId, title: '시험 작품', characters: [], episodes: [], currentStep: 1 });

test('작품 저장·재열기와 revision 충돌, 다른 계정 차단', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webtoon-store-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createWebtoonStore(root);
  assert.equal(store.listProjects(identity('student-a')).length, 0);
  assert.equal(store.saveProject(identity('student-a'), project(), 0).revision, 1);
  assert.equal(store.readProject(identity('student-a'), projectId).project.title, '시험 작품');
  assert.equal(store.listProjects(identity('student-a')).length, 1);
  assert.throws(() => store.readProject(identity('student-b'), projectId), { code: 'project_not_found' });
  assert.throws(() => store.saveProject(identity('student-a'), { ...project(), title: '덮어쓰기' }, 0), { code: 'revision_conflict' });
  assert.equal(store.saveProject(identity('student-a'), { ...project(), title: '수정' }, 1).revision, 2);
  assert.equal(store.readProject(identity('student-a'), projectId).project.title, '수정');
});

test('이미지와 작품 참조를 연결하고 다른 계정에서 읽지 못한다', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webtoon-store-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createWebtoonStore(root);
  const withImage = { ...project(), characters: [{ id: 'char-1', imageAssetId: imageId }] };
  assert.throws(() => store.saveProject(identity('student-a'), withImage, 0), { code: 'missing_image' });
  assert.equal(store.saveAsset(identity('student-a'), projectId, imageId, png, metadata).mimeType, 'image/png');
  assert.equal(store.saveProject(identity('student-a'), withImage, 0).revision, 1);
  assert.equal(store.listAssets(identity('student-a'), projectId)[0].id, imageId);
  assert.deepEqual(store.readAsset(identity('student-a'), projectId, imageId).bytes, png);
  assert.throws(() => store.readAsset(identity('student-b'), projectId, imageId), { code: 'project_not_found' });
  assert.throws(() => store.saveAsset(identity('student-a'), projectId, imageId, Buffer.from('ffd8ff00', 'hex'), metadata), { code: 'image_id_conflict' });
});

test('재등록 식별값과 파일 ID를 검증한다', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webtoon-store-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createWebtoonStore(root);
  store.saveProject(identity('student-a'), project(), 0);
  assert.throws(() => store.readProject({ userId: 'student-a', registrationId: 'c6a09cce-c9dc-4eea-951b-73b738b07033' }, projectId), { code: 'project_not_found' });
  assert.throws(() => store.readProject(identity('student-a'), '../escape'), { code: 'invalid_project_id' });
  assert.throws(() => store.saveAsset(identity('student-a'), projectId, '../escape', png, metadata), { code: 'invalid_asset_id' });
  assert.throws(() => store.saveProject({ userId: 'student-a' }, project(), 0), { code: 'registration_required' });
});
