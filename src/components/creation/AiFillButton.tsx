"use client";
import { useEffect, useRef, useState } from "react";
import { RefreshCw, Wand2 } from "lucide-react";
import type { FillMode } from "@/lib/aiFill";

type Snapshot = { fields: Record<string, string>; payload: object };
type Props = {
  label: string;
  disabled?: boolean;
  resultKey?: string;
  getSnapshot: () => Snapshot;
  onApply: (draft: Record<string, string>, before: Record<string, string>, mode: FillMode) => void;
};
export default function AiFillButton({ label, disabled, resultKey, getSnapshot, onApply }: Props) {
  const [mode, setMode] = useState<FillMode>("missing");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const fill = async () => {
    if (active.current || disabled) return;
    setMessage(""); setFailed(false);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    try {
      const snapshot = getSnapshot();
      const fields = { ...snapshot.fields };
      if (mode === "missing" && Object.values(fields).every(value => value.trim())) {
        setMessage("이미 내용이 있어요. 새 초안이 필요하면 ‘전체 다시 제안’을 선택하세요."); return;
      }
      if (mode === "replace" && Object.values(fields).some(value => value.trim())
        && !window.confirm("이 영역의 기존 내용을 AI 초안으로 바꿀까요? 다른 영역과 생성된 이미지는 유지됩니다.")) return;
      active.current = controller; setBusy(true);
      timeout = setTimeout(() => controller.abort(), 90000);
      const response = await fetch("/api/ai/autofill", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot.payload), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI 초안을 만들지 못했어요.");
      const draft = resultKey ? data[resultKey] : data;
      if (!draft || Object.keys(fields).some(key => typeof draft[key] !== "string")) throw new Error("AI 응답에 필요한 항목이 빠졌어요. 다시 시도해 주세요.");
      if (controller.signal.aborted) return;
      onApply(draft, fields, mode);
      setMessage("AI 초안을 반영했어요. 내용을 검토해 주세요. 요청 중 수정한 항목은 유지됩니다.");
    } catch (error) {
      setFailed(true);
      setMessage(controller.signal.aborted ? "요청이 중단되었어요. 입력은 유지됩니다. 다시 시도해 주세요." : error instanceof Error ? error.message : "AI 요청에 실패했어요.");
    } finally {
      if (timeout) clearTimeout(timeout);
      active.current = null; setBusy(false);
    }
  };
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label={label + " 적용 방식"} value={mode} onChange={e => setMode(e.target.value as FillMode)} disabled={busy || disabled} className="rounded-lg border border-[#DDD3F0] bg-white px-2 py-2 text-xs">
        <option value="missing">빈칸만 채우기</option><option value="replace">전체 다시 제안</option>
      </select>
      <button type="button" onClick={fill} disabled={busy || disabled} aria-busy={busy} className="inline-flex items-center gap-2 rounded-full bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-50">
        {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}{busy ? "AI 작성 중…" : label}
      </button>
    </div>
    {message && <p role={failed ? "alert" : "status"} className={`text-xs leading-6 ${failed ? "text-red-700" : "text-[#6F627D]"}`}>{message}</p>}
  </div>;
}
