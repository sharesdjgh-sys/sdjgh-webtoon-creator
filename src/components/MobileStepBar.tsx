"use client";

import Link from "next/link";
import { STEPS } from "@/lib/utils";
import { Check } from "lucide-react";

interface MobileStepBarProps {
  currentStep: number;
  activeStep?: number;
  projectId: string;
  isDirty?: boolean;
}

export default function MobileStepBar({ currentStep, activeStep, projectId, isDirty }: MobileStepBarProps) {
  const active = activeStep ?? currentStep;

  return (
    <div className="lg:hidden bg-white border-b border-[#EBE7E0] px-4 py-2.5 sticky top-[57px] z-30">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        {STEPS.map((step) => {
          const isDone = step.id < active;
          const isCurrent = step.id === active;
          const isClickable = step.id <= currentStep;
          const href = `/project/${projectId}/${step.route}`;

          const inner = (
            <div
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                isCurrent
                  ? "bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/30"
                  : isDone
                  ? "bg-[#F4F1EC] text-[#ADA8A0] border-[#EBE7E0]"
                  : "bg-white text-[#D4CFC9] border-[#EBE7E0]"
              }`}
            >
              {isDone && <Check className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={3} />}
              <span>{step.label}</span>
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
