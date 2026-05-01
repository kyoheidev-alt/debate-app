"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveReport } from "@/app/sys/actions";
import type { MessageReport } from "@/lib/supabase/types";

/** Joined view used by the SSR loader on /sys (see page.tsx). */
export interface ReportListItem extends MessageReport {
  message_content: string;
  message_deleted_at: string | null;
  message_created_at: string;
  message_user_id: string;
  reporter_login_id: string;
  reporter_nickname: string;
  author_login_id: string;
  author_nickname: string;
  room_theme: string;
}

interface ToastItem {
  id: string;
  text: string;
}

export function ReportsList({ initial }: { initial: ReportListItem[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<ReportListItem[]>(initial);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenIds = useRef<Set<string>>(new Set(initial.map((r) => r.id)));

  const unresolvedCount = items.filter((r) => !r.resolved_at).length;

  const pushToast = useCallback((text: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  // Keep local state in sync if the server-side list changes
  // (router.refresh after a server action).
  useEffect(() => {
    setItems(initial);
    initial.forEach((r) => seenIds.current.add(r.id));
  }, [initial]);

  useEffect(() => {
    const channel = supabase
      .channel("sys:reports")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reports",
        },
        (payload) => {
          const next = payload.new as MessageReport;
          if (seenIds.current.has(next.id)) return;
          seenIds.current.add(next.id);
          pushToast("新しい通報が届きました");
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router, pushToast]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-ink">
          通報一覧
          {unresolvedCount > 0 && (
            <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
              未対応 {unresolvedCount}
            </span>
          )}
        </h2>
        <p className="text-xs text-muted">
          通報内容はアプリ管理者のみが閲覧できます
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-sm border border-navy-600 bg-navy-700 p-4 text-sm text-muted shadow-md">
          通報はまだありません。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </ul>
      )}

      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-lg"
          >
            {t.text}
          </div>
        ))}
      </div>
    </section>
  );
}

function ReportCard({ report }: { report: ReportListItem }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isResolved = !!report.resolved_at;
  const isDeletedMessage = !!report.message_deleted_at;

  const dt = new Date(report.created_at).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  function act(deleteMessage: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await resolveReport(report.id, { deleteMessage });
      } catch (err) {
        setError(err instanceof Error ? err.message : "失敗しました");
      }
    });
  }

  return (
    <li
      className={`card flex flex-col gap-3 ${
        isResolved ? "opacity-70" : "border-l-4 border-l-rose-500"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{dt}</span>
          <span>•</span>
          <span>
            ルーム: <span className="font-medium text-ink">{report.room_theme}</span>
          </span>
          <Link
            href={`/rooms/${report.room_id}/manage`}
            className="text-pro hover:underline"
          >
            ルーム管理へ
          </Link>
        </div>
        {isResolved ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            対応済み
          </span>
        ) : (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
            未対応
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <p className="text-muted">
          <span className="font-medium">通報者:</span>{" "}
          <span className="font-mono text-xs">{report.reporter_login_id}</span>{" "}
          <span className="text-muted/80">({report.reporter_nickname})</span>
        </p>
        <p className="text-muted">
          <span className="font-medium">投稿者:</span>{" "}
          <span className="font-mono text-xs">{report.author_login_id}</span>{" "}
          <span className="text-muted/80">({report.author_nickname})</span>
        </p>
      </div>

      <div className="rounded-md border border-navy-600 bg-navy-800 p-3 text-sm">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
          対象メッセージ
        </p>
        {isDeletedMessage ? (
          <p className="italic text-muted">
            [削除済み] 元の本文: 「{report.message_content}」
          </p>
        ) : (
          <p className="whitespace-pre-wrap break-words text-ink">
            {report.message_content}
          </p>
        )}
      </div>

      {report.reason && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
            通報理由
          </p>
          <p className="whitespace-pre-wrap break-words">{report.reason}</p>
        </div>
      )}

      {!isResolved && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => act(false)}
            disabled={pending}
            className="btn-secondary text-sm"
          >
            {pending ? "処理中…" : "対応済みにする"}
          </button>
          {!isDeletedMessage && (
            <button
              type="button"
              onClick={() => {
                if (
                  !confirm(
                    "このメッセージを削除し、通報を対応済みにします。よろしいですか？",
                  )
                )
                  return;
                act(true);
              }}
              disabled={pending}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
            >
              メッセージを削除して対応済み
            </button>
          )}
        </div>
      )}

      {report.resolution_note && (
        <p className="text-xs text-muted">メモ: {report.resolution_note}</p>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </li>
  );
}
