import { normalizeWebtoonShot } from "@/lib/webtoonShots";
import { ensureProjectAddresses } from "@/lib/projectAddress";
import { DEFAULT_BRIEF, DEFAULT_WORLD, type CreativeBrief, type WorldBible } from "@/lib/creation";
import { deleteOciProject, getOciAssetProject, getOciSessionEpoch, putOciAsset, putOciProject, type ServerProjectRecord } from "@/lib/ociClient";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ArtStylePreset = "clean-webtoon" | "romance-watercolor" | "action-contrast" | "dark-noir" | "pencil-sketch";

export type ArtDirection = {
  preset: ArtStylePreset;
  custom: string;
};

export type PanelAspectRatio = typeof import("./webtoonDesign").PANEL_RATIOS[number];
export type WebtoonFontFamily = "clean" | "serif" | "handwritten" | "cute" | "comic" | "impact";
export type SpeechBalloonStyle = typeof import("./webtoonDesign").BALLOON_STYLES[number];
export type CharacterJointKey =
  | "head"
  | "neck"
  | "leftShoulder"
  | "leftElbow"
  | "leftHand"
  | "rightShoulder"
  | "rightElbow"
  | "rightHand"
  | "leftHip"
  | "rightHip"
  | "leftKnee"
  | "leftFoot"
  | "rightKnee"
  | "rightFoot";
export type CharacterRig = Record<CharacterJointKey, { x: number; y: number }>;

export type StoryboardElementType =
  | "background"
  | "character"
  | "prop"
  | "shape"
  | "arrow"
  | "speech"
  | "caption"
  | "sfx";

export type StoryboardElement = {
  id: string;
  type: StoryboardElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  text: string;
  characterId?: string;
  shape?: "rect" | "ellipse";
  pose?: string;
  poseReferenceAssetId?: string;
  expression?: string;
  fontFamily?: WebtoonFontFamily;
  fontSize?: number;
  fontWeight?: number;
  textColor?: string;
  textGradient?: boolean;
  textGradientColor?: string;
  textGradientAngle?: number;
  textStrokeColor?: string;
  textStrokeWidth?: number;
  balloonFill?: string;
  balloonStroke?: string;
  balloonStrokeWidth?: number;
  characterRig?: CharacterRig;
  poseControlEdited?: boolean;
  poseDescriptionEdited?: boolean;
  placement?: "art" | "before" | "after" | "top-edge" | "bottom-edge" | "canvas";
  flowOrder?: number;
  flowSpacing?: number;
  balloonStyle?: SpeechBalloonStyle;
  tailVisible?: boolean;
  speechRole?: "dialogue" | "thought" | "narration" | "broadcast";
  lineHeight?: number;
  textItalic?: boolean;
  tailX?: number;
  tailY?: number;
  speakerCharacterId?: string;
  assetId?: string;
  assetSourceHash?: string;
  visible?: boolean;
  locked?: boolean;
  opacity?: number;
  flipX?: boolean;
};

export type SceneDirection = {
  beat: "quiet" | "anticipation" | "movement" | "impact" | "aftermath" | "reveal";
  acting: string; lighting: string; effects: string; continuity: string; readingPath: string;
};
export type SceneAnatomyReview = {
  status: "pass" | "fail" | "uncertain" | "unavailable";
  issues: string[];
  people: Array<{ label: string; bodyPlan: "human" | "nonhuman"; visibleHands: number; visibleArms: number; limbTrace: string; verdict: "pass" | "fail" | "uncertain"; issues: string[] }>;
};
export type SceneReview = { anatomy?: SceneAnatomyReview; repair?: { outcome: "corrected" | "unresolved" | "failed"; initialIssues: string[] }; status: "checked" | "unavailable"; issues: string[]; protectedRegions: Array<{ x: number; y: number; width: number; height: number; label: string }> };

export type StoryboardDocument = {
  direction?: SceneDirection;
  version: 2;
  aspectRatio: PanelAspectRatio;
  width: number;
  height: number;
  elements: StoryboardElement[];
  sceneSketchAssetId?: string;
  flow?: { before: number; after: number; inset: number; align?: "left" | "center" | "right" };
};

function migrateStoryboard(cut: Cut): StoryboardDocument | undefined {
  const source = cut.storyboard as (Omit<StoryboardDocument, "version"> & { version?: number }) | undefined;
  if (!source?.elements?.length) return undefined;
  const hasBackground = source.elements.some((element) => element.type === "background");
  const legacyComposite = cut.storyboardImageAssetId && !hasBackground;
  const migratedElements: StoryboardElement[] = source.elements.map((element) => ({
    ...element,
    visible: legacyComposite && ["character", "prop", "shape", "arrow"].includes(element.type) ? false : element.visible ?? true,
    locked: element.locked ?? false,
    opacity: element.opacity ?? 1,
    flipX: element.flipX ?? false,
  }));
  if (legacyComposite) {
    migratedElements.unshift({
      id: makeId("layer-background"),
      type: "background",
      x: 0,
      y: 0,
      width: source.width,
      height: source.height,
      rotation: 0,
      zIndex: -100,
      text: "기존 합성 콘티",
      assetId: cut.storyboardImageAssetId,
      assetSourceHash: cut.storyboardImageSourceHash,
      visible: true,
      locked: true,
      opacity: 1,
      flipX: false,
    });
  }
  return { ...source, version: 2, elements: migratedElements };
}

export type CharacterVisualProfile = {
  gender: string;
  heightBuild: string;
  faceShape: string;
  eyes: string;
  noseMouth: string;
  skinTone: string;
  hair: string;
  distinctiveFeatures: string;
  outfit: string;
  shoes: string;
  accessories: string;
  colorPalette: string;
};

export type Character = {
  id: string;
  name: string;
  role: string;
  age: string;
  appearance: string;
  personality: string;
  backstory: string;
  goal?: string;
  fear?: string;
  weakness?: string;
  growth?: string;
  speechStyle?: string;
  relationships?: string;
  visualProfile: CharacterVisualProfile;
  imageInstructions?: string;
  imageAssetId?: string;
  imageSourceHash?: string;
  referenceAssetIds?: string[];
};

export type Cut = {
  id: string;
  purpose?: string;
  emotion?: string;
  continuityNotes?: string;
  scrollGap?: "short" | "normal" | "long";
  angle: string;
  description: string;
  dialogue: string;
  soundEffect: string;
  characterIds: string[];
  aspectRatio: PanelAspectRatio;
  storyboard?: StoryboardDocument;
  storyboardImageAssetId?: string;
  storyboardImageSourceHash?: string;
  sceneImageAssetId?: string;
  sceneSourceHash?: string;
  sceneReview?: SceneReview;
};

export type Episode = {
  episodeNumber: number;
  goal?: string;
  obstacle?: string;
  turningPoint?: string;
  endingHook?: string;
  title: string;
  synopsis: string;
  cuts: Cut[];
  script: string;
  isCompleted: boolean;
};

export type PlanningDoc = {
  name: string;
  text: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  shortId?: string;
  workflowVersion?: number;
  brief: CreativeBrief;
  /** 학생이 따로 작성해 올린 기획서 본문. AI 대화와 자동 채우기가 함께 참고합니다. */
  planningDoc?: PlanningDoc;
  world: WorldBible;
  worldChat?: ChatMessage[];
  title: string;
  author: string;
  genre: string;
  targetCompetition: string;
  deadline: string;
  currentStep: number;
  isCompleted: boolean;
  authorNote: string;
  reviewChecks?: Record<string, boolean>;
  createdAt: string;
  story: {
    logline: string;
    theme: string;
    setting: string;
    plotOutline: string;
    totalEpisodes: string;
    conflict?: string;
    stakes?: string;
    ordinary?: string;
    incident?: string;
    escalation?: string;
    choice?: string;
    ending?: string;
  };
  artDirection: ArtDirection;
  characters: Character[];
  episodes: Episode[];
  ideaChat: ChatMessage[];
  storyChat?: ChatMessage[];
  characterChat?: ChatMessage[];
  episodeChat?: ChatMessage[];
  scriptChat?: ChatMessage[];
};

const KEY = "webtoon_projects";
let serverProjects: Project[] | null = null;
const serverRevisions = new Map<string, number>();
const uploadedAssets = new Set<string>();
const serverErrors = new Map<string, string>();
let serverQueue: Promise<void> = Promise.resolve();
let localScheduling: Promise<void> = Promise.resolve();

function notifyProjectsChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("webtoon-projects-changed"));
}

function referencedMediaIds(value: unknown, found = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    for (const item of value) referencedMediaIds(item, found);
  } else {
    for (const [key, item] of Object.entries(value)) {
      if (/AssetIds?$/.test(key) || key === "assetId") {
        for (const id of Array.isArray(item) ? item : [item]) {
          if (typeof id === "string" && id.startsWith("media-")) found.add(id);
        }
      } else referencedMediaIds(item, found);
    }
  }
  return found;
}

function queueServerWrite(id: string, write: () => Promise<void>): void {
  const epoch = getOciSessionEpoch();
  serverQueue = serverQueue.catch(() => {}).then(async () => {
    // 재로그인·계정 전환 후에는 이전 계정의 대기 중인 쓰기를 새 토큰으로 보내지 않는다.
    if (epoch !== getOciSessionEpoch()) return;
    try { await write(); serverErrors.delete(id); }
    catch (error) {
      serverErrors.set(id, error instanceof Error ? error.message : "서버 저장에 실패했어요.");
      throw error;
    } finally { notifyProjectsChanged(); }
  });
  // 자동 저장 실패도 전역 상태에 남겨 화면에 표시한다.
  void serverQueue.catch(() => {});
}

async function syncProject(project: Project): Promise<void> {
  const { getLocalMediaAsset } = await import("@/lib/mediaStorage");
  for (const assetId of referencedMediaIds(project)) {
    if (uploadedAssets.has(assetId) || getOciAssetProject(assetId) === project.id) continue;
    const asset = await getLocalMediaAsset(assetId);
    if (asset) { await putOciAsset(asset); uploadedAssets.add(assetId); }
  }
  const revision = await putOciProject(project, serverRevisions.get(project.id) ?? 0);
  serverRevisions.set(project.id, revision);
}

export function isServerStorageActive(): boolean { return serverProjects !== null; }
export function getServerSaveError(): string | null { return serverErrors.values().next().value ?? null; }
export async function retryServerWrites(): Promise<void> {
  if (serverProjects === null) return;
  for (const id of serverErrors.keys()) {
    const project = serverProjects.find(item => item.id === id);
    if (project) queueServerWrite(id, () => syncProject(project));
    else if (serverRevisions.has(id)) queueServerWrite(id, async () => {
      const revision = serverRevisions.get(id);
      if (revision === undefined) return;
      await deleteOciProject(id, revision);
      serverRevisions.delete(id);
    });
  }
  await flushServerWrites();
}
export async function flushServerWrites(): Promise<void> {
  if (serverProjects === null) {
    await localScheduling;
    const { flushLocalFileWrites } = await import("./fileSystemStorage");
    await flushLocalFileWrites();
    return;
  }
  let pending: Promise<void>;
  do {
    pending = serverQueue;
    await pending.catch(() => {});
  } while (pending !== serverQueue);
  const error = getServerSaveError();
  if (error) throw new Error(error);
}

export function activateServerProjects(records: ServerProjectRecord[]): void {
  serverProjects = ensureProjectAddresses(records.map(({ project }) => normalizeProject(project)));
  serverRevisions.clear();
  uploadedAssets.clear();
  serverErrors.clear();
  for (const { project, revision } of records) {
    serverRevisions.set(project.id, revision);
    for (const id of referencedMediaIds(project)) uploadedAssets.add(id);
  }
  notifyProjectsChanged();
}

export function deactivateServerProjects(): void {
  serverProjects = null;
  serverRevisions.clear();
  uploadedAssets.clear();
  serverErrors.clear();
  notifyProjectsChanged();
}

export const DEFAULT_ART_DIRECTION: ArtDirection = {
  preset: "clean-webtoon",
  custom: "",
};

export const DEFAULT_CHARACTER_VISUAL_PROFILE: CharacterVisualProfile = {
  gender: "",
  heightBuild: "",
  faceShape: "",
  eyes: "",
  noseMouth: "",
  skinTone: "",
  hair: "",
  distinctiveFeatures: "",
  outfit: "",
  shoes: "",
  accessories: "",
  colorPalette: "",
};

function makeId(prefix: string): string {
  const value = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}

export function createCharacter(overrides: Partial<Character> = {}): Character {
  const { visualProfile, ...characterOverrides } = overrides;
  return {
    id: makeId("character"),
    name: "",
    role: "주인공",
    age: "",
    appearance: "",
    personality: "",
    backstory: "",
    imageInstructions: "",
    ...characterOverrides,
    visualProfile: {
      ...DEFAULT_CHARACTER_VISUAL_PROFILE,
      ...(visualProfile ?? {}),
    },
  };
}

export function createCut(overrides: Partial<Cut> = {}): Cut {
  return {
    id: makeId("cut"),
    description: "",
    dialogue: "",
    soundEffect: "",
    characterIds: [],
    aspectRatio: "3:4",
    ...overrides,
    angle: normalizeWebtoonShot(overrides.angle ?? "미디엄샷"),
  };
}

function normalizeProject(raw: Project): Project {
  const characters = Array.isArray(raw.characters)
    ? raw.characters.map((character) => createCharacter(character))
    : [];
  const validCharacterIds = new Set(characters.map((character) => character.id));
  const episodes = Array.isArray(raw.episodes)
    ? raw.episodes.map((episode, episodeIndex) => ({
        ...episode,
        episodeNumber: episode.episodeNumber ?? episodeIndex + 1,
        cuts: Array.isArray(episode.cuts)
          ? episode.cuts.map((cut) => {
              const normalized = createCut(cut);
              return {
                ...normalized,
                characterIds: normalized.characterIds.filter((characterId) => validCharacterIds.has(characterId)),
                storyboard: migrateStoryboard(normalized),
              };
            })
          : [],
      }))
    : [];

  return {
    ...raw,
    workflowVersion: 2,
    currentStep: raw.workflowVersion === 2 ? Math.min(7, Math.max(1, raw.currentStep || 1))
      : (new Map([[1, 1], [2, 4], [3, 2], [4, 6], [5, 5], [6, 7]]).get(raw.currentStep) ?? 1),
    brief: { ...DEFAULT_BRIEF, ...(raw.brief ?? {}) },
    world: { ...DEFAULT_WORLD, ...(raw.world ?? {}) },
    artDirection: {
      ...DEFAULT_ART_DIRECTION,
      ...(raw.artDirection ?? {}),
    },
    characters,
    episodes,
  };
}

/** 폴더가 설정되어 있으면 파일로도 저장 (fire-and-forget) */
function autoSaveToFile(project: Project): void {
  if (typeof window === "undefined") return;
  localScheduling = localScheduling.then(async () => {
    const { saveProjectToFile } = await import("@/lib/fileSystemStorage");
    saveProjectToFile(project);
  });
}

export function getBrowserProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(KEY) ?? "[]";
    const parsed = JSON.parse(stored) as Project[];
    if (!Array.isArray(parsed)) return [];
    const normalized = ensureProjectAddresses(parsed.map(normalizeProject));
    const normalizedJson = JSON.stringify(normalized);
    if (normalizedJson !== JSON.stringify(parsed)) localStorage.setItem(KEY, normalizedJson);
    return normalized;
  } catch {
    return [];
  }
}

export function getProjects(): Project[] {
  return serverProjects ?? getBrowserProjects();
}

export function saveProjects(projects: Project[]): void {
  const normalized = ensureProjectAddresses(projects.map(normalizeProject));
  if (serverProjects !== null) {
    const before = new Map(serverProjects.map(project => [project.id, project]));
    const after = new Map(normalized.map(project => [project.id, project]));
    serverProjects = normalized;
    for (const project of normalized) {
      if (JSON.stringify(before.get(project.id)) !== JSON.stringify(project)) {
        queueServerWrite(project.id, () => syncProject(project));
      }
    }
    for (const previous of before.values()) {
      if (!after.has(previous.id)) {
        if (serverRevisions.has(previous.id)) queueServerWrite(previous.id, async () => {
          const revision = serverRevisions.get(previous.id);
          if (revision === undefined) return;
          await deleteOciProject(previous.id, revision);
          serverRevisions.delete(previous.id);
        });
      }
    }
  } else {
    const before = new Map(getBrowserProjects().map(project => [project.id, project]));
    localStorage.setItem(KEY, JSON.stringify(normalized));
    for (const project of normalized) {
      if (JSON.stringify(before.get(project.id)) !== JSON.stringify(project)) autoSaveToFile(project);
    }
  }
  notifyProjectsChanged();
}

export function getProject(id: string): Project | null {
  const projects = getProjects();
  return projects.find(p => p.id === id) ?? projects.find(p => p.shortId === id) ?? null;
}

export function projectHref(project: string | Project, stage: string): string {
  const resolved = typeof project === "string" ? getProject(project) : project;
  return resolved?.shortId ? `/p/${encodeURIComponent(resolved.shortId)}/${encodeURIComponent(stage)}`
    : `/project/${encodeURIComponent(typeof project === "string" ? project : project.id)}/${encodeURIComponent(stage)}`;
}

export function updateProject(id: string, updates: Partial<Project>): void {
  const projects = [...getProjects()];
  const idx = projects.findIndex((p) => p.id === id);
  if (idx !== -1) {
    const creativeKeys = ["brief", "planningDoc", "world", "story", "characters", "episodes", "artDirection"] as const;
    const changed = creativeKeys.some(key => key in updates && JSON.stringify(updates[key]) !== JSON.stringify(projects[idx][key]));
    projects[idx] = { ...projects[idx], ...updates, ...(changed ? { isCompleted: false, reviewChecks: {} } : {}) };
    saveProjects(projects);
  }
}

export function createProject(data: {
  title: string;
  author: string;
  genre: string;
  targetCompetition: string;
  deadline: string;
}): Project {
  const project: Project = {
    ...data,
    workflowVersion: 2,
    brief: { ...DEFAULT_BRIEF },
    world: { ...DEFAULT_WORLD },
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    currentStep: 1,
    isCompleted: false,
    authorNote: "",
    story: { logline: "", theme: "", setting: "", plotOutline: "", totalEpisodes: "1" },
    artDirection: { ...DEFAULT_ART_DIRECTION },
    characters: [],
    episodes: [{ episodeNumber: 1, title: "", synopsis: "", cuts: [], script: "", isCompleted: false }],
    ideaChat: [],
  };
  const projects = getProjects();
  project.shortId = ensureProjectAddresses([...projects, project]).at(-1)!.shortId;
  saveProjects([project, ...projects]);
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  if (!isServerStorageActive()) {
    const { removeProjectFromFile } = await import("./fileSystemStorage");
    await removeProjectFromFile(id);
  }
  saveProjects(getProjects().filter((p) => p.id !== id));
  await flushServerWrites();
  if (!isServerStorageActive()) {
    const { deleteMediaByProject } = await import("@/lib/mediaStorage");
    await deleteMediaByProject(id);
  }
}
