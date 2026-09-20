"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type Props = {
  active: boolean;
  title: string;
  messages: string[];
};

export default function AiActivityBanner({ active, title, messages }: Props) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const reset = window.setTimeout(() => setSeconds(0), 0);
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => { window.clearTimeout(reset); window.clearInterval(timer); };
  }, [active]);

  if (!active) return null;
  const message = messages[Math.min(messages.length - 1, Math.floor(seconds / 10))] ?? "AI가 작업하고 있어요.";

  return (
    <div role="status" aria-live="polite" className="relative overflow-hidden rounded-2xl border border-[#D9CEF8] bg-gradient-to-r from-[#F5F3FF] via-white to-[#FFF9F2] px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-[#1A1A1A]">{title}</p>
            <span className="whitespace-nowrap text-[10px] font-semibold tabular-nums text-[#7C3AED]">{seconds}초 경과</span>
          </div>
          <p className="mt-1 text-[11px] text-[#6E655F]">{message}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EDE9FE]">
            <div className="h-full w-2/5 animate-[webtoon-progress_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#A78BFA] to-[#7C3AED]" />
          </div>
        </div>
      </div>
    </div>
  );
}
