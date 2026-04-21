"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  room_id: string;
  kind: string;
  payload: { login_id?: string; reason?: string } & Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

interface ToastItem {
  id: string;
  message: string;
}

export function NotificationBell({ roomId }: { roomId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [registerTarget, setRegisterTarget] = useState<Notification | null>(
    null,
  );
  const seenIds = useRef<Set<string>>(new Set());
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const pushToast = useCallback((notif: Notification) => {
    const loginId = notif.payload?.login_id ?? "(不明)";
    const id = notif.id;
    const message =
      notif.kind === "duplicate_entry_attempt"
        ? `ID ${loginId} が別の端末から重複入室を試みました`
        : `ID ${loginId} が入室を試みました`;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!mounted || !data) return;
      const list = data as Notification[];
      setItems(list);
      list.forEach((n) => seenIds.current.add(n.id));
    })();

    return () => {
      mounted = false;
    };
  }, [supabase, roomId]);

  useEffect(() => {
    const channel = supabase
      .channel(`notif:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const n = payload.new as Notification;
            if (seenIds.current.has(n.id)) return;
            seenIds.current.add(n.id);
            setItems((prev) => [n, ...prev]);
            pushToast(n);
          } else if (payload.eventType === "UPDATE") {
            const n = payload.new as Notification;
            setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Notification;
            setItems((prev) => prev.filter((x) => x.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, roomId, pushToast]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function markAsRead(id: string) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
  }

  async function markAllRead() {
    const unread = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length === 0) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread);
  }

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) void markAllRead();
      return next;
    });
  }

  return (
    <>
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={toggleOpen}
          aria-label="通知を表示"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-pro hover:text-pro"
        >
          <BellIcon />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-tight text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] origin-top-right rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-sm font-semibold">通知</span>
              <span className="text-xs text-slate-400">
                入室試行 / 重複入室
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-slate-500">
                  通知はありません
                </p>
              )}
              {items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notif={n}
                  onRegister={() => setRegisterTarget(n)}
                  onMarkRead={() => markAsRead(n.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toast container */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg"
          >
            {t.message}
          </div>
        ))}
      </div>

      {registerTarget && (
        <RegisterFromNotificationDialog
          roomId={roomId}
          loginId={registerTarget.payload?.login_id ?? ""}
          onClose={() => setRegisterTarget(null)}
          onSuccess={async () => {
            await markAsRead(registerTarget.id);
            setRegisterTarget(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function NotificationItem({
  notif,
  onRegister,
  onMarkRead,
}: {
  notif: Notification;
  onRegister: () => void;
  onMarkRead: () => void;
}) {
  const loginId = notif.payload?.login_id ?? "(不明)";
  const reason = notif.payload?.reason;
  const dt = new Date(notif.created_at);
  const dtLabel = dt.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const isDuplicate = notif.kind === "duplicate_entry_attempt";

  return (
    <div
      className={`flex flex-col gap-2 border-b px-4 py-3 text-sm ${
        notif.read_at ? "bg-white" : "bg-amber-50/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-medium text-slate-700">
            ID <span className="font-mono text-slate-900">{loginId}</span>{" "}
            {isDuplicate
              ? "が別の端末から重複入室を試みました"
              : "が入室を試みました"}
          </span>
          <span className="text-xs text-slate-400">{dtLabel}</span>
          {reason === "not_member" && (
            <span className="mt-0.5 text-xs text-slate-500">
              （別ルームに登録済み）
            </span>
          )}
          {isDuplicate && (
            <span className="mt-0.5 text-xs text-rose-600">
              なりすましの可能性があります。本人にご確認ください。
            </span>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {!notif.read_at && (
          <button
            type="button"
            onClick={onMarkRead}
            className="text-xs text-slate-500 hover:underline"
          >
            既読
          </button>
        )}
        {/* "このIDで登録" は未登録ユーザー向け。重複入室や別ルーム登録には不要。 */}
        {!reason && !isDuplicate && (
          <button
            type="button"
            onClick={onRegister}
            className="rounded-md bg-pro px-3 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            このIDで登録
          </button>
        )}
      </div>
    </div>
  );
}

function RegisterFromNotificationDialog({
  roomId,
  loginId,
  onClose,
  onSuccess,
}: {
  roomId: string;
  loginId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/users/single", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          room_id: roomId,
          user: {
            login_id: loginId,
            name: name.trim(),
            nickname: nickname.trim() || undefined,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "登録に失敗しました");
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">このIDをルームに登録</h2>
        <p className="mt-2 text-sm text-slate-500">
          ID <span className="font-mono">{loginId}</span> を本ルームの参加者として登録します。
        </p>

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">名前（必須）</span>
            <input
              className="input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 山田 太郎"
              disabled={pending}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-slate-700">
              ニックネーム（任意 / 本人がSTEP3で再設定可）
            </span>
            <input
              className="input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={pending}
            />
          </label>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={pending}
              className="btn-primary w-full"
            >
              {pending ? "登録中…" : "登録する"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="btn-secondary w-full"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
