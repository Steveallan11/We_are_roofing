"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import type { AssistantConversationRecord, AssistantUiMessage } from "@/lib/assistant/types";

type ToolState = {
  name: string;
  result?: string;
};

type ChatStatus = "idle" | "sending" | "error";

declare global {
  interface WindowEventMap {
    "gauge:prompt": CustomEvent<{ prompt: string }>;
  }

  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognition;
    SpeechRecognition?: new () => SpeechRecognition;
  }
}

type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function createMessage(role: "user" | "assistant", text: string): AssistantUiMessage {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    createdAt: new Date().toISOString()
  };
}

function getRouteContext(pathname: string) {
  const jobMatch = pathname.match(/^\/jobs\/([^/]+)/);
  const quoteMatch = pathname.match(/^\/jobs\/([^/]+)\/quote/);
  return {
    pathname,
    jobId: jobMatch?.[1] ?? null,
    quoteId: quoteMatch?.[1] ?? null
  };
}

export function useAssistant() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [messages, setMessages] = useState<AssistantUiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [toolState, setToolState] = useState<ToolState | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [micActive, setMicActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const routeContext = useMemo(() => getRouteContext(pathname), [pathname]);

  useEffect(() => {
    const tooltipTimer = window.setTimeout(() => setTooltipVisible(true), 3000);
    const hideTimer = window.setTimeout(() => setTooltipVisible(false), 9000);
    return () => {
      window.clearTimeout(tooltipTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const [conversationResponse, statusResponse] = await Promise.all([
        fetch("/api/assistant/chat"),
        fetch("/api/assistant/status")
      ]);

      const conversationData = (await conversationResponse.json().catch(() => null)) as
        | { ok?: boolean; conversation?: AssistantConversationRecord | null }
        | null;
      const statusData = (await statusResponse.json().catch(() => null)) as { overdueCount?: number } | null;

      if (conversationData?.conversation) {
        setConversationId(conversationData.conversation.id);
        setMessages(conversationData.conversation.history);
      }
      setOverdueCount(Number(statusData?.overdueCount ?? 0));
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, toolState, status, open]);

  useEffect(() => {
    const handler = (event: CustomEvent<{ prompt: string }>) => {
      setOpen(true);
      void sendMessage(event.detail.prompt);
    };
    window.addEventListener("gauge:prompt", handler as EventListener);
    return () => window.removeEventListener("gauge:prompt", handler as EventListener);
  }, []);

  const sendMessage = useCallback(
    async (text?: string) => {
      const nextText = (text ?? draft).trim();
      if (!nextText) return;

      const nextMessages = [...messages, createMessage("user", nextText)];
      setMessages(nextMessages);
      setDraft("");
      setStatus("sending");
      setError(null);
      setToolState(null);

      try {
        const response = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages,
            conversationId,
            context: routeContext
          })
        });

        if (!response.body) {
          throw new Error("No assistant response stream was returned.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const eventChunk of events) {
            const dataLine = eventChunk
              .split("\n")
              .find((line) => line.startsWith("data: "));
            if (!dataLine) continue;
            const payload = JSON.parse(dataLine.slice(6)) as Record<string, unknown>;

            if (payload.type === "text" && typeof payload.text === "string") {
              assistantText = assistantText ? `${assistantText}\n${payload.text}` : payload.text;
              setMessages((current) => {
                const withoutTail =
                  current[current.length - 1]?.role === "assistant" ? current.slice(0, -1) : current;
                return [...withoutTail, createMessage("assistant", assistantText)];
              });
            }

            if (payload.type === "tool_start" && typeof payload.tool === "string") {
              setToolState({ name: payload.tool });
            }

            if (payload.type === "tool_done" && typeof payload.tool === "string") {
              const resultSummary =
                payload.result && typeof payload.result === "object" && "summary" in payload.result
                  ? String((payload.result as { summary?: string }).summary ?? "")
                  : "";
              setToolState({ name: payload.tool, result: resultSummary });
            }

            if (payload.type === "navigation" && typeof payload.path === "string") {
              router.push(payload.path as Route);
            }

            if (payload.type === "conversation" && typeof payload.conversationId === "string") {
              setConversationId(payload.conversationId);
            }

            if (payload.type === "error" && typeof payload.error === "string") {
              throw new Error(payload.error);
            }
          }
        }

        setStatus("idle");
      } catch (sendError) {
        setStatus("error");
        setError(sendError instanceof Error ? sendError.message : "Assistant request failed.");
      }
    },
    [conversationId, draft, messages, routeContext, router]
  );

  const resetConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setToolState(null);
    setStatus("idle");
  }, []);

  const toggleMic = useCallback(() => {
    if (micActive) {
      recognitionRef.current?.stop();
      setMicActive(false);
      return;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice input is not available in this browser.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-GB";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) {
        void sendMessage(transcript);
      }
    };
    recognition.onend = () => setMicActive(false);
    recognitionRef.current = recognition;
    recognition.start();
    setMicActive(true);
  }, [micActive, sendMessage]);

  return {
    open,
    setOpen,
    tooltipVisible,
    messages,
    draft,
    setDraft,
    status,
    error,
    toolState,
    conversationId,
    overdueCount,
    micActive,
    scrollRef,
    sendMessage,
    resetConversation,
    toggleMic
  };
}
