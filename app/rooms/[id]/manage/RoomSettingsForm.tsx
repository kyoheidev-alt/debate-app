"use client";

import { useState, useTransition } from "react";
import {
  setLikesEnabled,
  setNameVisibility,
  updateRoomTheme,
} from "./actions";

export function RoomSettingsForm({
  roomId,
  theme,
  isNameVisible,
  likesEnabled,
}: {
  roomId: string;
  theme: string;
  isNameVisible: boolean;
  likesEnabled: boolean;
}) {
  const [t, setT] = useState(theme);
  const [v, setV] = useState(isNameVisible);
  const [l, setL] = useState(likesEnabled);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function saveTheme(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      await updateRoomTheme(roomId, t.trim());
      setMsg("テーマを更新しました");
    });
  }

  function toggleVisibility() {
    const next = !v;
    setV(next);
    startTransition(async () => {
      await setNameVisibility(roomId, next);
    });
  }

  function toggleLikes() {
    const next = !l;
    setL(next);
    startTransition(async () => {
      await setLikesEnabled(roomId, next);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={saveTheme} className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input flex-1"
          value={t}
          onChange={(e) => setT(e.target.value)}
          placeholder="テーマ"
          required
        />
        <button type="submit" disabled={pending} className="btn-primary">
          保存
        </button>
      </form>

      <label className="flex cursor-pointer items-center justify-between rounded-lg border bg-slate-50 px-4 py-3">
        <span className="font-medium">全員に実名を表示する</span>
        <input
          type="checkbox"
          checked={v}
          onChange={toggleVisibility}
          disabled={pending}
          className="h-5 w-5 accent-pro"
        />
      </label>

      <label className="flex cursor-pointer items-center justify-between rounded-lg border bg-slate-50 px-4 py-3">
        <span className="flex flex-col">
          <span className="font-medium">いいね機能を有効にする</span>
          <span className="text-xs text-slate-500">
            参加者は他のメッセージに「♡」で共感を示せます。自分のメッセージにはいいねできません。
          </span>
        </span>
        <input
          type="checkbox"
          checked={l}
          onChange={toggleLikes}
          disabled={pending}
          className="h-5 w-5 accent-pink-500"
        />
      </label>

      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
    </div>
  );
}
