import type { Project } from "./storage";

const DB_NAME = "webtoon_creator_fs";
const STORE_NAME = "handles";
const DIR_KEY = "save_directory";

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
  if (!("showDirectoryPicker" in window)) {
    throw new Error(
      "이 브라우저는 폴더 저장 기능을 지원하지 않아요. Chrome 또는 Edge를 사용해주세요."
    );
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
      mode: "readwrite",
    });
    await saveHandleToDB(handle);
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

const _pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

async function _writeToFile(project: Project): Promise<void> {
  const dir = await getHandleFromDB();
  if (!dir) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perm: string = await (dir as any).queryPermission({ mode: "readwrite" });
  if (perm !== "granted") return; // 권한 없으면 조용히 스킵

  const safeName = (project.title || "untitled").replace(/[<>:"/\\|?*\n\r]/g, "_").trim();
  const fileName = `${safeName}_${project.id.slice(0, 8)}.json`;

  const fileHandle: FileSystemFileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(project, null, 2));
  await writable.close();

  // 마지막 저장 시각 기록 (step 페이지의 상태 표시용)
  localStorage.setItem("webtoon_last_autosave", new Date().toISOString());
  window.dispatchEvent(new CustomEvent("webtoon-autosaved", { detail: { projectId: project.id } }));
}

/**
 * 프로젝트를 선택된 폴더에 저장합니다 (1.5s 디바운스).
 * fire-and-forget — await 하지 않아도 됩니다.
 */
export function saveProjectToFile(project: Project): void {
  const existing = _pendingSaves.get(project.id);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    _pendingSaves.delete(project.id);
    _writeToFile(project).catch(() => {}); // 오류는 조용히 무시
  }, 1500);

  _pendingSaves.set(project.id, timer);
}
