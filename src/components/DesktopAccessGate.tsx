"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { Monitor, Tablet } from "lucide-react";
import "./desktop-access.css";

// Tablet touch input is supported; only narrow viewports need a wider layout.
const BLOCKED_QUERY = "(max-width: 639px)";
function subscribe(onChange: () => void) {
  const query = window.matchMedia(BLOCKED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function getSnapshot() { return window.matchMedia(BLOCKED_QUERY).matches; }
function getServerSnapshot() { return false; }

export default function DesktopAccessGate({ children }: { children: ReactNode }) {
  const blocked = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return <>
    <div className="desktop-app">{blocked ? null : children}</div>
    <main className="desktop-access-screen" aria-label="작은 화면 안내">
      <div className="desktop-access-card">
        <span className="desktop-access-brand">웹툰 메이커 AI</span>
        <div className="desktop-access-icon"><Monitor size={36} strokeWidth={1.5} /></div>
        <p className="desktop-access-kicker">PC·태블릿 창작 작업실</p>
        <h1>화면을 넓혀<br />웹툰을 만들어 보세요.</h1>
        <p>대본과 콘티, 그림과 말풍선을 편집하려면 화면 너비가 더 필요해요.</p>
        <div className="desktop-access-tip"><Tablet size={18} /><span>태블릿은 가로 방향으로 돌리거나<br />브라우저 화면을 640px 이상으로 넓혀 주세요.</span></div>
        <p className="desktop-access-note">작품은 사용 중인 브라우저에 저장돼요. 스마트 캠퍼스 안과 새 탭은 저장 공간이 분리될 수 있으니 이동할 때는 내보내기·가져오기를 이용해 주세요.</p>
      </div>
    </main>
  </>;
}
