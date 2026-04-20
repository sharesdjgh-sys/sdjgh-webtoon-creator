export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Character = {
  name: string;
  role: string;
  age: string;
  appearance: string;
  personality: string;
  backstory: string;
};

export type Cut = {
  angle: string;
  description: string;
  dialogue: string;
  soundEffect: string;
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
  characters: Character[];
  episodes: Episode[];
  ideaChat: ChatMessage[];
  storyChat?: ChatMessage[];
  characterChat?: ChatMessage[];
  episodeChat?: ChatMessage[];
  scriptChat?: ChatMessage[];
};

const KEY = "webtoon_projects";

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
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(KEY, JSON.stringify(projects));
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
}
