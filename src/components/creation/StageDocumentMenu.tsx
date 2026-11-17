"use client";

import { useRef } from "react";
import { MoreHorizontal } from "lucide-react";

type DocumentAction = { label: string; onSelect: () => void };

export default function StageDocumentMenu({ actions }: { actions: DocumentAction[] }) {
  const menu = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={menu} className="relative shrink-0">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-[#EBE7E0] px-3 py-2 text-xs font-medium text-[#7A7067] hover:bg-[#F4F1EC] [&::-webkit-details-marker]:hidden">
        <MoreHorizontal className="h-3.5 w-3.5" /> 더보기
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 min-w-40 rounded-xl border border-[#EBE7E0] bg-white p-1 shadow-lg">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => { action.onSelect(); menu.current?.removeAttribute("open"); }}
            className="block w-full rounded-lg px-3 py-2 text-left text-xs text-[#514A65] hover:bg-[#F4F1EC]"
          >
            {action.label}
          </button>
        ))}
      </div>
    </details>
  );
}
