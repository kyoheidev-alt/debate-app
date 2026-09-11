"use client";

import { useState, useTransition } from "react";
import { joinRoom } from "./actions";
import { extractRoomId } from "@/lib/roomId";
import { isNextRedirectError } from "@/lib/utils";

export function JoinRoomCard() {
  const [roomId, setRoomId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = extractRoomId(roomId);
    if (!parsed) {
      setError(
        "ルームIDが見つかりません。招待リンクをそのまま貼るか、IDを入力してください。",
      );
      return;
    }
    const fd = new FormData();
    fd.set("room_id", parsed);
    startTransition(async () => {
      try {
        await joinRoom(fd);
      } catch (err) {
        if (isNextRedirectError(err)) return;
        setError(err instanceof Error ? err.message : "参加に失敗しました");
      }
    });
  }

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">既存のルームに参加</h2>
        <p className="text-sm text-muted">
          招待リンクまたはルームIDを貼ります。現在所属中のルームからは自動で抜けます。
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          className="input flex-1 font-mono"
          placeholder="リンクを貼るか、ルームIDを入力"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          required
        />
        <button type="submit" disabled={pending} className="btn-secondary">
          {pending ? "参加中…" : "参加"}
        </button>
      </form>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
