"use client";

import { useEffect, useState, useTransition } from "react";
import { attemptEnter, confirmEnter, type AttemptResult } from "./actions";
import {
  clearStudentEntry,
  getLoginIdForRoom,
  saveStudentEntry,
} from "@/lib/studentEntryStorage";
import { InlineSpinner } from "@/components/InlineSpinner";
import { isNextRedirectError } from "@/lib/utils";

interface PendingConfirm {
  loginId: string;
  name: string;
  needsNickname: boolean;
}

export function EnterForm({ roomId }: { roomId: string }) {
  const [loginId, setLoginId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<PendingConfirm | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [confirmPending, startConfirmTransition] = useTransition();

  // Pre-fill from localStorage if this device entered this room before.
  useEffect(() => {
    const remembered = getLoginIdForRoom(roomId);
    if (remembered) setLoginId(remembered);
  }, [roomId]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = loginId.trim();
    if (!trimmed) {
      setError("IDを入力してください。");
      return;
    }

    startTransition(async () => {
      let result: AttemptResult;
      try {
        result = await attemptEnter(roomId, trimmed);
      } catch (err) {
        if (isNextRedirectError(err)) return;
        setError(err instanceof Error ? err.message : "通信エラーが発生しました");
        return;
      }
      switch (result.status) {
        case "found":
          setConfirmTarget({
            loginId: trimmed,
            name: result.name,
            needsNickname: result.needsNickname,
          });
          break;
        case "unknown":
          setError(
            "このルームに登録されていません。議長に登録を依頼してください。",
          );
          break;
        case "not_member":
          setError(
            "このIDは他のルームに登録されています。議長に確認してください。",
          );
          break;
        case "not_student":
          setError(
            "このIDは一般ユーザー用ではありません。議長/管理者は通常のログインを使用してください。",
          );
          break;
        case "error":
          setError(result.message);
          break;
      }
    });
  }

  function onConfirmYes() {
    if (!confirmTarget) return;
    // Save BEFORE navigating away — `confirmEnter` ends with a server-side
    // redirect so any code after the await is unreachable.
    saveStudentEntry(roomId, confirmTarget.loginId);
    startConfirmTransition(async () => {
      try {
        await confirmEnter(roomId, confirmTarget.loginId);
        // confirmEnter calls redirect() on success; on error we land here.
      } catch (err) {
        if (isNextRedirectError(err)) return;
        setError(err instanceof Error ? err.message : "入室に失敗しました");
        setConfirmTarget(null);
      }
    });
  }

  function onConfirmNo() {
    // The remembered loginId was wrong (different person on this device).
    clearStudentEntry(roomId);
    setConfirmTarget(null);
    setLoginId("");
  }

  return (
    <>
      <form onSubmit={onSubmit} className="card flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium tracking-wide text-ink">ID</span>
          <input
            type="text"
            autoComplete="off"
            inputMode="text"
            required
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className="input"
            placeholder="例: 22A1234"
            disabled={pending || confirmPending}
          />
        </label>

        {error && (
          <p className="rounded-sm border border-con/50 bg-con/20 px-3 py-2 text-sm text-ink">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || confirmPending}
          className="btn-primary inline-flex items-center justify-center gap-2"
        >
          {pending ? (
            <>
              <InlineSpinner />
              <span>確認中…</span>
            </>
          ) : (
            "入室する"
          )}
        </button>
      </form>

      {confirmTarget && (
        <ConfirmDialog
          name={confirmTarget.name}
          pending={confirmPending}
          onYes={onConfirmYes}
          onNo={onConfirmNo}
        />
      )}
    </>
  );
}

function ConfirmDialog({
  name,
  pending,
  onYes,
  onNo,
}: {
  name: string;
  pending: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-sm border border-navy-600 bg-navy-700 p-6 shadow-xl">
        <h2 className="heading-serif text-lg text-gold-500">本人確認</h2>
        <p className="mt-3 text-base text-ink">
          あなたは <span className="font-bold">【{name}】</span> さんですか？
        </p>
        <p className="mt-2 text-sm text-muted">
          違う場合は「いいえ」を押してIDを入力し直してください。
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onYes}
            disabled={pending}
            className="btn-primary inline-flex w-full items-center justify-center gap-2"
          >
            {pending ? (
              <>
                <InlineSpinner />
                <span>入室中…</span>
              </>
            ) : (
              "はい、入室する"
            )}
          </button>
          <button
            type="button"
            onClick={onNo}
            disabled={pending}
            className="btn-secondary w-full"
          >
            いいえ、戻る
          </button>
        </div>
      </div>
    </div>
  );
}
