'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSET_ID = /^media-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_PROJECT_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_OWNER_BYTES = 256 * 1024 * 1024;
const OWNER_TYPES = new Set(['character', 'character-reference', 'storyboard', 'storyboard-layer', 'pose-reference', 'scene']);

class StoreError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}

function ownerKey(identity) {
  if (!identity || typeof identity.userId !== 'string' || !identity.userId ||
      typeof identity.registrationId !== 'string' || !PROJECT_ID.test(identity.registrationId)) {
    throw new StoreError('registration_required', 403);
  }
  return crypto.createHash('sha256').update(identity.userId).update('\0')
    .update(identity.registrationId).digest('hex');
}

function referencedMediaIds(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const item of value) referencedMediaIds(item, found);
  } else {
    for (const [key, item] of Object.entries(value)) {
      if (/AssetIds?$/.test(key) || key === 'assetId') {
        for (const id of Array.isArray(item) ? item : [item]) {
          if (typeof id === 'string' && id.startsWith('media-')) found.add(id);
        }
      } else referencedMediaIds(item, found);
    }
  }
  return found;
}

function imageMime(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw new StoreError('unsupported_image');
}

function directoryBytes(folder) {
  if (!fs.existsSync(folder)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const item = path.join(folder, entry.name);
    if (entry.isSymbolicLink()) throw new StoreError('unsafe_storage', 500);
    total += entry.isDirectory() ? directoryBytes(item) : fs.statSync(item).size;
  }
  return total;
}

function atomicWrite(filename, bytes) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, filename);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function createWebtoonStore(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw new Error('absolute_storage_root_required');
  const resolvedRoot = path.resolve(root);
  // 운영 서버의 웹 공개 경로나 코드 체크아웃을 지정하지 못하도록 별도 검증한다.
  if (resolvedRoot.includes(`${path.sep}public${path.sep}`) || resolvedRoot.includes(`${path.sep}client${path.sep}`)) {
    throw new Error('private_storage_root_required');
  }
  const owners = path.join(resolvedRoot, 'owners');
  const ownerFolder = identity => path.join(owners, ownerKey(identity));
  const projectFolder = (identity, projectId) => {
    if (!PROJECT_ID.test(projectId)) throw new StoreError('invalid_project_id');
    return path.join(ownerFolder(identity), 'projects', projectId);
  };
  const projectFile = (identity, projectId) => path.join(projectFolder(identity, projectId), 'project.json');
  const assetFile = (identity, projectId, assetId) => {
    if (!ASSET_ID.test(assetId)) throw new StoreError('invalid_asset_id');
    return path.join(projectFolder(identity, projectId), 'assets', assetId);
  };

  function readProject(identity, id) {
    const filename = projectFile(identity, id);
    if (!fs.existsSync(filename)) throw new StoreError('project_not_found', 404);
    const record = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (!record || record.project?.id !== id || !Number.isSafeInteger(record.revision)) throw new StoreError('corrupt_project', 500);
    return record;
  }

  function listProjects(identity) {
    const folder = path.join(ownerFolder(identity), 'projects');
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder, { withFileTypes: true }).filter(entry => entry.isDirectory() && PROJECT_ID.test(entry.name))
      .map(entry => readProject(identity, entry.name))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function saveProject(identity, project, expectedRevision) {
    if (!project || typeof project !== 'object' || !PROJECT_ID.test(project.id || '') ||
        typeof project.title !== 'string' || !Array.isArray(project.characters) || !Array.isArray(project.episodes)) {
      throw new StoreError('invalid_project');
    }
    const bytes = Buffer.from(JSON.stringify(project));
    if (bytes.length > MAX_PROJECT_BYTES) throw new StoreError('project_too_large', 413);
    const filename = projectFile(identity, project.id);
    const exists = fs.existsSync(filename);
    if (exists && !Number.isSafeInteger(expectedRevision)) throw new StoreError('revision_required', 428);
    if (!exists && expectedRevision !== 0) throw new StoreError('revision_required', 428);
    const current = exists ? readProject(identity, project.id) : null;
    if ((current?.revision ?? 0) !== expectedRevision) throw new StoreError('revision_conflict', 409);
    for (const assetId of referencedMediaIds(project)) {
      const filename = assetFile(identity, project.id, assetId);
      if (!fs.existsSync(filename) || !fs.existsSync(`${filename}.json`)) throw new StoreError('missing_image', 409);
    }
    const record = { revision: expectedRevision + 1, updatedAt: new Date().toISOString(), project };
    const next = Buffer.from(JSON.stringify(record));
    const currentBytes = current ? fs.statSync(filename).size : 0;
    if (directoryBytes(ownerFolder(identity)) - currentBytes + next.length > MAX_OWNER_BYTES) throw new StoreError('owner_quota_exceeded', 413);
    atomicWrite(filename, next);
    return record;
  }

  function saveAsset(identity, projectId, assetId, bytes, metadata) {
    if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw new StoreError('image_too_large', 413);
    const mime = imageMime(bytes);
    if (!metadata || typeof metadata.ownerId !== 'string' || metadata.ownerId.length > 128 ||
        !OWNER_TYPES.has(metadata.ownerType) || typeof metadata.createdAt !== 'string' ||
        !Number.isFinite(Date.parse(metadata.createdAt))) throw new StoreError('invalid_image_metadata');
    const filename = assetFile(identity, projectId, assetId);
    const meta = { id: assetId, projectId, ownerId: metadata.ownerId,
      ownerType: metadata.ownerType, mimeType: mime, createdAt: metadata.createdAt };
    if (fs.existsSync(filename)) {
      const old = fs.readFileSync(filename);
      if (!old.equals(bytes)) throw new StoreError('image_id_conflict', 409);
      if (fs.existsSync(`${filename}.json`)) return { ...JSON.parse(fs.readFileSync(`${filename}.json`, 'utf8')), size: bytes.length };
    } else {
      if (directoryBytes(ownerFolder(identity)) + bytes.length > MAX_OWNER_BYTES) throw new StoreError('owner_quota_exceeded', 413);
      atomicWrite(filename, bytes);
    }
    atomicWrite(`${filename}.json`, Buffer.from(JSON.stringify(meta)));
    return { ...meta, size: bytes.length };
  }

  function readAsset(identity, projectId, assetId) {
    readProject(identity, projectId);
    const filename = assetFile(identity, projectId, assetId);
    if (!fs.existsSync(filename)) throw new StoreError('image_not_found', 404);
    const bytes = fs.readFileSync(filename);
    return { bytes, mimeType: imageMime(bytes) };
  }

  function listAssets(identity, projectId) {
    readProject(identity, projectId);
    const folder = path.join(projectFolder(identity, projectId), 'assets');
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder).filter(id => ASSET_ID.test(id) && fs.existsSync(path.join(folder, `${id}.json`)))
      .map(id => JSON.parse(fs.readFileSync(path.join(folder, `${id}.json`), 'utf8')));
  }

  function deleteAsset(identity, projectId, assetId) {
    const project = readProject(identity, projectId).project;
    if (referencedMediaIds(project).has(assetId)) throw new StoreError('image_in_use', 409);
    const filename = assetFile(identity, projectId, assetId);
    if (fs.existsSync(filename)) fs.unlinkSync(filename);
    if (fs.existsSync(`${filename}.json`)) fs.unlinkSync(`${filename}.json`);
  }

  function deleteProject(identity, projectId, expectedRevision) {
    const current = readProject(identity, projectId);
    if (current.revision !== expectedRevision) throw new StoreError('revision_conflict', 409);
    fs.rmSync(projectFolder(identity, projectId), { recursive: true, force: false });
  }

  return { listProjects, readProject, saveProject, saveAsset, readAsset, listAssets, deleteAsset, deleteProject };
}

module.exports = { createWebtoonStore, StoreError, referencedMediaIds, imageMime };
