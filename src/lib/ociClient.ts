"use client";

import type { Project } from "./storage";
import type { MediaAsset } from "./mediaStorage";

export const SMART_CAMPUS_ORIGIN = "https://platform.sdjgh-ai.kr";
const API = `${SMART_CAMPUS_ORIGIN}/api/webtoon`;
let sessionToken: string | null = null;
let sessionEpoch = 0;
const assetProjects = new Map<string, string>();

export type ServerProjectRecord = { project: Project; revision: number; updatedAt: string };
export type ServerAssetMetadata = Omit<MediaAsset, "blob">;

export function setOciToken(token: string | null): void {
  sessionToken = token && /^[A-Za-z0-9._~-]+$/.test(token) ? token : null;
  sessionEpoch += 1;
  // 새 세션의 이미지 ID를 이전 계정의 작품에 연결하지 않는다.
  assetProjects.clear();
}

export function hasOciToken(): boolean { return !!sessionToken; }
export function getOciSessionEpoch(): number { return sessionEpoch; }
export function registerOciAsset(id: string, projectId: string): void { assetProjects.set(id, projectId); }
export function getOciAssetProject(id: string): string | undefined { return assetProjects.get(id); }

function mapProjectAssets(project: Project): void {
  function visit(value: unknown): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    for (const [key, item] of Object.entries(value)) {
      if (/AssetIds?$/.test(key) || key === "assetId") {
        for (const id of Array.isArray(item) ? item : [item]) {
          if (typeof id === "string" && id.startsWith("media-")) registerOciAsset(id, project.id);
        }
      } else visit(item);
    }
  }
  visit(project);
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  if (!sessionToken) throw new Error("스마트 캠퍼스 로그인이 필요해요.");
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "omit",
    cache: "no-store",
    headers: { Authorization: `Bearer ${sessionToken}`, ...init.headers },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      setOciToken(null);
      window.parent?.postMessage({ type: "sso:expired" }, SMART_CAMPUS_ORIGIN);
      window.dispatchEvent(new Event("webtoon-sso-expired"));
      throw new Error("스마트 캠퍼스 로그인 세션이 끝났어요. 다시 로그인해 주세요.");
    }
    const body = await response.json().catch(() => ({})) as { error?: string };
    const messages: Record<string, string> = {
      registration_required: "계정 등록 정보가 확인되지 않아 서버에 저장할 수 없어요.",
      project_too_large: "작품 내용이 서버 저장 한도를 넘었어요.",
      image_too_large: "이미지 크기가 서버 저장 한도를 넘었어요.",
      owner_quota_exceeded: "계정의 서버 저장 공간이 가득 찼어요. 관리자에게 알려 주세요.",
      revision_conflict: "다른 화면에서 작품이 수정되었어요. 현재 내용을 로컬 저장으로 백업해 주세요.",
      missing_image: "작품에서 쓰는 이미지가 서버에 없어 저장하지 못했어요.",
    };
    throw new Error(messages[body.error ?? ""] ?? `서버 저장 요청에 실패했어요 (${response.status}).`);
  }
  return response;
}

export async function listOciProjects(): Promise<ServerProjectRecord[]> {
  const response = await request("/projects");
  const body = await response.json() as { projects: { id: string }[] };
  return Promise.all(body.projects.map(async ({ id }) => {
    const record = await (await request(`/projects/${encodeURIComponent(id)}`)).json() as ServerProjectRecord;
    mapProjectAssets(record.project);
    return record;
  }));
}

export async function putOciProject(project: Project, revision: number): Promise<number> {
  const response = await request(`/projects/${encodeURIComponent(project.id)}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, revision }),
  });
  mapProjectAssets(project);
  return (await response.json() as { revision: number }).revision;
}

export async function deleteOciProject(id: string, revision: number): Promise<void> {
  await request(`/projects/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "If-Match": String(revision) } });
}

export async function putOciAsset(asset: MediaAsset): Promise<void> {
  await request(`/projects/${encodeURIComponent(asset.projectId)}/assets/${encodeURIComponent(asset.id)}`, {
    method: "PUT", body: asset.blob,
    headers: { "Content-Type": asset.mimeType, "X-Webtoon-Owner-Id": asset.ownerId,
      "X-Webtoon-Owner-Type": asset.ownerType, "X-Webtoon-Created-At": asset.createdAt },
  });
  registerOciAsset(asset.id, asset.projectId);
}

export async function getOciAsset(projectId: string, id: string): Promise<Blob> {
  return (await request(`/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(id)}`)).blob();
}

export async function listOciAssets(projectId: string): Promise<ServerAssetMetadata[]> {
  const response = await request(`/projects/${encodeURIComponent(projectId)}/assets`);
  return (await response.json() as { assets: ServerAssetMetadata[] }).assets;
}
