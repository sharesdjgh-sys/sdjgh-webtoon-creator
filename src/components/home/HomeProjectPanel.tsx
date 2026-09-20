"use client";

import styles from "./home.module.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Check, Plus } from "lucide-react";
import { getProjects, type Project } from "@/lib/storage";
import { workflowCheckpoints } from "@/lib/workflowProgress";
import { STEPS } from "@/lib/utils";
import StoredImage from "@/components/visual/StoredImage";

const NEXT_ACTIONS = [
  "떠오르는 장면 하나를 기획 카드에 적어봐요.",
  "주인공이 가장 원하는 것과 두려워하는 것을 정해요.",
  "이야기의 무대와 이 세계에서 가능한 일을 정해요.",
  "시작과 끝을 연결하고 주인공의 큰 선택을 정해요.",
  "이번 화의 줄거리를 정하고 장면과 대사를 써봐요.",
  "대본을 컷으로 나누고 그림과 말풍선을 완성해요.",
  "스토리·그림·글자를 확인하고 완성을 표시해요.",
];

function PanelSketch() {
  return <div aria-hidden="true" className={styles.comicPreview}>
    <div className={styles.comicMain}>
      <span className={styles.speech}>어떤 이야기가 시작될까?</span>
      <span className={styles.spark}>✦</span>
      <span className={styles.caption}>상상하는 순간, 첫 컷!</span>
    </div>
    <div className={styles.comicSide}>
      <div className={styles.ideaPanel}><span>한 줄의 생각</span><strong>반짝!</strong></div>
      <div className={styles.storyPanel}>나만의<br /><strong>웹툰으로!</strong></div>
    </div>
  </div>;
}

export default function HomeProjectPanel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  useEffect(() => {
    const refresh = () => {
      const next = getProjects().sort((a, b) =>
        (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
      setProjects(next);
      setLoaded(true);
    };
    const timer = window.setTimeout(refresh, 0);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const project = projects.find(item => item.id === selectedId)
    ?? projects.find(item => !item.isCompleted) ?? projects[0];
  const checks = project ? workflowCheckpoints(project) : [];
  const nextIndex = project?.isCompleted ? 6 : Math.max(0, checks.findIndex(done => !done));
  const stage = STEPS[nextIndex];
  const cuts = project?.episodes.flatMap(episode => episode.cuts) ?? [];
  const scene = [...cuts].reverse().find(cut => cut.sceneImageAssetId || cut.storyboardImageAssetId);
  const cover = scene?.sceneImageAssetId || scene?.storyboardImageAssetId || project?.characters.find(character => character.imageAssetId)?.imageAssetId;
  const completedCount = checks.filter(Boolean).length;
  const episodeCount = project?.episodes.filter(episode => episode.title || episode.synopsis || episode.script || episode.cuts.length).length ?? 0;
  const destination = project ? `/project/${project.id}/${stage.route}` : "/dashboard";

  return <section aria-label="내 작품 작업실" aria-busy={!loaded} className={`${styles.projectCard} overflow-hidden rounded-[24px] bg-white`}>
    <div className="flex items-center justify-between gap-3 border-b-2 border-[#302342] bg-[#F2EAFF] px-5 py-4 sm:px-6">
      <span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#713DE3]"><BookOpen className="h-4 w-4" /> 나의 작업실</span>
      <Link href="/dashboard" className="flex items-center gap-1 text-xs text-[#625B72] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#713DE3]">모든 작품 <ArrowRight className="h-3 w-3" /></Link>
    </div>

    {!loaded ? <div role="status" className="flex min-h-[430px] flex-col justify-center gap-4 p-6">
      <div className="h-36 rounded-lg bg-[#EEE5FF] motion-safe:animate-pulse" />
      <div className="h-5 w-2/3 rounded bg-[#EEE5FF] motion-safe:animate-pulse" />
      <p className="text-xs text-[#625B72]">이 브라우저의 작품을 불러오고 있어요.</p>
    </div> : project ? <>
      <div className="relative h-40 overflow-hidden border-b border-[#E6DDF6] bg-[#F2EAFF]">
        <PanelSketch />
        {cover && <StoredImage key={cover} assetId={cover} alt={`${project.title}에서 만든 그림`} className={`absolute inset-0 h-full w-full bg-[#F2EAFF] ${scene ? "object-cover" : "object-contain"}`} />}
        <span className="absolute right-3 top-3 rounded-full border border-[#302342] bg-[#FFFFFF]/95 px-3 py-1 text-[10px] font-semibold text-[#713DE3]">{project.isCompleted ? "완성한 작품" : "진행 중인 프로젝트"}</span>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <div>
          {projects.length > 1 && <label className="mb-3 block text-[11px] text-[#625B72]">작품 선택
            <select aria-label="첫 화면에서 볼 작품" value={project.id} onChange={event => setSelectedId(event.target.value)} className="mt-1 w-full rounded-lg border border-[#DCCCF5] bg-white px-2 py-2 text-xs text-[#302342]">
              {projects.map(item => <option key={item.id} value={item.id}>{item.title}{item.isCompleted ? " · 완성" : ""}</option>)}
            </select>
          </label>}
          <p className="mb-1 text-[11px] font-medium text-[#625B72]">{project.genre || "장르를 정해보세요"}</p>
          <h2 className="break-words text-[22px] font-bold leading-snug tracking-tight text-[#302342]">{project.title}</h2>
          <p className="mt-2 line-clamp-2 text-xs leading-6 text-[#625B72]">{project.story.logline || project.brief?.idea || "아직 쓰지 않은 이야기의 첫 문장을 기다리고 있어요."}</p>
        </div>
        <div className="flex gap-4 border-y border-[#E6DDF6] py-3 text-xs text-[#625B72]">
          <span>캐릭터 <strong className="ml-1 tabular-nums text-[#302342]">{project.characters.length}</strong></span>
          <span>회차 <strong className="ml-1 tabular-nums text-[#302342]">{episodeCount}</strong></span>
          <span>컷 <strong className="ml-1 tabular-nums text-[#302342]">{cuts.length}</strong></span>
        </div>
        <div>
          <div className="mb-2 flex justify-between text-[11px] text-[#625B72]"><span>내용이 채워진 단계</span><span className="tabular-nums">{completedCount} / {STEPS.length}</span></div>
          <div className="grid grid-cols-7 gap-1.5">{STEPS.map((item, index) => <Link key={item.id} href={`/project/${project.id}/${item.route}`} aria-label={`${item.label}: ${checks[index] ? "내용 있음" : "작성할 내용 있음"}`} title={item.label} className={`flex h-7 items-center justify-center rounded-md border text-[10px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#713DE3] ${checks[index] ? "border-[#713DE3] bg-[#713DE3] text-white" : index === nextIndex ? "border-[#9B72EA] bg-[#FFF0A6] text-[#713DE3]" : "border-[#E6DDF6] bg-[#F6F2FC] text-[#70647F]"}`}>{checks[index] ? <Check className="h-3 w-3" /> : item.id}</Link>)}</div>
        </div>
        <div className="rounded-xl bg-[#FFF4B8] p-4">
          <p className="text-xs font-bold text-[#713DE3]">{project.isCompleted ? "완성한 이야기를 다시 만나보세요" : `다음 한 걸음 · ${stage.label}`}</p>
          <p className="mt-1 text-xs leading-6 text-[#66532B]">{project.isCompleted ? "작가 노트와 검수 내용을 확인하고 작품을 내려받을 수 있어요." : NEXT_ACTIONS[nextIndex]}</p>
        </div>
        <Link href={destination} className="flex items-center justify-between rounded-xl border-2 border-[#302342] shadow-[3px_3px_0_#302342] bg-[#713DE3] px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#5925BE] active:bg-[#471B9D] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#713DE3]">{project.isCompleted ? "완성 작품 보기" : `${stage.label} 이어서 만들기`}<ArrowRight className="h-4 w-4" /></Link>
      </div>
    </> : <>
      <div className="h-44 border-b border-[#E6DDF6] bg-[#F2EAFF]"><PanelSketch /></div>
      <div className="space-y-5 p-5 sm:p-6">
        <div><p className="text-[11px] font-medium text-[#625B72]">아직 작품이 없어도 괜찮아요</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-[#302342]">여기서 첫 이야기가<br />시작돼요.</h2><p className="mt-3 text-sm leading-7 text-[#625B72]">떠오르는 장면 하나, 만들고 싶은 주인공 한 명.<br />처음에는 8~12컷의 짧은 웹툰이면 충분해요.</p></div>
        <p className="rounded-xl bg-[#FFF4B8] px-4 py-3 text-xs leading-6 text-[#66532B]">작품을 만들면 이곳에 그림과 작성 상태가 표시되고, 다음 작업으로 바로 이어갈 수 있어요.</p>
        <Link href="/dashboard" className="flex items-center justify-between rounded-xl border-2 border-[#302342] shadow-[3px_3px_0_#302342] bg-[#713DE3] px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#5925BE] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#713DE3]">첫 작품 만들기<Plus className="h-4 w-4" /></Link>
      </div>
    </>}
    <div className="border-t border-[#E6DDF6] px-5 py-3 text-[10px] leading-5 text-[#70647F]">작품은 현재 브라우저에 저장돼요. 작업실에서 백업 파일을 내려받을 수 있어요.</div>
  </section>;
}
