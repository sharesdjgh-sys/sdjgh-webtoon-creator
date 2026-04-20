import { type Project, getProjects, saveProjects } from "./storage";

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
      lines.push("");
    });
  }
  triggerDownload(`${project.title}_캐릭터.txt`, lines.join("\n"), "text/plain;charset=utf-8");
}

export function downloadEpisode(project: Project, episodeIndex: number) {
  const ep = project.episodes[episodeIndex];
  if (!ep) return;
  const lines = [
    `[ ${project.title} — ${ep.episodeNumber}화 ]`,
    `작성일: ${new Date().toLocaleDateString("ko-KR")}`,
    "",
    `제목: ${ep.title || "(미입력)"}`,
    "",
    "=== 줄거리 ===",
    ep.synopsis || "(미작성)",
  ];

  const cuts = ep.cuts ?? [];
  if (cuts.length > 0) {
    lines.push("", "=== 콘티 ===");
    cuts.forEach((cut, i) => {
      lines.push(``, `[ 컷 ${i + 1} — ${cut.angle} ]`);
      if (cut.description) lines.push(`장면: ${cut.description}`);
      if (cut.dialogue) lines.push(`대사: ${cut.dialogue}`);
      if (cut.soundEffect) lines.push(`효과음: ${cut.soundEffect}`);
    });
  }

  lines.push("", "=== 대본 ===", ep.script || "(미작성)");

  triggerDownload(
    `${project.title}_${ep.episodeNumber}화.txt`,
    lines.join("\n"),
    "text/plain;charset=utf-8"
  );
}

export function downloadAllEpisodes(project: Project) {
  const lines = [
    `[ ${project.title} — 전체 콘티 & 대본 ]`,
    `작성일: ${new Date().toLocaleDateString("ko-KR")}`,
    "",
  ];
  project.episodes.forEach((ep) => {
    lines.push(`${"═".repeat(40)}`);
    lines.push(`${ep.episodeNumber}화: ${ep.title || "(제목 없음)"}`);
    lines.push(`${"═".repeat(40)}`);
    if (ep.synopsis) { lines.push("[ 줄거리 ]"); lines.push(ep.synopsis); lines.push(""); }

    const cuts = ep.cuts ?? [];
    if (cuts.length > 0) {
      lines.push("[ 콘티 ]");
      cuts.forEach((cut, i) => {
        lines.push(`컷 ${i + 1} (${cut.angle})${cut.description ? ` — ${cut.description}` : ""}`);
        if (cut.dialogue) lines.push(`  대사: ${cut.dialogue}`);
        if (cut.soundEffect) lines.push(`  효과음: ${cut.soundEffect}`);
      });
      lines.push("");
    }

    lines.push("[ 대본 ]");
    lines.push(ep.script || "(미작성)");
    lines.push("");
  });
  triggerDownload(`${project.title}_전체.txt`, lines.join("\n"), "text/plain;charset=utf-8");
}

export function downloadFullSummary(project: Project) {
  const s = project.story;
  const lines = [
    `[ ${project.title} — 최종 제출 요약 ]`,
    project.author ? `작가: ${project.author}` : "",
    `작성일: ${new Date().toLocaleDateString("ko-KR")}`,
    project.targetCompetition ? `대상 대회: ${project.targetCompetition}` : "",
    "",
    "═══ 스토리 ═══",
    `로그라인: ${s.logline || "(미작성)"}`,
    `주제: ${s.theme || "(미작성)"}`,
    `배경: ${s.setting || "(미작성)"}`,
    "",
    "줄거리:",
    s.plotOutline || "(미작성)",
    "",
    "═══ 캐릭터 ═══",
    ...project.characters.flatMap((ch) => [
      `▸ ${ch.name} (${ch.role}${ch.age ? `, ${ch.age}` : ""})`,
      ch.appearance ? `  외모: ${ch.appearance}` : "",
      ch.personality ? `  성격: ${ch.personality}` : "",
      ch.backstory ? `  배경: ${ch.backstory}` : "",
      "",
    ]),
    "═══ 콘티 & 대본 ═══",
    ...project.episodes.flatMap((ep) => {
      const cutLines: string[] = [];
      const cuts = ep.cuts ?? [];
      if (cuts.length > 0) {
        cutLines.push("  [ 콘티 ]");
        cuts.forEach((cut, i) => {
          cutLines.push(`  컷 ${i + 1} (${cut.angle})${cut.description ? ` — ${cut.description}` : ""}`);
          if (cut.dialogue) cutLines.push(`    대사: ${cut.dialogue}`);
          if (cut.soundEffect) cutLines.push(`    효과음: ${cut.soundEffect}`);
        });
        cutLines.push("");
      }
      return [
        `[ ${ep.episodeNumber}화: ${ep.title || "제목 없음"} ]`,
        ep.synopsis ? `줄거리: ${ep.synopsis}` : "",
        "",
        ...cutLines,
        "  [ 대본 ]",
        ep.script || "(미작성)",
        "",
      ];
    }),
  ].filter((l) => l !== undefined);
  triggerDownload(`${project.title}_최종요약.txt`, lines.join("\n"), "text/plain;charset=utf-8");
}
