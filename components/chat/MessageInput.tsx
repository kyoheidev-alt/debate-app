"use client";

import { useState } from "react";
import type { MessageStance } from "@/lib/supabase/types";
import { MIN_STUDENT_MESSAGE_CHARS } from "@/lib/identity";

export function MessageInput({
  disabled,
  stance,
  onSend,
  placeholder,
}: {
  disabled?: boolean;
  stance: MessageStance | null;
  onSend: (content: string) => void | Promise<void>;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const defaultPlaceholder =
    stance === "pro"
      ? "賛成の理由を書く（例: ○○だから賛成です）"
      : stance === "con"
        ? "反対の理由を書く（例: ○○が心配なので反対です）"
        : stance === "chair"
          ? "議長として論点を整理する…"
          : "先に賛成か反対かを選んでください";

  async function submit(e?: React.SyntheticEvent) {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (stance !== "chair" && trimmed.length < MIN_STUDENT_MESSAGE_CHARS) {
      setHint(
        `理由が伝わるように、${MIN_STUDENT_MESSAGE_CHARS}文字以上書いてください。`,
      );
      return;
    }
    setHint(null);
    setSending(true);
    try {
      await Promise.resolve(onSend(trimmed));
      setText("");
    } catch {
      /* keep draft so the student can retry */
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex items-start gap-2">
      <div className="flex-1">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (hint) setHint(null);
          }}
          rows={2}
          disabled={disabled || sending}
          placeholder={placeholder ?? defaultPlaceholder}
          className="w-full resize-none rounded-sm border border-navy-600 bg-navy-900/70 px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-gold-500 disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              void submit(e);
            }
          }}
        />
        {hint ? (
          <p role="alert" className="mt-1 text-[11px] text-red-300">
            {hint}
          </p>
        ) : (
          <p className="mt-1 hidden text-[11px] text-muted sm:block">
            Ctrl/Cmd + Enter で送信
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={disabled || sending || text.trim().length === 0}
        className="btn-primary shrink-0"
      >
        送信
      </button>
    </form>
  );
}
