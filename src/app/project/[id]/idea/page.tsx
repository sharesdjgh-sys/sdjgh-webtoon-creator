"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import StageIntro from "@/components/creation/StageIntro";
import { useRouter } from "next/navigation";
import BriefEditor from "@/components/creation/BriefEditor";
import AiChat from "@/components/ai-assistant/AiChat";
import StepIndicator from "@/components/progress-tracker/StepIndicator";
import MobileStepBar from "@/components/MobileStepBar";
import { ArrowRight, Sparkles } from "lucide-react";
import { getProject, updateProject, type Project, type ChatMessage } from "@/lib/storage";

export default function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { const p = getProject(id); if (p) setProject(p); }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  const goNext = () => {
    if (project) {
      updateProject(id, { currentStep: Math.max(2, project.currentStep) });
    }
    router.push(`/project/${id}/characters`);
  };

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
          <button
            onClick={goNext}
            className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all duration-300 flex-shrink-0"
          >
            캐릭터으로 <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </header>

      <MobileStepBar currentStep={project?.currentStep ?? 1} activeStep={1} projectId={id} />

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-5">
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-[#EBE7E0] p-4 sticky top-20 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <StepIndicator currentStep={project?.currentStep ?? 1} activeStep={1} projectId={id} />
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col gap-4">
          <StageIntro stage="idea" />
          <div>
            <p className="text-[10px] font-medium text-[#7C3AED] uppercase tracking-widest mb-1">Step 01</p>
            <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight">아이디어 발굴</h1>
            <p className="text-xs text-[#ADA8A0] mt-1">
              AI 멘토와 자유롭게 대화하며 웹툰 아이디어를 구체화해봐요. 막막해도 괜찮아요!
            </p>
          </div>

          {project && <BriefEditor key={project.id} project={project} />}
          <div className="h-[600px] max-h-[80vh]">
            {project && <AiChat
              key={project.id}
              step="idea"
              initialMessage="안녕하세요! 웹툰 멘토 웹툰이예요 😊 어떤 이야기를 만들고 싶으신가요? 막막해도 괜찮아요. 좋아하는 장르나 떠오르는 주제가 있으면 편하게 말해봐요!"
              initialMessages={project?.ideaChat}
              placeholder="아이디어에 대해 자유롭게 이야기해봐요..."
              onMessagesChange={(msgs) => updateProject(id, { ideaChat: msgs as ChatMessage[] })}
            />}
          </div>

          <div className="flex justify-end">
            <button
              onClick={goNext}
              className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-full bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-all duration-300"
            >
              다음: 캐릭터 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
