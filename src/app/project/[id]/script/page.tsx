"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import SettingFields from "@/components/creation/SettingFields";
import { EPISODE_FIELDS } from "@/lib/creation";
import { Input } from "@/components/ui/input";
import { autofillPayload } from "@/lib/autofillContext";
import StageIntro from "@/components/creation/StageIntro";
import { Textarea } from "@/components/ui/textarea";
import StepIndicator from "@/components/progress-tracker/StepIndicator";
import MobileChatSheet, { type MobileChatSheetHandle } from "@/components/mobile/MobileChatSheet";
import MobileStepBar from "@/components/MobileStepBar";
import { Save, ArrowRight, ArrowLeft, CheckCircle, Sparkles, Check, Download, FileText, Plus, ChevronDown, ChevronUp, Users, Wand2, Eye, PenLine, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { getProject, updateProject, type Episode, type Cut, type Project, type Character, type ChatMessage } from "@/lib/storage";
import { downloadEpisode, downloadAllEpisodes } from "@/lib/download";
import AiActivityBanner from "@/components/AiActivityBanner";

function CharacterPanel({ characters }: { characters: Character[] }) {
  const [open, setOpen] = useState(true);
  if (characters.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-[#EBE7E0] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F4F1EC] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-[#7C3AED]" />
          <span className="text-xs font-bold text-[#1A1A1A]">등장인물</span>
          <span className="text-[10px] text-[#ADA8A0]">{characters.length}명</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-[#ADA8A0]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#ADA8A0]" />}
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-2">
          {characters.map((ch, i) => (
            <div key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-xl bg-[#FBF9F6] border border-[#EBE7E0]">
              <div className="w-5 h-5 rounded-full bg-[#7C3AED]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[8px] font-bold text-[#7C3AED]">{(ch.name || "?")[0]}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#1A1A1A] leading-tight">{ch.name || "이름 없음"}</p>
                <p className="text-[10px] text-[#7A7067] leading-tight">{ch.role}{ch.age ? ` · ${ch.age}` : ""}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([
    { episodeNumber: 1, title: "", synopsis: "", cuts: [], script: "", isCompleted: false },
  ]);
  const [activeEp, setActiveEp] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [aiError, setAiError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [noIdeaChat, setNoIdeaChat] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const mobileChatRef = useRef<MobileChatSheetHandle>(null);

  useEffect(() => {
    const p = getProject(id);
    if (p) {
      const updatedStep = Math.max(5, p.currentStep);
      if (updatedStep !== p.currentStep) updateProject(id, { currentStep: updatedStep });
      setProject({ ...p, currentStep: updatedStep });
      if (p.episodes.length > 0) {
        setEpisodes(p.episodes.map((ep) => ({ ...ep, cuts: ep.cuts ?? [] })));
      }
    }
  }, [id]);

  const updateEp = (field: keyof Episode, value: string | boolean | Cut[]) => {
    setEpisodes((eps) => eps.map((ep, i) => (i === activeEp ? { ...ep, [field]: value } : ep)));
    setIsDirty(true);
  };

  const addEpisode = () => {
    const newEp: Episode = {
      episodeNumber: episodes.length + 1,
      title: "",
      synopsis: "",
      cuts: [],
      script: "",
      isCompleted: false,
    };
    setEpisodes((e) => [...e, newEp]);
    setActiveEp(episodes.length);
    setIsDirty(true);
  };

  const save = () => {
    setSaving(true);
    updateProject(id, {
      episodes,
      currentStep: Math.max(5, project?.currentStep ?? 1),
    });
    setSaving(false);
    setSaved(true);
    setIsDirty(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const autofill = async () => {
    const p = getProject(id);
    if (!p) {
      setNoIdeaChat(true);
      setTimeout(() => setNoIdeaChat(false), 3000);
      return;
    }
    const targetEpisodeIndex = activeEp;
    setAutofilling(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(autofillPayload({ ...p, episodes }, "script", episodes[activeEp])),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 초안 생성에 실패했어요.");
      if (data.script) {
        setEpisodes(current => current.map((episode, index) => index === targetEpisodeIndex ? { ...episode, script: episode.script ? `${episode.script}\n\n---\n\n${data.script}` : data.script } : episode));
        setIsDirty(true);
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI 초안 생성에 실패했어요.");
    } finally {
      setAutofilling(false);
    }
  };

  const ep = episodes[activeEp];
  const scriptText = ep?.script ?? "";
  const charCount = scriptText.length;
  const lineCount = scriptText ? scriptText.split("\n").length : 0;

  return (
    <div className="min-h-screen bg-[#FBF9F6]">
      <header className="bg-white border-b border-[#EBE7E0] px-6 py-3.5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-[#ADA8A0] hover:text-[#7A7067] transition-colors flex-shrink-0"
            >
              <Sparkles className="w-3 h-3 text-[#7C3AED]" /> 대시보드
            </Link>
            <span className="text-[#EBE7E0]">/</span>
            <span className="text-xs font-semibold text-[#1A1A1A] truncate">{project?.title ?? "..."}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {project && (
              <>
                <button
                  onClick={() => downloadEpisode({ ...project, episodes }, activeEp)}
                  className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] transition-all duration-200"
                >
                  <Download className="w-3.5 h-3.5" /> 이 화
                </button>
                <button
                  onClick={() => downloadAllEpisodes({ ...project, episodes })}
                  className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] transition-all duration-200"
                >
                  <Download className="w-3.5 h-3.5" /> 전체
                </button>
              </>
            )}
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

      <MobileStepBar currentStep={project?.currentStep ?? 1} activeStep={5} projectId={id} isDirty={isDirty} />

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-5">
        {/* Left sidebar */}
        <aside className="hidden lg:block w-52 flex-shrink-0 space-y-3 sticky top-20 self-start">
          <div className="bg-white rounded-2xl border border-[#EBE7E0] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <StepIndicator currentStep={project?.currentStep ?? 1} activeStep={5} projectId={id} isDirty={isDirty} />
          </div>

          <div className="bg-white rounded-2xl border border-[#EBE7E0] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[#1A1A1A]">화 목록</span>
              <button onClick={addEpisode} className="text-[#7C3AED] hover:text-[#6D28D9] transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {episodes.map((ep, i) => (
                <button
                  key={i}
                  onClick={() => setActiveEp(i)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all duration-200 ${
                    activeEp === i
                      ? "bg-[#7C3AED]/8 text-[#7C3AED] font-semibold border border-[#7C3AED]/20"
                      : "text-[#7A7067] hover:bg-[#F4F1EC]"
                  }`}
                >
                  <span>{ep.episodeNumber}화 {ep.title && `· ${ep.title.slice(0, 6)}`}</span>
                  {ep.isCompleted && <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 space-y-4">
          <StageIntro stage="script" />
          {aiError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{aiError}</p>}
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] font-medium text-[#7C3AED] uppercase tracking-widest mb-1">Step 05</p>
              <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">{ep?.episodeNumber}화 대본 작성</h1>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#7A7067] cursor-pointer">
              <input
                type="checkbox"
                checked={ep?.isCompleted ?? false}
                onChange={(e) => updateEp("isCompleted", e.target.checked)}
                className="rounded accent-[#7C3AED]"
              />
              대본 초안 완료
            </label>
          </div>

          <AiActivityBanner
            active={autofilling}
            title="AI가 대본을 작성하고 있어요"
            messages={["회차 줄거리와 등장인물을 확인하고 있어요.", "장면 순서와 감정 흐름을 구성하고 있어요.", "대사와 행동 지문을 작성하고 있어요.", "완성된 대본을 편집기에 반영하고 있어요."]}
          />

          {noIdeaChat && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
              <span className="text-xs text-orange-600">작품을 불러오지 못했어요. 대시보드에서 다시 열어 주세요.</span>
            </div>
          )}

          {/* 모바일 화 선택 탭 */}
          <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {episodes.map((ep, i) => (
              <button
                key={i}
                onClick={() => setActiveEp(i)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                  activeEp === i
                    ? "bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/30 font-semibold"
                    : "bg-white text-[#7A7067] border-[#EBE7E0] hover:bg-[#F4F1EC]"
                }`}
              >
                {ep.episodeNumber}화
                {ep.isCompleted && <CheckCircle className="w-3 h-3 text-green-500 ml-0.5" />}
              </button>
            ))}
            <button
              onClick={addEpisode}
              className="flex-shrink-0 w-7 h-7 rounded-full border border-dashed border-[#EBE7E0] flex items-center justify-center text-[#ADA8A0] hover:border-[#7C3AED]/40 hover:text-[#7C3AED] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <section className="rounded-2xl border border-[#EBE7E0] bg-white p-5 space-y-4">
            <h2 className="text-sm font-bold">대본 전에 정하는 회차 설계</h2>
            <label className="block text-xs font-semibold">회차 제목<Input className="mt-2" value={ep?.title ?? ""} onChange={event => updateEp("title", event.target.value)} /></label>
            <label className="block text-xs font-semibold">회차 시놉시스<Textarea className="mt-2" rows={4} value={ep?.synopsis ?? ""} onChange={event => updateEp("synopsis", event.target.value)} placeholder="시작 → 주요 사건 → 최고조 → 마지막 장면" /></label>
            <SettingFields fields={EPISODE_FIELDS} values={Object.fromEntries(EPISODE_FIELDS.map(field => [field.key, ep?.[field.key]]))} onChange={(key, value) => updateEp(key as keyof Episode, value)} />
          </section>
          {/* 화 정보 */}
          {ep?.title && (
            <div className="bg-[#F4F1EC] rounded-2xl border border-[#EBE7E0] px-5 py-3 flex items-center gap-3">
              <FileText className="w-4 h-4 text-[#7C3AED] flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#1A1A1A]">{ep.episodeNumber}화: {ep.title}</p>
                {ep.synopsis && <p className="text-[10px] text-[#7A7067] mt-0.5 line-clamp-1">{ep.synopsis}</p>}
              </div>
              <Link
                href={`/project/${id}/episodes`}
                className="ml-auto text-[10px] text-[#ADA8A0] hover:text-[#7C3AED] transition-colors whitespace-nowrap"
              >
                콘티 보기 →
              </Link>
            </div>
          )}

          {/* 대본 */}
          <div className="bg-white rounded-2xl border border-[#EBE7E0] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EBE7E0]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#7C3AED]" />
                <span className="text-sm font-bold text-[#1A1A1A]">대본</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-full border border-[#EBE7E0] overflow-hidden text-xs">
                  <button
                    onClick={() => setPreviewMode(false)}
                    className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${!previewMode ? "bg-[#7C3AED] text-white" : "text-[#7A7067] hover:bg-[#F4F1EC]"}`}
                  >
                    <PenLine className="w-3 h-3" /> 편집
                  </button>
                  <button
                    onClick={() => setPreviewMode(true)}
                    className={`flex items-center gap-1 px-3 py-1.5 transition-colors ${previewMode ? "bg-[#7C3AED] text-white" : "text-[#7A7067] hover:bg-[#F4F1EC]"}`}
                  >
                    <Eye className="w-3 h-3" /> 미리보기
                  </button>
                </div>
                <button
                  onClick={autofill}
                  disabled={autofilling}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] transition-all duration-200 disabled:opacity-50"
                >
                  {autofilling ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} {autofilling ? "대본 작성 중" : "AI 자동채우기"}
                </button>
              </div>
            </div>
            <div className="p-5">
              {previewMode ? (
                scriptText ? (
                  <div className="min-h-[400px] prose prose-sm max-w-none text-[#1A1A1A]
                    [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-5
                    [&_h2]:text-base [&_h2]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-[#7C3AED]
                    [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mb-1.5 [&_h3]:mt-3
                    [&_p]:text-xs [&_p]:leading-[1.9] [&_p]:mb-2
                    [&_strong]:font-semibold [&_strong]:text-[#1A1A1A]
                    [&_em]:italic [&_em]:text-[#5A5550]
                    [&_hr]:border-[#EBE7E0] [&_hr]:my-4
                    [&_blockquote]:border-l-2 [&_blockquote]:border-[#7C3AED] [&_blockquote]:pl-3 [&_blockquote]:text-[#7A7067] [&_blockquote]:italic [&_blockquote]:my-2
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-xs [&_ul]:leading-relaxed
                    [&_li]:mb-1
                    [&_pre]:bg-[#F4F1EC] [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:text-xs [&_pre]:font-mono [&_pre]:whitespace-pre-wrap [&_pre]:my-3
                    [&_code]:bg-[#F4F1EC] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-[#7C3AED]">
                    <ReactMarkdown>{scriptText}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="min-h-[400px] flex items-center justify-center text-xs text-[#ADA8A0]">
                    대본을 먼저 작성하면 여기서 미리볼 수 있어요
                  </div>
                )
              ) : (
                <>
                  <p className="text-xs text-[#ADA8A0] mb-3">장면 묘사, 대사, 효과음을 자유롭게 써봐요</p>
                  <Textarea
                    placeholder={`대본을 작성해주세요.\n\n예시:\n[장면1: 학교 복도, 낮]\n(주인공이 급하게 달려온다)\n주인공: "늦었어! 어떡해!"\n친구: (손을 흔들며) "여기야!"`}
                    value={scriptText}
                    onChange={(e) => updateEp("script", e.target.value)}
                    rows={26}
                    className="font-mono text-xs"
                  />
                  <div className="flex justify-end mt-2 gap-3 text-[10px] text-[#ADA8A0]">
                    <span>{lineCount}줄</span>
                    <span>{charCount.toLocaleString()}자</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <Link href={`/project/${id}/story`} onClick={event => { if (isDirty && !confirm("저장하지 않은 변경사항이 있어요. 이동하시겠어요?")) event.preventDefault(); }}>
              <button className="flex items-center gap-2 text-xs font-medium px-4 py-2.5 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] transition-all duration-200">
                <ArrowLeft className="w-3.5 h-3.5" /> 이전: 스토리 구조
              </button>
            </Link>
            <div className="flex gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="text-xs font-medium px-4 py-2.5 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] transition-all duration-200 disabled:opacity-50"
              >
                저장
              </button>
              <Link href={`/project/${id}/episodes`} onClick={save}>
                <button className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all duration-300">
                  다음: 콘티 · 작화 <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          </div>
        </main>

        <aside className="hidden lg:block w-72 flex-shrink-0 sticky top-20">
          <CharacterPanel characters={project?.characters ?? []} />
        </aside>
      </div>

      <MobileChatSheet
        ref={mobileChatRef}
        step="script"
        initialMessage="대본 작업을 도와드릴게요! 대사나 장면 묘사에 대해 도움이 필요하시면 말씀해 주세요!"
        placeholder="대본·대사에 대해 질문하세요..."
        initialMessages={project?.scriptChat}
        onMessagesChange={(msgs) => updateProject(id, { scriptChat: msgs as ChatMessage[] })}
      />
    </div>
  );
}
