"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLastRoomId } from "@/lib/studentEntryStorage";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function RoomIdEntryForm() {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastRoom, setLastRoom] = useState<string | null>(null);

  useEffect(() => {
    setLastRoom(getLastRoomId());
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = roomId.trim();
    if (!UUID_RE.test(trimmed)) {
      setError("ルームID（UUID形式）を正しく入力してください。");
      return;
    }
    setError(null);
    router.push(`/r/${trimmed}/enter`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium tracking-wide text-ink">ルームID</span>
        <input
          type="text"
          required
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="input font-mono"
          placeholder="例: 11111111-2222-3333-4444-555555555555"
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      {error && (
        <p className="rounded-sm border border-con/50 bg-con/20 px-3 py-2 text-sm text-ink">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary">
        入室画面へ
      </button>

      {lastRoom && lastRoom !== roomId.trim() && (
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
