"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateNickname } from "@/lib/utils";
import { updateProfile } from "./actions";

export function SettingsForm({
  initialName,
  initialNickname,
}: {
  initialName: string;
  initialNickname: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [nickname, setNickname] = useState(initialNickname);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);

  const dirty = name !== initialName || nickname !== initialNickname;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const result = await updateProfile({ name, nickname });
      if (!result.ok) {
        setMsg({ kind: "err", text: result.error });
        return;
      }
      setMsg({ kind: "ok", text: "保存しました。" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-slate-700">名前（議長機能で表示）</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          maxLength={60}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-slate-700">
          ニックネーム（チャットでの表示名）
        </span>
        <div className="flex gap-2">
          <input
            type="text"
            required
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="input flex-1"
            maxLength={20}
          />
          <button
            type="button"
            onClick={() => setNickname(generateNickname())}
            className="btn-secondary whitespace-nowrap"
          >
            ランダム
          </button>
        </div>
      </label>

      {msg && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            msg.kind === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="btn-primary"
        >
          {pending ? "保存中…" : "保存"}
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setName(initialName);
              setNickname(initialNickname);
              setMsg(null);
            }}
            disabled={pending}
            className="btn-secondary"
          >
            元に戻す
          </button>
        )}
      </div>
    </form>
  );
}
