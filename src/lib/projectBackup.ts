"use client";

import type { Project } from "./storage";
import { flushServerWrites, getProjects, isServerStorageActive, saveProjects } from "./storage";
import { putOciAsset } from "./ociClient";
import { getLocalMediaByProject, getMediaAsset, getMediaByProject, restoreMediaAssets, type MediaAsset, type MediaOwnerType } from "./mediaStorage";

const FORMAT = "webtoon-maker-backup";
const VERSION = 1;
const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024;
const MAX_ASSET_BYTES = 50 * 1024 * 1024;
const OWNER_TYPES: MediaOwnerType[] = ["character", "character-reference", "storyboard", "storyboard-layer", "pose-reference", "scene"];

type AssetEntry = Omit<MediaAsset, "blob"> & { path: string; size: number; sha256: string };
type Manifest = { format: typeof FORMAT; version: typeof VERSION; createdAt: string; projectIds: string[]; assets: AssetEntry[] };

function referencedMediaIds(value: unknown, found = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    for (const item of value) referencedMediaIds(item, found);
  } else {
    for (const [key, item] of Object.entries(value)) {
      if (/AssetIds?$/.test(key) || key === "assetId") {
        for (const id of Array.isArray(item) ? item : [item]) {
          if (typeof id === "string" && id.startsWith("media-")) found.add(id);
        }
      } else referencedMediaIds(item, found);
    }
  }
  return found;
}

async function sha256(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** A ZIP is a full backup only when every referenced media asset is present. */
export async function createProjectBackupBlob(projects: Project[], source: "active" | "browser" = "active"): Promise<Blob> {
  if (!projects.length) throw new Error("백업할 작품이 없어요.");
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const readAssets = source === "browser" ? getLocalMediaByProject : getMediaByProject;
  const assets = (await Promise.all(projects.map((project) => readAssets(project.id)))).flat();
  const assetIds = new Set(assets.map((asset) => asset.id));
  const missing = projects.flatMap((project) => [...referencedMediaIds(project)].filter((id) => !assetIds.has(id)));
  if (missing.length) throw new Error(`작품에서 참조하는 이미지 ${missing.length}개를 찾지 못해 완전 백업을 만들 수 없어요.`);

  const entries: AssetEntry[] = [];
  for (const asset of assets) {
    if (asset.blob.size > MAX_ASSET_BYTES) throw new Error("50 MiB를 넘는 이미지가 있어 백업을 만들 수 없어요.");
    const path = `assets/${asset.id}.bin`;
    zip.file(path, asset.blob, { binary: true, compression: "STORE" });
    entries.push({ id: asset.id, projectId: asset.projectId, ownerId: asset.ownerId,
      ownerType: asset.ownerType, mimeType: asset.mimeType, createdAt: asset.createdAt,
      path, size: asset.blob.size, sha256: await sha256(asset.blob) });
  }
  const manifest: Manifest = { format: FORMAT, version: VERSION, createdAt: new Date().toISOString(),
    projectIds: projects.map((project) => project.id), assets: entries };
  zip.file("projects.json", JSON.stringify(projects));
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", streamFiles: true });
  if (blob.size > MAX_ARCHIVE_BYTES) throw new Error("백업 파일이 500 MiB를 넘어 한 번에 다운로드할 수 없어요.");
  return blob;
}

export async function downloadProjectBackup(projects: Project[], filename: string, source: "active" | "browser" = "active"): Promise<void> {
  download(await createProjectBackupBlob(projects, source), filename);
}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const project = value as Record<string, unknown>;
  return typeof project.id === "string" && project.id.length > 0 && typeof project.title === "string" &&
    Array.isArray(project.characters) && Array.isArray(project.episodes);
}

function isAssetEntry(value: unknown): value is AssetEntry {
  if (!value || typeof value !== "object") return false;
  const asset = value as Record<string, unknown>;
  return typeof asset.id === "string" && /^media-[a-zA-Z0-9-]+$/.test(asset.id) &&
    typeof asset.projectId === "string" && typeof asset.ownerId === "string" &&
    OWNER_TYPES.includes(asset.ownerType as MediaOwnerType) &&
    ["image/png", "image/jpeg", "image/webp"].includes(String(asset.mimeType)) &&
    typeof asset.createdAt === "string" && asset.path === `assets/${asset.id}.bin` &&
    Number.isSafeInteger(asset.size) && Number(asset.size) >= 0 && Number(asset.size) <= MAX_ASSET_BYTES &&
    typeof asset.sha256 === "string" && /^[0-9a-f]{64}$/.test(asset.sha256);
}

export async function restoreProjectBackup(file: File): Promise<{ added: number; skipped: number }> {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error("500 MiB 이하의 백업 파일을 선택해 주세요.");
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(file, { checkCRC32: true });
  if (Object.keys(zip.files).length > 2000) throw new Error("백업 파일에 항목이 너무 많아요.");
  const manifestFile = zip.file("manifest.json");
  const projectsFile = zip.file("projects.json");
  if (!manifestFile || !projectsFile) throw new Error("웹툰 메이커 백업 파일이 아니에요.");
  const manifest = JSON.parse(await manifestFile.async("string")) as Partial<Manifest>;
  const projects = JSON.parse(await projectsFile.async("string")) as unknown;
  if (manifest.format !== FORMAT || manifest.version !== VERSION || !Array.isArray(manifest.projectIds) ||
      !Array.isArray(manifest.assets) || !Array.isArray(projects) || !projects.every(isProject)) {
    throw new Error("지원하지 않는 백업 형식이에요.");
  }
  const projectIds = new Set(projects.map((project) => project.id));
  if (projectIds.size !== projects.length || manifest.projectIds.length !== projects.length ||
      manifest.projectIds.some((id) => !projectIds.has(id)) || !manifest.assets.every(isAssetEntry)) {
    throw new Error("백업 파일의 작품·이미지 목록이 일치하지 않아요.");
  }
  const assetIds = new Set(manifest.assets.map((asset) => asset.id));
  if (assetIds.size !== manifest.assets.length) throw new Error("백업에 같은 이미지가 중복되어 있어요.");
  const existing = getProjects();
  const existingIds = new Set(existing.map((project) => project.id));
  const toAdd = projects.filter((project) => !existingIds.has(project.id));
  const toAddIds = new Set(toAdd.map((project) => project.id));
  const assets: MediaAsset[] = [];
  for (const entry of manifest.assets) {
    if (!projectIds.has(entry.projectId)) throw new Error("소속 작품이 없는 이미지가 있어요.");
    if (!toAddIds.has(entry.projectId)) continue;
    const archiveFile = zip.file(entry.path);
    if (!archiveFile) throw new Error("백업에서 이미지 파일을 찾지 못했어요.");
    const bytes = await archiveFile.async("uint8array");
    if (bytes.byteLength !== entry.size) throw new Error("백업 이미지의 크기가 맞지 않아요.");
    const blob = new Blob([new Uint8Array(bytes)], { type: entry.mimeType });
    if (await sha256(blob) !== entry.sha256) throw new Error("백업 이미지의 내용 검증에 실패했어요.");
    if (await getMediaAsset(entry.id)) throw new Error("이미 같은 ID의 이미지가 있어 기존 자료를 보존했어요.");
    assets.push({ id: entry.id, projectId: entry.projectId, ownerId: entry.ownerId,
      ownerType: entry.ownerType, mimeType: entry.mimeType, createdAt: entry.createdAt, blob });
  }
  const restoredIds = new Set(assets.map((asset) => asset.id));
  if (toAdd.some((project) => [...referencedMediaIds(project)].some((id) => !restoredIds.has(id)))) {
    throw new Error("작품에서 참조하는 이미지가 백업에 빠져 있어 복원하지 않았어요.");
  }
  if (isServerStorageActive()) {
    for (const asset of assets) await putOciAsset(asset);
  } else {
    await restoreMediaAssets(assets);
  }
  if (toAdd.length) {
    saveProjects([...existing, ...toAdd]);
    await flushServerWrites();
  }
  return { added: toAdd.length, skipped: projects.length - toAdd.length };
}
