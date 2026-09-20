import { type Project, type Episode, type Cut, getProjects, saveProjects } from "./storage";
import { CHARACTER_STORY_FIELDS, STORY_FIELDS, EPISODE_FIELDS } from "./creation";

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── JSON 백업 / 복원 ───────────────────────────────────────────

export function exportAllProjects() {
  const data = JSON.stringify(getProjects(), null, 2);
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(`webtoon_backup_${date}.json`, data, "application/json");
}

export function importProjects(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error();
        saveProjects(parsed);
        resolve();
      } catch {
        reject(new Error("올바른 백업 파일이 아니에요."));
      }
    };
    reader.readAsText(file);
  });
}

// ─── 스텝별 텍스트 다운로드 ────────────────────────────────────

export function downloadStory(project: Project) {
  const s = project.story;
  const lines = [
    `[ ${project.title} — 스토리 구성 ]`,
    `작가: ${project.author || "(미입력)"}`,
    `작성일: ${new Date().toLocaleDateString("ko-KR")}`,
    "",
    "=== 한 줄 소개 (로그라인) ===",
    s.logline || "(미작성)",
    "",
    "=== 주제 / 메시지 ===",
    s.theme || "(미작성)",
    "",
    "=== 배경 / 세계관 ===",
    s.setting || "(미작성)",
    "",
    "=== 전체 줄거리 (기승전결) ===",
    s.plotOutline || "(미작성)",
    "",
    `총 화 수: ${s.totalEpisodes}화`,
    ...STORY_FIELDS.map(field => `${field.label}: ${s[field.key] || "(미작성)"}`),
  ];
  triggerDownload(`${project.title}_스토리.txt`, lines.join("\n"), "text/plain;charset=utf-8");
}

export function downloadCharacters(project: Project) {
  const lines = [
    `[ ${project.title} — 캐릭터 설계 ]`,
    `작성일: ${new Date().toLocaleDateString("ko-KR")}`,
    "",
  ];
  if (project.characters.length === 0) {
    lines.push("(등록된 캐릭터 없음)");
  } else {
    project.characters.forEach((ch, i) => {
      lines.push(`── 캐릭터 ${i + 1}: ${ch.name || "이름 없음"} ──`);
      lines.push(`역할: ${ch.role}`);
      if (ch.age) lines.push(`나이/학년: ${ch.age}`);
      if (ch.appearance) lines.push(`외모: ${ch.appearance}`);
      if (ch.personality) lines.push(`성격: ${ch.personality}`);
      if (ch.backstory) lines.push(`배경 이야기: ${ch.backstory}`);
      lines.push(...CHARACTER_STORY_FIELDS.map(field => `${field.label}: ${ch[field.key] || "(미작성)"}`));
      lines.push("");
    });
  }
  triggerDownload(`${project.title}_캐릭터.txt`, lines.join("\n"), "text/plain;charset=utf-8");
}

function cutLines(cut: Cut, index: number): string[] {
  return [`컷 ${index + 1} (${cut.angle})`, `목적: ${cut.purpose || ""} / 감정: ${cut.emotion || ""}`,
    `장면: ${cut.description}`, `대사: ${cut.dialogue}`, `효과음: ${cut.soundEffect}`,
    `연속성: ${cut.continuityNotes || ""}`, `여백: ${cut.scrollGap || "normal"}`, ""];
}
function episodeLines(ep: Episode): string[] {
  return [`[ ${ep.episodeNumber}화: ${ep.title || "제목 없음"} ]`, "=== 시놉시스 ===", ep.synopsis || "(미작성)",
    ...EPISODE_FIELDS.map(field => `${field.label}: ${ep[field.key] || "(미작성)"}`),
    "", "=== 대본 ===", ep.script || "(미작성)", "", "=== 콘티 ===",
    ...ep.cuts.flatMap(cutLines), ""];
}
export function downloadEpisode(project: Project, episodeIndex: number) {
  const episode = project.episodes[episodeIndex]; if (!episode) return;
  triggerDownload(`${project.title}_${episode.episodeNumber}화.txt`, episodeLines(episode).join("\n"), "text/plain;charset=utf-8");
}
export function downloadAllEpisodes(project: Project) {
  triggerDownload(`${project.title}_전체.txt`, [project.title, ...project.episodes.flatMap(episodeLines)].join("\n"), "text/plain;charset=utf-8");
}
export function downloadFullSummary(project: Project) {
  const labels: Record<string, string> = { idea: "아이디어", tone: "분위기", audience: "독자", feeling: "독자 감정", format: "작품 형태", mode: "제작 방식", targetCuts: "목표 컷 수", purpose: "제작 목표", mustKeep: "꼭 지킬 아이디어", era: "시대", mainLocation: "주요 무대", possible: "가능한 것", forbidden: "금지 규칙", cost: "대가", locations: "반복 장소", props: "주요 물건", confirmed: "확정 설정", undecided: "미정 후보", foreshadowing: "복선" };
  const settings = (values: Record<string, string>) => Object.entries(values).map(([key, value]) => `${labels[key] ?? key}: ${value || "(미작성)"}`);
  const lines = [`[ ${project.title} — 작품 설정과 제작 기록 ]`, `작가: ${project.author || "(미입력)"}`, `작성일: ${new Date().toLocaleDateString("ko-KR")}`, `대상 대회: ${project.targetCompetition || "(없음)"}`, "=== 기획 ===", ...settings(project.brief ?? {}),
    "", "=== 캐릭터 ===", ...project.characters.flatMap(c => [c.name, `역할: ${c.role} / 나이: ${c.age}`, `배경 이야기: ${c.backstory}`, `외모: ${c.appearance}`, `성격: ${c.personality}`, ...CHARACTER_STORY_FIELDS.map(f => `${f.label}: ${c[f.key] || ""}`), ""]),
    "", "=== 세계관 · 설정집 ===", ...settings(project.world ?? {}), "", "=== 스토리 ===", project.story.logline, project.story.theme, project.story.setting, project.story.plotOutline,
    ...STORY_FIELDS.map(f => `${f.label}: ${project.story[f.key] || ""}`), "", ...project.episodes.flatMap(episodeLines),
    "=== 작가 노트 ===", project.authorNote || ""];
  triggerDownload(`${project.title}_최종요약.txt`, lines.join("\n"), "text/plain;charset=utf-8");
}
