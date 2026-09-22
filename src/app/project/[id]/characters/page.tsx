"use client";

import { projectHref } from "@/lib/storage";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import AiFillButton from "@/components/creation/AiFillButton";
import { mergeAiFields } from "@/lib/aiFill";
import SettingFields from "@/components/creation/SettingFields";
import { CHARACTER_STORY_FIELDS } from "@/lib/creation";
import { autofillPayload } from "@/lib/autofillContext";
import StageIntro from "@/components/creation/StageIntro";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import StepIndicator from "@/components/progress-tracker/StepIndicator";
import EmptyContentModal from "@/components/EmptyContentModal";
import MobileChatSheet, { type MobileChatSheetHandle } from "@/components/mobile/MobileChatSheet";
import MobileStepBar from "@/components/MobileStepBar";
import { Plus, Trash2, ArrowRight, Check, Save, Sparkles, User, Download, Wand2, ImageIcon, RefreshCw, X } from "lucide-react";
import { createCharacter, getProject, updateProject, type Character, type CharacterVisualProfile, type Project, type ChatMessage } from "@/lib/storage";
import { downloadCharacters } from "@/lib/download";
import ArtDirectionEditor from "@/components/visual/ArtDirectionEditor";
import StoredImage, { BlobImage } from "@/components/visual/StoredImage";
import ImageLightbox, { type LightboxImage } from "@/components/visual/ImageLightbox";
import { characterSheetHash, requestCharacterSheet, type CharacterSheetProgressStage } from "@/lib/visualClient";
import { deleteMediaAsset, deleteMediaByOwner, downloadBlob, getMediaAsset, saveMediaAsset } from "@/lib/mediaStorage";

const ROLES = ["주인공", "조력자", "악당(빌런)", "조연", "기타"];

const VISUAL_PROFILE_FIELDS: Array<{ key: keyof CharacterVisualProfile; label: string; placeholder: string }> = [
  { key: "gender", label: "성별 / 젠더 표현", placeholder: "예: 여성, 중성적인 표현" },
  { key: "heightBuild", label: "키와 체형", placeholder: "예: 178cm, 마른 근육질" },
  { key: "faceShape", label: "얼굴형", placeholder: "예: 계란형, 날렵한 턱선" },
  { key: "eyes", label: "눈", placeholder: "예: 긴 고양이상 눈매, 회청색" },
  { key: "noseMouth", label: "코와 입", placeholder: "예: 곧은 코, 얇고 선명한 입술" },
  { key: "skinTone", label: "피부톤", placeholder: "예: 밝은 뉴트럴 베이지" },
  { key: "hair", label: "헤어스타일", placeholder: "길이, 앞머리, 질감, 색상" },
  { key: "distinctiveFeatures", label: "대표 외형 특징", placeholder: "점, 흉터, 피어싱, 안경 등" },
  { key: "outfit", label: "기본 의상", placeholder: "레이어, 길이, 소재, 색상을 상세히" },
  { key: "shoes", label: "신발", placeholder: "예: 검은 하이탑 운동화, 흰 밑창" },
  { key: "accessories", label: "액세서리 / 소품", placeholder: "목걸이, 귀걸이, 가방, 무기 등" },
  { key: "colorPalette", label: "대표 색상 팔레트", placeholder: "예: 네이비, 아이보리, 버건디, 은색" },
];

type GenerationProgress = {
  stage: CharacterSheetProgressStage | "saving";
  startedAt: number;
  elapsedSeconds: number;
};

type AutofillProgress = {
  stage: "requesting" | "applying";
  startedAt: number;
  elapsedSeconds: number;
};

const INTERACTIVE_BUTTON = "transform-gpu transition-all duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:active:scale-100";

function AutofillStatus({ progress }: { progress: AutofillProgress }) {
  const applying = progress.stage === "applying";
  return (
    <div aria-live="polite" className="relative overflow-hidden rounded-xl border border-[#DDD6FE] bg-gradient-to-r from-[#F5F3FF] to-white px-4 py-3">
      <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-[#EDE9FE]">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-[#7C3AED]" />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
          {applying ? <Check className="h-4 w-4 text-[#7C3AED]" /> : <RefreshCw className="h-4 w-4 animate-spin text-[#7C3AED]" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-[#1A1A1A]">{applying ? "AI 응답 적용 중" : "AI 자동채우기 요청 중"}</p>
            <span className="tabular-nums text-[10px] font-medium text-[#7C3AED]">{progress.elapsedSeconds}초 경과</span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#7A7067]">
            {applying ? "받아온 캐릭터 정보를 입력란에 정리하고 있습니다." : "아이디어 대화를 바탕으로 캐릭터 정보 생성을 요청했습니다. 응답을 기다리고 있습니다."}
          </p>
        </div>
      </div>
    </div>
  );
}

function CharacterSheetGenerationStatus({ progress }: { progress: GenerationProgress }) {
  const { stage, elapsedSeconds } = progress;
  const message = stage === "receiving"
    ? "생성된 이미지를 안전하게 받아오는 중입니다."
    : stage === "saving"
      ? "결과를 브라우저에 저장하고 미리보기를 준비하고 있습니다."
      : elapsedSeconds < 10
        ? "캐릭터 설정과 시트 구성을 Gemini에 전달했습니다."
        : elapsedSeconds < 45
          ? "Gemini가 포즈·표정·의상 디테일이 포함된 고해상도 시트를 생성하고 있습니다."
          : elapsedSeconds < 90
            ? "구성 요소가 많은 고해상도 시트라 생성 응답을 기다리고 있습니다."
            : "Gemini에서 계속 생성 중입니다. 창을 닫지 말고 조금만 더 기다려주세요.";
  const activeStep = stage === "generating" ? 1 : stage === "receiving" ? 2 : 3;
  const steps = ["요청 준비", "Gemini 생성", "결과 수신", "미리보기"];

  return (
    <div aria-live="polite" className="mb-3 rounded-xl border border-[#C4B5FD] bg-white p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#7C3AED]/10">
          <RefreshCw className="h-4 w-4 animate-spin text-[#7C3AED]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-[#1A1A1A]">캐릭터 시트 생성 중</p>
            <span className="tabular-nums text-[10px] font-medium text-[#7C3AED]">{elapsedSeconds}초 경과</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#7A7067]">{message}</p>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {steps.map((label, index) => {
              const completed = index < activeStep;
              const active = index === activeStep;
              return (
                <div key={label} className="min-w-0">
                  <div className={`h-1 rounded-full ${completed ? "bg-[#7C3AED]" : active ? "animate-pulse bg-[#A78BFA]" : "bg-[#EDE9FE]"}`} />
                  <p className={`mt-1 truncate text-[9px] ${active || completed ? "text-[#6D28D9]" : "text-[#ADA8A0]"}`}>{label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [autofillProgress, setAutofillProgress] = useState<AutofillProgress | null>(null);
  const [noIdeaChat, setNoIdeaChat] = useState(false);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [generationProgress, setGenerationProgress] = useState<Record<string, GenerationProgress>>({});
  const [candidateSheets, setCandidateSheets] = useState<Record<string, { blob: Blob; sourceHash: string }>>({});
  const [visualError, setVisualError] = useState("");
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);
  const mobileChatRef = useRef<MobileChatSheetHandle>(null);
  const autofillStartedAt = autofillProgress?.startedAt;

  useEffect(() => {
    const p = getProject(id);
    if (p) {
      const updated = { ...p, currentStep: Math.max(2, p.currentStep) };
      if (updated.currentStep !== p.currentStep) updateProject(id, { currentStep: updated.currentStep });
      setProject(updated);
      if (p.characters.length > 0) setCharacters(p.characters);
    }
  }, [id]);

  useEffect(() => {
    if (generatingIds.size === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setGenerationProgress((current) => Object.fromEntries(
        Object.entries(current).map(([characterId, progress]) => [characterId, {
          ...progress,
          elapsedSeconds: Math.floor((now - progress.startedAt) / 1000),
        }]),
      ));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [generatingIds.size]);

  useEffect(() => {
    if (!autofillStartedAt) return;
    const timer = window.setInterval(() => {
      setAutofillProgress((current) => current ? {
        ...current,
        elapsedSeconds: Math.floor((Date.now() - current.startedAt) / 1000),
      } : null);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [autofillStartedAt]);

  const addCharacter = () => {
    const newChar = createCharacter();
    setCharacters((c) => [...c, newChar]);
    setEditIdx(characters.length);
    setIsDirty(true);
  };

  const updateChar = (idx: number, field: keyof Character, value: string) => {
    setCharacters((c) => c.map((ch, i) => (i === idx ? { ...ch, [field]: value } : ch)));
    setIsDirty(true);
  };

  const updateVisualProfile = (idx: number, field: keyof CharacterVisualProfile, value: string) => {
    setCharacters((current) => current.map((character, characterIndex) => characterIndex === idx
      ? { ...character, visualProfile: { ...character.visualProfile, [field]: value } }
      : character));
    setIsDirty(true);
  };

  const removeChar = (idx: number) => {
    const removed = characters[idx];
    setCharacters((current) => {
      const next = current.filter((_, i) => i !== idx);
      updateProject(id, { characters: next });
      return next;
    });
    if (removed) deleteMediaByOwner(removed.id).catch(() => {});
    if (editIdx === idx) setEditIdx(null);
    setIsDirty(true);
  };

  const save = () => {
    setSaving(true);
    updateProject(id, {
      characters,
      artDirection: project?.artDirection,
      currentStep: Math.max(2, project?.currentStep ?? 1),
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
    setAutofilling(true);
    setAutofillProgress({ stage: "requesting", startedAt: Date.now(), elapsedSeconds: 0 });
    setVisualError("");
    try {
      const res = await fetch("/api/ai/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(autofillPayload({ ...p, characters, artDirection: project?.artDirection ?? p.artDirection }, "character")),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 자동채우기 요청에 실패했습니다.");
      setAutofillProgress((current) => current ? { ...current, stage: "applying" } : current);
      if (Array.isArray(data.characters) && data.characters.length > 0) {
        setCharacters(current => [...current, ...data.characters.map((character: Partial<Character>) => createCharacter(character))]);
        setEditIdx(null);
        setIsDirty(true);
      }
    } catch (error) {
      setVisualError(error instanceof Error ? error.message : "AI 자동채우기에 실패했습니다.");
    } finally {
      setAutofilling(false);
      setAutofillProgress(null);
    }
  };

  const setGenerating = (characterId: string, active: boolean) => {
    setGeneratingIds((current) => {
      const next = new Set(current);
      if (active) next.add(characterId); else next.delete(characterId);
      return next;
    });
    setGenerationProgress((current) => {
      if (active) {
        return { ...current, [characterId]: { stage: "generating", startedAt: Date.now(), elapsedSeconds: 0 } };
      }
      const next = { ...current };
      delete next[characterId];
      return next;
    });
  };

  const setGenerationStage = (characterId: string, stage: GenerationProgress["stage"]) => {
    setGenerationProgress((current) => current[characterId]
      ? { ...current, [characterId]: { ...current[characterId], stage } }
      : current);
  };

  const generateSheet = async (character: Character, acceptImmediately = false) => {
    if (!project || !character.name.trim()) {
      setVisualError("캐릭터 이름을 먼저 입력해주세요.");
      return false;
    }
    setVisualError("");
    setGenerating(character.id, true);
    try {
      const currentProject = { ...project, characters };
      const result = await requestCharacterSheet(currentProject, character, (stage) => setGenerationStage(character.id, stage));
      setGenerationStage(character.id, "saving");
      if (acceptImmediately) {
        const asset = await saveMediaAsset({ projectId: id, ownerId: character.id, ownerType: "character", mimeType: result.blob.type || "image/jpeg", blob: result.blob });
        await deleteMediaAsset(character.imageAssetId);
        setCharacters((current) => {
          const nextCharacters = current.map((item) => item.id === character.id ? { ...item, imageAssetId: asset.id, imageSourceHash: result.sourceHash } : item);
          updateProject(id, { characters: nextCharacters });
          return nextCharacters;
        });
      } else {
        setCandidateSheets((current) => ({ ...current, [character.id]: { blob: result.blob, sourceHash: result.sourceHash } }));
      }
      return true;
    } catch (error) {
      setVisualError(error instanceof Error ? error.message : "캐릭터 시트 생성에 실패했습니다.");
      return false;
    } finally {
      setGenerating(character.id, false);
    }
  };

  const acceptSheet = async (character: Character) => {
    const candidate = candidateSheets[character.id];
    if (!candidate) return;
    try {
      const asset = await saveMediaAsset({ projectId: id, ownerId: character.id, ownerType: "character", mimeType: candidate.blob.type || "image/jpeg", blob: candidate.blob });
      await deleteMediaAsset(character.imageAssetId);
      setCharacters((current) => {
        const nextCharacters = current.map((item) => item.id === character.id ? { ...item, imageAssetId: asset.id, imageSourceHash: candidate.sourceHash } : item);
        updateProject(id, { characters: nextCharacters });
        return nextCharacters;
      });
      setCandidateSheets((current) => {
        const next = { ...current };
        delete next[character.id];
        return next;
      });
    } catch {
      setVisualError("브라우저 이미지 저장 공간을 확인해주세요.");
    }
  };

  const downloadSheet = async (character: Character) => {
    const candidate = candidateSheets[character.id];
    const blob = candidate?.blob ?? (await getMediaAsset(character.imageAssetId))?.blob;
    if (blob) downloadBlob(blob, `${character.name || "character"}_시트.jpg`);
  };

  const generateAllMissing = async () => {
    const targets = characters.filter((character) => !character.imageAssetId && character.name.trim());
    if (targets.length === 0) {
      setVisualError("이미지가 없는 이름 입력 완료 캐릭터가 없습니다.");
      return;
    }
    setBulkGenerating(true);
    let success = 0;
    for (const character of targets) {
      if (await generateSheet(character, true)) success += 1;
    }
    setBulkGenerating(false);
    setVisualError(`${success}/${targets.length}개의 캐릭터 시트를 생성했습니다.`);
  };

  const handleNext = () => {
    if (characters.length === 0) {
      setShowEmptyModal(true);
    } else {
      save();
      router.push(projectHref(id, "world"));
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
                className={`${INTERACTIVE_BUTTON} hidden sm:flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:-translate-y-0.5 hover:bg-[#F4F1EC] hover:shadow-sm`}
              >
                <Download className="w-3.5 h-3.5" /> 다운로드
              </button>
            )}
            <button
              onClick={generateAllMissing}
              disabled={bulkGenerating || characters.length === 0}
              className={`${INTERACTIVE_BUTTON} hidden md:flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border border-[#7C3AED]/20 bg-[#7C3AED]/5 text-[#7C3AED] hover:-translate-y-0.5 hover:bg-[#7C3AED]/10 hover:shadow-sm disabled:opacity-60`}
            >
              {bulkGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />} {bulkGenerating ? `시트 생성 중 (${generatingIds.size})` : "미생성 시트 만들기"}
            </button>
            <button
              onClick={autofill}
              disabled={autofilling}
              aria-busy={autofilling}
              className={`${INTERACTIVE_BUTTON} flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:-translate-y-0.5 hover:bg-[#F4F1EC] hover:shadow-sm disabled:border-[#C4B5FD] disabled:bg-[#F5F3FF] disabled:text-[#7C3AED] disabled:opacity-100`}
            >
              {autofilling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{autofilling ? "AI 응답 기다리는 중" : "AI 자동채우기"}</span>
            </button>
            <button
              onClick={save}
              disabled={saving}
              className={`${INTERACTIVE_BUTTON} flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full bg-[#7C3AED] text-white hover:-translate-y-0.5 hover:bg-[#6D28D9] hover:shadow-md disabled:opacity-50`}
            >
              {saved ? <><Check className="w-3.5 h-3.5" /> 저장됨</> : saving ? "저장 중..." : <><Save className="w-3.5 h-3.5" /> 저장</>}
            </button>
          </div>
        </div>
      </header>

      <MobileStepBar currentStep={project?.currentStep ?? 1} activeStep={2} projectId={id} isDirty={isDirty} />

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-5">
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-[#EBE7E0] p-4 sticky top-20 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <StepIndicator currentStep={project?.currentStep ?? 1} activeStep={2} projectId={id} isDirty={isDirty} />
          </div>
        </aside>

        <main className="flex-1 min-w-0 space-y-4">
          <StageIntro stage="characters" />
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] font-medium text-[#7C3AED] uppercase tracking-widest mb-1">Step 02</p>
              <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">캐릭터 설계</h1>
            </div>
            <button
              onClick={addCharacter}
              className={`${INTERACTIVE_BUTTON} flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:-translate-y-0.5 hover:bg-[#F4F1EC] hover:border-[#7C3AED]/30 hover:shadow-sm`}
            >
              <Plus className="w-3.5 h-3.5" /> 캐릭터 추가
            </button>
          </div>

          {noIdeaChat && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
              <span className="text-xs text-orange-600">작품을 불러오지 못했어요. 대시보드에서 다시 열어 주세요.</span>
            </div>
          )}

          {autofillProgress && <AutofillStatus progress={autofillProgress} />}

          {visualError && (
            <div className={`rounded-xl px-4 py-2.5 text-xs ${visualError.includes("생성했습니다") ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
              {visualError}
            </div>
          )}

          {project && (
            <ArtDirectionEditor
              value={project.artDirection}
              onChange={(artDirection) => {
                setProject((current) => current ? { ...current, artDirection } : current);
                updateProject(id, { artDirection });
                setIsDirty(true);
              }}
            />
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
                className={`${INTERACTIVE_BUTTON} inline-flex items-center gap-2 bg-[#7C3AED] text-white text-xs font-medium px-5 py-2.5 rounded-full hover:-translate-y-0.5 hover:bg-[#6D28D9] hover:shadow-md`}
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
                      <div className="w-10 h-12 rounded-lg bg-[#F4F1EC] overflow-hidden flex items-center justify-center flex-shrink-0">
                        {ch.imageAssetId ? (
                          <button type="button" onClick={() => setLightboxImage({ assetId: ch.imageAssetId, alt: `${ch.name} 캐릭터 시트` })} className="w-full h-full cursor-zoom-in" title="캐릭터 시트 확대 보기">
                            <StoredImage assetId={ch.imageAssetId} alt={`${ch.name} 캐릭터 시트`} className="w-full h-full object-contain" />
                          </button>
                        ) : (
                          <span className="text-xl">{ch.role === "주인공" ? "🦸" : ch.role === "악당(빌런)" ? "😈" : "👤"}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1A1A1A]">{ch.name || "이름 없음"}</p>
                        <p className="text-xs text-[#ADA8A0]">{ch.role}{ch.imageAssetId ? " · 시트 생성됨" : ""}</p>
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
                      <SettingFields fields={CHARACTER_STORY_FIELDS} values={Object.fromEntries(CHARACTER_STORY_FIELDS.map(field => [field.key, ch[field.key]]))} onChange={(key, value) => updateChar(idx, key as keyof Character, value)} />
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

                      <div className="rounded-xl border border-[#E4DDF8] bg-[#FAF8FF] p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-xs font-bold text-[#1A1A1A]">웹툰 캐릭터 시트</p>
                            <p className="text-[10px] text-[#7A7067] mt-1">여백이 넉넉한 3:2 제작 시트에 전신·턴어라운드·포즈 3종·표정 6종·손·액세서리·소재·색상표를 구성해요.</p>
                          </div>
                          {ch.imageAssetId && ch.imageSourceHash !== characterSheetHash({ ...project!, characters } as Project, ch) && (
                            <span className="text-[10px] text-orange-600 bg-orange-100 px-2 py-1 rounded-full flex-shrink-0">설정 변경됨</span>
                          )}
                        </div>
                        <div className="mb-4 space-y-2">
                          <p className="text-[11px] leading-6 text-[#7A7067]">위에서 입력한 이름·나이·외모·성격·배경과 기획을 바탕으로 AI가 외형 고정 정보를 구체화해요. 이미지는 별도로 생성합니다.</p>
                          <AiFillButton label="외형 고정 정보 AI 채우기" resultKey="visualProfile" disabled={autofilling || generatingIds.has(ch.id)}
                            getSnapshot={() => {
                              const latest = getProject(id);
                              if (!latest) throw new Error("작품을 다시 열어 주세요.");
                              return { fields: { ...ch.visualProfile }, payload: autofillPayload({ ...latest, characters, artDirection: project?.artDirection ?? latest.artDirection }, "visualProfile", undefined, ch) };
                            }}
                            onApply={(draft, before, mode) => {
                              setCharacters(current => current.map(character => character.id === ch.id
                                ? { ...character, visualProfile: mergeAiFields(character.visualProfile, before, draft, mode) } : character));
                              setIsDirty(true);
                            }} />
                        </div>
                        <details className="rounded-xl border border-[#E4DDF8] bg-white mb-3" open>
                          <summary className="cursor-pointer select-none px-3 py-2.5 text-[11px] font-bold text-[#5B21B6]">
                            외형 고정 정보 · 각도별 일관성을 높이는 핵심 입력
                          </summary>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-3 pb-3 border-t border-[#F0ECFA] pt-3">
                            {VISUAL_PROFILE_FIELDS.map((field) => (
                              <div key={field.key}>
                                <label className="block text-[10px] font-semibold text-[#7A7067] mb-1">{field.label}</label>
                                <Input
                                  value={ch.visualProfile[field.key]}
                                  onChange={(event) => updateVisualProfile(idx, field.key, event.target.value)}
                                  placeholder={field.placeholder}
                                  className="text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        </details>
                        <Textarea
                          value={ch.imageInstructions ?? ""}
                          onChange={(event) => updateChar(idx, "imageInstructions", event.target.value)}
                          placeholder="추가 이미지 지시 — 예: 교복 재킷은 짙은 남색, 왼쪽 눈 아래 점"
                          rows={2}
                          className="text-xs mb-3"
                        />

                        {generationProgress[ch.id] && <CharacterSheetGenerationStatus progress={generationProgress[ch.id]} />}

                        {(candidateSheets[ch.id] || ch.imageAssetId) ? (
                          <div className="grid gap-3 sm:grid-cols-[180px_1fr] items-start">
                            <button
                              type="button"
                              onClick={() => setLightboxImage(candidateSheets[ch.id]
                                ? { blob: candidateSheets[ch.id].blob, alt: `${ch.name} 새 캐릭터 시트` }
                                : { assetId: ch.imageAssetId, alt: `${ch.name} 캐릭터 시트` })}
                              className="relative aspect-[3/2] rounded-xl overflow-hidden bg-white border border-[#EBE7E0] cursor-zoom-in group"
                              title="클릭하여 크게 보기"
                            >
                              {candidateSheets[ch.id]
                                ? <BlobImage blob={candidateSheets[ch.id].blob} alt={`${ch.name} 새 캐릭터 시트`} className="w-full h-full object-contain" />
                                : <StoredImage assetId={ch.imageAssetId} alt={`${ch.name} 캐릭터 시트`} className="w-full h-full object-contain" />}
                              <span className="absolute inset-x-0 bottom-0 py-1.5 bg-black/55 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">클릭하여 크게 보기</span>
                            </button>
                            <div className="space-y-2">
                              {candidateSheets[ch.id] && (
                                <div className="rounded-lg bg-white border border-[#EBE7E0] p-3">
                                  <p className="text-[11px] font-bold text-[#1A1A1A] mb-1">새 결과를 적용할까요?</p>
                                  <p className="text-[10px] text-[#7A7067] mb-3">취소하면 기존 시트가 그대로 유지됩니다.</p>
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => acceptSheet(ch)} className={`${INTERACTIVE_BUTTON} inline-flex items-center gap-1 rounded-full bg-[#7C3AED] text-white px-3 py-1.5 text-[11px] font-semibold hover:bg-[#6D28D9]`}><Check className="w-3 h-3" /> 적용</button>
                                    <button type="button" onClick={() => setCandidateSheets((current) => { const next = { ...current }; delete next[ch.id]; return next; })} className={`${INTERACTIVE_BUTTON} inline-flex items-center gap-1 rounded-full border border-[#EBE7E0] bg-white px-3 py-1.5 text-[11px] hover:bg-[#F4F1EC]`}><X className="w-3 h-3" /> 취소</button>
                                  </div>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2">
                                <button type="button" disabled={generatingIds.has(ch.id)} onClick={() => generateSheet(ch)} className={`${INTERACTIVE_BUTTON} inline-flex items-center gap-1.5 rounded-full bg-[#1A1A1A] text-white px-3 py-2 text-[11px] font-semibold hover:-translate-y-0.5 hover:bg-black hover:shadow-md disabled:bg-[#5B5560] disabled:opacity-100`}>
                                  {generatingIds.has(ch.id) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} {generatingIds.has(ch.id) ? "작업 진행 중" : ch.imageAssetId ? "새로 생성" : "시트 생성"}
                                </button>
                                <button type="button" onClick={() => downloadSheet(ch)} className={`${INTERACTIVE_BUTTON} inline-flex items-center gap-1.5 rounded-full border border-[#EBE7E0] bg-white px-3 py-2 text-[11px] text-[#7A7067] hover:-translate-y-0.5 hover:bg-[#F4F1EC]`}><Download className="w-3.5 h-3.5" /> 이미지 저장</button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button type="button" disabled={generatingIds.has(ch.id)} onClick={() => generateSheet(ch)} className={`${INTERACTIVE_BUTTON} w-full rounded-xl border border-dashed border-[#C4B5FD] bg-white py-5 text-xs font-semibold text-[#7C3AED] hover:-translate-y-0.5 hover:border-[#8B5CF6] hover:bg-[#F5F3FF] hover:shadow-sm disabled:translate-y-0 disabled:bg-[#F5F3FF] disabled:opacity-100`}>
                            {generatingIds.has(ch.id) ? "작업 진행 중 · 위에서 현재 단계를 확인하세요" : "GPT로 캐릭터 시트 만들기"}
                          </button>
                        )}
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
              className={`${INTERACTIVE_BUTTON} text-xs font-medium px-4 py-2.5 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:-translate-y-0.5 hover:bg-[#F4F1EC] hover:shadow-sm disabled:opacity-50`}
            >
              저장
            </button>
            <button
              onClick={handleNext}
              className={`${INTERACTIVE_BUTTON} flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-full bg-[#7C3AED] text-white hover:-translate-y-0.5 hover:bg-[#6D28D9] hover:shadow-md`}
            >
              다음: 세계관 · 설정집 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </main>

      </div>

      {showEmptyModal && (
        <EmptyContentModal
          title="캐릭터가 없어요"
          description="아이디어 발굴 대화 내용을 바탕으로 AI가 주인공 등 주요 캐릭터를 자동으로 만들어드릴 수 있어요."
          onAutofill={() => { setShowEmptyModal(false); autofill(); }}
          onAskMentor={() => { setShowEmptyModal(false); mobileChatRef.current?.openAndFocus(); }}
          onGoAnyway={() => { setShowEmptyModal(false); router.push(projectHref(id, "world")); }}
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
      {lightboxImage && <ImageLightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />}
    </div>
  );
}
