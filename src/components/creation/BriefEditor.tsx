"use client";
import { useState } from "react";
import { updateProject, type Project } from "@/lib/storage";
import { DEFAULT_BRIEF } from "@/lib/creation";
import SettingFields from "./SettingFields";
export default function BriefEditor({ project }: { project: Project }) {
  const [brief, setBrief] = useState({ ...DEFAULT_BRIEF, ...project.brief });
  const [status, setStatus] = useState("");
  const change = (key: string, value: string) => {
    const next = { ...brief, [key]: value }; setBrief(next);
    try { updateProject(project.id, { brief: next }); setStatus("기획이 저장되었어요"); }
    catch { setStatus("저장하지 못했어요. 저장 공간을 확인해 주세요."); }
  };
  return <section className="rounded-2xl border border-[#EBE7E0] bg-white p-5 space-y-5">
    <div><h2 className="text-sm font-bold">나의 작품 기획 카드</h2><p className="mt-1 text-xs text-[#82798B]">떠오르는 것부터 적어요. 자동 저장되고 AI가 참고해요.</p></div>
    <div className="grid gap-4 sm:grid-cols-3">
      {([
        ["mode", "만드는 방식", [["together", "함께 만들기"], ["auto", "AI 초안부터"], ["manual", "직접 만들기"]]],
        ["format", "작품 형태", [["short", "완결 단편"], ["episode", "한 화 제작"], ["series", "여러 화 연재"]]],
      ] as const).map(([key, label, options]) => <label key={key} className="text-xs font-semibold">{label}
        <select value={brief[key]} onChange={e => change(key, e.target.value)} className="mt-2 block w-full rounded-xl border border-[#EBE7E0] bg-white p-3">{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
      </label>)}
      <label className="text-xs font-semibold">목표 컷 수<input type="number" min={4} max={100} value={brief.targetCuts} onChange={e => change("targetCuts", e.target.value)} onBlur={() => change("targetCuts", String(Math.min(100, Math.max(4, Number(brief.targetCuts) || 12))))} className="mt-2 block w-full rounded-xl border border-[#EBE7E0] p-3" /></label>
    </div>
    <p className="text-xs text-[#7C3AED]">{brief.mode === "manual" ? "직접 작성하고 AI에는 피드백을 요청해요." : brief.mode === "auto" ? "AI 초안을 요청한 뒤 내가 검토하고 저장해요." : "AI와 작은 결정 하나씩 주고받으며 만들어요."}</p>
    <SettingFields fields={[
      { key: "idea", label: "떠오르는 주인공이나 장면", hint: "예: 사물함에서 내일의 일기를 발견한 학생" },
      { key: "tone", label: "작품 분위기", hint: "따뜻한 / 코믹한 / 신비로운 / 어둡지만 희망적인" },
      { key: "feeling", label: "독자가 느꼈으면 하는 감정", hint: "웃음, 긴장, 뭉클함, 안도감…" },
      { key: "audience", label: "누구에게 보여주고 싶나요?", hint: "실명 대신 친구들, 또래 독자처럼 적어요." },
      { key: "purpose", label: "이번 작품의 목표", hint: "재미로 / 첫 작품 완성 / 학교 프로젝트 / 공모전" },
      { key: "mustKeep", label: "꼭 지키고 싶은 아이디어", hint: "AI가 바꾸지 않았으면 하는 장면·관계·결말" },
    ]} values={brief} onChange={change} />
    <p role="status" className="text-xs text-[#82798B]">{status}</p>
  </section>;
}
