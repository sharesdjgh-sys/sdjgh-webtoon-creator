"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import { Monitor, MousePointer2 } from "lucide-react";
import "./desktop-access.css";

// Editing requires a wide workspace and a primary mouse/trackpad.
const BLOCKED_QUERY = "(max-width: 1023px), (hover: none) and (pointer: coarse)";
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
    <main className="desktop-access-screen" aria-label="PC 전용 서비스 안내">
      <div className="desktop-access-card">
        <span className="desktop-access-brand">웹툰 메이커 AI</span>
        <div className="desktop-access-icon"><Monitor size={36} strokeWidth={1.5} /></div>
        <p className="desktop-access-kicker">PC 전용 창작 작업실</p>
        <h1>웹툰 만들기는<br />PC에서 이어가세요.</h1>
        <p>대본과 콘티를 나란히 보고, 그림과 말풍선을 편집할 수 있도록 PC 환경에서 제공하는 서비스예요.</p>
        <div className="desktop-access-tip"><MousePointer2 size={18} /><span>컴퓨터에서 접속하고 브라우저 창을<br />가로 1,024px 이상으로 넓혀 주세요.</span></div>
        <p className="desktop-access-note">모바일에서는 제작 기능을 이용할 수 없어요.<br />작품은 작성한 브라우저에 저장되므로, 기존 작업을 이어갈 때는 같은 PC와 브라우저를 사용해 주세요.</p>
      </div>
    </main>
  </>;
}
