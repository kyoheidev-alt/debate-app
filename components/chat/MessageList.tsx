"use client";

import { useEffect, useRef, useState } from "react";
import { chatAuthorLabel } from "@/lib/nickname";
import type { Message, Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type ProfileLite = Pick<Profile, "id" | "nickname" | "role"> &
  Partial<Pick<Profile, "name">>;

export interface LikeState {
  count: number;
  likedByMe: boolean;
}

export function MessageList({
  messages,
  profiles,
  meId,
  isAdmin,
  isNameVisible,
  likesEnabled,
  likes,
  onToggleLike,
  onToggleImportant,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  messages: Message[];
  profiles: Record<string, ProfileLite>;
  meId: string;
  isAdmin: boolean;
  isNameVisible: boolean;
  likesEnabled: boolean;
  likes: Record<string, LikeState>;
  onToggleLike: (messageId: string) => void | Promise<void>;
  onToggleImportant: (messageId: string, next: boolean) => void;
  onEdit: (messageId: string, content: string) => void | Promise<void>;
  onDelete: (messageId: string) => void | Promise<void>;
  /** Archived prompts are readable but not part of the live actions. */
  readOnly?: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (readOnly) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, readOnly]);

  if (messages.length === 0) {
    return (
      <div className="px-2 py-10 text-center">
        <p className="text-sm font-semibold text-ink">最初の意見を書こう</p>
        <ol className="mx-auto mt-3 max-w-xs list-decimal space-y-1 pl-5 text-left text-sm leading-relaxed text-muted">
          <li>左（または下）で賛成か反対かを選ぶ</li>
          <li>「なぜそう思うか」を1文以上書く</li>
          <li>相手の意見に返信して議論を深める</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((m) => (
        <MessageRow
          key={m.id}
          message={m}
          author={profiles[m.user_id]}
          meId={meId}
          isAdmin={isAdmin}
          isNameVisible={isNameVisible}
          likesEnabled={likesEnabled}
          like={likes[m.id]}
          readOnly={readOnly}
          onToggleLike={onToggleLike}
          onToggleImportant={onToggleImportant}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function MessageRow({
  message,
  author,
  meId,
  isAdmin,
  isNameVisible,
  likesEnabled,
  like,
  onToggleLike,
  onToggleImportant,
  onEdit,
  onDelete,
  readOnly = false,
}: {
  message: Message;
  author: ProfileLite | undefined;
  meId: string;
  isAdmin: boolean;
  isNameVisible: boolean;
  likesEnabled: boolean;
  like: LikeState | undefined;
  onToggleLike: (messageId: string) => void | Promise<void>;
  onToggleImportant: (messageId: string, next: boolean) => void;
  onEdit: (messageId: string, content: string) => void | Promise<void>;
  onDelete: (messageId: string) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [saving, setSaving] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const isPro = message.stance === "pro";
  const isCon = message.stance === "con";
  const isChair = message.stance === "chair";
  const isMine = message.user_id === meId;
  const isDeleted = message.deleted_at != null;
  const isEdited = message.edited_at != null && !isDeleted;

  const displayName = chatAuthorLabel(author, isNameVisible);

  const alignWrapper = isPro
    ? "justify-start"
    : isCon
      ? "justify-end"
      : "justify-center";
  const alignInner = isPro
    ? "items-start"
    : isCon
      ? "items-end"
      : "items-center";
  const alignHeader = isCon ? "flex-row-reverse" : "";

  // Body styling: self-messages use the saturated color, others use the
  // light tint. Chair keeps its existing purple treatment. Deleted
  // messages fall back to a muted gray regardless of stance.
  const bodyClass = isDeleted
    ? "bg-navy-800/80 text-muted italic ring-1 ring-navy-600"
    : isChair
      ? "border-2 border-chair bg-chair-light text-slate-900 ring-1 ring-navy-600/40"
      : isMine
        ? isPro
          ? "bg-pro text-white ring-1 ring-navy-600/40"
          : "bg-con text-white ring-1 ring-navy-600/40"
        : isPro
          ? "bg-pro-light text-slate-900 ring-1 ring-navy-600/40"
          : "bg-con-light text-slate-900 ring-1 ring-navy-600/40";

  async function saveEdit() {
    const next = draft.trim();
    if (!next || next === message.content) {
      setEditing(false);
      setDraft(message.content);
      return;
    }
    setSaving(true);
    try {
      await onEdit(message.id, next);
      setEditing(false);
    } catch (err) {
      alert(
        "編集に失敗しました: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!confirm("このメッセージを削除しますか？（元に戻せません）")) return;
    try {
      await onDelete(message.id);
    } catch (err) {
      alert(
        "削除に失敗しました: " +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  const canLike =
    !readOnly &&
    likesEnabled &&
    !isMine &&
    !isDeleted &&
    message.stance !== "chair"
      ? true
      : false;
  const likeCount = like?.count ?? 0;

  // Reports go directly to app_admin (NOT the chair). We hide the
  // button on chair / app_admin messages because moderation of those
  // is not in scope for the report flow (and the chair cannot read
  // reports anyway).
  const canReport =
    !readOnly && !isMine && !isDeleted && message.stance !== "chair";

  return (
    <div className={cn("flex w-full", alignWrapper)}>
      <div className={cn("flex max-w-[78%] flex-col gap-1", alignInner)}>
        <div
          className={cn(
            "flex items-center gap-2 text-xs",
            alignHeader,
          )}
        >
          <span className="font-semibold text-ink">{displayName}</span>
          <span
            className={cn(
              "rounded-sm px-2 py-0.5 font-semibold tracking-wide",
              isPro && "bg-pro-light text-pro",
              isCon && "bg-con-light text-con",
              isChair && "bg-chair text-white",
            )}
          >
            {isPro ? "賛成" : isCon ? "反対" : "議長"}
          </span>
          {isMine && <span className="text-muted">あなた</span>}
          {isEdited && <span className="text-muted">(編集済み)</span>}
        </div>

        <div
          className={cn(
            "rounded-md px-4 py-2 text-[0.95rem] leading-relaxed shadow-md",
            bodyClass,
            message.is_important &&
              !isDeleted &&
              "ring-2 ring-gold-500 ring-offset-2 ring-offset-navy-900",
          )}
        >
          {isDeleted ? (
            <p className="whitespace-pre-wrap break-words">
              [議長により削除されました]
            </p>
          ) : editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                disabled={saving}
                className="w-full resize-none rounded-sm border border-slate-300 bg-white/95 px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-gold-500 disabled:opacity-60"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void saveEdit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setEditing(false);
                    setDraft(message.content);
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={saving}
                  className="btn-primary text-xs"
                >
                  {saving ? "保存中…" : "保存 (Ctrl+Enter)"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDraft(message.content);
                  }}
                  disabled={saving}
                  className="btn-secondary text-xs"
                >
                  取消 (Esc)
                </button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>

        {!editing && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-3 text-xs",
              alignHeader,
            )}
          >
            {canLike ? (
              <button
                type="button"
                onClick={() => void onToggleLike(message.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-medium tracking-wide transition",
                  like?.likedByMe
                    ? "border-pink-400 bg-pink-500/20 text-pink-300"
                    : "border-navy-600 bg-navy-800/60 text-muted hover:border-pink-400 hover:text-pink-300",
                )}
                aria-pressed={like?.likedByMe ?? false}
              >
                <span aria-hidden>{like?.likedByMe ? "♥" : "♡"}</span>
                <span>{likeCount}</span>
              </button>
            ) : (
              likesEnabled &&
              !isDeleted &&
              likeCount > 0 && (
                <span className="inline-flex items-center gap-1 text-muted">
                  <span aria-hidden>♡</span>
                  <span>{likeCount}</span>
                </span>
              )
            )}

            {canReport && (
              <button
                type="button"
                onClick={() => setReportOpen(true)}
                className="font-medium tracking-wide text-rose-300 hover:text-rose-200"
                title="この発言をアプリ管理者に通報"
              >
                通報
              </button>
            )}

            {!readOnly && isAdmin && !isDeleted && (
              <>
                <button
                  type="button"
                  onClick={() => onToggleImportant(message.id, !message.is_important)}
                  className={cn(
                    "font-medium tracking-wide transition",
                    message.is_important
                      ? "text-gold-500 hover:text-gold-400"
                      : "text-muted hover:text-gold-500",
                  )}
                >
                  {message.is_important
                    ? "★ 重要から外す"
                    : "☆ 重要にピックアップ"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(message.content);
                    setEditing(true);
                  }}
                  className="font-medium tracking-wide text-muted hover:text-ink"
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={() => void doDelete()}
                  className="font-medium tracking-wide text-muted hover:text-con"
                >
                  削除
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {reportOpen && (
        <ReportDialog
          messageId={message.id}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

function ReportDialog({
  messageId,
  onClose,
}: {
  messageId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message_id: messageId, reason: reason.trim() }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status === 409) {
          throw new Error("この発言はすでに通報済みです");
        }
        throw new Error(json.error ?? "通報に失敗しました");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "通報に失敗しました");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">
          この発言を通報
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          通報内容は<strong>アプリ管理者のみ</strong>に届きます（議長には共有されません）。
          危険な発言・誹謗中傷・個人情報の暴露などにご利用ください。
        </p>

        {done ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              通報を受け付けました。アプリ管理者が確認します。
            </p>
            <button
              type="button"
              onClick={onClose}
              className="btn-primary w-full"
            >
              閉じる
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700">
                理由（任意・最大500文字）
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={500}
                disabled={pending}
                placeholder="どこが問題かを簡潔に書くと管理者の判断が早まります（空欄でも送信できます）"
                className="resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-60"
              />
              <span className="text-right text-xs text-slate-400">
                {reason.length} / 500
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
                className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
              >
                {pending ? "送信中…" : "通報する"}
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
        )}
      </div>
    </div>
  );
}
