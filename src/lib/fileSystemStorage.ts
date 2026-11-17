import type { Project } from "./storage";

const DB_NAME = "webtoon_creator_fs";
const STORE_NAME = "handles";
const DIR_KEY = "save_directory";

/** Browser file pickers cannot open from a cross-origin iframe. */
export function isCrossOriginEmbedded(): boolean {
  if (typeof window === "undefined" || window.top === window) return false;
  try {
    return window.top?.location.origin !== window.location.origin;
  } catch {
    return true;
  }
}

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getHandleFromDB(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(DIR_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveHandleToDB(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, DIR_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteHandleFromDB(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(DIR_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/** 폴더 선택 다이얼로그를 열고 핸들을 IndexedDB에 저장합니다. 취소 시 null 반환. */
export async function setSaveDirectory(): Promise<string | null> {
  if (isCrossOriginEmbedded()) {
    throw new Error("스마트 캠퍼스 안에서는 폴더를 선택할 수 없어요. 웹툰 메이커를 새 탭에서 직접 열어 설정해 주세요.");
  }
  if (!("showDirectoryPicker" in window)) {
    throw new Error(
      "이 브라우저는 폴더 저장 기능을 지원하지 않아요. 작품을 내보내기로 백업하거나 폴더 선택을 지원하는 PC 브라우저를 사용해 주세요."
    );
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
      mode: "readwrite",
    });
    // 이전 폴더의 예약 쓰기가 새 폴더 핸들을 잡지 않도록 먼저 비운다.
    await flushLocalFileWrites().catch(() => {});
    const previous = await getHandleFromDB();
    await saveHandleToDB(handle);
    errors.clear();
    try { await connectLocalFolder(); }
    catch (error) {
      if (previous) await saveHandleToDB(previous);
      else await deleteHandleFromDB();
      throw error;
    }
    return handle.name;
  } catch (err) {
    if ((err as Error).name === "AbortError") return null;
    throw err;
  }
}

/** IndexedDB에서 저장된 폴더 이름을 반환합니다. 없으면 null. */
export async function getSaveDirectoryName(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const handle = await getHandleFromDB();
  return handle?.name ?? null;
}

/** 저장된 폴더 설정을 해제합니다. */
export async function clearSaveDirectory(): Promise<void> {
  return deleteHandleFromDB();
}

/** 현재 저장 폴더 권한 상태를 반환합니다. */
export async function checkDirectoryPermission(): Promise<
  "granted" | "prompt" | "denied" | "none"
> {
  if (typeof window === "undefined") return "none";
  const dir = await getHandleFromDB();
  if (!dir) return "none";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (dir as any).queryPermission({ mode: "readwrite" });
  } catch {
    return "none";
  }
}

/** 사용자 제스처 이벤트 핸들러 안에서 호출해야 합니다 (권한 재요청). */
export async function requestDirectoryPermission(): Promise<boolean> {
  const dir = await getHandleFromDB();
  if (!dir) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (dir as any).requestPermission({ mode: "readwrite" });
    return result === "granted";
  } catch {
    return false;
  }
}

// ── Debounced file write ──────────────────────────────────────────────────────

const pending = new Map<string, { project: Project; timer: ReturnType<typeof setTimeout> }>();
const errors = new Map<string, string>();
let writes: Promise<void> = Promise.resolve();

function notifySaveState(): void {
  window.dispatchEvent(new Event("webtoon-local-save-changed"));
}

// 폴더에는 작품 JSON과 이미지를 함께 담은 복원 가능한 ZIP을 저장한다.
async function writeProject(project: Project): Promise<void> {
  const dir = await getHandleFromDB();
  if (!dir) throw new Error("저장 폴더를 먼저 선택해 주세요.");
  if (await checkDirectoryPermission() !== "granted") throw new Error("저장 폴더의 쓰기 권한을 다시 허용해 주세요.");
  const { createProjectBackupBlob } = await import("./projectBackup");
  const archive = await createProjectBackupBlob([project]);
  const handle = await dir.getFileHandle(`webtoon_${project.id}.zip`, { create: true });
  const writer = await handle.createWritable();
  try {
    await writer.write(archive);
    await writer.close();
  } catch (error) {
    await writer.abort().catch(() => {});
    throw error;
  }
  localStorage.setItem("webtoon_last_autosave", new Date().toISOString());
  window.dispatchEvent(new CustomEvent("webtoon-autosaved", { detail: { projectId: project.id } }));
}

function enqueue(project: Project): void {
  writes = writes.catch(() => {}).then(async () => {
    try { await writeProject(project); errors.delete(project.id); }
    catch (error) {
      errors.set(project.id, error instanceof Error ? error.message : "폴더 저장에 실패했어요.");
      throw error;
    } finally { notifySaveState(); }
  });
  void writes.catch(() => {});
}

export function getLocalSaveError(): string | null {
  return errors.values().next().value ?? null;
}

/** 마지막 편집본만 예약한다. 명시적 저장은 flushLocalFileWrites를 기다린다. */
export function saveProjectToFile(project: Project): void {
  const previous = pending.get(project.id);
  if (previous) clearTimeout(previous.timer);
  const timer = setTimeout(() => { pending.delete(project.id); enqueue(project); }, 1500);
  pending.set(project.id, { project, timer });
}

export async function flushLocalFileWrites(): Promise<void> {
  for (const [id, item] of pending) {
    clearTimeout(item.timer);
    pending.delete(id);
    enqueue(item.project);
  }
  await writes.catch(() => {});
  const error = getLocalSaveError();
  if (error) throw new Error(error);
}

/** 폴더를 다시 열 때 ZIP을 브라우저 작업 캐시로 복원하고, 캐시에만 있는 작품을 폴더로 복사한다. */
export async function connectLocalFolder(): Promise<void> {
  const dir = await getHandleFromDB();
  if (!dir || await checkDirectoryPermission() !== "granted") throw new Error("저장 폴더의 쓰기 권한을 허용해 주세요.");
  const JSZip = (await import("jszip")).default;
  const { restoreProjectBackup } = await import("./projectBackup");
  const { getBrowserProjects } = await import("./storage");
  const folderIds = new Set<string>();
  const archivedProjects: { file: File; project: Project }[] = [];
  let archiveCount = 0;
  const iterable = dir as FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };
  for await (const entry of iterable.values()) {
    if (entry.kind !== "file" || !/^webtoon_[0-9a-f-]{36}\.zip$/i.test(entry.name)) continue;
    if (++archiveCount > 1000) throw new Error("폴더에 웹툰 작품이 너무 많아요.");
    const file = await (entry as FileSystemFileHandle).getFile();
    const archive = await JSZip.loadAsync(file, { checkCRC32: true });
    const projectFile = archive.file("projects.json");
    if (!projectFile) throw new Error(`${entry.name}의 작품 정보를 읽지 못했어요.`);
    const parsed = JSON.parse(await projectFile.async("string")) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 1 || !parsed[0] || typeof parsed[0] !== "object" ||
        (parsed[0] as { id?: unknown }).id !== entry.name.slice(8, -4)) {
      throw new Error(`${entry.name}의 작품 ID가 파일명과 달라요.`);
    }
    const project = parsed[0] as Project;
    if (folderIds.has(project.id)) throw new Error("폴더에 같은 작품 ID가 두 번 있어요.");
    folderIds.add(project.id);
    const browser = getBrowserProjects().find(item => item.id === project.id);
    if (browser && JSON.stringify(browser) !== JSON.stringify(project)) {
      throw new Error(`브라우저와 폴더의 「${project.title}」 내용이 달라요. 기존 자료를 보존했어요. 다른 폴더를 선택하거나 ZIP을 별도로 백업해 주세요.`);
    }
    if (!browser) archivedProjects.push({ file, project });
  }
  for (const { file } of archivedProjects) await restoreProjectBackup(file);
  for (const project of getBrowserProjects()) {
    if (!folderIds.has(project.id)) saveProjectToFile(project);
  }
  await flushLocalFileWrites();
}

export async function removeProjectFromFile(id: string): Promise<void> {
  const item = pending.get(id);
  if (item) { clearTimeout(item.timer); pending.delete(id); }
  await writes.catch(() => {});
  const dir = await getHandleFromDB();
  if (!dir || await checkDirectoryPermission() !== "granted") throw new Error("저장 폴더의 쓰기 권한을 다시 허용해 주세요.");
  await dir.removeEntry(`webtoon_${id}.zip`).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "NotFoundError") return;
    throw error;
  });
  errors.delete(id);
  notifySaveState();
}
