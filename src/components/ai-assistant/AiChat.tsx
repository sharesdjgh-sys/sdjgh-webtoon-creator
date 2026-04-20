"use client";

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, User, Mic, MicOff } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`{3}[\s\S]*?`{3}/g, "")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface AiChatHandle {
  focusInput: () => void;
}

interface AiChatProps {
  step: string;
  placeholder?: string;
  initialMessage?: string;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
}

const AiChat = forwardRef<AiChatHandle, AiChatProps>(function AiChat(
  { step, placeholder, initialMessage, initialMessages, onMessagesChange },
  ref
) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialMessages && initialMessages.length > 0) return initialMessages;
    if (initialMessage) return [{ role: "assistant", content: initialMessage }];
    return [];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const manualStopRef = useRef(false);

  useImperativeHandle(ref, () => ({
    focusInput: () => {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
  }));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startRecognition = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionAPI = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const lastIndex = e.results.length - 1;
      const transcript = e.results[lastIndex][0].transcript as string;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
    };
    recognition.onend = () => {
      if (!manualStopRef.current) {
        startRecognition();
      } else {
        setIsListening(false);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      if (e.error === "no-speech") return;
      if (!manualStopRef.current) {
        startRecognition();
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const toggleListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.SpeechRecognition && !w.webkitSpeechRecognition) return;

    if (isListening) {
      manualStopRef.current = true;
      recognitionRef.current?.stop();
      return;
    }

    manualStopRef.current = false;
    setIsListening(true);
    startRecognition();
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    onMessagesChange?.(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, step }),
      });
      const data = await res.json();
      const newMessages = [...next, { role: "assistant" as const, content: stripMarkdown(data.reply) }];
      setMessages(newMessages);
      onMessagesChange?.(newMessages);
    } catch {
      const errMessages = [...next, { role: "assistant" as const, content: "오류가 발생했어요. 다시 시도해주세요." }];
      setMessages(errMessages);
      onMessagesChange?.(errMessages);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-[#EBE7E0] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#EBE7E0] bg-[#FBF9F6]">
        <div className="w-8 h-8 rounded-xl bg-[#7C3AED] flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <p className="text-xs font-bold text-[#1A1A1A]">AI 멘토 웹툰이</p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <p className="text-[10px] text-[#ADA8A0]">항상 준비됐어요</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-[#FBF9F6]">
        {messages.length === 0 && (
          <div className="text-center mt-8">
            <div className="w-12 h-12 rounded-2xl bg-[#7C3AED]/10 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-5 h-5 text-[#7C3AED]" />
            </div>
            <p className="text-xs text-[#ADA8A0]">궁금한 점을 편하게 물어봐요!</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
              msg.role === "user" ? "bg-[#1A1A1A]" : "bg-[#7C3AED]"
            }`}>
              {msg.role === "user"
                ? <User className="w-3 h-3 text-white" />
                : <Sparkles className="w-3 h-3 text-white" />
              }
            </div>
            <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
              msg.role === "user"
                ? "bg-[#1A1A1A] text-white rounded-tr-sm"
                : "bg-white text-[#1A1A1A] rounded-tl-sm border border-[#EBE7E0] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-[#7C3AED] flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <div className="bg-white border border-[#EBE7E0] rounded-2xl rounded-tl-sm px-3.5 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-[#7C3AED] rounded-full animate-bounce [animation-delay:0ms] opacity-60" />
                <span className="w-1.5 h-1.5 bg-[#7C3AED] rounded-full animate-bounce [animation-delay:150ms] opacity-60" />
                <span className="w-1.5 h-1.5 bg-[#7C3AED] rounded-full animate-bounce [animation-delay:300ms] opacity-60" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#EBE7E0] bg-white">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? "Enter로 전송, Shift+Enter로 줄바꿈"}
            className="resize-none min-h-[52px] max-h-[100px] text-xs"
            rows={2}
          />
          <button
            type="button"
            onClick={toggleListening}
            className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center transition-all duration-200 ${
              isListening
                ? "bg-red-500 animate-pulse"
                : "bg-[#EBE7E0] hover:bg-[#7C3AED] group"
            }`}
            title={isListening ? "녹음 중지" : "음성 입력"}
          >
            {isListening
              ? <MicOff className="w-3.5 h-3.5 text-white" />
              : <Mic className="w-3.5 h-3.5 text-[#7A7067] group-hover:text-white" />
            }
          </button>
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="w-9 h-9 flex-shrink-0 rounded-xl bg-[#7C3AED] flex items-center justify-center hover:bg-[#6D28D9] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default AiChat;
