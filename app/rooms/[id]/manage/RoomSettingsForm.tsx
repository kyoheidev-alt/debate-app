"use client";

import { useState, useTransition } from "react";
import {
  setLikesEnabled,
  setNameVisibility,
  setRoomUserLimit,
  updateRoomTheme,
} from "./actions";
import { isNextRedirectError } from "@/lib/utils";

export function RoomSettingsForm({
  roomId,
  theme,
  isNameVisible,
  likesEnabled,
  userLimit,
  defaultLimit,
}: {
  roomId: string;
  theme: string;
  isNameVisible: boolean;
  likesEnabled: boolean;
  userLimit: number | null;
  defaultLimit: number;
}) {
  const [t, setT] = useState(theme);
  const [v, setV] = useState(isNameVisible);
  const [l, setL] = useState(likesEnabled);
  const [limitInput, setLimitInput] = useState(
    userLimit == null ? "" : String(userLimit),
  );
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

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

  function saveLimit(e: React.FormEvent) {
    e.preventDefault();
    setLimitMsg(null);
    const trimmed = limitInput.trim();
    let next: number | null;
    if (trimmed === "") {
      next = null;
    } else {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 1) {
        setLimitMsg("1 以上の整数または空欄で入力してください");
        return;
      }
      next = Math.floor(n);
    }
    startTransition(async () => {
      try {
        await setRoomUserLimit(roomId, next);
        setLimitMsg(
          next == null
            ? `上書きを解除しました（既定値 ${defaultLimit} 名を使用）`
            : `上限を ${next} 名に設定しました`,
        );
      } catch (err) {
        if (isNextRedirectError(err)) return;
        setLimitMsg(err instanceof Error ? err.message : "失敗しました");
      }
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

      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-navy-600 bg-navy-800 px-4 py-3">
        <span className="font-medium">全員に実名を表示する</span>
        <input
          type="checkbox"
          checked={v}
          onChange={toggleVisibility}
          disabled={pending}
          className="h-5 w-5 accent-pro"
        />
      </label>

      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-navy-600 bg-navy-800 px-4 py-3">
        <span className="flex flex-col">
          <span className="font-medium">いいね機能を有効にする</span>
          <span className="text-xs text-muted">
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

      <form
        onSubmit={saveLimit}
        className="flex flex-col gap-2 rounded-lg border border-navy-600 bg-navy-800 px-4 py-3"
      >
        <span className="font-medium">このルームの人数上限</span>
        <span className="text-xs text-muted">
          空欄にするとアプリ管理者が設定した既定値（現在 {defaultLimit} 名）に従います。
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            step={1}
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            placeholder={`空欄=既定値 ${defaultLimit}`}
            disabled={pending}
            className="input w-40"
          />
          <span className="text-sm text-muted">名</span>
          <button type="submit" disabled={pending} className="btn-primary">
            保存
          </button>
        </div>
        {limitMsg && <p className="text-sm text-emerald-700">{limitMsg}</p>}
      </form>
    </div>
  );
}
