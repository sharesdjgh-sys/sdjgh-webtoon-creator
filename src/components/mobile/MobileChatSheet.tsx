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
      {/* 플로팅 버튼 - 모바일/태블릿만 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-4 z-40 lg:hidden w-12 h-12 rounded-full bg-[#7C3AED] shadow-lg shadow-[#7C3AED]/30 flex items-center justify-center text-white"
        aria-label="AI 멘토 열기"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {/* 바텀 시트 - 모바일/태블릿만 */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative bg-white rounded-t-2xl flex flex-col" style={{ height: "82vh" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#EBE7E0] flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#7C3AED] flex items-center justify-center">
                  <MessageCircle className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-bold text-[#1A1A1A]">AI 멘토 웹툰이</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#F4F1EC] transition-colors"
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
