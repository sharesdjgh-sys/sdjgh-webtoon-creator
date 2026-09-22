"use client";

import { projectHref } from "@/lib/storage";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { mergeAiFields } from "@/lib/aiFill";
import { autofillPayload } from "@/lib/autofillContext";
import { buildProjectContext } from "@/lib/projectContext";
import StageIntro from "@/components/creation/StageIntro";
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
import { normalizeWebtoonFlow, changeWebtoonFlow } from "@/lib/webtoonFlow";
import ShotSelector from "@/components/visual/ShotSelector";
import AspectRatioSelector from "@/components/visual/AspectRatioSelector";
import WebtoonPreviewModal from "@/components/visual/WebtoonPreviewModal";
import CutNavigator from "@/components/visual/CutNavigator";
import AiActivityBanner from "@/components/AiActivityBanner";
import { BlobImage } from "@/components/visual/StoredImage";
import { requestCharacterRig, requestSceneImage, requestStoryboardLayer, requestStoryboardLayout, sceneHash, storyboardLayerHash } from "@/lib/visualClient";
import { deleteMediaAsset, deleteMediaByOwner, saveMediaAsset, whiteToTransparentPng } from "@/lib/mediaStorage";
import { resizeStoryboard } from "@/lib/storyboardSvg";
import { hasGeneratedStoryboardLayers } from "@/lib/storyboardComposite";
import { cleanCharacterMentions } from "@/lib/characterMentions";
import { pendingLayerIds, runLayerBatch } from "@/lib/layerBatch";

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
  const cutCards = useRef(new Map<string, HTMLDivElement>());
  const navigateToCut = (cutId: string) => {
    const card = cutCards.current.get(cutId);
    if (!card) return;
    card.focus({ preventScroll: true });
    card.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [noIdeaChat, setNoIdeaChat] = useState(false);
  const [layoutGeneratingIds, setLayoutGeneratingIds] = useState<Set<string>>(new Set());
  const layoutRequests = useRef(new Set<string>());
  const [layerGeneratingIds, setLayerGeneratingIds] = useState<Set<string>>(new Set());
  const layerRequests = useRef(new Set<string>());
  const layerBatches = useRef(new Map<string, { cancelled: boolean }>());
  const [layerBatchProgress, setLayerBatchProgress] = useState<Record<string, { completed: number; total: number }>>({});
  const [sceneGeneratingIds, setSceneGeneratingIds] = useState<Set<string>>(new Set());
  const sceneRequests = useRef(new Set<string>());
  const [poseDetectingIds, setPoseDetectingIds] = useState<Set<string>>(new Set());
  const [sceneCandidates, setSceneCandidates] = useState<Record<string, { blob: Blob; sourceHash: string; reviewed?: boolean }>>({});
  const [visualError, setVisualError] = useState("");
  const [bulkLayoutGenerating, setBulkLayoutGenerating] = useState(false);
  const [aiCutProgress, setAiCutProgress] = useState<AiCutProgress | null>(null);
  const mobileChatRef = useRef<MobileChatSheetHandle>(null);
  const aiCutStartedAt = aiCutProgress?.startedAt;
  useEffect(() => {
    const batches = layerBatches.current;
    return () => { batches.forEach(batch => { batch.cancelled = true; }); };
  }, []);

  useEffect(() => {
    const p = getProject(id);
    if (p) {
      const updatedStep = Math.max(6, p.currentStep);
      if (updatedStep !== p.currentStep) updateProject(id, { currentStep: updatedStep });
      setProject({ ...p, currentStep: updatedStep });
      const totalEp = Math.max(1, parseInt(p.story.totalEpisodes) || 1);
      const existing = p.episodes.length > 0
        ? p.episodes.map((ep) => ({
            ...ep,
            cuts: (ep.cuts ?? []).map((cut) => ({
              ...cut,
              description: cleanCharacterMentions(cut.description, p.characters),
              dialogue: cleanCharacterMentions(cut.dialogue, p.characters),
              soundEffect: cleanCharacterMentions(cut.soundEffect, p.characters),
            })),
          }))
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
        context: buildProjectContext({ ...project, episodes }),
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
              storyboard = resizeStoryboard(storyboard, aspectRatio);
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
      i === cutIdx ? { ...c, [field]: value,
        storyboard: field === "scrollGap" && c.storyboard ? changeWebtoonFlow(c.storyboard, { after: value === "short" ? 80 : value === "long" ? 300 : 150 }) : c.storyboard,
      } : c
    );
    updateEp("cuts", updated);
  };

  const removeCut = (cutIdx: number) => {
    const removed = episodes[activeEp]?.cuts?.[cutIdx];
    const next = episodes.map((episode, episodeIndex) => episodeIndex === activeEp
      ? { ...episode, cuts: (episode.cuts ?? []).filter((_, index) => index !== cutIdx) }
      : episode);
    setEpisodes(next);
    updateProject(id, { episodes: next });
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
    const selectedCut = episodes[activeEp]?.cuts[cutIdx];
    if (!selectedCut || selectedCut.aspectRatio === aspectRatio) return;
    setSceneCandidates((current) => {
      const next = { ...current };
      delete next[selectedCut.id];
      return next;
    });
    replaceCut(cutIdx, (cut) => ({
      ...cut, aspectRatio,
      storyboard: cut.storyboard ? resizeStoryboard(cut.storyboard, aspectRatio) : undefined,
    }));
  };

  const setLoadingId = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string, active: boolean) => {
    setter((current) => {
      const next = new Set(current);
      if (active) next.add(id); else next.delete(id);
      return next;
    });
  };

  const generateLayout = async (cutIdx: number, keepLayout = false) => {
    if (!project) return;
    const episode = episodes[activeEp], cut = episode?.cuts[cutIdx];
    if (!cut || layoutRequests.current.has(cut.id) || sceneRequests.current.has(cut.id) || layerBatches.current.has(cut.id)) return false;
    if (cut.storyboard?.elements.some(layer => layerRequests.current.has(layer.id))) return false;
    const currentProject = { ...project, episodes };
    const inputHash = sceneHash(currentProject, episode, cut);
    const editorSnapshot = JSON.stringify({ storyboard: cut.storyboard, dialogue: cut.dialogue, soundEffect: cut.soundEffect });
    layoutRequests.current.add(cut.id);
    setVisualError("");
    setLoadingId(setLayoutGeneratingIds, cut.id, true);
    try {
      const storyboard = keepLayout && cut.storyboard
        ? cut.storyboard
        : await requestStoryboardLayout(currentProject, episode, cut);
      const draft = { ...cut, storyboard };
      const result = await requestSceneImage(currentProject, episode, draft, "direct", "sketch");
      const asset = await saveMediaAsset({ projectId: id, ownerId: cut.id, ownerType: "storyboard", mimeType: result.blob.type, blob: result.blob });
      const sceneStoryboard: StoryboardDocument = {
        ...storyboard, sceneSketchAssetId: asset.id,
        flow: normalizeWebtoonFlow(storyboard.flow),
        elements: storyboard.elements.map(element => ({ ...element, poseControlEdited: false, poseDescriptionEdited: false })),
      };
      setEpisodes(current => current.map(ep => ({ ...ep, cuts: ep.cuts.map(item =>
        item.id === cut.id && sceneHash({ ...project, episodes: current }, ep, item) === inputHash
          && JSON.stringify({ storyboard: item.storyboard, dialogue: item.dialogue, soundEffect: item.soundEffect }) === editorSnapshot
          ? { ...item, storyboard: sceneStoryboard } : item) })));
      setIsDirty(true);
      setVisualError("장면 전체 스케치를 생성했습니다. 인물·손·소품·배경을 함께 그렸습니다. 생성 중 변경한 콘티는 덮어쓰지 않습니다. 콘티 미리보기에서 대사와 여백을 확인해주세요.");
      return true;
    } catch (error) {
      setVisualError(error instanceof Error ? error.message : "장면 스케치 생성에 실패했습니다. 기존 콘티는 유지됩니다.");
      return false;
    } finally {
      layoutRequests.current.delete(cut.id);
      setLoadingId(setLayoutGeneratingIds, cut.id, false);
    }
  };

  const regenerateStoryboardLayer = async (cutIdx: number, layerId: string, batch = false): Promise<boolean> => {
    if (!project) return false;
    const episode = episodes[activeEp];
    const cut = episode?.cuts[cutIdx];
    const layer = cut?.storyboard?.elements.find((element) => element.id === layerId);
    if (!episode || !cut?.storyboard || !layer || !["background", "character", "prop"].includes(layer.type)) return false;
    if (sceneRequests.current.has(cut.id) || layerRequests.current.has(layer.id) || (!batch && layerBatches.current.has(cut.id))) return false;
    layerRequests.current.add(layer.id);
    const inputHash = storyboardLayerHash({ ...project, episodes }, episode, cut, layer.id);
    if (!batch) setVisualError("");
    setLoadingId(setLayerGeneratingIds, layer.id, true);
    try {
      const result = await requestStoryboardLayer({ ...project, episodes }, episode, cut, layer.id);
      const blob = layer.type === "background" ? result.blob : await whiteToTransparentPng(result.blob, "chroma");
      const asset = await saveMediaAsset({ projectId: id, ownerId: layer.id, ownerType: "storyboard-layer", mimeType: blob.type || "image/png", blob });
      // Keep previous artwork for unsaved-state recovery and editor undo.
      setEpisodes(currentEpisodes => currentEpisodes.map(currentEpisode => ({
        ...currentEpisode,
        cuts: currentEpisode.cuts.map(current => current.id !== cut.id || !current.storyboard ? current : {
          ...current,
          storyboard: {
            ...current.storyboard,
            elements: current.storyboard.elements.map((element) => element.id === layer.id && storyboardLayerHash({ ...project, episodes: currentEpisodes }, currentEpisode, current, layer.id) === inputHash ? {
              ...element,
              assetId: asset.id,
              assetSourceHash: result.sourceHash,
              characterRig: result.characterRig ?? element.characterRig,
              poseControlEdited: false,
            } : element),
          },
        }),
      })));
      setIsDirty(true);
      if (!batch) setVisualError(`${layer.text || "선택 레이어"} 생성이 완료되었습니다. 생성 중 수정된 레이어는 덮어쓰지 않습니다.`);
      return true;
    } catch (error) {
      if (!batch) setVisualError(error instanceof Error ? error.message : "선택한 콘티 레이어를 다시 그리지 못했습니다.");
      return false;
    } finally {
      setLoadingId(setLayerGeneratingIds, layer.id, false);
      layerRequests.current.delete(layer.id);
    }
  };

  const regenerateStoryboardLayers = async (cutIdx: number, requestedIds: string[]) => {
    if (!project) return;
    const episode = episodes[activeEp], cut = episode?.cuts[cutIdx];
    if (!cut?.storyboard || sceneRequests.current.has(cut.id) || layerBatches.current.has(cut.id) || cut.storyboard.elements.some(layer => layerRequests.current.has(layer.id)) || layoutGeneratingIds.has(cut.id) || sceneGeneratingIds.has(cut.id) || poseDetectingIds.has(cut.id)) return;
    const stale = new Set(cut.storyboard.elements.filter(layer => layer.assetSourceHash !== storyboardLayerHash({ ...project, episodes }, episode, cut, layer.id)).map(layer => layer.id));
    const targets = pendingLayerIds(cut.storyboard, stale).filter(layerId => requestedIds.includes(layerId));
    if (!targets.length) return;
    const control = { cancelled: false };
    layerBatches.current.set(cut.id, control);
    setVisualError("");
    try {
      const result = await runLayerBatch(targets, layerId => regenerateStoryboardLayer(cutIdx, layerId, true),
        (completed, total) => setLayerBatchProgress(current => ({ ...current, [cut.id]: { completed, total } })),
        () => control.cancelled);
      const failedNames = result.failed.map(layerId => cut.storyboard!.elements.find(layer => layer.id === layerId)?.text || layerId);
      setVisualError(`일괄 생성 완료: 성공 ${result.succeeded}개 · 실패 ${result.failed.length}개 · 중지 ${result.remaining}개.${failedNames.length ? " 실패: " + failedNames.join(", ") : ""} 생성 중 수정된 레이어는 덮어쓰지 않습니다. 성공한 그림은 유지하며 남은 항목만 다시 반영할 수 있습니다.`);
    } finally {
      layerBatches.current.delete(cut.id);
      setLayerBatchProgress(current => { const next = { ...current }; delete next[cut.id]; return next; });
    }
  };

  const detectAllCharacterPoses = async (cutIdx: number) => {
    if (!project) return;
    const episode = episodes[activeEp];
    const cut = episode?.cuts[cutIdx];
    const targets = cut?.storyboard?.elements.filter((element) => element.type === "character" && element.visible !== false && element.assetId) ?? [];
    if (!episode || !cut?.storyboard || targets.length === 0) return;
    if (layerBatches.current.has(cut.id)) { setVisualError("레이어 일괄 반영이 끝난 뒤 포즈를 분석해주세요."); return; }
    setVisualError("");
    setLoadingId(setPoseDetectingIds, cut.id, true);
    targets.forEach((element) => setLoadingId(setLayerGeneratingIds, element.id, true));
    try {
      const detected = await Promise.all(targets.map(async (element) => ({
        id: element.id,
        rig: await requestCharacterRig(element.assetId!),
      })));
      const rigs = new Map(detected.map(({ id: layerId, rig }) => [layerId, rig]));
      replaceCut(cutIdx, (current) => {
        if (!current.storyboard) return current;
        const storyboardWithRigs: StoryboardDocument = {
          ...current.storyboard,
          elements: current.storyboard.elements.map((element) => ({
            ...element,
            characterRig: rigs.get(element.id) ?? element.characterRig,
            poseControlEdited: rigs.has(element.id) ? true : element.poseControlEdited,
          })),
        };
        const cutWithRigs = { ...current, storyboard: storyboardWithRigs };
        return {
          ...cutWithRigs,
          storyboard: {
            ...storyboardWithRigs,
            elements: storyboardWithRigs.elements.map((element) => rigs.has(element.id) ? {
              ...element,
              assetSourceHash: storyboardLayerHash({ ...project, episodes }, episode, cutWithRigs, element.id),
            } : element),
          },
        };
      });
      setVisualError(`캐릭터 ${targets.length}명의 포즈 핸들을 실제 그림에 맞췄습니다.`);
    } catch (error) {
      setVisualError(error instanceof Error ? error.message : "캐릭터 포즈를 분석하지 못했습니다.");
    } finally {
      targets.forEach((element) => setLoadingId(setLayerGeneratingIds, element.id, false));
      setLoadingId(setPoseDetectingIds, cut.id, false);
    }
  };

  const setPoseReference = async (cutIdx: number, layerId: string, file: File | null) => {
    const layer = episodes[activeEp]?.cuts[cutIdx]?.storyboard?.elements.find((element) => element.id === layerId);
    if (!layer) return;
    try {
      if (!file) {
        await deleteMediaAsset(layer.poseReferenceAssetId);
        replaceCut(cutIdx, (current) => ({
          ...current,
          storyboard: current.storyboard ? {
            ...current.storyboard,
            elements: current.storyboard.elements.map((element) => element.id === layerId ? { ...element, poseReferenceAssetId: undefined } : element),
          } : current.storyboard,
        }));
        return;
      }
      if (!file.type.match(/^image\/(png|jpeg|webp)$/)) throw new Error("PNG, JPG, WEBP 이미지만 사용할 수 있습니다.");
      if (file.size > 10 * 1024 * 1024) throw new Error("포즈 참고 이미지는 10MB 이하로 올려주세요.");
      const asset = await saveMediaAsset({ projectId: id, ownerId: layerId, ownerType: "pose-reference", mimeType: file.type, blob: file });
      await deleteMediaAsset(layer.poseReferenceAssetId);
      replaceCut(cutIdx, (current) => ({
        ...current,
        storyboard: current.storyboard ? {
          ...current.storyboard,
          elements: current.storyboard.elements.map((element) => element.id === layerId ? {
            ...element,
            poseReferenceAssetId: asset.id,
            pose: "업로드한 참고 이미지의 자세를 정확히 따르기",
          } : element),
        } : current.storyboard,
      }));
      setVisualError("포즈 참고 이미지를 연결했습니다. ‘이 설명으로 다시 그리기’를 누르면 적용됩니다.");
    } catch (error) {
      setVisualError(error instanceof Error ? error.message : "포즈 참고 이미지를 저장하지 못했습니다.");
    }
  };

  const generateScene = async (cutIdx: number) => {
    if (!project) return;
    const episode = episodes[activeEp];
    const cut = episode?.cuts[cutIdx];
    if (!episode || !cut) return;
    if (!cut.storyboard) {
      setVisualError("먼저 콘티를 만든 뒤 장면을 생성해 주세요.");
      return;
    }
    const currentProject = { ...project, episodes };
    if (sceneRequests.current.has(cut.id)) return;
    if (layerBatches.current.has(cut.id) || layoutGeneratingIds.has(cut.id) || poseDetectingIds.has(cut.id) || cut.storyboard.elements.some(layer => layerRequests.current.has(layer.id))) {
      setVisualError("진행 중인 레이어 작업을 완료하거나 중지한 뒤 장면에 한 번에 반영해주세요.");
      return;
    }
    sceneRequests.current.add(cut.id);
    setVisualError("");
    setLoadingId(setSceneGeneratingIds, cut.id, true);
    try {
      const result = await requestSceneImage(currentProject, episode, cut, "direct");
      setSceneCandidates((current) => ({ ...current, [cut.id]: { blob: result.blob, sourceHash: result.sourceHash } }));
    } catch (error) {
      setVisualError(error instanceof Error ? error.message : "장면 이미지 생성에 실패했습니다.");
    } finally {
      setLoadingId(setSceneGeneratingIds, cut.id, false);
      sceneRequests.current.delete(cut.id);
    }
  };

  const acceptScene = async (cutIdx: number) => {
    const cut = episodes[activeEp]?.cuts[cutIdx];
    if (!cut) return;
    const candidate = sceneCandidates[cut.id];
    if (!candidate) return;
    if (!candidate.reviewed) {
      setVisualError("AI 원본에서 말풍선·글자·가이드·잘림이 없는지 확인한 뒤 검수 체크를 해주세요.");
      return;
    }
    if (!project || candidate.sourceHash !== sceneHash({ ...project, episodes }, episodes[activeEp], cut)) {
      setVisualError("컷 비율이나 구도가 변경되었습니다. 현재 설정으로 장면을 다시 생성해주세요.");
      return;
    }
    try {
      const asset = await saveMediaAsset({ projectId: id, ownerId: cut.id, ownerType: "scene", mimeType: candidate.blob.type || "image/jpeg", blob: candidate.blob });
      // Do not delete the last saved artwork before project persistence succeeds.
      const next = episodes.map((episode, episodeIndex) => episodeIndex === activeEp
        ? { ...episode, cuts: (episode.cuts ?? []).map((item, index) => index === cutIdx ? { ...item, sceneImageAssetId: asset.id, sceneSourceHash: candidate.sourceHash } : item) }
        : episode);
      setEpisodes(next);
      updateProject(id, { episodes: next });
      setSceneCandidates((current) => { const next = { ...current }; delete next[cut.id]; return next; });
    } catch {
      setVisualError("브라우저 이미지 저장 공간을 확인해주세요.");
    }
  };

  const generateMissingLayouts = async () => {
    const targets = (episodes[activeEp]?.cuts ?? []).map((cut, index) => ({ cut, index })).filter(({ cut }) => !hasGeneratedStoryboardLayers(cut.storyboard));
    if (targets.length === 0) {
      setVisualError("이 화의 모든 컷에 장면 콘티가 있습니다.");
      return;
    }
    setBulkLayoutGenerating(true);
    let success = 0;
    for (const target of targets) if (await generateLayout(target.index)) success += 1;
    setBulkLayoutGenerating(false);
    setVisualError(`${success}/${targets.length}개의 장면 콘티를 생성했습니다.`);
  };

  const save = () => {
    setSaving(true);
    updateProject(id, {
      episodes,
      currentStep: Math.max(6, project?.currentStep ?? 1),
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
    const fields = ["title", "synopsis", "goal", "obstacle", "turningPoint", "endingHook"];
    const before = episodes.map(ep => Object.fromEntries(fields.map(key => [key, String((ep as unknown as Record<string, unknown>)[key] ?? "")])));
    setVisualError("");
    setAutofilling(true);
    try {
      const res = await fetch("/api/ai/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(autofillPayload({ ...p, episodes }, "episodes")),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "회차 자동 채우기에 실패했어요.");
      if (Array.isArray(data.episodes) && data.episodes.length > 0) {
        setEpisodes((prev) =>
          prev.map((ep, i) => {
            const filled = data.episodes[i];
            if (!filled) return ep;
            return mergeAiFields(ep, before[i] ?? {}, filled, "missing");
          })
        );
        setIsDirty(true);
      }
    } catch (error) {
      setVisualError(error instanceof Error ? error.message : "회차 자동 채우기에 실패했어요.");
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
      router.push(projectHref(id, "submit"));
    }
  };

  const ep = episodes[activeEp];

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
                  <Download className="w-3.5 h-3.5" /> 이 화 제작 문서
                </button>
                <button
                  onClick={() => downloadAllEpisodes({ ...project, episodes })}
                  className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] transition-all duration-200"
                >
                  <Download className="w-3.5 h-3.5" /> 전체 제작 문서
                </button>
              </>
            )}
            <button
              onClick={generateMissingLayouts}
              disabled={bulkLayoutGenerating || !ep?.cuts?.length}
              className="hidden md:flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border border-[#7C3AED]/20 bg-[#7C3AED]/5 text-[#7C3AED] hover:bg-[#7C3AED]/10 transition-all disabled:opacity-50"
            >
              {bulkLayoutGenerating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />} {bulkLayoutGenerating ? "콘티 생성 중" : "미생성 콘티 만들기"}
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              disabled={!ep?.cuts?.length}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#DDD6FE] bg-[#F5F3FF] px-3 py-2 text-xs font-semibold text-[#7C3AED] transition hover:bg-[#EDE9FE] disabled:opacity-40"
            >
              <Film className="h-3.5 w-3.5" /> <span>이 화 전체 이어보기</span>
            </button>
            <button
              onClick={autofill}
              disabled={autofilling}
              className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] transition-all duration-200 disabled:opacity-50"
            >
              {autofilling ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{autofilling ? "에피소드 작성 중" : "AI 자동채우기"}</span>
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

      <MobileStepBar currentStep={project?.currentStep ?? 1} activeStep={6} projectId={id} isDirty={isDirty} />

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-5">
        {/* Left sidebar */}
        <aside className="hidden lg:block w-52 flex-shrink-0 space-y-3 sticky top-20 self-start">
          <div className="bg-white rounded-2xl border border-[#EBE7E0] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <StepIndicator currentStep={project?.currentStep ?? 1} activeStep={6} projectId={id} isDirty={isDirty} />
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
          <StageIntro stage="episodes" />
          {ep && <section aria-label="한 화 원고 미리보기와 다운로드" className="flex items-center justify-between gap-5 rounded-2xl border border-[#DDD6FE] bg-[#F5F3FF] p-5">
            <div>
              <h2 className="text-sm font-bold text-[#5B21B6]">{ep.episodeNumber}화 전체를 웹툰처럼 읽어보세요</h2>
              <p className="mt-1 text-xs leading-6 text-[#7A7067]">{ep.cuts.length}개의 컷과 대사·독백·여백을 현재 순서대로 이어 보여줍니다. 미리보기에서 한 화의 PNG를 ZIP으로 받을 수 있어요.</p>
              <p className="text-[11px] text-[#82798B]">완성 그림이 없는 컷은 콘티로 표시하며, 미제작 컷은 위치를 알려줍니다. AI 추가 호출은 없습니다.</p>
            </div>
            <button type="button" disabled={!ep.cuts.length} onClick={() => setPreviewOpen(true)} className="flex shrink-0 items-center gap-2 rounded-full bg-[#7C3AED] px-5 py-3 text-xs font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-40">
              <Film className="h-4 w-4" /> 전체 이어보기 · 다운로드
            </button>
          </section>}
          {ep && !ep.script.trim() && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6">아직 이 화의 대본이 없어요. 회차 · 대본에서 장면의 흐름을 먼저 정하면 컷을 나누기 쉬워요.</p>}
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] font-medium text-[#7C3AED] uppercase tracking-widest mb-1">Step 06</p>
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

          <AiActivityBanner
            active={autofilling || bulkLayoutGenerating || layoutGeneratingIds.size > 0}
            title={bulkLayoutGenerating ? "AI가 여러 장면의 콘티를 만들고 있어요" : layoutGeneratingIds.size > 0 ? "AI가 장면 전체 스케치를 만들고 있어요" : "AI가 에피소드 내용을 채우고 있어요"}
            messages={bulkLayoutGenerating || layoutGeneratingIds.size > 0
              ? ["장면 설명과 등장인물을 확인하고 있어요.", "카메라 구도와 그림 밖 대사 배치를 설계하고 있어요.", "인물·손·소품·배경을 한 장면으로 함께 그리고 있어요.", "스케치가 나오면 세로 원고에서 여백과 읽기 순서를 확인해주세요."]
              : ["아이디어 대화와 전체 줄거리를 읽고 있어요.", "각 화의 제목과 줄거리를 구성하고 있어요.", "에피소드 흐름을 입력란에 반영하고 있어요."]}
          />

          {noIdeaChat && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
              <span className="text-xs text-orange-600">작품을 불러오지 못했어요. 대시보드에서 다시 열어 주세요.</span>
            </div>
          )}

          {visualError && (
              <div className={`rounded-xl px-4 py-2.5 text-xs ${visualError.includes("생성했습니다") || visualError.includes("그렸습니다") || visualError.includes("반영했습니다") || visualError.includes("추가했습니다") || visualError.includes("모든 컷") ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
              {visualError}
            </div>
          )}

          <CutNavigator cuts={ep?.cuts ?? []} onNavigate={navigateToCut} />

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
                    <div key={cut.id} ref={node => { if (node) cutCards.current.set(cut.id, node); else cutCards.current.delete(cut.id); }}
                      tabIndex={-1} aria-label={`${cutIdx + 1}컷 편집`} className="relative scroll-mt-40 rounded-xl border border-[#EBE7E0] bg-white focus:outline-none focus:ring-2 focus:ring-[#A78BFA]">
                      <div className="flex flex-col gap-2 px-4 py-2.5 bg-[#FBF9F6] border-b border-[#EBE7E0] sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <span className="text-xs font-bold text-[#7C3AED] w-10">컷 {cutIdx + 1}</span>
                          <ShotSelector
                            value={cut.angle}
                            onChange={(angle) => updateCut(cutIdx, "angle", angle)}
                          />
                          <AspectRatioSelector
                            disabled={Boolean(aiCutProgress) || layoutGeneratingIds.has(cut.id) || sceneGeneratingIds.has(cut.id) || Boolean(cut.storyboard?.elements.some((element) => layerGeneratingIds.has(element.id) || poseDetectingIds.has(element.id)))}
                            value={cut.aspectRatio}
                            onChange={(aspectRatio) => changeAspectRatio(cutIdx, aspectRatio)}
                          />
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
                        <label className="text-xs font-semibold">이 컷의 목적<Input className="mt-2" value={cut.purpose ?? ""} onChange={e => updateCut(cutIdx, "purpose", e.target.value)} placeholder="정보 / 감정 / 행동 / 반전 준비" /></label>
                        <label className="text-xs font-semibold">전할 감정<Input className="mt-2" value={cut.emotion ?? ""} onChange={e => updateCut(cutIdx, "emotion", e.target.value)} placeholder="호기심 → 긴장" /></label>
                        <label className="text-xs font-semibold">다음 컷까지 여백<select value={cut.scrollGap ?? "normal"} onChange={e => updateCut(cutIdx, "scrollGap", e.target.value)} className="mt-2 block w-full rounded-lg border border-[#EBE7E0] bg-white p-2"><option value="short">짧게 · 빠른 행동 / 대화</option><option value="normal">보통 · 자연스러운 흐름</option><option value="long">길게 · 침묵 / 긴장 / 전환</option></select></label>
                        <label className="text-xs font-semibold">이어져야 하는 설정<Input className="mt-2" value={cut.continuityNotes ?? ""} onChange={e => updateCut(cutIdx, "continuityNotes", e.target.value)} placeholder="남색 가디건, 왼손의 일기장, 비 오는 오후" /></label>
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
                              <p className="text-xs font-bold text-[#1A1A1A]">장면 콘티 · 세로 웹툰 연출</p>
                              <p className="text-[10px] text-[#7A7067] mt-1">인물·손·소품·배경을 함께 그립니다. 그림 여백은 콘티 옵션에서 조절하고, 말풍선은 같은 미리보기의 그림·여백 위로 직접 옮기세요.</p>
                            </div>
                            <button
                              type="button"
                              disabled={layoutGeneratingIds.has(cut.id)}
                              onClick={() => generateLayout(cutIdx)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#7C3AED] text-white text-[11px] font-semibold px-3 py-2 disabled:opacity-50"
                            >
                              {layoutGeneratingIds.has(cut.id) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                              {layoutGeneratingIds.has(cut.id)
                                ? "장면 전체 스케치 생성 중..."
                                : hasGeneratedStoryboardLayers(cut.storyboard) ? "장면 콘티 새로 제안" : "AI 장면 콘티 만들기"}
                            </button>
                          </div>

                          {sceneCandidates[cut.id] && (
                            <div className="rounded-xl border border-[#C4B5FD] bg-white p-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                              <div className="rounded-lg overflow-hidden bg-[#F4F1EC]" style={{ aspectRatio: cut.aspectRatio.replace(":", "/") }}>
                                <BlobImage blob={sceneCandidates[cut.id].blob} alt="검수할 AI 원본 그림" className="w-full h-full object-cover" />
                              </div>
                              <div className="self-center">
                                <p className="text-xs font-bold text-[#1A1A1A] mb-1">새 장면을 적용할까요?</p>
                                <p className="text-[10px] text-[#7A7067] mb-3">이 미리보기는 말풍선을 합성하지 않은 AI 원본입니다. 크게 비교에서 인물 크기·위치·포즈와 소품 배치를 대조하고, 불필요한 글자·말풍선·가이드·테두리·잘림이 없는지 확인해주세요.</p>
                                <label className="mb-3 flex items-start gap-2 text-[11px]"><input type="checkbox" checked={Boolean(sceneCandidates[cut.id].reviewed)} onChange={event => { const reviewed = event.target.checked; setSceneCandidates(current => ({ ...current, [cut.id]: { ...current[cut.id], reviewed } })); }} /> 콘티의 크기·위치·포즈·소품 배치가 유지되고 불필요한 말풍선·가이드·잘림이 없는 것을 확인했습니다.</label>
                                <div className="flex gap-2">
                                  <button type="button" disabled={!sceneCandidates[cut.id].reviewed} onClick={() => acceptScene(cutIdx)} className="inline-flex items-center gap-1 rounded-full bg-[#7C3AED] text-white px-3 py-1.5 text-[11px] font-semibold"><Check className="w-3 h-3" /> 적용</button>
                                  <button type="button" onClick={() => setSceneCandidates((current) => { const next = { ...current }; delete next[cut.id]; return next; })} className="inline-flex items-center gap-1 rounded-full border border-[#EBE7E0] px-3 py-1.5 text-[11px]"><X className="w-3 h-3" /> 취소</button>
                                </div>
                              </div>
                            </div>
                          )}

                          {cut.storyboard ? (
                            <>
                            <StoryboardEditor
                              document={cut.storyboard}
                              characters={project?.characters ?? []}
                              staleLayerIds={new Set(cut.storyboard.elements
                                .filter((layer) => ["background", "character", "prop"].includes(layer.type) && Boolean(layer.assetId) && layer.assetSourceHash !== storyboardLayerHash({ ...project!, episodes }, ep, cut, layer.id))
                                .map((layer) => layer.id))}
                              generatingLayerIds={layerGeneratingIds}
                              detectingAllPoses={poseDetectingIds.has(cut.id)}
                              sceneAssetId={cut.sceneImageAssetId}
                              sceneCandidate={sceneCandidates[cut.id]?.blob}
                              sceneCandidateReviewed={Boolean(sceneCandidates[cut.id]?.reviewed)}
                              onReviewScene={reviewed => setSceneCandidates(current => current[cut.id] ? ({ ...current, [cut.id]: { ...current[cut.id], reviewed } }) : current)}
                              candidateStale={Boolean(sceneCandidates[cut.id] && project && sceneCandidates[cut.id].sourceHash !== sceneHash({ ...project, episodes }, ep, cut))}
                              sceneFeedback={visualError}
                              onAcceptScene={() => acceptScene(cutIdx)}
                              onDiscardScene={() => setSceneCandidates((current) => { const next = { ...current }; delete next[cut.id]; return next; })}
                              sceneStale={Boolean(cut.sceneImageAssetId && project && cut.sceneSourceHash !== sceneHash({ ...project, episodes }, ep, cut))}
                              generatingScene={sceneGeneratingIds.has(cut.id)}
                              onChange={(storyboard: StoryboardDocument) => replaceCut(cutIdx, (current) => ({ ...current, storyboard }))}
                              onRegenerateLayer={(layerId) => cut.storyboard?.sceneSketchAssetId ? void generateLayout(cutIdx, true) : void regenerateStoryboardLayer(cutIdx, layerId)}
                              onRegenerateLayers={(layerIds) => cut.storyboard?.sceneSketchAssetId ? void generateLayout(cutIdx, true) : void regenerateStoryboardLayers(cutIdx, layerIds)}
                              onRegenerateSketch={() => generateLayout(cutIdx, true)}
                              generatingSketch={layoutGeneratingIds.has(cut.id)}
                              layerBatchProgress={layerBatchProgress[cut.id]}
                              onCancelLayerBatch={() => { const batch = layerBatches.current.get(cut.id); if (batch) batch.cancelled = true; }}
                              onDetectAllPoses={() => detectAllCharacterPoses(cutIdx)}
                              onSetPoseReference={(layerId, file) => setPoseReference(cutIdx, layerId, file)}
                              onGenerateScene={() => generateScene(cutIdx)}
                            />
                            </>
                          ) : (
                            <div className="rounded-xl border border-dashed border-[#C4B5FD] bg-white py-8 text-center">
                              <Film className="w-7 h-7 text-[#C4B5FD] mx-auto mb-2" />
                              <p className="text-[11px] text-[#7A7067]">장면 전체 스케치를 만들고 세로 여백·대사를 편집하세요.</p>
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
              다음: 검수 · 완성 <ArrowRight className="w-3.5 h-3.5" />
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
          onGoAnyway={() => { setShowEmptyModal(false); router.push(projectHref(id, "submit")); }}
          onClose={() => setShowEmptyModal(false)}
          autofilling={autofilling}
        />
      )}

      <WebtoonPreviewModal
        open={previewOpen}
        title={`${ep?.episodeNumber ?? 1}화${ep?.title ? ` · ${ep.title}` : ""}`}
        cuts={ep?.cuts ?? []}
        onClose={() => setPreviewOpen(false)}
      />

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
