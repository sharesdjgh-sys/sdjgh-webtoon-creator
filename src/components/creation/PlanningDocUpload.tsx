"use client";
import { useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { updateProject, type PlanningDoc, type Project } from "@/lib/storage";

const MAX_CHARS = 30_000;

export default function PlanningDocUpload({ project }: { project: Project }) {
  const [doc, setDoc] = useState<PlanningDoc | undefined>(project.planningDoc);
  const [editing, setEditing] = useState(Boolean(project.planningDoc?.text));
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const save = (next: PlanningDoc | undefined, message: string) => {
    setDoc(next);
    try { updateProject(project.id, { planningDoc: next }); setStatus(message); }
    catch { setStatus("저장하지 못했어요. 저장 공간을 확인해 주세요."); }
  };

  const upload = async (file: File) => {
    setUploading(true); setStatus("기획서를 읽는 중이에요...");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/planning-doc", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setStatus(data.error ?? "기획서를 읽지 못했어요."); return; }
      save({ name: data.name, text: data.text, updatedAt: new Date().toISOString() },
        data.truncated ? `앞부분 ${MAX_CHARS.toLocaleString()}자만 불러왔어요. 중요한 내용이 빠졌다면 아래에서 고쳐 주세요.` : "기획서를 불러왔어요. 아래에서 내용을 확인하고 고칠 수 있어요.");
      setEditing(true);
    } catch { setStatus("기획서를 올리지 못했어요. 네트워크를 확인해 주세요."); }
    finally { setUploading(false); }
  };

  const remove = () => {
    if (!window.confirm("불러온 기획서를 지울까요? AI 대화와 자동 채우기에서 더 이상 참고하지 않아요.")) return;
    save(undefined, "기획서를 지웠어요."); setEditing(false);
  };

  return <section className="rounded-2xl border border-[#EBE7E0] bg-white p-5 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-bold">내 기획서 불러오기 <span className="font-normal text-[#ADA8A0]">(선택)</span></h2>
        <p className="mt-1 text-xs text-[#82798B]">미리 써 둔 기획서가 있다면 올려 주세요. AI 멘토가 읽고 이어서 대화하고, 대화 없이도 자동 채우기가 기획서를 바탕으로 초안을 만들어요.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="flex items-center gap-1.5 rounded-full bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-50">
          <Upload className="h-3.5 w-3.5" /> {uploading ? "읽는 중..." : doc ? "다른 파일 올리기" : "파일 올리기"}
        </button>
        {!editing && <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-[#EBE7E0] px-4 py-2 text-xs font-semibold text-[#5B5362] hover:bg-[#F7F3FF]">직접 붙여넣기</button>}
      </div>
      <input ref={inputRef} type="file" accept=".txt,.md,.docx,.pdf,.hwpx,.hwp" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} />
    </div>
    <p className="text-[11px] text-[#ADA8A0]">TXT · MD · DOCX · PDF · HWPX, 4MB 이하. 한글(.hwp)은 HWPX나 PDF로 저장해 올려 주세요.</p>
    {editing && <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-[#5B5362]"><FileText className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{doc?.name || "직접 입력한 기획서"}</span></span>
        {doc && <button type="button" onClick={remove} className="flex flex-shrink-0 items-center gap-1 text-[#ADA8A0] hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /> 지우기</button>}
      </div>
      <textarea value={doc?.text ?? ""} maxLength={MAX_CHARS} rows={10}
        placeholder="기획서 내용을 붙여넣거나 직접 적어 주세요. 인물 설정, 세계관, 줄거리, 결말 등 무엇이든 좋아요."
        onChange={event => save(event.target.value ? { name: doc?.name ?? "", text: event.target.value, updatedAt: new Date().toISOString() } : undefined, "기획서가 저장되었어요")}
        className="block w-full rounded-xl border border-[#EBE7E0] p-3 text-xs leading-relaxed" />
      <p className="text-right text-[11px] text-[#ADA8A0]">{(doc?.text.length ?? 0).toLocaleString()} / {MAX_CHARS.toLocaleString()}자</p>
    </div>}
    <p role="status" className="text-xs text-[#82798B]">{status}</p>
  </section>;
}
