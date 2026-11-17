'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createWebtoonStore } = require('./webtoon-store.cjs');
const { createWebtoonRouter } = require('./webtoon-router.cjs');

const projectId = 'e1d80b73-cf6d-4e75-9e9c-25eca39883cc';
const imageId = 'media-c47b93d0-7df5-4c6f-abd4-242133b31873';
const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');

test('HTTP 작품·이미지 저장과 계정 격리, 미인증 거부', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webtoon-api-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createWebtoonStore(root);
  const router = createWebtoonRouter({ store,
    verifySession: async token => ({ userId: token, registrationId: '73464e70-0e4d-4bbd-b852-e964b7cb442c', role: '학생' }),
    allows: () => true, securityEnabled: () => true });
  const server = http.createServer(router);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (route, token, options = {}) => fetch(base + route, { ...options,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });

  assert.equal((await call('/projects')).status, 401);
  const initial = { id: projectId, title: '테스트', characters: [], episodes: [], currentStep: 1 };
  const put = (token, project, revision) => call(`/projects/${projectId}`, token, { method: 'PUT',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project, revision }) });
  assert.equal((await put('student-a', initial, 0)).status, 200);
  assert.equal((await call(`/projects/${projectId}`, 'student-a')).status, 200);
  assert.equal((await call(`/projects/${projectId}`, 'student-b')).status, 404);
  assert.equal((await put('student-a', initial, 0)).status, 409);

  const image = await call(`/projects/${projectId}/assets/${imageId}`, 'student-a', {
    method: 'PUT', headers: { 'Content-Type': 'image/png', 'X-Webtoon-Owner-Id': 'character-1',
      'X-Webtoon-Owner-Type': 'character', 'X-Webtoon-Created-At': '2026-11-03T00:00:00.000Z' }, body: png });
  assert.equal(image.status, 200);
  const withImage = { ...initial, characters: [{ id: 'character-1', imageAssetId: imageId }] };
  assert.equal((await put('student-a', withImage, 1)).status, 200);
  assert.equal((await call(`/projects/${projectId}/assets/${imageId}`, 'student-a')).status, 200);
  assert.equal((await call(`/projects/${projectId}/assets/${imageId}`, 'student-b')).status, 404);
  assert.equal((await call(`/projects/${projectId}/assets/${imageId}`, 'student-a', { method: 'DELETE' })).status, 409);
});

test('중앙 계정 보안 모드가 꺼져 있으면 등록값이 있더라도 저장 API를 닫는다', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'webtoon-api-gate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const router = createWebtoonRouter({ store: createWebtoonStore(root),
    verifySession: async () => ({ userId: 'student-a', registrationId: '73464e70-0e4d-4bbd-b852-e964b7cb442c', role: '학생' }),
    allows: () => true, securityEnabled: () => false });
  const server = http.createServer(router);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/projects`, {
    headers: { Authorization: 'Bearer test-token' } });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'account_security_required');
});
