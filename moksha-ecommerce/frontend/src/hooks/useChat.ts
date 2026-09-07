import { useCallback, useRef, useState } from "react";

import { apiBaseUrl, tokenStore } from "@/lib/api";

/**
 * The support agent conversation, over Server-Sent Events.
 *
 * `fetch` with a manual stream reader rather than `EventSource`, for one
 * concrete reason: `EventSource` cannot send headers, so it cannot carry the
 * `Authorization` bearer token. The alternatives are a token in the query
 * string — which lands in access logs and browser history — or this. This is
 * a POST anyway, which `EventSource` also cannot do.
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Set on an assistant turn that failed, so the UI can offer a retry. */
  error?: string;
}

interface StreamEvent {
  delta?: string;
  done?: boolean;
  error?: { code: string; message: string };
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: ChatMessage = {
        id: `u${Date.now()}`,
        role: "user",
        content: trimmed,
      };
      const assistantId = `a${Date.now()}`;

      // The history sent is what is on screen *before* this turn. Read from the
      // updater rather than from the closure so two quick sends cannot both
      // capture the same stale array and drop a turn.
      let history: { role: string; content: string }[] = [];
      setMessages((current) => {
        history = current
          .filter((m) => !m.error)
          .map((m) => ({ role: m.role, content: m.content }));
        return [...current, userMessage, { id: assistantId, role: "assistant", content: "" }];
      });

      setIsStreaming(true);

      const updateAssistant = (update: (message: ChatMessage) => ChatMessage) =>
        setMessages((current) =>
          current.map((m) => (m.id === assistantId ? update(m) : m)),
        );

      try {
        const token = tokenStore.access();
        const response = await fetch(`${apiBaseUrl}/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ message: trimmed, history }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          // Only a failure *before* streaming starts has a usable status code —
          // once the stream is open the response is already 200 and errors
          // arrive as events instead.
          const message =
            response.status === 429
              ? "You are sending messages faster than I can answer. Give it a moment."
              : response.status === 503
                ? "The assistant is not configured on this deployment."
                : "The assistant is unavailable right now.";
          updateAssistant((m) => ({ ...m, error: message }));
          return;
        }

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += value;

          // Split on the SSE record separator. A chunk can end mid-record, so
          // the trailing fragment is kept in the buffer for the next read.
          const records = buffer.split("\n\n");
          buffer = records.pop() ?? "";

          for (const record of records) {
            const line = record.trim();
            if (!line.startsWith("data:")) continue;

            let event: StreamEvent;
            try {
              event = JSON.parse(line.slice(5).trim()) as StreamEvent;
            } catch {
              continue; // a malformed record must not kill the whole stream
            }

            if (event.error) {
              updateAssistant((m) => ({ ...m, error: event.error?.message ?? "Something failed." }));
            } else if (event.delta) {
              updateAssistant((m) => ({ ...m, content: m.content + event.delta }));
            }
          }
        }
      } catch (error) {
        // An abort is the user navigating away or sending again — not a failure.
        if (error instanceof DOMException && error.name === "AbortError") return;
        updateAssistant((m) => ({ ...m, error: "Lost connection to the assistant." }));
      } finally {
        setIsStreaming(false);
        // An assistant turn that produced nothing at all would render as an
        // empty bubble; drop it instead.
        setMessages((current) =>
          current.filter((m) => m.id !== assistantId || m.content || m.error),
        );
      }
    },
    [isStreaming],
  );

  return { messages, isStreaming, send, reset };
}
