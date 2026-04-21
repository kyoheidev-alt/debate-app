"use client";

import { useState, useTransition } from "react";
import { generateNickname } from "@/lib/utils";
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
        // On success the action redirects to /rooms/[id].
      } catch (err) {
        setError(err instanceof Error ? err.message : "保存に失敗しました");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium tracking-wide text-ink">
          ニックネーム（20文字以内）
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            required
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="input flex-1"
            placeholder="例: パンダ1234"
            maxLength={20}
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

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "保存中…" : "決定してチャットに入る"}
      </button>
    </form>
  );
}
