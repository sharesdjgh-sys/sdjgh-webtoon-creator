"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { workflowProgress } from "@/lib/workflowProgress";
import { STEPS, GENRES } from "@/lib/utils";
import { Plus, ChevronRight, Sparkles, X, Trophy, Download, Upload, Trash2, User, Pencil, Search, Folder, FolderOpen } from "lucide-react";
import { getProjects, createProject, deleteProject, updateProject, type Project } from "@/lib/storage";
import { exportAllProjects, importProjects } from "@/lib/download";
import { setSaveDirectory, getSaveDirectoryName } from "@/lib/fileSystemStorage";

const STEP_ROUTES = STEPS.map(step => step.route);

const GENRE_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  판타지:      { border: "#7C3AED", bg: "#F3EEFF", text: "#6D28D9" },
  로맨스:      { border: "#EC4899", bg: "#FDF2F8", text: "#BE185D" },
  액션:        { border: "#F97316", bg: "#FFF7ED", text: "#C2410C" },
  SF:          { border: "#0EA5E9", bg: "#F0F9FF", text: "#0369A1" },
  일상:        { border: "#10B981", bg: "#F0FDF4", text: "#047857" },
  학원:        { border: "#F59E0B", bg: "#FFFBEB", text: "#B45309" },
  스포츠:      { border: "#3B82F6", bg: "#EFF6FF", text: "#1D4ED8" },
  "공포/스릴러": { border: "#6B7280", bg: "#F9FAFB", text: "#374151" },
  "개그/코미디": { border: "#EAB308", bg: "#FEFCE8", text: "#A16207" },
  역사:        { border: "#92400E", bg: "#FEF3C7", text: "#78350F" },
  음악:        { border: "#8B5CF6", bg: "#F5F3FF", text: "#6D28D9" },
  기타:        { border: "#ADA8A0", bg: "#F4F1EC", text: "#7A7067" },
};

function getProjectHref(p: Project) {
  const route = STEP_ROUTES[Math.min(p.currentStep, STEP_ROUTES.length) - 1];
  return `/project/${p.id}/${route}`;
}

function getDday(deadline: string): { label: string; urgent: boolean; warning: boolean } | null {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deadline);
  due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, urgent: true, warning: false };
  if (diff === 0) return { label: "D-Day", urgent: true, warning: false };
  return {
    label: `D-${diff}`,
    urgent: diff <= 3,
    warning: diff <= 7,
  };
}

type FormState = { title: string; author: string; genre: string; targetCompetition: string; deadline: string };
const EMPTY_FORM: FormState = { title: "", author: "", genre: "", targetCompetition: "", deadline: "" };

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "progress" | "deadline">("recent");
  const [saveDirName, setSaveDirName] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProjects(getProjects());
      getSaveDirectoryName().then(setSaveDirName);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSetFolder = async () => {
    try {
      const name = await setSaveDirectory();
      if (name) setSaveDirName(name);
    } catch (err) {
      alert(err instanceof Error ? err.message : "폴더 설정 실패");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importProjects(file);
      setProjects(getProjects());
    } catch (err) {
      alert(err instanceof Error ? err.message : "가져오기 실패");
    }
    e.target.value = "";
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (e: React.MouseEvent, p: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(p.id);
    setForm({ title: p.title, author: p.author ?? "", genre: p.genre ?? "", targetCompetition: p.targetCompetition ?? "", deadline: p.deadline ?? "" });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    setCreating(true);
    if (editingId) {
      updateProject(editingId, form);
      setProjects(getProjects());
      setShowModal(false);
      setCreating(false);
    } else {
      const p = createProject(form);
      setProjects(getProjects());
      setShowModal(false);
      setForm(EMPTY_FORM);
      setCreating(false);
      router.push(`/project/${p.id}/idea`);
    }
  };

  const selectClass =
    "flex h-11 w-full rounded-xl border border-[#EBE7E0] bg-white px-4 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]/40 transition-all duration-200";

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "좋은 아침이에요";
    if (h < 18) return "안녕하세요";
    return "오늘도 수고했어요";
  };

  const filtered = projects
    .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "progress") return workflowProgress(b) - workflowProgress(a);
      if (sortBy === "deadline") {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="min-h-screen bg-[#FBF9F6]">
      {/* Header */}
      <header className="bg-white border-b border-[#EBE7E0] px-6 py-4 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#7C3AED] flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-[#1A1A1A] tracking-tight">웹툰 메이커 AI</span>
          </Link>
          <div className="flex items-center gap-2">
            <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            <button
              onClick={() => importRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-[#7A7067] hover:text-[#1A1A1A] px-3 py-1.5 rounded-full border border-[#EBE7E0] hover:bg-[#F4F1EC] transition-all duration-200"
            >
              <Upload className="w-3 h-3" /> 가져오기
            </button>
            <button
              onClick={exportAllProjects}
              className="flex items-center gap-1.5 text-xs text-[#7A7067] hover:text-[#1A1A1A] px-3 py-1.5 rounded-full border border-[#EBE7E0] hover:bg-[#F4F1EC] transition-all duration-200"
            >
              <Download className="w-3 h-3" /> 내보내기
            </button>
            <Link href="/guide" className="text-xs text-[#7A7067] hover:text-[#1A1A1A] transition-colors px-3 py-1.5">
              가이드
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Welcome */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-medium text-[#7C3AED] mb-1">{greeting()}</p>
            <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">내 웹툰 프로젝트</h1>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#7C3AED] text-white text-sm font-medium px-4 py-2.5 rounded-full hover:bg-[#6D28D9] transition-all duration-300 hover:scale-[1.02] shadow-[0_4px_16px_rgba(124,58,237,0.25)]"
          >
            <Plus className="w-4 h-4" /> 새 프로젝트
          </button>
        </div>

        {/* Search & Sort */}
        {projects.length > 0 && (
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#ADA8A0]" />
              <input
                type="text"
                placeholder="프로젝트 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 h-9 rounded-xl border border-[#EBE7E0] bg-white text-xs text-[#1A1A1A] placeholder-[#ADA8A0] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]/40 transition-all duration-200"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-9 px-3 rounded-xl border border-[#EBE7E0] bg-white text-xs text-[#7A7067] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 transition-all duration-200"
            >
              <option value="recent">최근 순</option>
              <option value="progress">진행률 순</option>
              <option value="deadline">마감 임박 순</option>
            </select>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-[0_24px_80px_rgba(0,0,0,0.12)] border border-[#EBE7E0]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#1A1A1A] tracking-tight">
                    {editingId ? "프로젝트 정보 수정" : "새 웹툰 프로젝트"}
                  </h2>
                  <p className="text-xs text-[#ADA8A0] mt-0.5">
                    {editingId ? "수정할 내용을 입력해주세요." : "어떤 이야기를 만들어볼까요?"}
                  </p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-[#ADA8A0] hover:text-[#7A7067] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">웹툰 제목 *</label>
                    <Input
                      placeholder="예: 마법을 잃은 탐정"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">작가 이름</label>
                    <Input
                      placeholder="예: 홍길동"
                      value={form.author}
                      onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">장르</label>
                    <select
                      value={form.genre}
                      onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
                      className={selectClass}
                    >
                      <option value="">장르 선택</option>
                      {GENRES.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">마감일</label>
                    <Input
                      type="date"
                      value={form.deadline}
                      onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">참가 대회명</label>
                  <Input
                    placeholder="예: 2026 AI 웹툰 창작 대회"
                    value={form.targetCompetition}
                    onChange={(e) => setForm((f) => ({ ...f, targetCompetition: e.target.value }))}
                  />
                </div>
                {!editingId && (
                  <div>
                    <label className="block text-xs font-semibold text-[#1A1A1A] mb-1.5">자동저장 폴더 (선택)</label>
                    {saveDirName ? (
                      <div className="flex items-center gap-2 h-11 px-4 rounded-xl border border-[#EBE7E0] bg-[#F4F1EC]">
                        <FolderOpen className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-[#1A1A1A] truncate flex-1">{saveDirName}</span>
                        <button
                          type="button"
                          onClick={handleSetFolder}
                          className="text-xs text-[#7C3AED] hover:text-[#6D28D9] font-medium flex-shrink-0 transition-colors"
                        >
                          변경
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSetFolder}
                        className="w-full flex items-center gap-2 h-11 px-4 rounded-xl border border-dashed border-[#EBE7E0] text-[#ADA8A0] hover:border-[#7C3AED]/40 hover:text-[#7C3AED] hover:bg-[#F3EEFF] transition-all duration-200"
                      >
                        <Folder className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm">폴더 선택하기</span>
                        <span className="text-xs text-[#D4CFC9] ml-auto">프로젝트를 파일로 자동저장해요</span>
                      </button>
                    )}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-[#7C3AED] text-white h-11 rounded-full text-sm font-semibold hover:bg-[#6D28D9] transition-all duration-300 disabled:opacity-50 shadow-[0_4px_16px_rgba(124,58,237,0.25)]"
                  >
                    {creating ? "저장 중..." : editingId ? "저장하기" : "시작하기"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="h-11 px-5 rounded-full text-sm border border-[#EBE7E0] text-[#7A7067] hover:bg-[#F4F1EC] transition-all duration-200"
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Projects */}
        {projects.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-[#EBE7E0]">
            <div className="w-14 h-14 rounded-2xl bg-[#F4F1EC] border border-[#EBE7E0] flex items-center justify-center mx-auto mb-5">
              <Sparkles className="w-6 h-6 text-[#7C3AED]" />
            </div>
            <p className="text-base font-bold text-[#1A1A1A] mb-1">아직 프로젝트가 없어요</p>
            <p className="text-sm text-[#7A7067] mb-6">첫 번째 웹툰 프로젝트를 만들어볼까요?</p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 bg-[#7C3AED] text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-[#6D28D9] transition-all duration-300 shadow-[0_4px_16px_rgba(124,58,237,0.25)]"
            >
              <Plus className="w-4 h-4" /> 새 프로젝트 만들기
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-[#EBE7E0]">
            <p className="text-sm font-bold text-[#1A1A1A] mb-1">검색 결과가 없어요</p>
            <p className="text-xs text-[#7A7067]">다른 검색어를 입력해보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((p) => {
              const progress = workflowProgress(p);
              const dday = getDday(p.deadline);
              const genreColor = p.genre ? GENRE_COLORS[p.genre] : null;
              return (
                <div key={p.id} className="relative group">
                  <Link href={getProjectHref(p)}>
                  <div
                    className="bg-white rounded-2xl border border-[#EBE7E0] p-5 hover:border-[#7C3AED]/30 hover:shadow-[0_4px_24px_rgba(124,58,237,0.08)] transition-all duration-300 cursor-pointer overflow-hidden"
                    style={genreColor ? { borderLeft: `3px solid ${genreColor.border}` } : undefined}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0 pr-2">
                        <h3 className="text-sm font-bold text-[#1A1A1A] mb-1.5">{p.title}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.author && (
                            <span className="flex items-center gap-1 text-[10px] text-[#7C3AED] font-medium">
                              <User className="w-3 h-3" /> {p.author}
                            </span>
                          )}
                          {p.genre && (
                            <span
                              className="text-[10px] px-2.5 py-1 rounded-full font-medium border border-transparent"
                              style={genreColor ? { backgroundColor: genreColor.bg, color: genreColor.text } : { backgroundColor: "#F4F1EC", color: "#7A7067" }}
                            >
                              {p.genre}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        {/* Edit button */}
                        <button
                          onClick={(e) => openEdit(e, p)}
                          className="opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center w-6 h-6 rounded hover:bg-[#F4F1EC]"
                          title="프로젝트 편집"
                        >
                          <Pencil className="w-3.5 h-3.5 text-[#ADA8A0] hover:text-[#7A7067]" />
                        </button>
                        {/* Chevron / Delete */}
                        <div className="relative w-5 h-5">
                          <ChevronRight className="w-4 h-4 text-[#EBE7E0] group-hover:opacity-0 transition-all duration-200 absolute inset-0" />
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (confirm(`"${p.title}" 프로젝트를 삭제할까요? 이 작업은 되돌릴 수 없어요.`)) {
                                deleteProject(p.id);
                                setProjects(getProjects());
                              }
                            }}
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center rounded hover:bg-red-50"
                            title="프로젝트 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#ADA8A0] hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3.5">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-[#7A7067]">{STEPS[p.currentStep - 1]?.label ?? "완료"}</span>
                        <span className="font-semibold text-[#7C3AED]">작성 체크 {progress}%</span>
                      </div>
                      <div className="w-full bg-[#F4F1EC] rounded-full h-1.5">
                        <div
                          className="bg-[#7C3AED] h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {p.targetCompetition && (
                        <div className="flex items-center gap-1 text-xs text-[#7C3AED]">
                          <Trophy className="w-3 h-3" />
                          <span className="truncate max-w-[140px]">{p.targetCompetition}</span>
                        </div>
                      )}
                      {dday && (
                        <p className={`text-xs ml-auto font-semibold ${
                          dday.urgent ? "text-red-500" : dday.warning ? "text-orange-400" : "text-[#ADA8A0]"
                        }`}>
                          {dday.label}
                        </p>
                      )}
                    </div>
                  </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
