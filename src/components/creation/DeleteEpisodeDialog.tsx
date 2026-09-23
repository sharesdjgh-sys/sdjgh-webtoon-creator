"use client";

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, X } from "lucide-react";
import type { Episode } from "@/lib/storage";

type Props = {
  episode?: Episode;
  disabledReason?: string;
  onConfirm: () => boolean;
};

export default function DeleteEpisodeDialog({ episode, disabledReason, onConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const number = episode?.episodeNumber ?? 1;
  const changeOpen = (next: boolean) => {
    setError("");
    setOpen(next);
  };
  const confirm = () => {
    if (disabledReason) return;
    try {
      if (onConfirm()) changeOpen(false);
      else setError("삭제할 회차를 확인하고 다시 시도해 주세요.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "회차 삭제를 저장하지 못했어요. 다시 시도해 주세요.");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <button type="button" disabled={!!disabledReason || !episode} aria-label={`${number}화 삭제`}
          aria-describedby={disabledReason ? "episode-delete-reason" : undefined}
          title={disabledReason ?? "현재 화 삭제"}
          className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#7A7067] transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:text-[#ADA8A0] focus-visible:outline-2 focus-visible:outline-red-500">
          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> 이 화 삭제
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content onOpenAutoFocus={event => { event.preventDefault(); cancelRef.current?.focus(); }}
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-[#EBE7E0] bg-white p-6 shadow-[0_16px_64px_rgba(0,0,0,0.16)] focus:outline-none">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <Trash2 aria-hidden="true" className="h-5 w-5" />
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="삭제 확인 닫기" className="rounded-lg p-2 text-[#7A7067] hover:bg-[#F4F1EC] focus-visible:outline-2 focus-visible:outline-[#7C3AED]"><X aria-hidden="true" className="h-4 w-4" /></button>
            </Dialog.Close>
          </div>
          <Dialog.Title className="text-lg font-bold tracking-tight text-[#1A1A1A]">{number}화를 삭제할까요?</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-[#7A7067]">
            이 화의 대본·콘티·작화가 작품에서 제거됩니다. 삭제한 화는 되돌릴 수 없어요.
          </Dialog.Description>
          <div className="my-4 rounded-2xl border border-[#EBE7E0] bg-[#FBF9F6] p-4">
            <p className="break-words text-sm font-semibold text-[#1A1A1A]">{number}화 · {episode?.title || "제목 없음"}</p>
            <p className="mt-1 text-xs text-[#7A7067]">{episode?.script?.trim() ? "대본 있음" : "대본 없음"} · {episode?.cuts?.length ?? 0}컷 · 작화 {episode?.cuts?.filter(cut => cut.sceneImageAssetId).length ?? 0}개</p>
          </div>
          <p className="text-xs leading-5 text-[#7A7067]">남은 화는 1화부터 다시 번호를 매깁니다. 현재 편집 내용과 전체 회차 수도 함께 즉시 저장됩니다.</p>
          {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</p>}
          {disabledReason && <p role="status" className="mt-3 text-xs text-[#7A7067]">{disabledReason}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button ref={cancelRef} type="button" className="rounded-full border border-[#EBE7E0] px-5 py-2.5 text-xs font-semibold text-[#514A45] hover:bg-[#F4F1EC] focus-visible:outline-2 focus-visible:outline-[#7C3AED]">취소</button>
            </Dialog.Close>
            <button type="button" onClick={confirm} disabled={!!disabledReason}
              className="rounded-full bg-red-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-red-500">{number}화 삭제</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
