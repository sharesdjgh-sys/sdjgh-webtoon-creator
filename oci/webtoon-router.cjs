'use strict';

const { StoreError } = require('./webtoon-store.cjs');

const MAX_PROJECT_BODY = 2 * 1024 * 1024 + 4096;
const MAX_IMAGE_BODY = 10 * 1024 * 1024;
const UUID = '[0-9a-fA-F-]{36}';
const PROJECT_ROUTE = new RegExp(`^/projects/(${UUID})$`);
const ASSETS_ROUTE = new RegExp(`^/projects/(${UUID})/assets$`);
const ASSET_ROUTE = new RegExp(`^/projects/(${UUID})/assets/(media-${UUID})$`);

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(value));
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new StoreError('body_too_large', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function createWebtoonRouter({ store, verifySession, allows, securityEnabled = () => process.env.ACCOUNT_SECURITY_ENABLED === 'true' }) {
  if (!store || typeof verifySession !== 'function' || typeof allows !== 'function') throw Error('webtoon_router_dependencies_required');
  return async function webtoonRouter(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      // 등록 식별값과 자격 버전이 검증되는 중앙 인증 모드에서만 작품 저장을 연다.
      if (!securityEnabled()) throw new StoreError('account_security_required', 403);
      const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(req.headers.authorization || '');
      if (!match) throw new StoreError('authentication_required', 401);
      let identity;
      try { identity = await verifySession(match[1]); }
      catch { throw new StoreError('authentication_invalid', 401); }
      if (!allows('webtoon-maker', identity.role)) throw new StoreError('access_denied', 403);
      if (typeof identity.userId !== 'string' || !identity.userId || !identity.registrationId) {
        throw new StoreError('registration_required', 403);
      }

      const route = new URL(req.url, 'http://localhost').pathname;
      if (route === '/projects' && req.method === 'GET') {
        return sendJson(res, 200, { projects: store.listProjects(identity).map(({ project, revision, updatedAt }) =>
          ({ id: project.id, title: project.title, revision, updatedAt })) });
      }
      const assetMatch = ASSET_ROUTE.exec(route);
      if (assetMatch && req.method === 'PUT') {
        if (!/^image\/(png|jpeg|webp)(?:;|$)/i.test(req.headers['content-type'] || '')) throw new StoreError('unsupported_image');
        const image = store.saveAsset(identity, assetMatch[1], assetMatch[2], await readBody(req, MAX_IMAGE_BODY), {
          ownerId: req.headers['x-webtoon-owner-id'],
          ownerType: req.headers['x-webtoon-owner-type'],
          createdAt: req.headers['x-webtoon-created-at'],
        });
        return sendJson(res, 200, image);
      }
      if (assetMatch && req.method === 'GET') {
        const image = store.readAsset(identity, assetMatch[1], assetMatch[2]);
        res.statusCode = 200;
        res.setHeader('Content-Type', image.mimeType);
        res.end(image.bytes);
        return;
      }
      if (assetMatch && req.method === 'DELETE') {
        store.deleteAsset(identity, assetMatch[1], assetMatch[2]);
        return sendJson(res, 200, { deleted: true });
      }
      const assetsMatch = ASSETS_ROUTE.exec(route);
      if (assetsMatch && req.method === 'GET') return sendJson(res, 200, { assets: store.listAssets(identity, assetsMatch[1]) });
      const projectMatch = PROJECT_ROUTE.exec(route);
      if (projectMatch && req.method === 'GET') return sendJson(res, 200, store.readProject(identity, projectMatch[1]));
      if (projectMatch && req.method === 'PUT') {
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new StoreError('invalid_content_type');
        const payload = JSON.parse((await readBody(req, MAX_PROJECT_BODY)).toString('utf8'));
        if (payload?.project?.id !== projectMatch[1]) throw new StoreError('invalid_project_id');
        if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) throw new StoreError('revision_required', 428);
        const saved = store.saveProject(identity, payload.project, payload.revision);
        return sendJson(res, 200, { revision: saved.revision, updatedAt: saved.updatedAt });
      }
      if (projectMatch && req.method === 'DELETE') {
        const revision = Number(req.headers['if-match']);
        if (!Number.isSafeInteger(revision) || revision < 1) throw new StoreError('revision_required', 428);
        store.deleteProject(identity, projectMatch[1], revision);
        return sendJson(res, 200, { deleted: true });
      }
      return sendJson(res, 404, { error: 'not_found' });
    } catch (error) {
      if (error instanceof SyntaxError) return sendJson(res, 400, { error: 'invalid_json' });
      if (error instanceof StoreError) return sendJson(res, error.status, { error: error.code });
      return sendJson(res, 500, { error: 'storage_unavailable' });
    }
  };
}

module.exports = { createWebtoonRouter };
