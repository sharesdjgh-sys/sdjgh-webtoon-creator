"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Captions,
  Circle,
  Copy,
  Download,
  Expand,
  MessageCircle,
  MousePointer2,
  Redo2,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Type,
  Undo2,
  User,
  X,
} from "lucide-react";
import type { Character, CharacterJointKey, StoryboardDocument, StoryboardElement, StoryboardElementType } from "@/lib/storage";
import { composeScenePng, defaultWebtoonFont, isOverlayElement, storyboardTextLines, storyboardToSvg, WEBTOON_FONT_OPTIONS, webtoonFontStack } from "@/lib/storyboardSvg";
import { CHARACTER_POSE_PRESETS, resolveCharacterRig } from "@/lib/storyboardRig";
import { downloadBlob, getMediaAsset } from "@/lib/mediaStorage";
import StoredImage from "@/components/visual/StoredImage";

type Props = {
  document: StoryboardDocument;
  characters: Character[];
  sceneAssetId?: string;
  sceneStale?: boolean;
  generatingScene?: boolean;
  onChange: (document: StoryboardDocument) => void;
  onGenerateScene: () => void;
};

type PointerAction = {
  mode: "drag" | "resize" | "joint";
  elementId: string;
  jointKey?: CharacterJointKey;
  startX: number;
  startY: number;
  original: StoryboardElement;
};

function labelForType(type: StoryboardElementType): string {
  return {
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
}: {
  element: StoryboardElement;
  characterName?: string;
  selected?: boolean;
  onJointPointerDown?: (event: React.PointerEvent, jointKey: CharacterJointKey) => void;
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
    const limb = (from: { x: number; y: number }, to: { x: number; y: number }, width = limbWidth) => (
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#5B21B6" strokeWidth={width} strokeLinecap="round" />
    );
    const joints = Object.keys(rig) as CharacterJointKey[];
    return (
      <>
        {limb(head, neck, limbWidth * 0.7)}
        {limb(leftShoulder, leftElbow)}{limb(leftElbow, leftHand, limbWidth * 0.82)}
        {limb(rightShoulder, rightElbow)}{limb(rightElbow, rightHand, limbWidth * 0.82)}
        {limb(leftHip, leftKnee, limbWidth * 1.15)}{limb(leftKnee, leftFoot)}
        {limb(rightHip, rightKnee, limbWidth * 1.15)}{limb(rightKnee, rightFoot)}
        <polygon points={`${leftShoulder.x},${leftShoulder.y} ${rightShoulder.x},${rightShoulder.y} ${rightHip.x},${rightHip.y} ${leftHip.x},${leftHip.y}`} fill="#EDE9FE" stroke="#5B21B6" strokeWidth={Math.max(4, limbWidth * 0.45)} strokeLinejoin="round" />
        <ellipse cx={head.x} cy={head.y} rx={headRadius * 0.82} ry={headRadius} fill="white" stroke="#5B21B6" strokeWidth={Math.max(4, limbWidth * 0.45)} />
        <path d={`M ${head.x} ${head.y + headRadius * 0.2} Q ${head.x + headRadius * 0.35} ${head.y + headRadius * 0.35} ${head.x + headRadius * 0.55} ${head.y + headRadius * 0.08}`} fill="none" stroke="#7C3AED" strokeWidth={Math.max(2, limbWidth * 0.25)} strokeLinecap="round" />
        <circle cx={leftHand.x} cy={leftHand.y} r={limbWidth * 0.62} fill="white" stroke="#5B21B6" strokeWidth={Math.max(3, limbWidth * 0.35)} />
        <circle cx={rightHand.x} cy={rightHand.y} r={limbWidth * 0.62} fill="white" stroke="#5B21B6" strokeWidth={Math.max(3, limbWidth * 0.35)} />
        <line x1={leftFoot.x - limbWidth} y1={leftFoot.y} x2={leftFoot.x + limbWidth * 1.2} y2={leftFoot.y} stroke="#5B21B6" strokeWidth={limbWidth * 0.8} strokeLinecap="round" />
        <line x1={rightFoot.x - limbWidth} y1={rightFoot.y} x2={rightFoot.x + limbWidth * 1.2} y2={rightFoot.y} stroke="#5B21B6" strokeWidth={limbWidth * 0.8} strokeLinecap="round" />
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
    return (
      <>
        <ellipse cx={centerX} cy={centerY} rx={Math.max(1, centerX - 3)} ry={Math.max(1, centerY - 3)} fill="white" stroke="#171717" strokeWidth={4} />
        <path d={`M ${element.width * 0.35} ${element.height * 0.86} L ${element.width * 0.22} ${element.height + 18} L ${element.width * 0.48} ${element.height * 0.91}`} fill="white" stroke="#171717" strokeWidth={4} strokeLinejoin="round" />
        {multilineText("대사")}
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

export default function StoryboardEditor({ document, characters, sceneAssetId, sceneStale, generatingScene, onChange, onGenerateScene }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [finalView, setFinalView] = useState(Boolean(sceneAssetId));
  const undoStack = useRef<StoryboardDocument[]>([]);
  const redoStack = useRef<StoryboardDocument[]>([]);
  const pointerAction = useRef<PointerAction | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const selected = document.elements.find((element) => element.id === selectedId);
  const characterNames = useMemo(() => new Map(characters.map((character) => [character.id, character.name])), [characters]);
  const visibleElements = document.elements
    .filter((element) => !finalView || !sceneAssetId || isOverlayElement(element))
    .sort((left, right) => left.zIndex - right.zIndex);

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

  const startPointer = (event: React.PointerEvent, element: StoryboardElement, mode: "drag" | "resize") => {
    event.stopPropagation();
    setSelectedId(element.id);
    setFinalView(false);
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

  const movePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const action = pointerAction.current;
    if (!action) return;
    const current = point(event);
    const dx = current.x - action.startX;
    const dy = current.y - action.startY;
    if (action.mode === "joint" && action.jointKey) {
      const baseRig = resolveCharacterRig(action.original);
      updateElement(action.elementId, {
        characterRig: {
          ...baseRig,
          [action.jointKey]: {
            x: Math.min(1, Math.max(0, (current.x - action.original.x) / action.original.width)),
            y: Math.min(1, Math.max(0, (current.y - action.original.y) / action.original.height)),
          },
        },
      }, false);
    } else if (action.mode === "drag") {
      updateElement(action.elementId, {
        x: Math.min(Math.max(0, action.original.x + dx), document.width - action.original.width),
        y: Math.min(Math.max(0, action.original.y + dy), document.height - action.original.height),
      }, false);
    } else {
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
      height: type === "character" ? document.height * 0.5 : document.height * 0.14,
      rotation: 0,
      zIndex: document.elements.length,
      text: labelForType(type),
      shape,
      characterId: type === "character" ? characters[0]?.id : undefined,
      fontFamily: isTextType ? defaultWebtoonFont(type) : undefined,
      fontWeight: type === "sfx" ? 900 : isTextType ? 600 : undefined,
    };
    apply({ ...document, elements: [...document.elements, element] });
    setSelectedId(element.id);
    setFinalView(false);
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
    const blob = new Blob([storyboardToSvg(document)], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, "webtoon-storyboard.svg");
  };

  const downloadFinal = async () => {
    const asset = await getMediaAsset(sceneAssetId);
    if (!asset) return;
    downloadBlob(await composeScenePng(document, asset.blob), "webtoon-panel.png");
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
          <button type="button" onClick={() => addElement("speech")} className="editor-tool"><MessageCircle className="w-3.5 h-3.5" /> 말풍선</button>
          <button type="button" onClick={() => addElement("caption")} className="editor-tool"><Captions className="w-3.5 h-3.5" /> 캡션</button>
          <button type="button" onClick={() => addElement("sfx")} className="editor-tool"><Type className="w-3.5 h-3.5" /> 효과음</button>
        </div>
        <div className="flex items-center gap-1.5">
          {sceneAssetId && <button type="button" onClick={() => setFinalView((value) => !value)} className="editor-tool"><MousePointer2 className="w-3.5 h-3.5" /> {finalView ? "구도 편집" : "완성 보기"}</button>}
          <button type="button" onClick={() => setExpanded((value) => !value)} className="editor-tool">{expanded ? <X className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}</button>
        </div>
      </div>

      <div className={`grid gap-3 ${expanded ? "lg:grid-cols-[1fr_280px]" : "xl:grid-cols-[1fr_240px]"}`}>
        <div className="relative bg-[#E9E4DC] rounded-xl p-3 min-h-[260px] flex items-center justify-center overflow-hidden">
          <div className="relative w-full max-h-[76vh] shadow-xl bg-white" style={{ aspectRatio: `${document.width}/${document.height}` }}>
            {sceneAssetId && finalView && <StoredImage assetId={sceneAssetId} alt="생성된 웹툰 장면" className="absolute inset-0 w-full h-full object-cover" />}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${document.width} ${document.height}`}
              className="absolute inset-0 w-full h-full touch-none select-none"
              onPointerMove={movePointer}
              onPointerUp={() => { pointerAction.current = null; }}
              onPointerCancel={() => { pointerAction.current = null; }}
              onPointerDown={() => setSelectedId(null)}
            >
              {!finalView && <rect width={document.width} height={document.height} fill="#FBF9F6" />}
              {visibleElements.map((element) => (
                <g
                  key={element.id}
                  transform={`translate(${element.x} ${element.y}) rotate(${element.rotation} ${element.width / 2} ${element.height / 2})`}
                  onPointerDown={(event) => startPointer(event, element, "drag")}
                  className="cursor-move"
                >
                  <SceneElement
                    element={element}
                    characterName={element.characterId ? characterNames.get(element.characterId) : undefined}
                    selected={selectedId === element.id && !finalView}
                    onJointPointerDown={(event, jointKey) => startJointPointer(event, element, jointKey)}
                  />
                  {selectedId === element.id && !finalView && (
                    <>
                      <rect x={-8} y={-8} width={element.width + 16} height={element.height + 16} fill="none" stroke="#7C3AED" strokeWidth={4} strokeDasharray="10 7" />
                      <circle cx={element.width + 8} cy={element.height + 8} r={15} fill="#7C3AED" stroke="white" strokeWidth={4} onPointerDown={(event) => startPointer(event, element, "resize")} className="cursor-se-resize" />
                    </>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="rounded-xl border border-[#EBE7E0] bg-white p-3 space-y-3">
          {selected ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#1A1A1A]">{labelForType(selected.type)} 설정</span>
                <button type="button" onClick={() => {
                  apply({ ...document, elements: document.elements.filter((element) => element.id !== selected.id) });
                  setSelectedId(null);
                }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              {selected.type === "character" && (
                <div className="space-y-2.5">
                  <select value={selected.characterId ?? ""} onChange={(event) => updateElement(selected.id, { characterId: event.target.value, text: characterNames.get(event.target.value) ?? "캐릭터" })} className="visual-input">
                    <option value="">캐릭터 선택</option>
                    {characters.map((character) => <option key={character.id} value={character.id}>{character.name || "이름 없음"}</option>)}
                  </select>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <p className="text-[11px] font-bold text-amber-800">포즈를 직접 수정할 수 있어요</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-amber-700">캔버스의 노란 관절점을 드래그하면 머리, 팔꿈치, 손, 무릎, 발이 각각 움직입니다.</p>
                  </div>
                  <div>
                    <label className="visual-label">포즈 프리셋</label>
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                      {CHARACTER_POSE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => updateElement(selected.id, { pose: preset.label, characterRig: structuredClone(preset.rig) })}
                          className="rounded-lg border border-[#E4DDF8] bg-white px-2 py-1.5 text-[10px] font-medium text-[#5B21B6] transition hover:border-[#A78BFA] hover:bg-[#F5F3FF] active:scale-95"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <label className="visual-label">표시 내용</label>
              <textarea value={selected.text} onChange={(event) => updateElement(selected.id, { text: event.target.value })} className="visual-input min-h-16 resize-none" />
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
              {selected.type === "character" && (
                <div className="grid grid-cols-2 gap-2">
                  <input value={selected.pose ?? ""} onChange={(event) => updateElement(selected.id, { pose: event.target.value })} placeholder="포즈 메모" className="visual-input" />
                  <input value={selected.expression ?? ""} onChange={(event) => updateElement(selected.id, { expression: event.target.value })} placeholder="표정 메모" className="visual-input" />
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
                <button type="button" onClick={() => updateElement(selected.id, { zIndex: Math.min(document.elements.length, selected.zIndex + 1) })} className="editor-tool justify-center"><ArrowUp className="w-3.5 h-3.5" /> 앞으로</button>
                <button type="button" onClick={() => updateElement(selected.id, { zIndex: Math.max(0, selected.zIndex - 1) })} className="editor-tool justify-center"><ArrowDown className="w-3.5 h-3.5" /> 뒤로</button>
              </div>
            </>
          ) : (
            <div className="py-8 text-center">
              <MousePointer2 className="w-6 h-6 text-[#D4CFC9] mx-auto mb-2" />
              <p className="text-xs text-[#ADA8A0] leading-relaxed">요소를 선택해 내용을 편집하거나<br />드래그해서 구도를 조정하세요.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={downloadSvg} className="editor-action"><Download className="w-3.5 h-3.5" /> SVG 저장</button>
          {sceneAssetId && <button type="button" onClick={downloadFinal} className="editor-action"><Download className="w-3.5 h-3.5" /> 최종 PNG</button>}
        </div>
        <div className="flex items-center gap-2">
          {sceneStale && sceneAssetId && <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded-full">구도가 변경되어 재생성이 필요해요</span>}
          <button type="button" disabled={generatingScene} onClick={onGenerateScene} className="inline-flex items-center gap-1.5 rounded-full bg-[#1A1A1A] text-white text-xs font-semibold px-4 py-2 hover:bg-black disabled:opacity-50">
            <Sparkles className="w-3.5 h-3.5" /> {generatingScene ? "콘티 좌표를 고정해 생성 중..." : sceneAssetId ? "이 콘티로 다시 생성" : "이 콘티 고정으로 장면 생성"}
          </button>
        </div>
      </div>
    </div>
  );

  return editor;
}
