"use client";

import { useState, useTransition } from "react";
import { InlineSpinner } from "@/components/InlineSpinner";
import {
  NICKNAME_FIELD_LABEL,
  NICKNAME_GUIDANCE,
  NICKNAME_MAX_LENGTH,
} from "@/lib/nickname";
import { generateNickname, isNextRedirectError } from "@/lib/utils";
import { saveNickname } from "./actions";

export function NicknameForm({
  roomId,
  initialNickname,
}: {
  roomId: string;
  initialNickname: string;
}) {
  const [nickname, setNickname] = useState(initialNickname);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveNickname(roomId, nickname);
      } catch (err) {
        if (isNextRedirectError(err)) return;
        setError(err instanceof Error ? err.message : "保存に失敗しました");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium tracking-wide text-ink">
          {NICKNAME_FIELD_LABEL}
        </span>
        <p className="text-xs text-muted">{NICKNAME_GUIDANCE}</p>
        <div className="flex gap-2">
          <input
            type="text"
            name="nickname"
            autoComplete="off"
            required
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="input flex-1"
            placeholder="例: パンダ1234"
            maxLength={NICKNAME_MAX_LENGTH}
            disabled={pending}
          />
          <button
            type="button"
            onClick={() => setNickname(generateNickname())}
            disabled={pending}
            className="btn-secondary whitespace-nowrap"
          >
            ランダム
          </button>
        </div>
      </label>

      {error && (
        <p className="rounded-sm border border-con/50 bg-con/20 px-3 py-2 text-sm text-ink">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary inline-flex items-center justify-center gap-2"
      >
        {pending ? (
          <>
            <InlineSpinner />
            <span>保存して入室中…</span>
          </>
        ) : (
          "決定してチャットに入る"
        )}
      </button>
    </form>
  );
}
