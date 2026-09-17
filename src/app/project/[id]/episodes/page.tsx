"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import StepIndicator from "@/components/progress-tracker/StepIndicator";
import EmptyContentModal from "@/components/EmptyContentModal";
import MobileChatSheet, { type MobileChatSheetHandle } from "@/components/mobile/MobileChatSheet";
import MobileStepBar from "@/components/MobileStepBar";
import { Plus, Trash2, Save, ArrowRight, CheckCircle, Sparkles, Check, Download, Film, Wand2, ImageIcon, RefreshCw, X } from "lucide-react";
import { createCut, getProject, updateProject, type Episode, type Cut, type Project, type ChatMessage, type PanelAspectRatio, type StoryboardDocument } from "@/lib/storage";
import { downloadEpisode, downloadAllEpisodes } from "@/lib/download";
import ArtDirectionEditor from "@/components/visual/ArtDirectionEditor";
import StoryboardEditor from "@/components/visual/StoryboardEditor";
import { BlobImage } from "@/components/visual/StoredImage";
import { requestSceneImage, requestStoryboardLayout, sceneHash } from "@/lib/visualClient";
import { deleteMediaAsset, deleteMediaByOwner, saveMediaAsset } from "@/lib/mediaStorage";
import { storyboardDimensions } from "@/lib/storyboardSvg";

const ANGLES = ["풀샷", "미디엄샷", "클로즈업", "익스트림 클로즈업", "버드뷰", "웜뷰", "오버더숄더"];
const INTERACTIVE_BUTTON = "transform-gpu transition-all duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:active:scale-100";

type AiCutProgress = {
  stage: "requesting" | "applying";
  operation: "next" | "current";
  targetCutId?: string;
  startedAt: number;
  elapsedSeconds: number;
};

function AiCutProgressPanel({ progress }: { progress: AiCutProgress }) {
  const applying = progress.stage === "applying";
  const currentCut = progress.operation === "current";
  const message = applying
    ? `제안받은 앵글·장면·대사·효과음을 ${currentCut ? "현재 컷에" : "새 컷에"} 적용하고 있습니다.`
    : progress.elapsedSeconds < 8
      ? "에피소드 줄거리와 기존 컷 순서를 AI에 전달했습니다."
      : currentCut ? "AI가 앞뒤 장면의 흐름에 맞게 현재 컷을 구체화하고 있습니다." : "AI가 앞 장면과 겹치지 않는 다음 연출을 설계하고 있습니다.";
  return (
    <div aria-live="polite" className="relative overflow-hidden rounded-xl border border-[#DDD6FE] bg-gradient-to-r from-[#F5F3FF] to-white px-4 py-3">
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-[#EDE9FE]"><div className="h-full w-1/3 animate-pulse rounded-full bg-[#7C3AED]" /></div>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
          {applying ? <Check className="h-4 w-4 text-[#7C3AED]" /> : <RefreshCw className="h-4 w-4 animate-spin text-[#7C3AED]" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-[#1A1A1A]">{applying ? "AI 컷 적용 중" : currentCut ? "현재 컷 설계 중" : "다음 컷 설계 중"}</p>
            <span className="tabular-nums text-[10px] font-medium text-[#7C3AED]">{progress.elapsedSeconds}초 경과</span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#7A7067]">{message}</p>
        </div>
      </div>
    </div>
  );
}

export default function EpisodesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([
    { episodeNumber: 1, title: "", synopsis: "", cuts: [], script: "", isCompleted: false },
  ]);
  const [activeEp, setActiveEp] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [noIdeaChat, setNoIdeaChat] = useState(false);
  const [layoutGeneratingIds, setLayoutGeneratingIds] = useState<Set<string>>(new Set());
  const [sceneGeneratingIds, setSceneGeneratingIds] = useState<Set<string>>(new Set());
  const [sceneCandidates, setSceneCandidates] = useState<Record<string, { blob: Blob; sourceHash: string }>>({});
  const [visualError, setVisualError] = useState("");
  const [bulkLayoutGenerating, setBulkLayoutGenerating] = useState(false);
  const [aiCutProgress, setAiCutProgress] = useState<AiCutProgress | null>(null);
  const mobileChatRef = useRef<MobileChatSheetHandle>(null);
  const aiCutStartedAt = aiCutProgress?.startedAt;

  useEffect(() => {
    const p = getProject(id);
    if (p) {
      const updatedStep = Math.max(4, p.currentStep);
      if (updatedStep !== p.currentStep) updateProject(id, { currentStep: updatedStep });
      setProject({ ...p, currentStep: updatedStep });
      const totalEp = Math.max(1, parseInt(p.story.totalEpisodes) || 1);
      const existing = p.episodes.length > 0
        ? p.episodes.map((ep) => ({ ...ep, cuts: ep.cuts ?? [] }))
        : [{ episodeNumber: 1, title: "", synopsis: "", cuts: [], script: "", isCompleted: false }];

      if (totalEp > existing.length) {
        const stubs: Episode[] = Array.from({ length: totalEp - existing.length }, (_, i) => ({
          episodeNumber: existing.length + i + 1,
          title: "",
          synopsis: "",
          cuts: [],
          script: "",
          isCompleted: false,
        }));
        const merged = [...existing, ...stubs];
        setEpisodes(merged);
        updateProject(id, { episodes: merged });
      } else {
        setEpisodes(existing);
      }
    }
  }, [id]);

  useEffect(() => {
    if (!aiCutStartedAt) return;
    const timer = window.setInterval(() => {
      setAiCutProgress((current) => current ? {
        ...current,
        elapsedSeconds: Math.floor((Date.now() - current.startedAt) / 1000),
      } : null);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [aiCutStartedAt]);

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

  const updateEp = (field: keyof Episode, value: string | boolean | Cut[]) => {
    setEpisodes((eps) => eps.map((ep, i) => (i === activeEp ? { ...ep, [field]: value } : ep)));
    setIsDirty(true);
  };

  const addCut = () => {
    const newCut = createCut();
    const updated = [...(episodes[activeEp]?.cuts ?? []), newCut];
    updateEp("cuts", updated);
  };

  const requestAiCut = async (episode: Episode, mode: "next" | "current", currentCutIndex?: number) => {
    if (!project) throw new Error("프로젝트 정보를 불러오지 못했습니다.");
    const response = await fetch("/api/ai/cuts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        currentCutIndex,
        project: {
          title: project.title,
          genre: project.genre,
          logline: project.story.logline,
          theme: project.story.theme,
          setting: project.story.setting,
          plotOutline: project.story.plotOutline,
        },
        episode: {
          number: episode.episodeNumber,
          title: episode.title,
          synopsis: episode.synopsis,
          script: episode.script,
        },
        characters: project.characters.map((character) => ({
          id: character.id,
          name: character.name,
          role: character.role,
          appearance: character.appearance,
          personality: character.personality,
        })),
        existingCuts: episode.cuts.map((cut) => ({
          angle: cut.angle,
          description: cut.description,
          dialogue: cut.dialogue,
          soundEffect: cut.soundEffect,
          characterIds: cut.characterIds,
          aspectRatio: cut.aspectRatio,
        })),
      }),
    });
    const data = await response.json().catch(() => ({})) as { cut?: Partial<Cut>; error?: string };
    if (!response.ok || !data.cut) throw new Error(data.error ?? "AI 컷 생성에 실패했습니다.");
    return data.cut;
  };

  const addCutWithAi = async () => {
    if (!project || aiCutProgress) return;
    const targetEpisodeIndex = activeEp;
    const episode = episodes[targetEpisodeIndex];
    if (!episode) return;
    setVisualError("");
    setAiCutProgress({ stage: "requesting", operation: "next", startedAt: Date.now(), elapsedSeconds: 0 });
    try {
      const suggestion = await requestAiCut(episode, "next");
      setAiCutProgress((current) => current ? { ...current, stage: "applying" } : current);
      const newCut = createCut(suggestion);
      setEpisodes((current) => current.map((item, index) => index === targetEpisodeIndex
        ? { ...item, cuts: [...(item.cuts ?? []), newCut] }
        : item));
      setIsDirty(true);
      setVisualError(`AI가 컷 ${episode.cuts.length + 1}을 추가했습니다.`);
    } catch (error) {
      setVisualError(error instanceof Error ? error.message : "AI 컷 생성에 실패했습니다.");
    } finally {
      setAiCutProgress(null);
    }
  };

  const designCurrentCutWithAi = async (cutIdx: number) => {
    if (!project || aiCutProgress) return;
    const targetEpisodeIndex = activeEp;
    const episode = episodes[targetEpisodeIndex];
    const targetCut = episode?.cuts[cutIdx];
    if (!episode || !targetCut) return;
    setVisualError("");
    setAiCutProgress({ stage: "requesting", operation: "current", targetCutId: targetCut.id, startedAt: Date.now(), elapsedSeconds: 0 });
    try {
      const suggestion = await requestAiCut(episode, "current", cutIdx);
      setAiCutProgress((current) => current ? { ...current, stage: "applying" } : current);
      const aspectRatio = suggestion.aspectRatio ?? targetCut.aspectRatio;
      setEpisodes((current) => current.map((item, episodeIndex) => episodeIndex === targetEpisodeIndex
        ? { ...item, cuts: item.cuts.map((cut, index) => {
            if (index !== cutIdx) return cut;
            let storyboard = cut.storyboard;
            if (storyboard && aspectRatio !== cut.aspectRatio) {
              const dimensions = storyboardDimensions(aspectRatio);
              const scaleX = dimensions.width / storyboard.width;
              const scaleY = dimensions.height / storyboard.height;
              storyboard = {
                ...storyboard,
                aspectRatio,
                ...dimensions,
                elements: storyboard.elements.map((element) => ({
                  ...element,
                  x: element.x * scaleX,
                  y: element.y * scaleY,
                  width: element.width * scaleX,
                  height: element.height * scaleY,
                })),
              };
            }
            return { ...cut, ...suggestion, id: cut.id, aspectRatio, storyboard };
          }) }
        : item));
      setIsDirty(true);
      setVisualError(`AI가 현재 컷 ${cutIdx + 1}을 설계했습니다.`);
    } catch (error) {
      setVisualError(error instanceof Error ? error.message : "현재 컷 AI 설계에 실패했습니다.");
    } finally {
      setAiCutProgress(null);
    }
  };

  const updateCut = (cutIdx: number, field: keyof Cut, value: string) => {
    const updated = (episodes[activeEp]?.cuts ?? []).map((c, i) =>
      i === cutIdx ? { ...c, [field]: value } : c
    );
    updateEp("cuts", updated);
  };

  const removeCut = (cutIdx: number) => {
    const removed = episodes[activeEp]?.cuts?.[cutIdx];
    setEpisodes((current) => {
      const next = current.map((episode, episodeIndex) => episodeIndex === activeEp
        ? { ...episode, cuts: (episode.cuts ?? []).filter((_, index) => index !== cutIdx) }
        : episode);
      updateProject(id, { episodes: next });
      return next;
    });
    setIsDirty(true);
    if (removed) deleteMediaByOwner(removed.id).catch(() => {});
  };

  const replaceCut = (cutIdx: number, updater: (cut: Cut) => Cut) => {
    setEpisodes((current) => current.map((episode, episodeIndex) => episodeIndex === activeEp
      ? { ...episode, cuts: (episode.cuts ?? []).map((cut, index) => index === cutIdx ? updater(cut) : cut) }
      : episode));
    setIsDirty(true);
  };

  const changeAspectRatio = (cutIdx: number, aspectRatio: PanelAspectRatio) => {
    replaceCut(cutIdx, (cut) => {
      if (!cut.storyboard) return { ...cut, aspectRatio };
      const dimensions = storyboardDimensions(aspectRatio);
      const scaleX = dimensions.width / cut.storyboard.width;
      const scaleY = dimensions.height / cut.storyboard.height;
      return {
        ...cut,
        aspectRatio,
        storyboard: {
          ...cut.storyboard,
          aspectRatio,
          ...dimensions,
          elements: cut.storyboard.elements.map((element) => ({
            ...element,
            x: element.x * scaleX,
            y: element.y * scaleY,
            width: element.width * scaleX,
            height: element.height * scaleY,
          })),
        },
      };
    });
  };

  const setLoadingId = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string, active: boolean) => {
    setter((current) => {
      const next = new Set(current);
      if (active) next.add(id); else next.delete(id);
      return next;
    });
  };

  const generateLayout = async (cutIdx: number) => {
    if (!project) return false;
    const episode = episodes[activeEp];
    const cut = episode?.cuts[cutIdx];
    if (!episode || !cut) return false;
    setVisualError("");
    setLoadingId(setLayoutGeneratingIds, cut.id, true);
    try {
      const currentProject = { ...project, episodes };
      const storyboard = await requestStoryboardLayout(currentProject, episode, cut);
      replaceCut(cutIdx, (current) => ({ ...current, storyboard }));
      return true;
    } catch (error) {
      setVisualError(error instanceof Error ? error.message : "SVG 콘티 생성에 실패했습니다.");
      return false;
    } finally {
      setLoadingId(setLayoutGeneratingIds, cut.id, false);
    }
  };

  const generateScene = async (cutIdx: number) => {
    if (!project) return;
    const episode = episodes[activeEp];
    const cut = episode?.cuts[cutIdx];
    if (!episode || !cut) return;
    setVisualError("");
    setLoadingId(setSceneGeneratingIds, cut.id, true);
    try {
      const result = await requestSceneImage({ ...project, episodes }, episode, cut);
      setSceneCandidates((current) => ({ ...current, [cut.id]: { blob: result.blob, sourceHash: result.sourceHash } }));
    } catch (error) {
      setVisualError(error instanceof Error ? error.message : "장면 이미지 생성에 실패했습니다.");
    } finally {
      setLoadingId(setSceneGeneratingIds, cut.id, false);
    }
  };

  const acceptScene = async (cutIdx: number) => {
    const cut = episodes[activeEp]?.cuts[cutIdx];
    if (!cut) return;
    const candidate = sceneCandidates[cut.id];
    if (!candidate) return;
    try {
      const asset = await saveMediaAsset({ projectId: id, ownerId: cut.id, ownerType: "scene", mimeType: candidate.blob.type || "image/jpeg", blob: candidate.blob });
      await deleteMediaAsset(cut.sceneImageAssetId);
      setEpisodes((current) => {
        const next = current.map((episode, episodeIndex) => episodeIndex === activeEp
          ? { ...episode, cuts: (episode.cuts ?? []).map((item, index) => index === cutIdx ? { ...item, sceneImageAssetId: asset.id, sceneSourceHash: candidate.sourceHash } : item) }
          : episode);
        updateProject(id, { episodes: next });
        return next;
      });
      setSceneCandidates((current) => { const next = { ...current }; delete next[cut.id]; return next; });
    } catch {
      setVisualError("브라우저 이미지 저장 공간을 확인해주세요.");
    }
  };

  const generateMissingLayouts = async () => {
    const targets = (episodes[activeEp]?.cuts ?? []).map((cut, index) => ({ cut, index })).filter(({ cut }) => !cut.storyboard);
    if (targets.length === 0) {
      setVisualError("이 화의 모든 컷에 SVG 콘티가 있습니다.");
      return;
    }
    setBulkLayoutGenerating(true);
    let success = 0;
    for (const target of targets) if (await generateLayout(target.index)) success += 1;
    setBulkLayoutGenerating(false);
    setVisualError(`${success}/${targets.length}개의 SVG 콘티를 생성했습니다.`);
  };

  const save = () => {
    setSaving(true);
    updateProject(id, {
      episodes,
      currentStep: Math.max(4, project?.currentStep ?? 1),
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
        body: JSON.stringify({ ideaChat: p.ideaChat, step: "episodes" }),
      });
      const data = await res.json();
      if (Array.isArray(data.episodes) && data.episodes.length > 0) {
        setEpisodes((prev) =>
          prev.map((ep, i) => {
            const filled = data.episodes[i];
            if (!filled) return ep;
            return { ...ep, title: filled.title ?? ep.title, synopsis: filled.synopsis ?? ep.synopsis };
          })
        );
        setIsDirty(true);
      }
    } finally {
      setAutofilling(false);
    }
  };

  const handleNext = () => {
    const allEmpty = episodes.every((ep) => !ep.title);
    if (allEmpty) {
      setShowEmptyModal(true);
    } else {
      save();
      router.push(`/project/${id}/script`);
    }
  };

  const ep = episodes[activeEp];

  const selectClass =
    "flex h-9 w-full rounded-xl border border-[#EBE7E0] bg-white px-3 py-1.5 text-xs text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]/40 transition-all duration-200";

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
              onClick={generateMissingLayouts}
              disabled={bulkLayoutGenerating || !ep?.cuts?.length}
              className="hidden md:flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border border-[#7C3AED]/20 bg-[#7C3AED]/5 text-[#7C3AED] hover:bg-[#7C3AED]/10 transition-all disabled:opacity-50"
            >
              <ImageIcon className="w-3.5 h-3.5" /> {bulkLayoutGenerating ? "콘티 생성 중..." : "미생성 콘티 만들기"}
            </button>
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

      <MobileStepBar currentStep={project?.currentStep ?? 1} activeStep={4} projectId={id} isDirty={isDirty} />

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-5">
        {/* Left sidebar */}
        <aside className="hidden lg:block w-52 flex-shrink-0 space-y-3 sticky top-20 self-start">
          <div className="bg-white rounded-2xl border border-[#EBE7E0] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <StepIndicator currentStep={project?.currentStep ?? 1} activeStep={4} projectId={id} isDirty={isDirty} />
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
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] font-medium text-[#7C3AED] uppercase tracking-widest mb-1">Step 04</p>
              <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">{ep?.episodeNumber}화 콘티 제작</h1>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#7A7067] cursor-pointer">
              <input
                type="checkbox"
                checked={ep?.isCompleted ?? false}
                onChange={(e) => updateEp("isCompleted", e.target.checked)}
                className="rounded accent-[#7C3AED]"
              />
              이 화 완료됨
            </label>
          </div>

          {noIdeaChat && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
              <span className="text-xs text-orange-600">먼저 1단계 아이디어 발굴에서 AI와 대화해주세요</span>
            </div>
          )}

          {visualError && (
            <div className={`rounded-xl px-4 py-2.5 text-xs ${visualError.includes("생성했습니다") || visualError.includes("추가했습니다") || visualError.includes("모든 컷") ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
              {visualError}
            </div>
          )}

          {project && (
            <ArtDirectionEditor
              compact
              value={project.artDirection}
              onChange={(artDirection) => {
                setProject((current) => current ? { ...current, artDirection } : current);
                updateProject(id, { artDirection });
                setIsDirty(true);
              }}
            />
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

          {/* 제목 & 줄거리 */}
          <div className="bg-white rounded-2xl border border-[#EBE7E0] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <label className="block text-xs font-bold text-[#1A1A1A] mb-1">{ep?.episodeNumber}화 제목 & 줄거리</label>
            <p className="text-xs text-[#ADA8A0] mb-3">이번 화에서 일어나는 일을 간략히 정리해봐요</p>
            <div className="space-y-3">
              <Input
                placeholder={`${ep?.episodeNumber}화 제목`}
                value={ep?.title ?? ""}
                onChange={(e) => updateEp("title", e.target.value)}
              />
              <Textarea
                placeholder={`${ep?.episodeNumber}화에서 일어나는 일을 간략히 정리하세요`}
                value={ep?.synopsis ?? ""}
                onChange={(e) => updateEp("synopsis", e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* 콘티 */}
          <div className="bg-white rounded-2xl border border-[#EBE7E0] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#EBE7E0]">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[#7C3AED]" />
                <span className="text-sm font-bold text-[#1A1A1A]">컷 구성</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={addCut}
                  className={`${INTERACTIVE_BUTTON} flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:-translate-y-0.5 hover:bg-[#F4F1EC] hover:border-[#7C3AED]/30`}
                >
                  <Plus className="w-3.5 h-3.5" /> 빈 컷
                </button>
                <button
                  onClick={addCutWithAi}
                  disabled={Boolean(aiCutProgress)}
                  aria-busy={Boolean(aiCutProgress)}
                  className={`${INTERACTIVE_BUTTON} flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#7C3AED] text-white hover:-translate-y-0.5 hover:bg-[#6D28D9] hover:shadow-sm disabled:bg-[#8B5CF6]`}
                >
                  {aiCutProgress ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {aiCutProgress ? "AI 설계 중" : "AI로 다음 컷"}
                </button>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-[#ADA8A0]">컷별로 앵글, 장면 묘사, 대사, 효과음을 설계해봐요</p>

              {aiCutProgress && <AiCutProgressPanel progress={aiCutProgress} />}

              {(!ep?.cuts || ep.cuts.length === 0) ? (
                <div className="text-center py-12 bg-[#FBF9F6] rounded-xl border border-dashed border-[#EBE7E0]">
                  <Film className="w-8 h-8 text-[#D4CFC9] mx-auto mb-3" />
                  <p className="text-xs text-[#ADA8A0] mb-3">아직 컷이 없어요. 첫 번째 컷을 추가해봐요!</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={addCut}
                      className={`${INTERACTIVE_BUTTON} inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border border-[#EBE7E0] bg-white text-[#7A7067] hover:-translate-y-0.5 hover:bg-[#F4F1EC]`}
                    >
                      <Plus className="w-3.5 h-3.5" /> 빈 컷 추가
                    </button>
                    <button
                      onClick={addCutWithAi}
                      disabled={Boolean(aiCutProgress)}
                      className={`${INTERACTIVE_BUTTON} inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-[#7C3AED] text-white hover:-translate-y-0.5 hover:bg-[#6D28D9] hover:shadow-md disabled:bg-[#8B5CF6]`}
                    >
                      {aiCutProgress ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {aiCutProgress ? "다음 컷 설계 중" : "AI로 첫 컷 만들기"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {ep.cuts.map((cut, cutIdx) => (
                    <div key={cut.id} className="border border-[#EBE7E0] rounded-xl overflow-hidden">
                      <div className="flex flex-col gap-2 px-4 py-2.5 bg-[#FBF9F6] border-b border-[#EBE7E0] sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <span className="text-xs font-bold text-[#7C3AED] w-10">컷 {cutIdx + 1}</span>
                          <select
                            value={cut.angle}
                            onChange={(e) => updateCut(cutIdx, "angle", e.target.value)}
                            className={selectClass + " w-36"}
                          >
                            {ANGLES.map((a) => <option key={a} value={a}>{a}</option>)}
                          </select>
                          <select
                            value={cut.aspectRatio}
                            onChange={(e) => changeAspectRatio(cutIdx, e.target.value as PanelAspectRatio)}
                            className={selectClass + " w-24"}
                            title="컷 비율"
                          >
                            <option value="4:3">가로 4:3</option>
                            <option value="3:4">세로 3:4</option>
                            <option value="1:1">정사각형</option>
                            <option value="9:16">세로 9:16</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => designCurrentCutWithAi(cutIdx)}
                            disabled={Boolean(aiCutProgress)}
                            aria-busy={aiCutProgress?.targetCutId === cut.id}
                            className={`${INTERACTIVE_BUTTON} inline-flex items-center gap-1.5 rounded-full border border-[#DDD6FE] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#7C3AED] hover:-translate-y-0.5 hover:bg-[#F5F3FF] disabled:opacity-60`}
                          >
                            {aiCutProgress?.targetCutId === cut.id
                              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              : <Sparkles className="h-3.5 w-3.5" />}
                            {aiCutProgress?.targetCutId === cut.id ? "이 컷 설계 중" : "AI로 이 컷 설계"}
                          </button>
                          <button
                            onClick={() => removeCut(cutIdx)}
                            className={`${INTERACTIVE_BUTTON} p-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#ADA8A0] hover:text-red-400" />
                          </button>
                        </div>
                      </div>

                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-[#7A7067] mb-1.5">장면 묘사</label>
                          <Textarea
                            value={cut.description}
                            onChange={(e) => updateCut(cutIdx, "description", e.target.value)}
                            placeholder="이 컷에서 무슨 일이 일어나는지, 인물 위치와 표정 등을 적어봐요"
                            rows={2}
                            className="text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#7A7067] mb-1.5">대사</label>
                          <Input
                            value={cut.dialogue}
                            onChange={(e) => updateCut(cutIdx, "dialogue", e.target.value)}
                            placeholder='예: "늦었어, 어떡해!"'
                            className="text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#7A7067] mb-1.5">효과음</label>
                          <Input
                            value={cut.soundEffect}
                            onChange={(e) => updateCut(cutIdx, "soundEffect", e.target.value)}
                            placeholder="예: 쾅! 스르륵... 두근두근"
                            className="text-xs"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-[#7A7067] mb-1.5">등장 캐릭터 <span className="font-normal text-[#ADA8A0]">· 최대 4명</span></label>
                          {project?.characters.length ? (
                            <div className="flex flex-wrap gap-2">
                              {project.characters.map((character) => {
                                const checked = cut.characterIds.includes(character.id);
                                const limitReached = cut.characterIds.length >= 4 && !checked;
                                return (
                                  <label key={character.id} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] cursor-pointer transition ${checked ? "border-[#7C3AED]/30 bg-[#7C3AED]/8 text-[#7C3AED]" : "border-[#EBE7E0] bg-white text-[#7A7067]"} ${limitReached ? "opacity-40 cursor-not-allowed" : ""}`}>
                                    <input
                                      type="checkbox"
                                      className="accent-[#7C3AED]"
                                      checked={checked}
                                      disabled={limitReached}
                                      onChange={() => replaceCut(cutIdx, (current) => ({
                                        ...current,
                                        characterIds: checked ? current.characterIds.filter((characterId) => characterId !== character.id) : [...current.characterIds, character.id],
                                      }))}
                                    />
                                    {character.name || "이름 없음"}{character.imageAssetId ? " ✓" : ""}
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-[#ADA8A0]">캐릭터 설계 단계에서 등장인물을 먼저 추가해주세요.</p>
                          )}
                        </div>

                        <div className="col-span-2 rounded-xl border border-[#E4DDF8] bg-[#FAF8FF] p-3 sm:p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-[#1A1A1A]">편집 가능한 SVG 콘티</p>
                              <p className="text-[10px] text-[#7A7067] mt-1">Gemini가 구도 초안을 만들면 인물과 말풍선을 직접 움직일 수 있어요.</p>
                            </div>
                            <button
                              type="button"
                              disabled={layoutGeneratingIds.has(cut.id)}
                              onClick={() => generateLayout(cutIdx)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#7C3AED] text-white text-[11px] font-semibold px-3 py-2 disabled:opacity-50"
                            >
                              {layoutGeneratingIds.has(cut.id) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                              {layoutGeneratingIds.has(cut.id) ? "구도 생성 중..." : cut.storyboard ? "콘티 다시 제안" : "SVG 콘티 만들기"}
                            </button>
                          </div>

                          {sceneCandidates[cut.id] && (
                            <div className="rounded-xl border border-[#C4B5FD] bg-white p-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                              <div className="rounded-lg overflow-hidden bg-[#F4F1EC]" style={{ aspectRatio: cut.aspectRatio.replace(":", "/") }}>
                                <BlobImage blob={sceneCandidates[cut.id].blob} alt="새 장면 생성 결과" className="w-full h-full object-cover" />
                              </div>
                              <div className="self-center">
                                <p className="text-xs font-bold text-[#1A1A1A] mb-1">새 장면을 적용할까요?</p>
                                <p className="text-[10px] text-[#7A7067] mb-3">적용 전까지 기존 장면은 유지됩니다. 말풍선과 대사는 SVG로 별도 합성돼요.</p>
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => acceptScene(cutIdx)} className="inline-flex items-center gap-1 rounded-full bg-[#7C3AED] text-white px-3 py-1.5 text-[11px] font-semibold"><Check className="w-3 h-3" /> 적용</button>
                                  <button type="button" onClick={() => setSceneCandidates((current) => { const next = { ...current }; delete next[cut.id]; return next; })} className="inline-flex items-center gap-1 rounded-full border border-[#EBE7E0] px-3 py-1.5 text-[11px]"><X className="w-3 h-3" /> 취소</button>
                                </div>
                              </div>
                            </div>
                          )}

                          {cut.storyboard ? (
                            <StoryboardEditor
                              document={cut.storyboard}
                              characters={project?.characters ?? []}
                              sceneAssetId={cut.sceneImageAssetId}
                              sceneStale={Boolean(cut.sceneImageAssetId && project && cut.sceneSourceHash !== sceneHash({ ...project, episodes }, ep, cut))}
                              generatingScene={sceneGeneratingIds.has(cut.id)}
                              onChange={(storyboard: StoryboardDocument) => replaceCut(cutIdx, (current) => ({ ...current, storyboard }))}
                              onGenerateScene={() => generateScene(cutIdx)}
                            />
                          ) : (
                            <div className="rounded-xl border border-dashed border-[#C4B5FD] bg-white py-8 text-center">
                              <Film className="w-7 h-7 text-[#C4B5FD] mx-auto mb-2" />
                              <p className="text-[11px] text-[#7A7067]">장면 설명과 등장인물을 정한 뒤 SVG 콘티를 만들어보세요.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      onClick={addCut}
                      className={`${INTERACTIVE_BUTTON} w-full py-2.5 rounded-xl border border-dashed border-[#EBE7E0] text-xs text-[#ADA8A0] hover:-translate-y-0.5 hover:border-[#7C3AED]/30 hover:text-[#7C3AED] hover:bg-[#FBF9F6] flex items-center justify-center gap-1.5`}
                    >
                      <Plus className="w-3.5 h-3.5" /> 빈 컷 추가
                    </button>
                    <button
                      onClick={addCutWithAi}
                      disabled={Boolean(aiCutProgress)}
                      className={`${INTERACTIVE_BUTTON} w-full py-2.5 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] text-xs font-semibold text-[#7C3AED] hover:-translate-y-0.5 hover:border-[#A78BFA] hover:bg-[#EDE9FE] flex items-center justify-center gap-1.5 disabled:opacity-70`}
                    >
                      {aiCutProgress ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {aiCutProgress ? "다음 컷 설계 중" : "AI로 다음 컷 추가"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

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
              다음: 대본 작성 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </main>

      </div>

      {showEmptyModal && (
        <EmptyContentModal
          title="화 제목이 비어있어요"
          description="아이디어 발굴 대화 내용을 바탕으로 AI가 각 화의 제목과 줄거리를 자동으로 채워드릴 수 있어요."
          onAutofill={() => { setShowEmptyModal(false); autofill(); }}
          onAskMentor={() => { setShowEmptyModal(false); mobileChatRef.current?.openAndFocus(); }}
          onGoAnyway={() => { setShowEmptyModal(false); router.push(`/project/${id}/script`); }}
          onClose={() => setShowEmptyModal(false)}
          autofilling={autofilling}
        />
      )}

      <MobileChatSheet
        ref={mobileChatRef}
        step="panel"
        initialMessage="콘티 작업을 도와드릴게요! 장면 연출이나 앵글 선택에 대해 궁금한 점이 있으면 말씀해 주세요!"
        placeholder="콘티·연출에 대해 질문하세요..."
        initialMessages={project?.episodeChat}
        onMessagesChange={(msgs) => updateProject(id, { episodeChat: msgs as ChatMessage[] })}
      />
    </div>
  );
}
