"use client";
import { use, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getProject } from "@/lib/storage";

const pages = {
  idea: dynamic(() => import("@/app/project/[id]/idea/page")),
  characters: dynamic(() => import("@/app/project/[id]/characters/page")),
  world: dynamic(() => import("@/app/project/[id]/world/page")),
  story: dynamic(() => import("@/app/project/[id]/story/page")),
  script: dynamic(() => import("@/app/project/[id]/script/page")),
  episodes: dynamic(() => import("@/app/project/[id]/episodes/page")),
  submit: dynamic(() => import("@/app/project/[id]/submit/page")),
};

export default function ShortProjectPage({ params }: { params: Promise<{ id: string; stage: string }> }) {
  const { id, stage } = use(params);
  const [resolved, setResolved] = useState<{ alias: string; params: Promise<{ id: string }> | null } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const project = getProject(id);
      setResolved({ alias: id, params: project ? Promise.resolve({ id: project.id }) : null });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);
  if (!Object.hasOwn(pages, stage)) return <div className="p-10">존재하지 않는 제작 단계입니다. <Link href="/dashboard">프로젝트 목록으로</Link></div>;
  if (resolved?.alias !== id) return <p role="status" className="p-10">프로젝트를 불러오는 중입니다…</p>;
  if (!resolved.params) return <div className="p-10">이 브라우저에 저장된 프로젝트를 찾을 수 없습니다. <Link href="/dashboard">프로젝트 목록으로</Link></div>;
  const Page = pages[stage as keyof typeof pages];
  return <Page key={`${id}/${stage}`} params={resolved.params} />;
}
