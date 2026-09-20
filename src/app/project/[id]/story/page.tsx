"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import SettingFields from "@/components/creation/SettingFields";
import { STORY_FIELDS } from "@/lib/creation";
import { mergeAiFields, textFields } from "@/lib/aiFill";
import { autofillPayload } from "@/lib/autofillContext";
import StageIntro from "@/components/creation/StageIntro";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import StepIndicator from "@/components/progress-tracker/StepIndicator";
import EmptyContentModal from "@/components/EmptyContentModal";
import MobileChatSheet, { type MobileChatSheetHandle } from "@/components/mobile/MobileChatSheet";
import MobileStepBar from "@/components/MobileStepBar";
import { Save, ArrowRight, Sparkles, Check, Download, Wand2, RefreshCw } from "lucide-react";
import { getProject, updateProject, type Project, type ChatMessage } from "@/lib/storage";
import { downloadStory } from "@/lib/download";
import AiActivityBanner from "@/components/AiActivityBanner";

export default function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [story, setStory] = useState<Project["story"]>({ logline: "", theme: "", setting: "", plotOutline: "", totalEpisodes: "1" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [aiError, setAiError] = useState("");
  const [noIdeaChat, setNoIdeaChat] = useState(false);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const mobileChatRef = useRef<MobileChatSheetHandle>(null);

  useEffect(() => {
    const p = getProject(id);
    if (p) {
      const updated = { ...p, currentStep: Math.max(4, p.currentStep) };
      if (updated.currentStep !== p.currentStep) updateProject(id, { currentStep: updated.currentStep });
      setProject(updated);
      setStory(p.story);
    }
  }, [id]);

  const save = () => {
    setSaving(true);
    updateProject(id, {
      story: { ...story },
      currentStep: Math.max(4, project?.currentStep ?? 1),
    });
    setSaving(false); setSaved(true); setIsDirty(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const autofill = async () => {
    const p = getProject(id);
    if (!p) {
      setNoIdeaChat(true);
      setTimeout(() => setNoIdeaChat(false), 3000);
      return;
    }
    const before = textFields(story, ["logline", "theme", "setting", "plotOutline", "totalEpisodes", ...STORY_FIELDS.map(field => field.key)]);
    const replace = Boolean(story.logline.trim() || story.plotOutline.trim() || STORY_FIELDS.some(field => story[field.key]?.trim()));
    if (replace && !window.confirm("스토리 설정을 AI의 새 초안으로 바꿀까요? 요청 중 수정한 항목은 유지됩니다.")) return;
    setAutofilling(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(autofillPayload({ ...p, story }, "story")),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 초안 생성에 실패했어요.");
      if (data.logline !== undefined) {
        setStory(current => mergeAiFields(current, before, data, replace ? "replace" : "missing"));
        setIsDirty(true);
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI 초안 생성에 실패했어요.");
    } finally {
      setAutofilling(false);
    }
  };

  const handleNext = () => {
    const isEmpty = !story.logline && !story.plotOutline;
    if (isEmpty) {
      setShowEmptyModal(true);
    } else {
      save();
      router.push(`/project/${id}/script`);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F6]">
      <header className="bg-white border-b border-[#EBE7E0] px-6 py-3.5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-[#ADA8A0] hover:text-[#7A7067] transition-colors flex-shrink-0">
              <Sparkles className="w-3 h-3 text-[#7C3AED]" /> 대시보드
            </Link>
            <span className="text-[#EBE7E0]">/</span>
            <span className="text-xs font-semibold text-[#1A1A1A] truncate">{project?.title ?? "..."}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {project && (
              <button
                onClick={() => downloadStory({ ...project, story })}
                className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] transition-all duration-200"
              >
                <Download className="w-3.5 h-3.5" /> 다운로드
              </button>
            )}
            <button
              onClick={autofill}
              disabled={autofilling}
              className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] transition-all duration-200 disabled:opacity-50"
            >
              {autofilling ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{autofilling ? "스토리 작성 중" : "AI 자동채우기"}</span>
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all duration-300 disabled:opacity-50"
            >
              {saved ? <><Check className="w-3.5 h-3.5" /> 저장됨</> : saving ? "저장 중..." : <><Save className="w-3.5 h-3.5" /> 저장</>}
            </button>
          </div>
        </div>
      </header>

      <MobileStepBar currentStep={project?.currentStep ?? 1} activeStep={4} projectId={id} isDirty={isDirty} />

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-5">
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-[#EBE7E0] p-4 sticky top-20 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <StepIndicator currentStep={project?.currentStep ?? 1} activeStep={4} projectId={id} isDirty={isDirty} />
          </div>
        </aside>

        <main className="flex-1 min-w-0 space-y-4">
          <StageIntro stage="story" />
          {aiError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{aiError}</p>}
          <div className="mb-2">
            <p className="text-[10px] font-medium text-[#7C3AED] uppercase tracking-widest mb-1">Step 04</p>
            <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">스토리 구성</h1>
          </div>

          <AiActivityBanner
            active={autofilling}
            title="AI가 스토리를 구성하고 있어요"
            messages={["아이디어 대화를 읽고 핵심 소재를 찾고 있어요.", "로그라인과 주제를 정리하고 있어요.", "세계관과 전체 줄거리를 연결하고 있어요.", "작성한 내용을 입력란에 반영할 준비를 하고 있어요."]}
          />

          {noIdeaChat && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
              <span className="text-xs text-orange-600">작품을 불러오지 못했어요. 대시보드에서 다시 열어 주세요.</span>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#EBE7E0] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <label className="block text-xs font-bold text-[#1A1A1A] mb-1">한 줄 소개 (로그라인)</label>
            <p className="text-xs text-[#ADA8A0] mb-3">독자가 읽었을 때 이야기가 궁금해지는 한 문장</p>
            <Input placeholder="예: 마법을 잃은 마법사가 평범한 고등학생이 되어 사건을 해결하는 이야기" value={story.logline} onChange={(e) => { setStory((s) => ({ ...s, logline: e.target.value })); setIsDirty(true); }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-[#EBE7E0] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <label className="block text-xs font-bold text-[#1A1A1A] mb-1">주제 / 메시지</label>
              <p className="text-xs text-[#ADA8A0] mb-3">독자에게 전달하고 싶은 메시지</p>
              <Textarea placeholder="이 웹툰으로 독자에게 전달하고 싶은 메시지는 무엇인가요?" value={story.theme} onChange={(e) => { setStory((s) => ({ ...s, theme: e.target.value })); setIsDirty(true); }} rows={4} />
            </div>
            <div className="bg-white rounded-2xl border border-[#EBE7E0] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <label className="block text-xs font-bold text-[#1A1A1A] mb-1">배경 / 세계관</label>
              <p className="text-xs text-[#ADA8A0] mb-3">이야기가 펼쳐지는 시간과 공간</p>
              <Textarea placeholder="배경 설정을 설명해주세요" value={story.setting} onChange={(e) => { setStory((s) => ({ ...s, setting: e.target.value })); setIsDirty(true); }} rows={4} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#EBE7E0] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <label className="block text-xs font-bold text-[#1A1A1A] mb-1">전체 줄거리 요약</label>
            <p className="text-xs text-[#ADA8A0] mb-3">아래 다섯 단계 설계를 바탕으로 전체 이야기를 연결해요</p>
            <Textarea
              placeholder="일상 → 사건 → 문제 확대 → 가장 큰 선택 → 결과와 변화"
              value={story.plotOutline}
              onChange={(e) => { setStory((s) => ({ ...s, plotOutline: e.target.value })); setIsDirty(true); }}
              rows={10}
            />
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#EBE7E0]">
              <label className="text-xs font-semibold text-[#1A1A1A] whitespace-nowrap">총 화 수</label>
              <Input type="number" min="1" max="100" value={story.totalEpisodes} onChange={(e) => { setStory((s) => ({ ...s, totalEpisodes: e.target.value })); setIsDirty(true); }} className="w-20" />
              <span className="text-xs text-[#ADA8A0]">화</span>
            </div>
          </div>

          <section className="rounded-2xl border border-[#EBE7E0] bg-white p-5"><h2 className="mb-4 text-sm font-bold">갈등과 다섯 단계 이야기</h2><SettingFields fields={STORY_FIELDS} values={story} onChange={(key, value) => { setStory(current => ({ ...current, [key]: value })); setIsDirty(true); }} /></section>
          <div className="flex justify-end gap-3">
            <button onClick={save} disabled={saving} className="text-xs font-medium px-4 py-2.5 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] transition-all duration-200 disabled:opacity-50">
              저장
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all duration-300"
            >
              다음: 회차 · 대본 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </main>

      </div>

      {showEmptyModal && (
        <EmptyContentModal
          title="스토리 구성이 비어있어요"
          description="아이디어 발굴 대화 내용을 바탕으로 AI가 로그라인, 주제, 배경, 줄거리를 자동으로 채워드릴 수 있어요."
          onAutofill={() => { setShowEmptyModal(false); autofill(); }}
          onAskMentor={() => { setShowEmptyModal(false); mobileChatRef.current?.openAndFocus(); }}
          onGoAnyway={() => { setShowEmptyModal(false); router.push(`/project/${id}/script`); }}
          onClose={() => setShowEmptyModal(false)}
          autofilling={autofilling}
        />
      )}

      <MobileChatSheet
        ref={mobileChatRef}
        step="story"
        initialMessage="안녕하세요! 스토리 구성을 도와드릴게요. 어떤 이야기를 만들고 싶으신가요?"
        placeholder="스토리에 대해 질문하세요..."
        initialMessages={project?.storyChat}
        onMessagesChange={(msgs) => updateProject(id, { storyChat: msgs as ChatMessage[] })}
      />
    </div>
  );
}
