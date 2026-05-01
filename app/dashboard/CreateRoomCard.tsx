"use client";

import { useState, useTransition } from "react";
import { createRoom } from "./actions";
import { isNextRedirectError } from "@/lib/utils";

export function CreateRoomCard() {
  const [theme, setTheme] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("theme", theme);
    startTransition(async () => {
      try {
        await createRoom(fd);
      } catch (err) {
        if (isNextRedirectError(err)) return;
        setError(err instanceof Error ? err.message : "作成に失敗しました");
      }
    });
  }

  return (
    <section className="card flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">新しいルームを作成</h2>
        <p className="text-sm text-muted">
          作成すると、あなたがそのルームの議長になります。
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          className="input flex-1"
          placeholder="ディベートテーマ（例: 学校給食を有料化すべきか）"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          required
        />
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "作成中…" : "作成して管理画面へ"}
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
