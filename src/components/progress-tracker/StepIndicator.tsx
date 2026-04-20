"use client";

import Link from "next/link";
import { STEPS } from "@/lib/utils";
import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  activeStep?: number;
  projectId?: string;
  isDirty?: boolean;
}

export default function StepIndicator({ currentStep, activeStep, projectId, isDirty }: StepIndicatorProps) {
  const active = activeStep ?? currentStep;
  const progress = Math.round(((currentStep - 1) / (STEPS.length - 1)) * 100);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-medium text-[#ADA8A0] uppercase tracking-wider">진행률</span>
        <span className="text-xs font-bold text-[#7C3AED]">{progress}%</span>
      </div>
      <div className="w-full bg-[#F4F1EC] rounded-full h-1.5 mb-5">
        <div
          className="bg-[#7C3AED] h-1.5 rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-1">
        {STEPS.map((step) => {
          const isDone = step.id < active;
          const isCurrent = step.id === active;
          const isClickable = step.id <= currentStep && !!projectId;
          const href = `/project/${projectId}/${step.route}`;

          const inner = (
            <div
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 ${
                isCurrent ? "bg-[#7C3AED]/8 border border-[#7C3AED]/20" : ""
              } ${isClickable ? "hover:bg-[#F4F1EC] cursor-pointer" : "cursor-default"}`}
            >
              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 border transition-all duration-200 ${
                isDone
                  ? "bg-[#7C3AED] border-[#7C3AED]"
                  : isCurrent
                  ? "bg-white border-[#7C3AED]"
                  : "border-[#EBE7E0] bg-transparent"
              }`}>
                {isDone && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />}
              </div>
              <span className={`text-xs font-medium transition-colors duration-200 ${
                isDone ? "text-[#ADA8A0]" : isCurrent ? "text-[#7C3AED]" : "text-[#D4CFC9]"
              }`}>
                {step.label}
              </span>
              {isCurrent && (
                <span className="ml-auto text-[9px] text-[#7C3AED] font-semibold">진행중</span>
              )}
            </div>
          );

          return isClickable ? (
            <Link
              key={step.id}
              href={href}
              onClick={(e) => {
                if (isDirty && !confirm("저장하지 않은 변경사항이 있어요. 이동하시겠어요?")) {
                  e.preventDefault();
                }
              }}
            >
              {inner}
            </Link>
          ) : (
            <div key={step.id}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
