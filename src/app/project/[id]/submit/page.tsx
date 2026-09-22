"use client";

import { projectHref } from "@/lib/storage";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { autofillPayload } from "@/lib/autofillContext";
import AiFillButton from "@/components/creation/AiFillButton";
import { mergeAiFields } from "@/lib/aiFill";
import StageIntro from "@/components/creation/StageIntro";
import { Textarea } from "@/components/ui/textarea";
import StepIndicator from "@/components/progress-tracker/StepIndicator";
import { Trophy, CheckCircle, Circle, ArrowLeft, Sparkles, Download } from "lucide-react";
import { getProject, updateProject } from "@/lib/storage";
import { downloadFullSummary } from "@/lib/download";
import MobileStepBar from "@/components/MobileStepBar";
import MobileChatSheet from "@/components/mobile/MobileChatSheet";

const CHECKLIST = [
  { id: "story", label: "스토리 기승전결이 완성되었나요?" },
  { id: "characters", label: "주요 캐릭터가 모두 설정되었나요?" },
  { id: "script", label: "모든 화의 대본이 작성되었나요?" },
  { id: "format", label: "대회 규정 형식(파일형식, 페이지 수 등)을 확인했나요?" },
  { id: "title", label: "웹툰 제목이 정해졌나요?" },
  { id: "authorNote", label: "작가 노트를 준비했나요?" },
  { id: "proofread", label: "오탈자와 문법 오류를 확인했나요?" },
  { id: "consistent", label: "캐릭터 외모와 이름이 전체적으로 일관되나요?" },
  { id: "continuity", label: "스토리: 시간·장소·소지품과 세계관 규칙이 앞 장면과 이어지나요?" },
  { id: "art", label: "그림: 모든 컷의 손·얼굴·인물 수·의상·배경을 직접 확인했나요?" },
  { id: "lettering", label: "글자: 휴대폰 크기에서 대사가 읽히고 말풍선 순서와 화자가 명확한가요?" },
  { id: "scroll", label: "연출: 세로로 읽을 때 컷 순서와 여백이 자연스러운가요?" },
  { id: "privacy", label: "실제 사람의 개인정보와 허락받지 않은 민감한 내용이 없는지 확인했나요?" },
  { id: "originality", label: "다른 작품을 그대로 복제하지 않았고 사용한 자료와 AI 이용 표기를 확인했나요?" },
];

export default function SubmitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ReturnType<typeof getProject>>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [authorNote, setAuthorNote] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    // Restore browser storage after hydration; cancel if the project changes.
    const timer = window.setTimeout(() => {
    const p = getProject(id);
    if (p) {
      setProject(p);
      setAuthorNote(p.authorNote ?? "");
      setChecks(p.reviewChecks ?? {});
      setCompleted(p.isCompleted);
      updateProject(id, { currentStep: Math.max(7, p.currentStep) });
    }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  const toggle = (key: string) => {
    const next = { ...checks, [key]: !checks[key] };
    updateProject(id, { reviewChecks: next, isCompleted: false });
    setChecks(next);
    setCompleted(false);
  };
  const checkedCount = CHECKLIST.filter(item => checks[item.id]).length;
  const isReady = checkedCount === CHECKLIST.length;

  const markComplete = () => {
    if (!isReady || !project) return;
    updateProject(id, { isCompleted: true });
    setCompleted(true);
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
        </div>
      </header>

      <MobileStepBar currentStep={project?.currentStep ?? 6} activeStep={7} projectId={id} />

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-5">
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-[#EBE7E0] p-4 sticky top-20 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <StepIndicator currentStep={project?.currentStep ?? 6} activeStep={7} projectId={id} />
          </div>
        </aside>

        <main className="flex-1 min-w-0 space-y-4">
          <StageIntro stage="submit" />
          <div>
            <p className="text-[10px] font-medium text-[#7C3AED] uppercase tracking-widest mb-1">Step 07</p>
            <h1 className="text-xl font-bold text-[#1A1A1A] tracking-tight flex items-center gap-2">
              제출 준비 <Trophy className="w-5 h-5 text-[#7C3AED]" />
            </h1>
          </div>

          {/* 진행률 */}
          <div className="bg-[#7C3AED] rounded-2xl p-6 text-white shadow-[0_4px_24px_rgba(124,58,237,0.25)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-base font-bold">최종 점검 체크리스트</p>
                {project?.targetCompetition && (
                  <p className="text-white/70 text-xs mt-1">대상 대회: {project.targetCompetition}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{checkedCount}/{CHECKLIST.length}</p>
                <p className="text-white/70 text-xs">항목 완료</p>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div
                className="bg-white h-2 rounded-full transition-all duration-500"
                style={{ width: `${(checkedCount / CHECKLIST.length) * 100}%` }}
              />
            </div>
          </div>

          {/* 체크리스트 */}
          <div className="bg-white rounded-2xl border border-[#EBE7E0] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="px-5 py-4 border-b border-[#EBE7E0]">
              <p className="text-sm font-bold text-[#1A1A1A]">제출 전 확인 사항</p>
            </div>
            <div className="p-3">
              {CHECKLIST.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  role="checkbox"
                  aria-checked={Boolean(checks[item.id])}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#F4F1EC] transition-colors text-left"
                >
                  {checks[item.id] ? (
                    <CheckCircle className="w-4.5 h-4.5 text-[#7C3AED] flex-shrink-0" />
                  ) : (
                    <Circle className="w-4.5 h-4.5 text-[#D4CFC9] flex-shrink-0" />
                  )}
                  <span className={`text-xs ${checks[item.id] ? "text-[#ADA8A0] line-through" : "text-[#1A1A1A]"}`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 작가 노트 */}
          <div className="bg-white rounded-2xl border border-[#EBE7E0] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <label className="block text-xs font-bold text-[#1A1A1A] mb-1">작가 노트 (선택)</label>
            <p className="text-xs text-[#ADA8A0] mb-3">작품에 대한 소개, 제작 동기, 독자에게 하고 싶은 말을 써봐요.</p>
            <AiFillButton label="작가 노트 AI 채우기" disabled={!project}
              getSnapshot={() => {
                const latest = getProject(id);
                if (!latest) throw new Error("작품을 다시 열어 주세요.");
                return { fields: { authorNote }, payload: autofillPayload({ ...latest, authorNote }, "authorNote") };
              }}
              onApply={(draft, before, mode) => {
                const latest = getProject(id);
                if (!latest) return;
                const next = mergeAiFields({ authorNote: latest.authorNote ?? "" }, before, draft, mode).authorNote;
                updateProject(id, { authorNote: next, isCompleted: false, reviewChecks: { ...(latest.reviewChecks ?? {}), authorNote: false } });
                setAuthorNote(next); setCompleted(false); setChecks(current => ({ ...current, authorNote: false }));
              }} />
            <p className="my-3 text-xs text-[#82798B]">작가 노트는 AI 초안으로 채울 수 있어요. 실제 경험과 AI 사용 내역은 직접 확인해 주세요. 검수 체크와 완성 표시는 자동으로 처리하지 않아요.</p>
            <Textarea
              placeholder="작품 소개나 제작 동기를 자유롭게 써보세요."
              value={authorNote}
              onChange={(e) => {
                setAuthorNote(e.target.value);
                updateProject(id, { authorNote: e.target.value });
              }}
              rows={5}
            />
          </div>

          {isReady && !completed && (
            <div className="bg-[#F4F1EC] border border-[#EBE7E0] rounded-2xl p-6 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <h3 className="text-base font-bold text-[#1A1A1A] mb-1">모든 준비가 완료됐어요!</h3>
              <p className="text-xs text-[#7A7067] mb-4">직접 점검한 내용을 바탕으로 완성 표시를 할 수 있어요. 실제 제출은 대회 안내에 따라 진행해 주세요.</p>
              <button
                onClick={markComplete}
                className="bg-[#7C3AED] text-white text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-[#6D28D9] transition-all duration-300 shadow-[0_4px_16px_rgba(124,58,237,0.25)]"
              >
                웹툰 완성 완료 표시하기
              </button>
            </div>
          )}

          {completed && (
            <div className="bg-[#7C3AED] rounded-2xl p-6 text-center text-white">
              <div className="text-3xl mb-2">🏆</div>
              <h3 className="text-base font-bold mb-1">축하해요!</h3>
              <p className="text-xs text-white/80">웹툰 제작을 완료했어요. 대회에서 좋은 결과 있기를 응원해요!</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Link href={projectHref(id, "episodes")}>
              <button className="flex items-center gap-2 text-xs font-medium px-4 py-2.5 rounded-full border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] transition-all duration-200">
                <ArrowLeft className="w-3.5 h-3.5" /> 이전: 콘티 · 작화
              </button>
            </Link>
            {project && (
              <button
                onClick={() => downloadFullSummary(project)}
                className="flex items-center gap-2 text-xs font-semibold px-5 py-2.5 rounded-full border border-[#7C3AED]/30 text-[#7C3AED] hover:bg-[#7C3AED]/5 transition-all duration-200"
              >
                <Download className="w-3.5 h-3.5" /> 최종 요약 다운로드
              </button>
            )}
          </div>
        </main>

      </div>
      <MobileChatSheet
        step="completion"
        initialMessage="거의 다 왔어요! 제출 전 최종 점검을 도와드릴게요. 작가 노트 작성이나 마지막으로 확인하고 싶은 부분이 있으시면 말씀해 주세요!"
        placeholder="마지막 점검에 도움을 요청하세요..."
      />
    </div>
  );
}
