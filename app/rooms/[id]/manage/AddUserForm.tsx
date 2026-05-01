"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateNickname } from "@/lib/utils";

export function AddUserForm({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/users/single", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          user: {
            login_id: loginId,
            name,
            // nickname は任意。空なら本人が入室時に設定する。
            nickname: nickname.trim(),
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "登録に失敗しました");
      }
      setSuccess(`${loginId} を登録しました`);
      setLoginId("");
      setName("");
      setNickname("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">ID（必須）</span>
        <input
          className="input"
          required
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          placeholder="例: 22A1234"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">名前（必須）</span>
        <input
          className="input"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 山田 太郎"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium text-ink">
          ニックネーム（任意）
        </span>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            maxLength={20}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="例: パンダ1234（空欄可。本人が入室時に設定）"
          />
          <button
            type="button"
            onClick={() => setNickname(generateNickname())}
            className="btn-secondary text-sm whitespace-nowrap"
          >
            ランダム
          </button>
        </div>
      </label>

      <div className="sm:col-span-2 flex flex-col gap-2">
        <p className="text-xs text-muted">
          一般ユーザーはパスワード不要で入室できます（ID + 本人確認ダイアログ）。
          ニックネームは任意です。未設定なら本人が入室時に必ず設定します（匿名性は入室時に確保）。
        </p>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="btn-primary self-start"
        >
          {pending ? "登録中…" : "ユーザーを登録してこのルームに追加"}
        </button>
      </div>
    </form>
  );
}
