"use client";

import { useEffect, useState } from "react";

export function ShareInviteCard({ roomId }: { roomId: string }) {
  const [url, setUrl] = useState(`/r/${roomId}/enter`);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}/r/${roomId}/enter`);
  }, [roomId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card flex flex-col gap-3">
      <h2 className="text-lg font-semibold">生徒への招待</h2>
      <p className="text-sm text-muted">
        Teams などにこのリンクを1本送ってください。生徒はリンクを開いて参加用ID（学籍番号）を入力します。UUIDを手打ちさせる必要はありません。
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={url}
          className="input font-mono text-xs"
          aria-label="招待リンク"
        />
        <button type="button" onClick={() => void copy()} className="btn-primary shrink-0">
          {copied ? "コピーしました" : "リンクをコピー"}
        </button>
      </div>
    </section>
  );
}
