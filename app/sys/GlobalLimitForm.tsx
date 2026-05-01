"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGlobalUserLimit } from "@/app/sys/actions";

export function GlobalLimitForm({ currentValue }: { currentValue: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(currentValue));
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) {
      setMsg({ kind: "err", text: "1 以上の整数を入力してください" });
      return;
    }
    startTransition(async () => {
      try {
        await updateGlobalUserLimit(Math.floor(n));
        setMsg({
          kind: "ok",
          text: `全体既定値を ${Math.floor(n)} 名に更新しました`,
        });
        router.refresh();
      } catch (err) {
        setMsg({
          kind: "err",
          text: err instanceof Error ? err.message : "失敗しました",
        });
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="font-medium text-ink">既定上限</span>
        <input
          type="number"
          min={1}
          step={1}
          className="input w-32"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
        />
        <span className="text-muted">名 / ルーム</span>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "保存中…" : "保存"}
        </button>
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
    </form>
  );
}
