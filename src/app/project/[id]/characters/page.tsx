"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AiChat from "@/components/ai-assistant/AiChat";
import StepIndicator from "@/components/progress-tracker/StepIndicator";
import EmptyContentModal from "@/components/EmptyContentModal";
import MobileChatSheet, { type MobileChatSheetHandle } from "@/components/mobile/MobileChatSheet";
import MobileStepBar from "@/components/MobileStepBar";
import { Plus, Trash2, ArrowRight, Check, Save, Sparkles, User, Download, Wand2 } from "lucide-react";
import { getProject, updateProject, type Character, type Project, type ChatMessage } from "@/lib/storage";
import { downloadCharacters } from "@/lib/download";

const ROLES = ["주인공", "조력자", "악당(빌런)", "조연", "기타"];

export default function CharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [noIdeaChat, setNoIdeaChat] = useState(false);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const mobileChatRef = useRef<MobileChatSheetHandle>(null);

  useEffect(() => {
    const p = getProject(id);
    if (p) {
      const updated = { ...p, currentStep: Math.max(3, p.currentStep) };
      if (updated.currentStep !== p.currentStep) updateProject(id, { currentStep: updated.currentStep });
      setProject(updated);
      if (p.characters.length > 0) setCharacters(p.characters);
    }
  }, [id]);

  const addCharacter = () => {
    const newChar: Character = { name: "", role: "주인공", age: "", appearance: "", personality: "", backstory: "" };
    setCharacters((c) => [...c, newChar]);
    setEditIdx(characters.length);
    setIsDirty(true);
  };

  const updateChar = (idx: number, field: keyof Character, value: string) => {
    setCharacters((c) => c.map((ch, i) => (i === idx ? { ...ch, [field]: value } : ch)));
    setIsDirty(true);
  };

  const removeChar = (idx: number) => {
    setCharacters((c) => c.filter((_, i) => i !== idx));
    if (editIdx === idx) setEditIdx(null);
    setIsDirty(true);
  };

  const save = () => {
    setSaving(true);
    updateProject(id, {
      characters,
      currentStep: Math.max(3, project?.currentStep ?? 1),
    });
    setSaving(false);
    setSaved(true);
    setIsDirty(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const autofill = async () => {
    const p = getProject(id);
    if (!p?.ideaChat || p.ideaChat.length === 0) {
      setNoIdeaChat(true);
      setTimeout(() => setNoIdeaChat(false), 3000);
      return;
    }
    setAutofilling(true);
    try {
      const res = await fetch("/api/ai/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ideaChat: p.ideaChat, step: "character" }),
      });
      const data = await res.json();
      if (Array.isArray(data.characters) && data.characters.length > 0) {
        setCharacters(data.characters);
        setEditIdx(null);
        setIsDirty(true);
      }
    } finally {
      setAutofilling(false);
    }
  };

  const handleNext = () => {
    if (characters.length === 0) {
      setShowEmptyModal(true);
    } else {
      save();
      router.push(`/project/${id}/episodes`);
    }
  };

  const selectClass =
    "flex h-10 w-full rounded-xl border border-[#EBE7E0] bg-white px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]/40 transition-all duration-200";

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
              <button
                onClick={() => downloadCharacters({ ...project, characters })}
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
              <Wand2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{autofilling ? "채우는 중..." : "AI 자동채우기"}</span>
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

      <MobileStepBar currentStep={project?.currentStep ?? 1} activeStep={3} projectId={id} isDirty={isDirty} />

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-5">
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-[#EBE7E0] p-4 sticky top-20 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <StepIndicator currentStep={project?.currentStep ?? 1} activeStep={3} projectId={id} isDirty={isDirty} />
          </div>
        </aside>

        <main className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] font-medium text-[#7C3AED] uppercase tracking-widest mb-1">Step 03</p>
              <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">캐릭터 설계</h1>
            </div>
            <button
              onClick={addCharacter}
              className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] hover:border-[#7C3AED]/30 transition-all duration-200"
            >
              <Plus className="w-3.5 h-3.5" /> 캐릭터 추가
            </button>
          </div>

          {noIdeaChat && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
              <span className="text-xs text-orange-600">먼저 1단계 아이디어 발굴에서 AI와 대화해주세요</span>
            </div>
          )}

          {characters.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-[#EBE7E0]">
              <div className="w-12 h-12 rounded-2xl bg-[#F4F1EC] flex items-center justify-center mx-auto mb-4">
                <User className="w-5 h-5 text-[#ADA8A0]" />
              </div>
              <p className="text-sm font-semibold text-[#1A1A1A] mb-1">아직 캐릭터가 없어요</p>
              <p className="text-xs text-[#7A7067] mb-5">첫 번째 캐릭터를 추가해봐요!</p>
              <button
                onClick={addCharacter}
                className="inline-flex items-center gap-2 bg-[#7C3AED] text-white text-xs font-medium px-5 py-2.5 rounded-full hover:bg-[#6D28D9] transition-all duration-300"
              >
                <Plus className="w-3.5 h-3.5" /> 캐릭터 추가하기
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {characters.map((ch, idx) => (
                <div
                  key={idx}
                  className={`bg-white rounded-2xl border transition-all duration-200 shadow-[0_2px_12px_rgba(0,0,0,0.04)] ${
                    editIdx === idx ? "border-[#7C3AED]/30" : "border-[#EBE7E0]"
                  }`}
                >
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {ch.role === "주인공" ? "🦸" : ch.role === "악당(빌런)" ? "😈" : "👤"}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-[#1A1A1A]">{ch.name || "이름 없음"}</p>
                        <p className="text-xs text-[#ADA8A0]">{ch.role}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditIdx(editIdx === idx ? null : idx)}
                        className="text-xs text-[#7A7067] hover:text-[#1A1A1A] px-3 py-1.5 rounded-lg border border-[#EBE7E0] hover:bg-[#F4F1EC] transition-all duration-200"
                      >
                        {editIdx === idx ? "접기" : "편집"}
                      </button>
                      <button
                        onClick={() => removeChar(idx)}
                        className="p-1.5 rounded-lg border border-[#EBE7E0] hover:bg-red-50 hover:border-red-200 transition-all duration-200"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-[#ADA8A0] hover:text-red-400" />
                      </button>
                    </div>
                  </div>

                  {editIdx === idx && (
                    <div className="px-5 pb-5 space-y-3 border-t border-[#EBE7E0] pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">이름 *</label>
                          <Input
                            value={ch.name}
                            onChange={(e) => updateChar(idx, "name", e.target.value)}
                            placeholder="캐릭터 이름"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">역할</label>
                          <select
                            value={ch.role}
                            onChange={(e) => updateChar(idx, "role", e.target.value)}
                            className={selectClass}
                          >
                            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">나이/학년</label>
                          <Input
                            value={ch.age}
                            onChange={(e) => updateChar(idx, "age", e.target.value)}
                            placeholder="예: 17세, 고2"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">외모 묘사</label>
                        <Textarea
                          value={ch.appearance}
                          onChange={(e) => updateChar(idx, "appearance", e.target.value)}
                          placeholder="머리카락 색, 키, 특징적인 외모 등을 자세히 써주세요"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">성격</label>
                        <Textarea
                          value={ch.personality}
                          onChange={(e) => updateChar(idx, "personality", e.target.value)}
                          placeholder="어떤 성격인가요? 장점과 단점 모두 적어주세요"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">배경 이야기</label>
                        <Textarea
                          value={ch.backstory}
                          onChange={(e) => updateChar(idx, "backstory", e.target.value)}
                          placeholder="캐릭터의 과거, 목표, 동기는 무엇인가요?"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="text-xs font-medium px-4 py-2.5 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] transition-all duration-200 disabled:opacity-50"
            >
              저장
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all duration-300"
            >
              다음: 콘티 & 대본 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </main>

        <aside className="hidden lg:block w-72 flex-shrink-0 h-[calc(100vh-5rem)] sticky top-20">
          <AiChat
            step="character"
            initialMessage="캐릭터 설계를 도와드릴게요! 어떤 캐릭터를 만들고 싶으신가요? 주인공의 이름과 역할부터 알려주세요!"
            placeholder="캐릭터에 대해 도움받고 싶은 것을 말씀해주세요..."
            initialMessages={project?.characterChat}
            onMessagesChange={(msgs) => updateProject(id, { characterChat: msgs as ChatMessage[] })}
          />
        </aside>
      </div>

      {showEmptyModal && (
        <EmptyContentModal
          title="캐릭터가 없어요"
          description="아이디어 발굴 대화 내용을 바탕으로 AI가 주인공 등 주요 캐릭터를 자동으로 만들어드릴 수 있어요."
          onAutofill={() => { setShowEmptyModal(false); autofill(); }}
          onAskMentor={() => { setShowEmptyModal(false); mobileChatRef.current?.openAndFocus(); }}
          onGoAnyway={() => { setShowEmptyModal(false); router.push(`/project/${id}/episodes`); }}
          onClose={() => setShowEmptyModal(false)}
          autofilling={autofilling}
        />
      )}

      <MobileChatSheet
        ref={mobileChatRef}
        step="character"
        initialMessage="캐릭터 설계를 도와드릴게요! 어떤 캐릭터를 만들고 싶으신가요? 주인공의 이름과 역할부터 알려주세요!"
        placeholder="캐릭터에 대해 도움받고 싶은 것을 말씀해주세요..."
        initialMessages={project?.characterChat}
        onMessagesChange={(msgs) => updateProject(id, { characterChat: msgs as ChatMessage[] })}
      />
    </div>
  );
}
