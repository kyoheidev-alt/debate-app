"use client";

import { useState } from "react";
import type { MessageStance } from "@/lib/supabase/types";

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <div className="flex-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          disabled={disabled || sending}
          placeholder={
            placeholder ??
            (stance === "pro"
              ? "賛成の立場で発言…"
              : stance === "con"
                ? "反対の立場で発言…"
                : stance === "chair"
                  ? "議長として発言…"
                  : "立場を選んでください")
          }
          className="w-full resize-none rounded-sm border border-navy-600 bg-navy-900/70 px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-gold-500 disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              submit(e as unknown as React.FormEvent);
            }
          }}
        />
        <p className="mt-1 text-[11px] text-muted">
          Ctrl/Cmd + Enter で送信
        </p>
      </div>
      <button
        type="submit"
        disabled={disabled || sending || text.trim().length === 0}
        className="btn-primary"
      >
        送信
      </button>
    </form>
  );
}
