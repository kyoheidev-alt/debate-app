"use client";

import { useState, useTransition } from "react";
import { joinRoom } from "./actions";

export function JoinRoomCard() {
  const [roomId, setRoomId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("room_id", roomId);
    startTransition(async () => {
      try {
        await joinRoom(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "参加に失敗しました");
      }
    });
  }

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">既存のルームに参加</h2>
        <p className="text-sm text-slate-500">
          議長から共有されたルーム ID を入力します。現在所属中のルームからは自動で抜けます。
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          className="input flex-1 font-mono"
          placeholder="ルーム ID (UUID)"
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
