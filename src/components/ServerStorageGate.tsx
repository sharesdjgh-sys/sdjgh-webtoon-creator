"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SMART_CAMPUS_ORIGIN, listOciProjects, setOciToken } from "@/lib/ociClient";
import { activateServerProjects, deactivateServerProjects, flushServerWrites, getBrowserProjects, getProjects, getServerSaveError, retryServerWrites, saveProjects } from "@/lib/storage";
import { checkDirectoryPermission, connectLocalFolder, flushLocalFileWrites, getLocalSaveError, getSaveDirectoryName, requestDirectoryPermission, saveProjectToFile, setSaveDirectory } from "@/lib/fileSystemStorage";

type Status = "connecting" | "ready" | "direct" | "local" | "error";

export default function ServerStorageGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("connecting");
  const [message, setMessage] = useState("");
  const [legacyCount, setLegacyCount] = useState(0);
  const [collisionCount, setCollisionCount] = useState(0);
  const [migrating, setMigrating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);

  useEffect(() => {
    if (window.parent === window) {
      let active = true;
      void Promise.all([getSaveDirectoryName(), checkDirectoryPermission()]).then(async ([name, permission]) => {
        if (!active) return;
        setFolderName(name);
        if (name && permission === "granted") {
          try { await connectLocalFolder(); if (active) setStatus("local"); }
          catch (error) {
            if (active) { setMessage(error instanceof Error ? error.message : "저장 폴더를 읽지 못했어요."); setStatus("direct"); }
          }
        } else setStatus("direct");
      });
      return () => { active = false; };
    }
    let mounted = true;
    async function onMessage(event: MessageEvent) {
      if (event.origin !== SMART_CAMPUS_ORIGIN || event.source !== window.parent ||
          event.data?.type !== "sso:token" || typeof event.data.token !== "string") return;
      setStatus("connecting");
      deactivateServerProjects();
      setOciToken(event.data.token);
      try {
        const records = await listOciProjects();
        if (!mounted) return;
        const serverIds = new Set(records.map(record => record.project.id));
        const browserProjects = getBrowserProjects();
        setLegacyCount(browserProjects.filter(project => !serverIds.has(project.id)).length);
        setCollisionCount(browserProjects.filter(project => serverIds.has(project.id)).length);
        activateServerProjects(records);
        setStatus("ready");
        setMessage("");
      } catch (error) {
        if (!mounted) return;
        setOciToken(null);
        deactivateServerProjects();
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "서버 저장소에 연결하지 못했어요.");
      }
    }
    function expired() { deactivateServerProjects(); setStatus("error"); setMessage("스마트 캠퍼스 로그인이 끝났어요. 다시 로그인해 주세요."); }
    function changed() { setSaveError(getServerSaveError()); }
    function localChanged() { setSaveError(getLocalSaveError()); }
    window.addEventListener("message", onMessage);
    window.addEventListener("webtoon-sso-expired", expired);
    window.addEventListener("webtoon-projects-changed", changed);
    window.addEventListener("webtoon-local-save-changed", localChanged);
    window.parent.postMessage({ type: "sso:ready" }, SMART_CAMPUS_ORIGIN);
    return () => {
      mounted = false;
      window.removeEventListener("message", onMessage);
      window.removeEventListener("webtoon-sso-expired", expired);
      window.removeEventListener("webtoon-projects-changed", changed);
      window.removeEventListener("webtoon-local-save-changed", localChanged);
    };
  }, []);

  const connectFolder = async () => {
    setFolderBusy(true);
    setMessage("");
    try {
      let name = folderName;
      if (name) {
        const granted = await requestDirectoryPermission();
        if (!granted) throw new Error("저장 폴더의 쓰기 권한을 허용해 주세요.");
      } else {
        name = await setSaveDirectory();
        if (!name) return;
      }
      await connectLocalFolder();
      setFolderName(name);
      setStatus("local");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장 폴더에 연결하지 못했어요.");
    } finally { setFolderBusy(false); }
  };

  const changeFolder = async () => {
    setFolderBusy(true);
    try {
      const name = await setSaveDirectory();
      if (!name) return;
      await connectLocalFolder();
      setFolderName(name);
      setSaveError(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "새 폴더에 저장하지 못했어요.");
    } finally { setFolderBusy(false); }
  };

  const retrySave = async () => {
    setSaveError(null);
    try {
      if (status === "ready") await retryServerWrites();
      else {
        for (const project of getBrowserProjects()) saveProjectToFile(project);
        await flushLocalFileWrites();
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "저장을 다시 시도하지 못했어요.");
    }
  };

  const migrate = async () => {
    setMigrating(true);
    setMessage("");
    try {
      const existingIds = new Set(getProjects().map(p => p.id));
      const additions = getBrowserProjects().filter(p => !existingIds.has(p.id));
      saveProjects([...getProjects(), ...additions]);
      await flushServerWrites();
      setLegacyCount(0);
      setMessage(`${additions.length}개 이전 작품을 서버로 복사했어요. 브라우저 원본은 남겨 두었습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이전 작품을 서버로 복사하지 못했어요.");
    } finally { setMigrating(false); }
  };

  if (["/", "/guide", "/login", "/signup"].includes(pathname)) return <>{children}</>;
  if (status === "connecting") return <main className="m-auto p-8 text-center">스마트 캠퍼스 계정과 서버 저장소를 연결하고 있어요.</main>;
  if (status === "error") return <main className="m-auto max-w-md p-8 text-center">
    <h1 className="text-xl font-bold">서버 저장소에 연결하지 못했어요</h1>
    <p className="mt-3 text-sm">{message}</p>
    <button type="button" onClick={() => window.parent.postMessage({ type: "sso:ready" }, SMART_CAMPUS_ORIGIN)}
      className="mt-5 rounded-full bg-[#7C3AED] px-5 py-2 text-sm text-white">다시 연결</button>
  </main>;
  if (status === "direct") return <main className="m-auto max-w-lg p-8 text-center">
    <h1 className="text-xl font-bold">저장 폴더를 연결해 주세요</h1>
    <p className="mt-3 text-sm">스마트 캠퍼스 밖에서는 선택한 폴더에 작품과 이미지를 ZIP 파일로 저장합니다. 기존 작품도 폴더에 복사한 뒤 작업을 시작합니다.</p>
    <button type="button" disabled={folderBusy || !("showDirectoryPicker" in window)} onClick={() => void connectFolder()}
      className="mt-5 rounded-full bg-[#7C3AED] px-5 py-2 text-sm text-white disabled:opacity-50">{folderBusy ? "폴더 연결 중..." : folderName ? `${folderName} 권한 다시 허용` : "저장 폴더 선택"}</button>
    {!("showDirectoryPicker" in window) && <p className="mt-3 text-sm text-amber-800">이 브라우저에서는 폴더 저장을 지원하지 않습니다. 폴더 선택을 지원하는 PC 브라우저에서 열어 주세요.</p>}
    {message && <p role="alert" className="mt-3 text-sm text-red-700">{message}</p>}
    {folderName && <button type="button" onClick={() => void changeFolder()} className="mt-3 block w-full text-sm text-[#6D28D9] underline">다른 폴더 선택</button>}
    <a href={SMART_CAMPUS_ORIGIN} className="mt-5 block text-sm text-[#6D28D9] underline">스마트 캠퍼스에서 서버 저장 사용</a>
  </main>;

  return <>
    {status === "local" && <div role="status" className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      로컬 폴더 저장: {folderName}{saveError ? ` · 저장 오류: ${saveError}` : ""}
      <button type="button" disabled={folderBusy} onClick={() => void changeFolder()} className="ml-3 font-semibold underline disabled:opacity-50">폴더 변경</button>
      {saveError && <button type="button" disabled={folderBusy} onClick={() => void connectFolder()} className="ml-3 font-semibold underline disabled:opacity-50">권한 다시 허용</button>}
      {saveError && <button type="button" disabled={folderBusy} onClick={() => void retrySave()} className="ml-3 font-semibold underline disabled:opacity-50">저장 다시 시도</button>}
    </div>}
    {status === "ready" && <div role="status" className="bg-[#F5F3FF] px-4 py-2 text-center text-sm text-[#514A65]">
      서버 저장 연결됨{saveError ? ` · 저장 오류: ${saveError}` : ""}
      {saveError && <button type="button" onClick={() => void retrySave()} className="ml-3 font-semibold text-[#6D28D9] underline">저장 다시 시도</button>}
      {legacyCount > 0 && <button type="button" disabled={migrating} onClick={() => void migrate()}
        className="ml-3 font-semibold text-[#6D28D9] underline disabled:opacity-50">
        {migrating ? "이전 작품 복사 중" : `이 브라우저의 이전 작품 ${legacyCount}개 서버로 복사`}
      </button>}
      {collisionCount > 0 && <span className="ml-3 text-amber-800">같은 ID의 브라우저 작품 {collisionCount}개는 자동 복사하지 않았어요. 먼저 백업을 확인해 주세요.</span>}
      {message && <span className="ml-3">{message}</span>}
    </div>}
    {children}
  </>;
}
