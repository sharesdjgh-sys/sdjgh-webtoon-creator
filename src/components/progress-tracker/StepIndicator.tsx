"use client";

import { projectHref } from "@/lib/storage";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";
import { STEPS } from "@/lib/utils";
import { getProject } from "@/lib/storage";
import { workflowStatuses, type WorkflowStatus } from "@/lib/workflowProgress";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  activeStep?: number;
  projectId?: string;
  isDirty?: boolean;
}

function subscribe(onChange: () => void) {
  window.addEventListener("webtoon-projects-changed", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("webtoon-projects-changed", onChange);
    window.removeEventListener("storage", onChange);
  };
}
const serverSnapshot = () => "";
const statusColors: Record<WorkflowStatus | "저장 필요" | "불러오는 중", string> = {
  "시작 전": "bg-[#F4F1EC] text-[#78716C]",
  "작성 중": "bg-blue-50 text-blue-700",
  "초안 준비": "bg-emerald-50 text-emerald-700",
  "검토 필요": "bg-amber-50 text-amber-800",
  "검토 중": "bg-blue-50 text-blue-700",
  "완료": "bg-emerald-100 text-emerald-800",
  "저장 필요": "bg-orange-50 text-orange-700",
  "불러오는 중": "bg-[#F4F1EC] text-[#78716C]",
};

export default function StepIndicator({ currentStep, activeStep, projectId, isDirty }: StepIndicatorProps) {
  const active = activeStep ?? currentStep;
  const getSnapshot = useCallback(() => {
    const project = projectId ? getProject(projectId) : null;
    return project ? JSON.stringify(workflowStatuses(project)) : "";
  }, [projectId]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const statuses: WorkflowStatus[] = snapshot ? JSON.parse(snapshot) : [];
  const ready = statuses.filter(status => status === "초안 준비" || status === "완료").length;
  const progress = Math.round(ready / STEPS.length * 100);

  return (
    <nav className="w-full" aria-label="제작 순서">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-medium text-[#78716C]">제작 순서</span>
        <span className="text-[10px] font-bold text-[#7C3AED]">준비 {ready} / {STEPS.length}</span>
      </div>
      <div role="progressbar" aria-label="저장된 초안 준비 및 완성 단계" aria-valuemin={0} aria-valuemax={7} aria-valuenow={ready} className="mb-3 h-1.5 w-full rounded-full bg-[#F4F1EC]">
        <div className="h-1.5 rounded-full bg-[#7C3AED] transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>
      <p className="mb-4 text-[10px] leading-4 text-[#78716C]">저장된 내용 기준 · 초안 준비는 최종 검수 완료가 아니에요.</p>
      <div className="space-y-1">
        {STEPS.map((step, index) => {
          const isCurrent = step.id === active;
          const status = isCurrent && isDirty ? "저장 필요" : statuses[index] ?? "불러오는 중";
          const isReady = status === "초안 준비" || status === "완료";
          const inner = (
            <div className={`flex items-start gap-2 rounded-xl border px-2 py-2.5 transition-colors ${isCurrent ? "border-[#7C3AED]/30 bg-[#F5F3FF]" : "border-transparent hover:bg-[#F4F1EC]"}`}>
              <span aria-hidden="true" className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${isReady ? "border-emerald-600 bg-emerald-600 text-white" : isCurrent ? "border-[#7C3AED] text-[#7C3AED]" : "border-[#D4CFC9] text-[#78716C]"}`}>
                {isReady ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : step.id}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className={`text-xs font-semibold ${isCurrent ? "text-[#7C3AED]" : "text-[#514A45]"}`}>{step.label}</span>
                  {isCurrent && <span className="text-[9px] font-semibold text-[#7C3AED]">현재</span>}
                </div>
                <span className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-medium ${statusColors[status]}`}>{status}</span>
              </div>
            </div>
          );
          return projectId ? (
            <Link key={step.id} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]" href={projectHref(projectId, step.route)} aria-current={isCurrent ? "step" : undefined}
              onClick={(event) => {
                if (isDirty && !confirm("저장하지 않은 변경사항이 있어요. 이동하시겠어요?")) event.preventDefault();
              }}>
              {inner}
            </Link>
          ) : <div key={step.id}>{inner}</div>;
        })}
      </div>
    </nav>
  );
}
