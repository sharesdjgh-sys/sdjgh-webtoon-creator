"use client";

import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { MessageCircle, X } from "lucide-react";
import AiChat, { type AiChatHandle } from "@/components/ai-assistant/AiChat";

type Message = { role: "user" | "assistant"; content: string };

export interface MobileChatSheetHandle {
  openAndFocus: () => void;
}

interface Props {
  step: string;
  initialMessage: string;
  placeholder?: string;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
}

const MobileChatSheet = forwardRef<MobileChatSheetHandle, Props>(function MobileChatSheet(
  { step, initialMessage, placeholder, initialMessages, onMessagesChange },
  ref
) {
  const [open, setOpen] = useState(false);
  const chatRef = useRef<AiChatHandle>(null);

  useImperativeHandle(ref, () => ({
    openAndFocus: () => {
      setOpen(true);
      setTimeout(() => chatRef.current?.focusInput(), 120);
    },
  }));

  return (
    <>
      {/* 화면을 차지하지 않고 필요할 때 여는 AI 멘토 버튼 */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(() => chatRef.current?.focusInput(), 120);
        }}
        className="fixed bottom-5 right-4 z-40 flex h-12 w-12 transform-gpu items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-lg shadow-[#7C3AED]/30 transition-all duration-200 hover:-translate-y-1 hover:scale-105 hover:bg-[#6D28D9] hover:shadow-xl active:scale-95 sm:bottom-6 sm:right-6"
        aria-label="AI 멘토 열기"
        title="AI 멘토 웹툰이"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {/* 모바일에서는 바텀 시트, 넓은 화면에서는 큰 우측 패널 */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end sm:p-4">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="relative mt-auto flex h-[86vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:mt-0 sm:h-full sm:max-w-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#EBE7E0] flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#7C3AED] flex items-center justify-center">
                  <MessageCircle className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-bold text-[#1A1A1A]">AI 멘토 웹툰이</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-[#F4F1EC] transition-all active:scale-95"
                aria-label="AI 멘토 닫기"
              >
                <X className="w-4 h-4 text-[#ADA8A0]" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <AiChat
                ref={chatRef}
                step={step}
                initialMessage={initialMessage}
                placeholder={placeholder}
                initialMessages={initialMessages}
                onMessagesChange={onMessagesChange}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default MobileChatSheet;
