"use client";

import { useEffect, useRef, useState } from "react";
import type { Message, Profile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type ProfileLite = Pick<Profile, "id" | "name" | "nickname" | "role">;

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
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        まだメッセージがありません。最初の意見を投稿しましょう。
      </p>
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
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [saving, setSaving] = useState(false);

  const isPro = message.stance === "pro";
  const isCon = message.stance === "con";
  const isChair = message.stance === "chair";
  const isMine = message.user_id === meId;
  const isDeleted = message.deleted_at != null;
  const isEdited = message.edited_at != null && !isDeleted;

  const displayName =
    (isNameVisible && author?.name) || author?.nickname || "不明";

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
    likesEnabled && !isMine && !isDeleted && message.stance !== "chair"
      ? true
      : false;
  const likeCount = like?.count ?? 0;

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

            {isAdmin && !isDeleted && (
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
    </div>
  );
}
