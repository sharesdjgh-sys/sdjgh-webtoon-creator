export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ArtStylePreset = "clean-webtoon" | "romance-watercolor" | "action-contrast" | "dark-noir" | "pencil-sketch";

export type ArtDirection = {
  preset: ArtStylePreset;
  custom: string;
};

export type PanelAspectRatio = "4:3" | "3:4" | "1:1" | "9:16";
export type WebtoonFontFamily = "clean" | "serif" | "handwritten" | "cute" | "comic" | "impact";
export type SpeechBalloonStyle = "normal" | "thought" | "shout" | "whisper";
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
  expression?: string;
  fontFamily?: WebtoonFontFamily;
  fontSize?: number;
  fontWeight?: number;
  characterRig?: CharacterRig;
  balloonStyle?: SpeechBalloonStyle;
  tailX?: number;
  tailY?: number;
  speakerCharacterId?: string;
};

export type StoryboardDocument = {
  version: 1;
  aspectRatio: PanelAspectRatio;
  width: number;
  height: number;
  elements: StoryboardElement[];
};

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
  visualProfile: CharacterVisualProfile;
  imageInstructions?: string;
  imageAssetId?: string;
  imageSourceHash?: string;
};

export type Cut = {
  id: string;
  angle: string;
  description: string;
  dialogue: string;
  soundEffect: string;
  characterIds: string[];
  aspectRatio: PanelAspectRatio;
  storyboard?: StoryboardDocument;
  sceneImageAssetId?: string;
  sceneSourceHash?: string;
};

export type Episode = {
  episodeNumber: number;
  title: string;
  synopsis: string;
  cuts: Cut[];
  script: string;
  isCompleted: boolean;
};

export type Project = {
  id: string;
  title: string;
  author: string;
  genre: string;
  targetCompetition: string;
  deadline: string;
  currentStep: number;
  isCompleted: boolean;
  authorNote: string;
  createdAt: string;
  story: {
    logline: string;
    theme: string;
    setting: string;
    plotOutline: string;
    totalEpisodes: string;
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
    angle: "미디엄샷",
    description: "",
    dialogue: "",
    soundEffect: "",
    characterIds: [],
    aspectRatio: "3:4",
    ...overrides,
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
              };
            })
          : [],
      }))
    : [];

  return {
    ...raw,
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
  import("@/lib/fileSystemStorage")
    .then(({ saveProjectToFile }) => saveProjectToFile(project))
    .catch(() => {});
}

export function getProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(KEY) ?? "[]";
    const parsed = JSON.parse(stored) as Project[];
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.map(normalizeProject);
    const normalizedJson = JSON.stringify(normalized);
    if (normalizedJson !== JSON.stringify(parsed)) localStorage.setItem(KEY, normalizedJson);
    return normalized;
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(KEY, JSON.stringify(projects.map(normalizeProject)));
}

export function getProject(id: string): Project | null {
  return getProjects().find((p) => p.id === id) ?? null;
}

export function updateProject(id: string, updates: Partial<Project>): void {
  const projects = getProjects();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx !== -1) {
    projects[idx] = { ...projects[idx], ...updates };
    saveProjects(projects);
    autoSaveToFile(projects[idx]);
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
  saveProjects([project, ...projects]);
  autoSaveToFile(project);
  return project;
}

export function deleteProject(id: string): void {
  saveProjects(getProjects().filter((p) => p.id !== id));
  import("@/lib/mediaStorage")
    .then(({ deleteMediaByProject }) => deleteMediaByProject(id))
    .catch(() => {});
}
