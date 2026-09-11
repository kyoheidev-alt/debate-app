"use client";

import { useEffect, useState } from "react";
import { getLastRoomId } from "@/lib/studentEntryStorage";
import { extractRoomId } from "@/lib/roomId";

export function RoomIdEntryForm() {
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastRoom, setLastRoom] = useState<string | null>(null);

  useEffect(() => {
    setLastRoom(getLastRoomId());
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = extractRoomId(roomId);
    if (!parsed) {
      setError(
        "ルームIDが見つかりません。議長から共有されたリンクをそのまま貼るか、IDを入力してください。",
      );
      return;
    }
    setError(null);
    window.location.assign(`/r/${parsed}/enter`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium tracking-wide text-ink">
          招待リンク または ルームID
        </span>
        <input
          type="text"
          required
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="input font-mono"
          placeholder="リンクを貼り付け"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
        />
      </label>

      {error && (
        <p
          role="alert"
          className="rounded-sm border border-con/50 bg-con/20 px-3 py-2 text-sm text-ink"
        >
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary">
        入室画面へ
      </button>

      {lastRoom && lastRoom !== extractRoomId(roomId) && (
        <button
          type="button"
          onClick={() => setRoomId(lastRoom)}
          className="self-start text-xs text-muted hover:text-gold-500 hover:underline"
        >
          前回のルーム ({lastRoom.slice(0, 8)}…) を使う
        </button>
      )}
    </form>
  );
}
