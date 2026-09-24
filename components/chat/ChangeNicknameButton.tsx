"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { InlineSpinner } from "@/components/InlineSpinner";
import {
  NICKNAME_FIELD_LABEL,
  NICKNAME_GUIDANCE,
  NICKNAME_MAX_LENGTH,
  validateNickname,
} from "@/lib/nickname";
import { generateNickname } from "@/lib/utils";
import { updateOwnNickname } from "@/app/rooms/nickname-actions";

export function ChangeNicknameButton({
  currentNickname,
  onChanged,
}: {
  currentNickname: string;
  onChanged: (nickname: string) => void;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(currentNickname);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending]);

  function openDialog() {
    setNickname(currentNickname);
    setError(null);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = validateNickname(nickname);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    startTransition(async () => {
      const result = await updateOwnNickname(parsed.nickname);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onChanged(result.nickname);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="text-xs font-medium tracking-wide text-gold-500 underline-offset-2 hover:underline"
      >
        名前を変える
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-2xl bg-white p-6 text-slate-900 shadow-xl"
          >
            <h2 id={titleId} className="text-lg font-semibold">
              ニックネームを変更
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              議論を中断せず、この画面のまま表示名だけ変えられます。
            </p>

            <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-slate-800">
                  {NICKNAME_FIELD_LABEL}
                </span>
                <p className="text-xs text-slate-500">{NICKNAME_GUIDANCE}</p>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    name="nickname"
                    autoComplete="off"
                    required
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
                    placeholder="例: パンダ1234"
                    maxLength={NICKNAME_MAX_LENGTH}
                    disabled={pending}
                  />
                  <button
                    type="button"
                    onClick={() => setNickname(generateNickname())}
                    disabled={pending}
                    className="whitespace-nowrap rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    ランダム
                  </button>
                </div>
                <span className="text-right text-xs text-slate-400">
                  {nickname.trim().length} / {NICKNAME_MAX_LENGTH}
                </span>
              </label>

              {error && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-1 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {pending ? (
                    <>
                      <InlineSpinner />
                      <span>保存中…</span>
                    </>
                  ) : (
                    "保存する"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
