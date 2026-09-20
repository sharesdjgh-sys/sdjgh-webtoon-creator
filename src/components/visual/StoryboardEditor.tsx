"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Captions,
  Circle,
  Copy,
  Download,
  Expand,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Layers3,
  Lock,
  MessageCircle,
  MousePointer2,
  Redo2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  User,
  X,
} from "lucide-react";
import type { Character, CharacterJointKey, StoryboardDocument, StoryboardElement, StoryboardElementType } from "@/lib/storage";
import { composeScenePng, defaultWebtoonFont, isOverlayElement, speechBalloonGeometry, storyboardTextLines, storyboardToSvg, WEBTOON_FONT_OPTIONS, webtoonFontStack } from "@/lib/storyboardSvg";
import { CHARACTER_POSE_PRESETS, resolveCharacterRig } from "@/lib/storyboardRig";
import { downloadBlob, getMediaAsset } from "@/lib/mediaStorage";
import StoredImage from "@/components/visual/StoredImage";
import { composeStoryboardPng } from "@/lib/storyboardComposite";
import AiActivityBanner from "@/components/AiActivityBanner";

type Props = {
  document: StoryboardDocument;
  characters: Character[];
  staleLayerIds?: Set<string>;
  generatingLayerIds?: Set<string>;
  sceneAssetId?: string;
  sceneStale?: boolean;
  generatingScene?: boolean;
  detectingAllPoses?: boolean;
  onChange: (document: StoryboardDocument) => void;
  onRegenerateLayer: (layerId: string) => void;
  onDetectAllPoses: () => void;
  onSetPoseReference: (layerId: string, file: File | null) => void;
  onGenerateScene: () => void;
};

type PointerAction = {
  mode: "drag" | "resize" | "joint" | "tail";
  elementId: string;
  jointKey?: CharacterJointKey;
  startX: number;
  startY: number;
  original: StoryboardElement;
};

function labelForType(type: StoryboardElementType): string {
  return {
    background: "배경",
    character: "캐릭터",
    prop: "소품",
    shape: "도형",
    arrow: "동선",
    speech: "대사",
    caption: "캡션",
    sfx: "효과음",
  }[type];
}

function defaultElementFontSize(element: StoryboardElement): number {
  if (element.type === "sfx") return Math.max(28, Math.min(72, element.height * 0.65));
  if (element.type === "caption") return Math.max(16, Math.min(26, element.height / 4));
  return Math.max(16, Math.min(28, element.height / 5));
}

function SceneElement({
  element,
  characterName,
  selected,
  onJointPointerDown,
  onTailPointerDown,
}: {
  element: StoryboardElement;
  characterName?: string;
  selected?: boolean;
  onJointPointerDown?: (event: React.PointerEvent, jointKey: CharacterJointKey) => void;
  onTailPointerDown?: (event: React.PointerEvent) => void;
}) {
  const centerX = element.width / 2;
  const centerY = element.height / 2;
  const fontFamily = webtoonFontStack(element.fontFamily ?? defaultWebtoonFont(element.type));
  const fontWeight = element.fontWeight ?? (element.type === "sfx" ? 900 : 600);
  const multilineText = (fallback: string) => {
    const fontSize = element.fontSize ?? defaultElementFontSize(element);
    const lines = storyboardTextLines(element.text || fallback, Math.max(5, Math.floor(element.width / (fontSize * 0.72))));
    const startY = centerY - ((lines.length - 1) * fontSize * 0.6);
    return (
      <text x={centerX} y={startY} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontWeight={fontWeight} style={{ fontFamily }}>
        {lines.map((line, index) => <tspan key={`${index}-${line}`} x={centerX} dy={index === 0 ? 0 : fontSize * 1.2}>{line || " "}</tspan>)}
      </text>
    );
  };
  if (element.type === "character") {
    const rig = resolveCharacterRig(element);
    const point = (key: CharacterJointKey) => ({ x: rig[key].x * element.width, y: rig[key].y * element.height });
    const head = point("head");
    const neck = point("neck");
    const leftShoulder = point("leftShoulder");
    const rightShoulder = point("rightShoulder");
    const leftElbow = point("leftElbow");
    const rightElbow = point("rightElbow");
    const leftHand = point("leftHand");
    const rightHand = point("rightHand");
    const leftHip = point("leftHip");
    const rightHip = point("rightHip");
    const leftKnee = point("leftKnee");
    const rightKnee = point("rightKnee");
    const leftFoot = point("leftFoot");
    const rightFoot = point("rightFoot");
    const headRadius = Math.max(14, Math.min(element.width, element.height) * 0.09);
    const limbWidth = Math.max(7, Math.min(element.width, element.height) * 0.035);
    const limb = (from: { x: number; y: number }, to: { x: number; y: number }, width: number, color = "#DDD6FE") => (
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={width} strokeLinecap="round" />
    );
    const outlinedLimb = (from: { x: number; y: number }, to: { x: number; y: number }, width: number) => (
      <>
        {limb(from, to, width + Math.max(3, limbWidth * 0.38), "#5B21B6")}
        {limb(from, to, width)}
      </>
    );
    const joints = Object.keys(rig) as CharacterJointKey[];
    return (
      <>
        {outlinedLimb(head, neck, limbWidth * 1.15)}
        {outlinedLimb(leftShoulder, leftElbow, limbWidth * 2.15)}{outlinedLimb(leftElbow, leftHand, limbWidth * 1.7)}
        {outlinedLimb(rightShoulder, rightElbow, limbWidth * 2.15)}{outlinedLimb(rightElbow, rightHand, limbWidth * 1.7)}
        {outlinedLimb(leftHip, leftKnee, limbWidth * 2.8)}{outlinedLimb(leftKnee, leftFoot, limbWidth * 2.15)}
        {outlinedLimb(rightHip, rightKnee, limbWidth * 2.8)}{outlinedLimb(rightKnee, rightFoot, limbWidth * 2.15)}
        <path d={`M ${leftShoulder.x} ${leftShoulder.y} Q ${head.x} ${neck.y + limbWidth} ${rightShoulder.x} ${rightShoulder.y} L ${rightHip.x} ${rightHip.y} Q ${head.x} ${Math.max(leftHip.y, rightHip.y) + limbWidth * 1.3} ${leftHip.x} ${leftHip.y} Z`} fill="#EDE9FE" stroke="#5B21B6" strokeWidth={Math.max(4, limbWidth * 0.45)} strokeLinejoin="round" />
        <path d={`M ${leftHip.x - limbWidth * 0.35} ${leftHip.y} Q ${head.x} ${leftHip.y + limbWidth * 2.4} ${rightHip.x + limbWidth * 0.35} ${rightHip.y}`} fill="none" stroke="#7C3AED" strokeWidth={Math.max(3, limbWidth * 0.35)} />
        <path d={`M ${head.x - headRadius * 0.78} ${head.y - headRadius * 0.45} Q ${head.x - headRadius * 0.65} ${head.y - headRadius} ${head.x} ${head.y - headRadius} Q ${head.x + headRadius * 0.72} ${head.y - headRadius * 0.9} ${head.x + headRadius * 0.78} ${head.y - headRadius * 0.35} L ${head.x + headRadius * 0.6} ${head.y + headRadius * 0.42} Q ${head.x} ${head.y + headRadius * 1.08} ${head.x - headRadius * 0.6} ${head.y + headRadius * 0.42} Z`} fill="#FFF7ED" stroke="#5B21B6" strokeWidth={Math.max(4, limbWidth * 0.45)} />
        <path d={`M ${head.x - headRadius * 0.8} ${head.y - headRadius * 0.35} Q ${head.x - headRadius * 0.45} ${head.y - headRadius * 1.18} ${head.x + headRadius * 0.72} ${head.y - headRadius * 0.52} Q ${head.x + headRadius * 0.25} ${head.y - headRadius * 0.62} ${head.x - headRadius * 0.05} ${head.y - headRadius * 0.18}`} fill="#C4B5FD" stroke="#5B21B6" strokeWidth={Math.max(3, limbWidth * 0.35)} strokeLinecap="round" />
        <path d={`M ${head.x - headRadius * 0.48} ${head.y} Q ${head.x} ${head.y - headRadius * 0.08} ${head.x + headRadius * 0.48} ${head.y}`} fill="none" stroke="#7C3AED" strokeWidth={Math.max(2, limbWidth * 0.25)} strokeLinecap="round" />
        <path d={`M ${head.x} ${head.y - headRadius * 0.55} L ${head.x + headRadius * 0.08} ${head.y + headRadius * 0.5}`} fill="none" stroke="#A78BFA" strokeWidth={Math.max(2, limbWidth * 0.2)} strokeDasharray="6 5" />
        <circle cx={leftHand.x} cy={leftHand.y} r={limbWidth * 0.9} fill="#FFF7ED" stroke="#5B21B6" strokeWidth={Math.max(3, limbWidth * 0.35)} />
        <circle cx={rightHand.x} cy={rightHand.y} r={limbWidth * 0.9} fill="#FFF7ED" stroke="#5B21B6" strokeWidth={Math.max(3, limbWidth * 0.35)} />
        <path d={`M ${leftFoot.x - limbWidth * 1.1} ${leftFoot.y} Q ${leftFoot.x} ${leftFoot.y - limbWidth * 0.7} ${leftFoot.x + limbWidth * 1.65} ${leftFoot.y + limbWidth * 0.15}`} fill="none" stroke="#5B21B6" strokeWidth={limbWidth * 1.15} strokeLinecap="round" />
        <path d={`M ${rightFoot.x - limbWidth * 1.1} ${rightFoot.y} Q ${rightFoot.x} ${rightFoot.y - limbWidth * 0.7} ${rightFoot.x + limbWidth * 1.65} ${rightFoot.y + limbWidth * 0.15}`} fill="none" stroke="#5B21B6" strokeWidth={limbWidth * 1.15} strokeLinecap="round" />
        <rect x={Math.max(0, head.x - element.width * 0.24)} y={0} width={element.width * 0.48} height={28} rx={10} fill="#5B21B6" />
        <text x={head.x} y={15} textAnchor="middle" dominantBaseline="middle" fontSize={16} fontWeight={700} fill="white">{characterName || element.text || "캐릭터"}</text>
        {selected && joints.map((jointKey) => {
          const joint = point(jointKey);
          return <circle key={jointKey} cx={joint.x} cy={joint.y} r={9} fill="#FDE68A" stroke="#7C3AED" strokeWidth={4} className="cursor-grab active:cursor-grabbing" onPointerDown={(event) => onJointPointerDown?.(event, jointKey)} />;
        })}
      </>
    );
  }
  if (element.type === "speech") {
    const balloon = speechBalloonGeometry(element);
    const style = element.balloonStyle ?? "normal";
    return (
      <>
        {style === "thought" ? (
          <>
            <ellipse cx={balloon.centerX} cy={balloon.centerY} rx={balloon.radiusX} ry={balloon.radiusY} fill="white" stroke="#171717" strokeWidth={4} />
            {balloon.thoughtDots.map((dot, index) => <circle key={index} cx={dot.x} cy={dot.y} r={dot.radius} fill="white" stroke="#171717" strokeWidth={3} />)}
          </>
        ) : style === "shout" ? (
          <>
            <polygon points={balloon.tailPoints} fill="white" stroke="#171717" strokeWidth={4} strokeLinejoin="round" />
            <polygon points={balloon.spikePoints} fill="white" stroke="#171717" strokeWidth={4} strokeLinejoin="round" />
          </>
        ) : style === "whisper" ? (
          <>
            <path d={`M ${balloon.boundaryX} ${balloon.boundaryY} Q ${(balloon.boundaryX + balloon.tailX) / 2 + 8} ${(balloon.boundaryY + balloon.tailY) / 2} ${balloon.tailX} ${balloon.tailY}`} fill="none" stroke="#555" strokeWidth={3} strokeDasharray="8 7" />
            <ellipse cx={balloon.centerX} cy={balloon.centerY} rx={balloon.radiusX} ry={balloon.radiusY} fill="white" stroke="#555" strokeWidth={3} strokeDasharray="9 7" />
          </>
        ) : (
          <>
            <polygon points={balloon.tailPoints} fill="white" stroke="#171717" strokeWidth={4} strokeLinejoin="round" />
            <ellipse cx={balloon.centerX} cy={balloon.centerY} rx={balloon.radiusX} ry={balloon.radiusY} fill="white" stroke="#171717" strokeWidth={4} />
          </>
        )}
        {multilineText("대사")}
        {selected && <circle cx={balloon.tailX} cy={balloon.tailY} r={11} fill="#FDE68A" stroke="#7C3AED" strokeWidth={4} className="cursor-crosshair" onPointerDown={onTailPointerDown} />}
      </>
    );
  }
  if (element.type === "caption") {
    return (
      <>
        <rect width={element.width} height={element.height} rx={8} fill="white" stroke="#171717" strokeWidth={4} />
        {multilineText("캡션")}
      </>
    );
  }
  if (element.type === "sfx") {
    const fontSize = element.fontSize ?? defaultElementFontSize(element);
    const lines = storyboardTextLines(element.text || "효과음", Math.max(3, Math.floor(element.width / (fontSize * 0.72))));
    const startY = centerY - ((lines.length - 1) * fontSize * 0.6);
    return (
      <text x={centerX} y={startY} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontWeight={fontWeight} fontStyle="italic" fill="#171717" stroke="white" strokeWidth={5} paintOrder="stroke" style={{ fontFamily }}>
        {lines.map((line, index) => <tspan key={`${index}-${line}`} x={centerX} dy={index === 0 ? 0 : fontSize * 1.2}>{line || " "}</tspan>)}
      </text>
    );
  }
  if (element.type === "arrow") {
    return (
      <>
        <line x1={8} y1={centerY} x2={Math.max(12, element.width - 18)} y2={centerY} stroke="#C2410C" strokeWidth={7} />
        <path d={`M ${element.width - 24} ${centerY - 16} L ${element.width - 4} ${centerY} L ${element.width - 24} ${centerY + 16}`} fill="none" stroke="#C2410C" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      </>
    );
  }
  return (
    <>
      {element.shape === "ellipse" ? (
        <ellipse cx={centerX} cy={centerY} rx={Math.max(1, centerX - 3)} ry={Math.max(1, centerY - 3)} fill="#F4F1EC" stroke="#7A7067" strokeWidth={4} strokeDasharray="12 8" />
      ) : (
        <rect width={element.width} height={element.height} rx={12} fill="#F4F1EC" stroke="#7A7067" strokeWidth={4} strokeDasharray="12 8" />
      )}
      <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="middle" fontSize={22} fontWeight={600} fill="#514A45">{element.text || labelForType(element.type)}</text>
    </>
  );
}

function LayoutControlOverlay({
  element,
  label,
  selected,
  flipped,
  onJointPointerDown,
}: {
  element: StoryboardElement;
  label: string;
  selected: boolean;
  flipped?: boolean;
  onJointPointerDown: (event: React.PointerEvent, jointKey: CharacterJointKey) => void;
}) {
  if (element.type !== "character") {
    return (
      <>
        <rect width={element.width} height={element.height} rx={12} fill="#7C3AED" fillOpacity={0.08} stroke="#7C3AED" strokeWidth={3} strokeDasharray="10 7" />
        <rect x={8} y={8} width={Math.min(element.width - 16, Math.max(72, label.length * 15))} height={28} rx={10} fill="#5B21B6" />
        <text x={18} y={23} dominantBaseline="middle" fontSize={14} fontWeight={700} fill="white">{label}</text>
      </>
    );
  }
  const rig = resolveCharacterRig(element);
  const point = (key: CharacterJointKey) => ({
    x: (flipped ? 1 - rig[key].x : rig[key].x) * element.width,
    y: rig[key].y * element.height,
  });
  const segments: Array<[CharacterJointKey, CharacterJointKey]> = [
    ["head", "neck"], ["neck", "leftShoulder"], ["neck", "rightShoulder"],
    ["leftShoulder", "leftElbow"], ["leftElbow", "leftHand"],
    ["rightShoulder", "rightElbow"], ["rightElbow", "rightHand"],
    ["leftShoulder", "leftHip"], ["rightShoulder", "rightHip"], ["leftHip", "rightHip"],
    ["leftHip", "leftKnee"], ["leftKnee", "leftFoot"],
    ["rightHip", "rightKnee"], ["rightKnee", "rightFoot"],
  ];
  return (
    <>
      <rect width={element.width} height={element.height} rx={12} fill="#7C3AED" fillOpacity={selected ? 0.1 : 0.04} stroke="#7C3AED" strokeWidth={3} strokeDasharray="10 7" />
      {segments.map(([from, to]) => {
        const start = point(from);
        const end = point(to);
        return <line key={`${from}-${to}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#7C3AED" strokeOpacity={0.72} strokeWidth={4} strokeDasharray="8 6" strokeLinecap="round" />;
      })}
      <rect x={8} y={8} width={Math.min(element.width - 16, Math.max(86, label.length * 16))} height={30} rx={10} fill="#5B21B6" />
      <text x={18} y={24} dominantBaseline="middle" fontSize={14} fontWeight={700} fill="white">{label}</text>
      {selected && (Object.keys(rig) as CharacterJointKey[]).map((jointKey) => {
        const joint = point(jointKey);
        return <circle key={jointKey} cx={joint.x} cy={joint.y} r={9} fill="#FDE68A" stroke="#5B21B6" strokeWidth={4} className="cursor-grab active:cursor-grabbing" onPointerDown={(event) => onJointPointerDown(event, jointKey)} />;
      })}
    </>
  );
}

export default function StoryboardEditor({ document, characters, staleLayerIds = new Set(), generatingLayerIds = new Set(), sceneAssetId, sceneStale, generatingScene, detectingAllPoses, onChange, onRegenerateLayer, onDetectAllPoses, onSetPoseReference, onGenerateScene }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [finalView, setFinalView] = useState(Boolean(sceneAssetId));
  const [showBlocking, setShowBlocking] = useState(false);
  const [showAdvancedPose, setShowAdvancedPose] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);
  const undoStack = useRef<StoryboardDocument[]>([]);
  const redoStack = useRef<StoryboardDocument[]>([]);
  const pointerAction = useRef<PointerAction | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const selected = document.elements.find((element) => element.id === selectedId);
  const selectedCharacter = selected?.type === "character"
    ? characters.find((character) => character.id === selected.characterId)
    : undefined;
  const characterNames = useMemo(() => new Map(characters.map((character) => [character.id, character.name])), [characters]);
  const visibleElements = document.elements
    .filter((element) => element.visible !== false && (!finalView || !sceneAssetId || isOverlayElement(element)))
    .sort((left, right) => left.zIndex - right.zIndex);
  const hasImageLayers = visibleElements.some((element) => ["background", "character", "prop"].includes(element.type) && element.assetId);
  const generatingThisStoryboard = document.elements.some((element) => generatingLayerIds.has(element.id));
  const generationStep = generationSeconds < 8
    ? "콘티의 구도와 레이어를 확인하고 있어요"
    : generationSeconds < 22
      ? "캐릭터 시트와 표정을 장면에 맞추고 있어요"
      : "Gemini가 완성 장면을 그리고 있어요";

  useEffect(() => {
    if (!generatingScene) {
      setGenerationSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => setGenerationSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [generatingScene]);

  const apply = (next: StoryboardDocument, remember = true) => {
    if (remember) {
      undoStack.current.push(structuredClone(document));
      redoStack.current = [];
    }
    onChange(next);
  };

  const updateElement = (id: string, changes: Partial<StoryboardElement>, remember = true) => {
    apply({ ...document, elements: document.elements.map((element) => element.id === id ? { ...element, ...changes } : element) }, remember);
  };

  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * document.width,
      y: ((event.clientY - rect.top) / rect.height) * document.height,
    };
  };

  const elementLocalPoint = (event: React.PointerEvent, element: StoryboardElement) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const canvasX = ((event.clientX - rect.left) / rect.width) * document.width;
    const canvasY = ((event.clientY - rect.top) / rect.height) * document.height;
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    const radians = -element.rotation * Math.PI / 180;
    const dx = canvasX - centerX;
    const dy = canvasY - centerY;
    let localX = dx * Math.cos(radians) - dy * Math.sin(radians) + element.width / 2;
    const localY = dx * Math.sin(radians) + dy * Math.cos(radians) + element.height / 2;
    if (element.flipX) localX = element.width - localX;
    return { x: localX, y: localY };
  };

  const startPointer = (event: React.PointerEvent, element: StoryboardElement, mode: "drag" | "resize") => {
    event.stopPropagation();
    setSelectedId(element.id);
    setFinalView(false);
    if (element.locked) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    undoStack.current.push(structuredClone(document));
    redoStack.current = [];
    pointerAction.current = {
      mode,
      elementId: element.id,
      startX: ((event.clientX - rect.left) / rect.width) * document.width,
      startY: ((event.clientY - rect.top) / rect.height) * document.height,
      original: structuredClone(element),
    };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const startJointPointer = (event: React.PointerEvent, element: StoryboardElement, jointKey: CharacterJointKey) => {
    event.stopPropagation();
    setSelectedId(element.id);
    setFinalView(false);
    if (element.locked) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    undoStack.current.push(structuredClone(document));
    redoStack.current = [];
    pointerAction.current = {
      mode: "joint",
      elementId: element.id,
      jointKey,
      startX: ((event.clientX - rect.left) / rect.width) * document.width,
      startY: ((event.clientY - rect.top) / rect.height) * document.height,
      original: structuredClone(element),
    };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const startTailPointer = (event: React.PointerEvent, element: StoryboardElement) => {
    event.stopPropagation();
    setSelectedId(element.id);
    setFinalView(false);
    if (element.locked) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    undoStack.current.push(structuredClone(document));
    redoStack.current = [];
    pointerAction.current = {
      mode: "tail",
      elementId: element.id,
      startX: ((event.clientX - rect.left) / rect.width) * document.width,
      startY: ((event.clientY - rect.top) / rect.height) * document.height,
      original: structuredClone(element),
    };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const movePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const action = pointerAction.current;
    if (!action) return;
    const current = point(event);
    const dx = current.x - action.startX;
    const dy = current.y - action.startY;
    if (action.mode === "joint" && action.jointKey) {
      const baseRig = resolveCharacterRig(action.original);
      const local = elementLocalPoint(event, action.original);
      updateElement(action.elementId, {
        characterRig: {
          ...baseRig,
          [action.jointKey]: {
            x: Math.min(1, Math.max(0, local.x / action.original.width)),
            y: Math.min(1, Math.max(0, local.y / action.original.height)),
          },
        },
      }, false);
    } else if (action.mode === "tail") {
      updateElement(action.elementId, {
        tailX: Math.min(2, Math.max(-1, (current.x - action.original.x) / action.original.width)),
        tailY: Math.min(2, Math.max(-1, (current.y - action.original.y) / action.original.height)),
      }, false);
    } else if (action.mode === "drag") {
      const minX = action.original.type === "background" ? Math.min(0, document.width - action.original.width) : 0;
      const minY = action.original.type === "background" ? Math.min(0, document.height - action.original.height) : 0;
      const maxX = action.original.type === "background" ? Math.max(0, document.width - action.original.width) : document.width - action.original.width;
      const maxY = action.original.type === "background" ? Math.max(0, document.height - action.original.height) : document.height - action.original.height;
      updateElement(action.elementId, {
        x: Math.min(Math.max(minX, action.original.x + dx), maxX),
        y: Math.min(Math.max(minY, action.original.y + dy), maxY),
      }, false);
    } else {
      if (action.original.type === "background") {
        const width = Math.min(Math.max(document.width, action.original.width + dx), document.width * 2);
        const height = width * document.height / document.width;
        updateElement(action.elementId, { width, height }, false);
        return;
      }
      updateElement(action.elementId, {
        width: Math.min(Math.max(50, action.original.width + dx), document.width - action.original.x),
        height: Math.min(Math.max(40, action.original.height + dy), document.height - action.original.y),
      }, false);
    }
  };

  const addElement = (type: StoryboardElementType, shape?: "rect" | "ellipse") => {
    const isTextType = type === "speech" || type === "caption" || type === "sfx";
    const element: StoryboardElement = {
      id: `element-${crypto.randomUUID()}`,
      type,
      x: document.width * 0.34,
      y: document.height * 0.34,
      width: type === "character" ? document.width * 0.22 : document.width * 0.3,
      height: type === "character" ? document.height * 0.5 : type === "arrow" ? document.height * 0.06 : document.height * 0.14,
      rotation: 0,
      zIndex: document.elements.length,
      text: labelForType(type),
      shape,
      characterId: type === "character" ? characters[0]?.id : undefined,
      fontFamily: isTextType ? defaultWebtoonFont(type) : undefined,
      fontWeight: type === "sfx" ? 900 : isTextType ? 600 : undefined,
      balloonStyle: type === "speech" ? "normal" : undefined,
      tailX: type === "speech" ? 0.25 : undefined,
      tailY: type === "speech" ? 1.22 : undefined,
      visible: true,
      locked: false,
      opacity: 1,
      flipX: false,
    };
    apply({ ...document, elements: [...document.elements, element] });
    setSelectedId(element.id);
    setFinalView(false);
    if (["character", "prop"].includes(element.type)) setShowBlocking(true);
  };

  const setSpeechSpeaker = (speech: StoryboardElement, characterId: string) => {
    const characterElement = document.elements.find((element) => element.type === "character" && element.characterId === characterId);
    if (!characterElement) {
      updateElement(speech.id, { speakerCharacterId: characterId || undefined });
      return;
    }
    const targetX = characterElement.x + characterElement.width * 0.5;
    const targetY = characterElement.y + characterElement.height * 0.34;
    updateElement(speech.id, {
      speakerCharacterId: characterId,
      tailX: Math.min(2, Math.max(-1, (targetX - speech.x) / speech.width)),
      tailY: Math.min(2, Math.max(-1, (targetY - speech.y) / speech.height)),
    });
  };

  const undo = () => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(structuredClone(document));
    onChange(previous);
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(structuredClone(document));
    onChange(next);
  };

  const downloadSvg = () => {
    const blob = new Blob([storyboardToSvg(document, { overlaysOnly: true, transparent: true })], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, "webtoon-storyboard-overlay.svg");
  };

  const downloadFinal = async () => {
    const asset = await getMediaAsset(sceneAssetId);
    if (!asset) return;
    downloadBlob(await composeScenePng(document, asset.blob), "webtoon-panel.png");
  };

  const downloadStoryboard = async () => {
    downloadBlob(await composeStoryboardPng(document), "webtoon-storyboard.png");
  };

  const editor = (
    <div className={expanded ? "fixed inset-0 z-[100] bg-[#FBF9F6] p-3 sm:p-6 overflow-auto" : "space-y-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={undo} title="실행 취소" className="editor-tool"><Undo2 className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={redo} title="다시 실행" className="editor-tool"><Redo2 className="w-3.5 h-3.5" /></button>
          <span className="w-px h-5 bg-[#EBE7E0] mx-1" />
          <button type="button" onClick={() => addElement("character")} className="editor-tool"><User className="w-3.5 h-3.5" /> 인물</button>
          <button type="button" onClick={() => addElement("prop")} className="editor-tool"><Square className="w-3.5 h-3.5" /> 소품</button>
          <button type="button" onClick={() => addElement("shape", "ellipse")} className="editor-tool"><Circle className="w-3.5 h-3.5" /> 도형</button>
          <button type="button" onClick={() => addElement("arrow")} className="editor-tool"><ArrowUp className="w-3.5 h-3.5 rotate-90" /> 동선</button>
          <button type="button" onClick={() => addElement("speech")} className="editor-tool"><MessageCircle className="w-3.5 h-3.5" /> 말풍선</button>
          <button type="button" onClick={() => addElement("caption")} className="editor-tool"><Captions className="w-3.5 h-3.5" /> 캡션</button>
          <button type="button" onClick={() => addElement("sfx")} className="editor-tool"><Type className="w-3.5 h-3.5" /> 효과음</button>
        </div>
        <div className="flex items-center gap-1.5">
          {!finalView && visibleElements.some((element) => element.type === "character") && <button type="button" onClick={() => setShowBlocking((value) => !value)} className={`editor-tool ${showBlocking ? "border-[#7C3AED] bg-[#F5F3FF] text-[#5B21B6]" : ""}`}><User className="w-3.5 h-3.5" /> {showBlocking ? "전체 포즈 닫기" : "전체 포즈 보기"}</button>}
          {!finalView && visibleElements.some((element) => element.type === "character" && element.assetId) && (
            <button type="button" disabled={detectingAllPoses} onClick={onDetectAllPoses} className="editor-tool">
              <RefreshCw className={`h-3.5 w-3.5 ${detectingAllPoses ? "animate-spin" : ""}`} /> {detectingAllPoses ? "모두 맞추는 중..." : "그림에 포즈 모두 맞추기"}
            </button>
          )}
          {sceneAssetId && <button type="button" onClick={() => setFinalView((value) => !value)} className="editor-tool"><MousePointer2 className="w-3.5 h-3.5" /> {finalView ? "구도 편집" : "완성 보기"}</button>}
          <button type="button" onClick={() => setExpanded((value) => !value)} className="editor-tool">{expanded ? <X className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}</button>
        </div>
      </div>

      <AiActivityBanner
        active={generatingThisStoryboard || Boolean(detectingAllPoses)}
        title={detectingAllPoses ? "AI가 모든 캐릭터의 포즈를 맞추고 있어요" : "AI가 선택한 레이어를 다시 그리고 있어요"}
        messages={detectingAllPoses
          ? ["캐릭터 그림을 한 명씩 확인하고 있어요.", "머리·어깨·손·무릎·발 위치를 찾고 있어요.", "찾은 관절을 콘티 좌표에 맞춰 저장하고 있어요."]
          : ["콘티의 위치와 포즈 지시를 확인하고 있어요.", "캐릭터 시트와 참고 포즈를 비교하고 있어요.", "Gemini가 새 레이어를 그리고 있어요.", "생성된 그림에서 실제 관절 위치를 분석하고 있어요."]}
      />

      <div className={`grid gap-3 ${expanded ? "lg:grid-cols-[minmax(0,1fr)_280px]" : "xl:grid-cols-[minmax(0,1fr)_240px]"}`}>
        <div className="relative bg-[#E9E4DC] rounded-xl p-3 min-h-[260px] flex items-center justify-center overflow-hidden">
          <div className="relative w-full shrink-0 shadow-xl bg-white" style={{ aspectRatio: `${document.width}/${document.height}`, maxWidth: `${76 * document.width / document.height}vh` }}>
            {sceneAssetId && finalView && <StoredImage assetId={sceneAssetId} alt="생성된 웹툰 장면" className="absolute inset-0 w-full h-full object-contain" />}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${document.width} ${document.height}`}
              className="absolute inset-0 z-[1000] w-full h-full touch-none select-none"
              onPointerMove={movePointer}
              onPointerUp={() => { pointerAction.current = null; }}
              onPointerCancel={() => { pointerAction.current = null; }}
              onPointerDown={() => setSelectedId(null)}
            >
              {!finalView && !hasImageLayers && <rect width={document.width} height={document.height} fill="#FBF9F6" />}
              {visibleElements.map((element) => (
                <g
                  key={element.id}
                  transform={`translate(${element.x} ${element.y}) rotate(${element.rotation} ${element.width / 2} ${element.height / 2})`}
                  opacity={element.opacity ?? 1}
                  onPointerDown={(event) => startPointer(event, element, "drag")}
                  className={element.locked ? "cursor-not-allowed" : "cursor-move"}
                >
                  {!finalView && element.assetId && ["background", "character", "prop"].includes(element.type) && (
                    <g transform={element.flipX ? `translate(${element.width} 0) scale(-1 1)` : undefined} pointerEvents="none">
                      <foreignObject width={element.width} height={element.height}>
                        <div className="h-full w-full overflow-hidden" style={{ opacity: showBlocking && selectedId === element.id && element.type === "character" ? 0.42 : 1 }}>
                          <StoredImage
                            assetId={element.assetId}
                            alt={`${element.text || labelForType(element.type)} 콘티 레이어`}
                            className="h-full w-full select-none"
                            style={{ objectFit: element.type === "background" ? "cover" : "contain" }}
                          />
                        </div>
                      </foreignObject>
                    </g>
                  )}
                  {!finalView && ["background", "character", "prop"].includes(element.type) ? (
                    !element.assetId || (showBlocking && element.type === "character") ? (
                      <LayoutControlOverlay
                        element={element}
                        label={element.characterId ? characterNames.get(element.characterId) ?? element.text : element.text || labelForType(element.type)}
                        selected={selectedId === element.id}
                        flipped={element.flipX}
                        onJointPointerDown={(event, jointKey) => startJointPointer(event, element, jointKey)}
                      />
                    ) : <rect width={element.width} height={element.height} fill="transparent" />
                  ) : (
                    <SceneElement
                      element={element}
                      characterName={element.characterId ? characterNames.get(element.characterId) : undefined}
                      selected={selectedId === element.id && !finalView}
                      onJointPointerDown={(event, jointKey) => startJointPointer(event, element, jointKey)}
                      onTailPointerDown={(event) => startTailPointer(event, element)}
                    />
                  )}
                  {selectedId === element.id && !finalView && !element.locked && (
                    <>
                      <rect x={-8} y={-8} width={element.width + 16} height={element.height + 16} fill="none" stroke="#7C3AED" strokeWidth={4} strokeDasharray="10 7" />
                      <circle cx={element.width + 8} cy={element.height + 8} r={15} fill="#7C3AED" stroke="white" strokeWidth={4} onPointerDown={(event) => startPointer(event, element, "resize")} className="cursor-se-resize" />
                    </>
                  )}
                </g>
              ))}
            </svg>
            {generatingScene && (
              <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-[#17131F]/70 p-5 backdrop-blur-[2px]" role="status" aria-live="polite">
                <div className="w-full max-w-[320px] rounded-2xl border border-white/20 bg-white p-5 text-center shadow-2xl">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F5F3FF] text-[#7C3AED]">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  </div>
                  <p className="text-sm font-bold text-[#1A1A1A]">웹툰 장면을 생성하고 있어요</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#6B625C]">{generationStep}</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EDE9FE]">
                    <div className="h-full w-2/5 animate-[webtoon-progress_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#A78BFA] to-[#7C3AED]" />
                  </div>
                  <p className="mt-3 text-[10px] font-medium text-[#8C837A]">{generationSeconds}초 경과 · 보통 30초~2분 정도 걸려요</p>
                  <p className="mt-1 text-[10px] text-[#ADA8A0]">완료될 때까지 이 화면을 닫지 마세요.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#EBE7E0] bg-white p-3 space-y-3">
          <div className="rounded-lg border border-[#EBE7E0] bg-[#FBF9F6] p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#514A45]"><Layers3 className="h-3.5 w-3.5" /> 레이어</span>
              <span className="text-[9px] text-[#ADA8A0]">{document.elements.length}개</span>
            </div>
            <div className="max-h-40 space-y-1 overflow-auto">
              {document.elements.slice().sort((left, right) => right.zIndex - left.zIndex).map((layer) => (
                <div key={layer.id} className={`flex items-center gap-1 rounded-md border px-1.5 py-1 ${selectedId === layer.id ? "border-[#A78BFA] bg-[#F5F3FF]" : "border-transparent bg-white"}`}>
                  <button type="button" onClick={() => { setSelectedId(layer.id); setFinalView(false); }} className="min-w-0 flex-1 truncate text-left text-[10px] font-medium text-[#514A45]">
                    {staleLayerIds.has(layer.id) && <span className="mr-1 text-orange-500">●</span>}{layer.characterId ? characterNames.get(layer.characterId) ?? layer.text : layer.text || labelForType(layer.type)}
                  </button>
                  <button type="button" title={layer.visible === false ? "표시" : "숨김"} onClick={() => updateElement(layer.id, { visible: layer.visible === false })} className="rounded p-1 text-[#8C837A] hover:bg-white">
                    {layer.visible === false ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </button>
                  <button type="button" title={layer.locked ? "잠금 해제" : "잠금"} onClick={() => updateElement(layer.id, { locked: !layer.locked })} className="rounded p-1 text-[#8C837A] hover:bg-white">
                    {layer.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
          {selected ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1A1A1A]">{labelForType(selected.type)} 설정</span>
                <button type="button" onClick={() => {
                  apply({ ...document, elements: document.elements.filter((element) => element.id !== selected.id) });
                  setSelectedId(null);
                }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              {["background", "character", "prop"].includes(selected.type) && (
                <div className="space-y-2 rounded-xl border border-[#DDD6FE] bg-[#FAF8FF] p-3">
                  <button
                    type="button"
                    disabled={generatingLayerIds.has(selected.id)}
                    onClick={() => onRegenerateLayer(selected.id)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#7C3AED] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#6D28D9] active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${generatingLayerIds.has(selected.id) ? "animate-spin" : ""}`} />
                    {generatingLayerIds.has(selected.id) ? "이 레이어 그리는 중..." : !selected.assetId ? "이 레이어 생성" : staleLayerIds.has(selected.id) ? "포즈·표정 수정 적용" : "이 레이어 다시 그리기"}
                  </button>
                  {staleLayerIds.has(selected.id) && <p className="text-[10px] text-orange-600">포즈·표정 변경이 아직 이미지에 반영되지 않았습니다.</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => updateElement(selected.id, { flipX: !selected.flipX })} className="editor-tool justify-center"><FlipHorizontal2 className="h-3.5 w-3.5" /> 좌우 반전</button>
                    <button type="button" onClick={() => updateElement(selected.id, { locked: !selected.locked })} className="editor-tool justify-center">{selected.locked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />} {selected.locked ? "잠금 해제" : "잠금"}</button>
                  </div>
                  <label className="visual-label">불투명도 {Math.round((selected.opacity ?? 1) * 100)}%</label>
                  <input type="range" min="0.1" max="1" step="0.05" value={selected.opacity ?? 1} onChange={(event) => updateElement(selected.id, { opacity: Number(event.target.value) })} className="w-full accent-[#7C3AED]" />
                </div>
              )}
              {selected.type === "character" && (
                <div className="space-y-2.5">
                  <select value={selected.characterId ?? ""} onChange={(event) => updateElement(selected.id, { characterId: event.target.value, text: characterNames.get(event.target.value) ?? "캐릭터" })} className="visual-input">
                    <option value="">캐릭터 선택</option>
                    {characters.map((character) => <option key={character.id} value={character.id}>{character.name || "이름 없음"}</option>)}
                  </select>
                  <div className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-[10px] ${selectedCharacter?.imageAssetId ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                    <span className="font-semibold">{selectedCharacter?.imageAssetId ? "캐릭터 시트 연결됨" : "캐릭터 시트가 필요해요"}</span>
                    <span>{selectedCharacter?.imageAssetId ? "전체 시트 + 전신 확대 참조" : "캐릭터 메뉴에서 먼저 생성"}</span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="visual-label">1. 그림으로 자세 선택</label>
                      <span className="text-[9px] text-[#9A8F86]">선택 후 위 버튼으로 적용</span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      {CHARACTER_POSE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => { updateElement(selected.id, { pose: preset.label, characterRig: structuredClone(preset.rig), poseReferenceAssetId: undefined }); setShowBlocking(false); }}
                          className={`overflow-hidden rounded-xl border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${selected.pose === preset.label && !selected.poseReferenceAssetId ? "border-[#7C3AED] ring-2 ring-[#7C3AED]/15" : "border-[#E4DDF8]"}`}
                        >
                          <span className="relative block aspect-[4/3] bg-[#F4F1EC]"><Image src={`/pose-guides/${preset.id}.jpg`} alt={`${preset.label} 자세`} fill sizes="100px" className="object-cover" /></span>
                          <span className="block px-2 py-1.5 text-center text-[10px] font-semibold text-[#5B21B6]">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#E4DDF8] bg-[#FAF8FF] p-3">
                    <label className="visual-label">2. 말로 원하는 자세 설명</label>
                    <textarea value={selected.pose ?? ""} onChange={(event) => updateElement(selected.id, { pose: event.target.value, poseReferenceAssetId: undefined })} placeholder="예: 오른손에 사진을 들고 복도 안쪽으로 반걸음 먼저 내딛기" className="visual-input mt-1.5 min-h-20 resize-none" />
                    <input value={selected.expression ?? ""} onChange={(event) => updateElement(selected.id, { expression: event.target.value })} placeholder="표정: 무심한 척하지만 날카로운 눈빛" className="visual-input mt-2" />
                    <button type="button" disabled={generatingLayerIds.has(selected.id)} onClick={() => onRegenerateLayer(selected.id)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#7C3AED] px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50">
                      <Sparkles className="h-3.5 w-3.5" /> 이 설명으로 다시 그리기
                    </button>
                  </div>
                  <div className="rounded-xl border border-[#DDE7F5] bg-[#F8FBFF] p-3">
                    <label className="visual-label">3. 참고할 포즈 사진</label>
                    {selected.poseReferenceAssetId ? (
                      <div className="mt-2 flex gap-2">
                        <StoredImage assetId={selected.poseReferenceAssetId} alt="사용자가 올린 포즈 참고 이미지" className="h-24 w-20 rounded-lg border border-[#DDE7F5] bg-white object-contain" />
                        <div className="flex flex-1 flex-col justify-center gap-1.5">
                          <p className="text-[10px] leading-relaxed text-[#58708D]">이 사진에서는 자세만 가져오고 캐릭터 외형은 시트를 유지합니다.</p>
                          <button type="button" onClick={() => onSetPoseReference(selected.id, null)} className="editor-tool justify-center">참고 사진 제거</button>
                        </div>
                      </div>
                    ) : (
                      <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#AFC6E3] bg-white px-3 py-3 text-[11px] font-semibold text-[#4B6F97] hover:bg-[#F2F7FC]">
                        <Upload className="h-3.5 w-3.5" /> 사진 또는 포즈 이미지 올리기
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onSetPoseReference(selected.id, file); event.currentTarget.value = ""; }} />
                      </label>
                    )}
                  </div>
                  <div className="rounded-xl border border-[#EBE7E0] bg-[#FBF9F6] p-3">
                    <button type="button" onClick={() => { setShowAdvancedPose((value) => !value); setShowBlocking(true); }} className="flex w-full items-center justify-between text-[11px] font-bold text-[#514A45]">
                      <span>4. 고급 조정 · 관절 직접 수정</span><span>{showAdvancedPose ? "접기" : "열기"}</span>
                    </button>
                    {showAdvancedPose && <p className="mt-2 text-[10px] leading-relaxed text-[#7A7067]">그림 위 노란 관절을 움직여 미세 조정합니다. 보라색 박스 안쪽을 끌면 캐릭터 전체가 이동합니다.</p>}
                  </div>
                </div>
              )}
              <label className="visual-label">표시 내용</label>
              <textarea value={selected.text} onChange={(event) => updateElement(selected.id, { text: event.target.value })} className="visual-input min-h-16 resize-none" />
              {selected.type === "speech" && (
                <div className="space-y-2.5 rounded-xl border border-[#F1D5B9] bg-[#FFF9F2] p-3">
                  <div>
                    <label className="visual-label">말풍선 종류</label>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      {([
                        ["normal", "일반 대사"],
                        ["thought", "생각"],
                        ["shout", "외침"],
                        ["whisper", "속삭임"],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateElement(selected.id, { balloonStyle: value })}
                          className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition active:scale-95 ${selected.balloonStyle === value || (!selected.balloonStyle && value === "normal") ? "border-[#7C3AED] bg-[#F5F3FF] text-[#5B21B6]" : "border-[#E8DCCF] bg-white text-[#7A7067] hover:border-[#C4B5FD]"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="visual-label">화자와 꼬리 방향</label>
                    <select
                      value={selected.speakerCharacterId ?? ""}
                      onChange={(event) => setSpeechSpeaker(selected, event.target.value)}
                      className="visual-input mt-1.5"
                    >
                      <option value="">화자 직접 지정 안 함</option>
                      {characters.map((character) => <option key={character.id} value={character.id}>{character.name || "이름 없음"}</option>)}
                    </select>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-[#9A7654]">화자를 선택하면 꼬리가 인물을 향합니다. 캔버스의 노란 핸들을 드래그해 정확한 방향을 조절할 수 있어요.</p>
                  </div>
                </div>
              )}
              {isOverlayElement(selected) && (
                <div className="space-y-2.5 rounded-xl border border-[#E4DDF8] bg-[#FAF8FF] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#5B21B6]">웹툰 글꼴</span>
                    <span className="text-[9px] text-[#8B7EAE]">요소마다 개별 설정</span>
                  </div>
                  <select
                    value={selected.fontFamily ?? defaultWebtoonFont(selected.type)}
                    onChange={(event) => updateElement(selected.id, { fontFamily: event.target.value as StoryboardElement["fontFamily"] })}
                    className="visual-input"
                  >
                    {WEBTOON_FONT_OPTIONS.map((font) => (
                      <option key={font.value} value={font.value}>{font.label} · {font.description}</option>
                    ))}
                  </select>
                  <div
                    className="flex min-h-14 items-center justify-center rounded-lg border border-[#E4DDF8] bg-white px-3 text-center text-xl text-[#1A1A1A]"
                    style={{
                      fontFamily: webtoonFontStack(selected.fontFamily ?? defaultWebtoonFont(selected.type)),
                      fontSize: Math.min(32, selected.fontSize ?? defaultElementFontSize(selected)),
                      fontWeight: selected.fontWeight ?? (selected.type === "sfx" ? 900 : 600),
                    }}
                  >
                    {selected.text || (selected.type === "sfx" ? "쾅!" : selected.type === "caption" ? "그날의 기억" : "무슨 일이야?")}
                  </div>
                  <label className="visual-label">글자 크기 {Math.round(selected.fontSize ?? defaultElementFontSize(selected))}</label>
                  <input
                    type="range"
                    min="12"
                    max="120"
                    step="1"
                    value={selected.fontSize ?? defaultElementFontSize(selected)}
                    onChange={(event) => updateElement(selected.id, { fontSize: Number(event.target.value) })}
                    className="w-full accent-[#7C3AED]"
                  />
                  <label className="visual-label">글자 굵기</label>
                  <select
                    value={selected.fontWeight ?? (selected.type === "sfx" ? 900 : 600)}
                    onChange={(event) => updateElement(selected.id, { fontWeight: Number(event.target.value) })}
                    className="visual-input"
                  >
                    <option value="400">보통</option>
                    <option value="500">중간</option>
                    <option value="600">약간 굵게</option>
                    <option value="700">굵게</option>
                    <option value="800">매우 굵게</option>
                    <option value="900">강조</option>
                  </select>
                </div>
              )}
              <label className="visual-label">회전 {Math.round(selected.rotation)}°</label>
              <input type="range" min="-180" max="180" value={selected.rotation} onChange={(event) => updateElement(selected.id, { rotation: Number(event.target.value) })} className="w-full accent-[#7C3AED]" />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => {
                  const copy = { ...selected, id: `element-${crypto.randomUUID()}`, x: selected.x + 20, y: selected.y + 20, zIndex: document.elements.length };
                  apply({ ...document, elements: [...document.elements, copy] });
                  setSelectedId(copy.id);
                }} className="editor-tool justify-center"><Copy className="w-3.5 h-3.5" /> 복제</button>
                <button type="button" onClick={() => updateElement(selected.id, { rotation: 0 })} className="editor-tool justify-center"><RotateCcw className="w-3.5 h-3.5" /> 회전 초기화</button>
                <button type="button" onClick={() => updateElement(selected.id, { zIndex: Math.max(...document.elements.map((element) => element.zIndex), 0) + 1 })} className="editor-tool justify-center"><ArrowUp className="w-3.5 h-3.5" /> 앞으로</button>
                <button type="button" onClick={() => updateElement(selected.id, { zIndex: Math.min(...document.elements.map((element) => element.zIndex), 0) - 1 })} className="editor-tool justify-center"><ArrowDown className="w-3.5 h-3.5" /> 뒤로</button>
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <MousePointer2 className="w-6 h-6 text-[#D4CFC9] mx-auto mb-2" />
              <p className="text-xs text-[#ADA8A0] leading-relaxed">
                캔버스나 레이어 목록에서 요소를 선택하고<br />직접 이동·크기·포즈를 조정하세요.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={downloadStoryboard} className="editor-action"><Download className="w-3.5 h-3.5" /> 콘티 PNG</button>
          <button type="button" onClick={downloadSvg} className="editor-action"><Download className="w-3.5 h-3.5" /> 오버레이 SVG</button>
          {sceneAssetId && <button type="button" onClick={downloadFinal} className="editor-action"><Download className="w-3.5 h-3.5" /> 최종 PNG</button>}
        </div>
        <div className="flex items-center gap-2">
          {staleLayerIds.size > 0 && <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded-full">수정 적용이 필요한 레이어 {staleLayerIds.size}개</span>}
          {sceneStale && sceneAssetId && <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded-full">비율·구도가 변경되었습니다. 기존 그림은 여백을 두고 표시되며, 새 구도는 재생성해주세요.</span>}
          <button type="button" disabled={generatingScene} onClick={onGenerateScene} className="inline-flex items-center gap-1.5 rounded-full bg-[#1A1A1A] text-white text-xs font-semibold px-4 py-2 hover:bg-black disabled:cursor-wait disabled:opacity-80">
            {generatingScene ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {generatingScene ? `장면 생성 중 · ${generationSeconds}초` : sceneAssetId ? "이 콘티로 다시 생성" : "이 콘티 고정으로 장면 생성"}
          </button>
        </div>
      </div>
    </div>
  );

  return editor;
}
