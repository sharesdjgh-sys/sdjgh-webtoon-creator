"use client";

import { projectHref } from "@/lib/storage";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { autofillPayload } from "@/lib/autofillContext";
import AiFillButton from "@/components/creation/AiFillButton";
import { mergeAiFields } from "@/lib/aiFill";
import { getProject, updateProject, type Project } from "@/lib/storage";
import { DEFAULT_WORLD } from "@/lib/creation";
import StepIndicator from "@/components/progress-tracker/StepIndicator";
import MobileStepBar from "@/components/MobileStepBar";
import MobileChatSheet from "@/components/mobile/MobileChatSheet";
import StageIntro from "@/components/creation/StageIntro";
import SettingFields from "@/components/creation/SettingFields";
export default function WorldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [world, setWorld] = useState(DEFAULT_WORLD);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const p = getProject(id);
      if (p) { setProject(p); setWorld(p.world); updateProject(id, { currentStep: Math.max(3, p.currentStep) }); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);
  const save = () => {
    if (!project) return false;
    try { updateProject(id, { world }); setDirty(false); setStatus("설정집을 저장했어요"); return true; }
    catch { setStatus("저장하지 못했어요. 저장 공간을 확인해 주세요."); return false; }
  };
  const change = (key: string, value: string) => { setWorld(current => ({ ...current, [key]: value })); setDirty(true); };
  return <div className="min-h-screen bg-[#FBF9F6]">
    <header className="sticky top-0 z-40 border-b border-[#EBE7E0] bg-white px-6 py-4"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4"><Link href="/dashboard" className="text-xs text-[#82798B]">← 내 작품</Link><span className="truncate text-sm font-semibold">{project?.title ?? "작품 불러오는 중"}</span><button onClick={save} disabled={!project} className="rounded-full bg-[#7C3AED] px-5 py-2 text-xs font-bold text-white">저장</button></div></header>
    <MobileStepBar currentStep={project?.currentStep ?? 3} activeStep={3} projectId={id} isDirty={dirty} />
    <div className="mx-auto flex max-w-7xl gap-5 px-4 py-6">
      <aside className="hidden w-52 shrink-0 lg:block"><div className="sticky top-20 rounded-2xl border border-[#EBE7E0] bg-white p-4"><StepIndicator currentStep={project?.currentStep ?? 3} activeStep={3} projectId={id} isDirty={dirty} /></div></aside>
      <main className="min-w-0 flex-1 space-y-5">
        <div><p className="text-xs text-[#7C3AED]">Step 03</p><h1 className="mt-1 text-xl font-bold">세계관 · 설정집</h1></div>
        <StageIntro stage="world" />
        <section className="space-y-3 rounded-2xl border border-[#DCCCF5] bg-[#FAF8FF] p-5">
          <h2 className="text-sm font-bold">아이디어로 세계관 AI 채우기</h2>
          <p className="text-xs leading-6 text-[#82798B]">기획만 있어도 시대·장소·규칙·소품·복선의 초안을 만들어요. 직접 확정한 설정은 바꾸지 않으며, 생성 후 자유롭게 수정하고 저장할 수 있어요.</p>
          <AiFillButton label="세계관 AI 채우기" resultKey="world" disabled={!project}
            getSnapshot={() => {
              const latest = getProject(id);
              if (!latest) throw new Error("작품을 다시 열어 주세요.");
              return { fields: Object.fromEntries(Object.entries(world).filter(([key]) => key !== "confirmed")), payload: autofillPayload({ ...latest, world }, "world") };
            }}
            onApply={(draft, before, mode) => { setWorld(current => mergeAiFields(current, before, draft, mode)); setDirty(true); setStatus("AI 초안을 채웠어요. 검토 후 저장해 주세요."); }} />
        </section>
        {project?.story.setting && <div className="rounded-xl border border-[#EBE7E0] p-4 text-xs"><p className="mb-2 font-bold">기존 배경 설정</p><p className="whitespace-pre-wrap leading-6">{project.story.setting}</p></div>}
        <section className="rounded-2xl border border-[#EBE7E0] bg-white p-5"><h2 className="mb-4 text-sm font-bold">세계의 기본 규칙</h2><SettingFields values={world} onChange={change} fields={[
          { key: "era", label: "시간과 시대", hint: "현대, 가까운 미래, 계절과 시간대" },
          { key: "mainLocation", label: "주요 무대", hint: "가상의 학교나 마을 이름" },
          { key: "possible", label: "가능한 것", hint: "능력이나 특별한 현상" },
          { key: "forbidden", label: "불가능한 것 / 금지 규칙", hint: "능력의 한계와 지켜야 하는 규칙" },
          { key: "cost", label: "대가와 결과", hint: "능력을 쓰거나 규칙을 어기면 생기는 일" },
          { key: "locations", label: "반복 등장 장소", hint: "장소별 창문·문·가구 위치와 대표 색" },
          { key: "props", label: "중요한 물건", hint: "생김새, 소유자, 현재 위치와 역할" },
        ]} /></section>
        <section className="rounded-2xl border border-[#EBE7E0] bg-white p-5"><h2 className="mb-2 text-sm font-bold">작품의 기억</h2><p className="mb-4 text-xs leading-6 text-[#82798B]">AI가 기본 설정의 초안을 채워줘요. 검토가 필요한 후보는 미정에, 내가 검토한 사실만 확정 설정에 기록해요. 회차가 바뀌면 물건·관계·알게 된 정보도 갱신해요.</p><SettingFields values={world} onChange={change} fields={[
          { key: "confirmed", label: "내가 확정한 설정", hint: "예: 1화에서 민서는 아직 일기장의 비밀을 모른다." },
          { key: "undecided", label: "미정 / AI 제안 후보", hint: "아직 고르지 않은 이름·관계·반전" },
          { key: "foreshadowing", label: "복선 기록", hint: "단서 / 심은 회차 / 회수할 회차 / 계획·등장·회수 상태" },
        ]} /></section>
        <div className="flex items-center justify-between gap-4"><p role="status" className="text-xs text-[#82798B]">{status || (dirty ? "저장하지 않은 변경사항이 있어요." : "")}</p><Link href={projectHref(id, "story")} onClick={event => { if (!save()) event.preventDefault(); }} className="rounded-full bg-[#7C3AED] px-5 py-3 text-xs font-bold text-white">저장하고 스토리 구조로 →</Link></div>
      </main>
    </div>
    {project && <MobileChatSheet step="story" initialMessage="세계관을 함께 정해요. 이 세계에서 가능한 특별한 일은 무엇인가요?" initialMessages={project.worldChat} onMessagesChange={worldChat => updateProject(id, { worldChat })} />}
  </div>;
}
