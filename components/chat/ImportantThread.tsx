"use client";

import { useState } from "react";
import type { Message, Profile, Stance } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { MessageInput } from "./MessageInput";
import type { LikeState } from "./MessageList";

type ProfileLite = Pick<Profile, "id" | "name" | "nickname" | "role">;

export function ImportantThread({
  roots,
  childrenByParent,
  profiles,
  meId,
  isAdmin,
  isModerator,
  isNameVisible,
  myStance,
  likesEnabled,
  likes,
  onToggleLike,
  onReply,
  onToggleImportant,
  onEdit,
  onDelete,
}: {
  roots: Message[];
  childrenByParent: Map<string, Message[]>;
  profiles: Record<string, ProfileLite>;
  meId: string;
  isAdmin: boolean;
  isModerator: boolean;
  isNameVisible: boolean;
  myStance: Stance | null;
  likesEnabled: boolean;
  likes: Record<string, LikeState>;
  onToggleLike: (messageId: string) => void | Promise<void>;
  onReply: (content: string, parentId: string) => void | Promise<void>;
  onToggleImportant: (messageId: string, next: boolean) => void;
  onEdit: (messageId: string, content: string) => void | Promise<void>;
  onDelete: (messageId: string) => void | Promise<void>;
}) {
  if (roots.length === 0) {
    return (
      <p className="px-2 py-8 text-center text-sm text-muted">
        まだ重要意見はありません。<br />
        管理者がチャットからピックアップします。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {roots.map((root) => (
        <ThreadNode
          key={root.id}
          message={root}
          depth={0}
          childrenByParent={childrenByParent}
          profiles={profiles}
          meId={meId}
          isAdmin={isAdmin}
          isModerator={isModerator}
          isNameVisible={isNameVisible}
          myStance={myStance}
          likesEnabled={likesEnabled}
          likes={likes}
          onToggleLike={onToggleLike}
          onReply={onReply}
          onToggleImportant={onToggleImportant}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function ThreadNode({
  message,
  depth,
  childrenByParent,
  profiles,
  meId,
  isAdmin,
  isModerator,
  isNameVisible,
  myStance,
  likesEnabled,
  likes,
  onToggleLike,
  onReply,
  onToggleImportant,
  onEdit,
  onDelete,
}: {
  message: Message;
  depth: number;
  childrenByParent: Map<string, Message[]>;
  profiles: Record<string, ProfileLite>;
  meId: string;
  isAdmin: boolean;
  isModerator: boolean;
  isNameVisible: boolean;
  myStance: Stance | null;
  likesEnabled: boolean;
  likes: Record<string, LikeState>;
  onToggleLike: (messageId: string) => void | Promise<void>;
  onReply: (content: string, parentId: string) => void | Promise<void>;
  onToggleImportant: (messageId: string, next: boolean) => void;
  onEdit: (messageId: string, content: string) => void | Promise<void>;
  onDelete: (messageId: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  const [showReply, setShowReply] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [saving, setSaving] = useState(false);

  const replies = childrenByParent.get(message.id) ?? [];
  const author = profiles[message.user_id];
  const displayName =
    (isNameVisible && author?.name) || author?.nickname || "不明";
  const isPro = message.stance === "pro";
  const isCon = message.stance === "con";
  const isChairMsg = message.stance === "chair";
  const isMine = message.user_id === meId;
  const isDeleted = message.deleted_at != null;
  const isEdited = message.edited_at != null && !isDeleted;

  // Body treatment: deleted > chair > own > others'.
  const bodyClass = isDeleted
    ? "border border-navy-600 bg-navy-800/80 text-muted italic ring-1 ring-navy-600/40"
    : isChairMsg
      ? "border-2 border-chair bg-chair-light text-slate-900 ring-1 ring-navy-600/40"
      : isMine
        ? isPro
          ? "border border-pro bg-pro text-white ring-1 ring-navy-600/40"
          : "border border-con bg-con text-white ring-1 ring-navy-600/40"
        : isPro
          ? "border border-pro/30 bg-pro-light text-slate-900 ring-1 ring-navy-600/40"
          : "border border-con/30 bg-con-light text-slate-900 ring-1 ring-navy-600/40";

  const like = likes[message.id];
  const canLike =
    likesEnabled && !isMine && !isDeleted && !isChairMsg ? true : false;
  const likeCount = like?.count ?? 0;

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

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        depth > 0 && "border-l-2 border-navy-600 pl-3",
      )}
    >
      <div
        className={cn(
          "rounded-md p-3 text-sm shadow-md",
          bodyClass,
          depth === 0 &&
            message.is_important &&
            !isDeleted &&
            "ring-2 ring-gold-500 ring-offset-2 ring-offset-navy-900",
        )}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "rounded-sm px-2 py-0.5 font-semibold tracking-wide",
                isPro && !isMine && "bg-pro text-white",
                isCon && !isMine && "bg-con text-white",
                isPro && isMine && "bg-white/90 text-pro",
                isCon && isMine && "bg-white/90 text-con",
                isChairMsg && "bg-chair text-white",
                isDeleted && "bg-navy-700 text-muted",
              )}
            >
              {isPro ? "賛成" : isCon ? "反対" : "議長"}
            </span>
            <span
              className={cn(
                "font-semibold",
                isMine && !isDeleted && !isChairMsg
                  ? "text-white/90"
                  : "text-slate-700",
              )}
            >
              {displayName}
            </span>
            {isMine && (
              <span
                className={cn(
                  isMine && !isDeleted && !isChairMsg
                    ? "text-white/70"
                    : "text-slate-400",
                )}
              >
                あなた
              </span>
            )}
            {isEdited && (
              <span
                className={cn(
                  isMine && !isDeleted && !isChairMsg
                    ? "text-white/70"
                    : "text-slate-400",
                )}
              >
                (編集済み)
              </span>
            )}
          </div>
          {replies.length > 0 && (
            <button
              onClick={() => setOpen((v) => !v)}
              className={cn(
                "text-xs",
                isMine && !isDeleted && !isChairMsg
                  ? "text-white/80 hover:text-white"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              {open ? `▼ 返信 ${replies.length}` : `▶ 返信 ${replies.length}`}
            </button>
          )}
        </div>

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
          <p
            className={cn(
              "whitespace-pre-wrap break-words",
              isMine && !isDeleted && !isChairMsg
                ? "text-white"
                : "text-slate-900",
            )}
          >
            {message.content}
          </p>
        )}

        {!editing && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {!isDeleted && (
              <button
                onClick={() => setShowReply((v) => !v)}
                className={cn(
                  "font-medium",
                  isMine && !isChairMsg
                    ? "text-white/90 hover:text-white"
                    : "text-slate-600 hover:text-pro",
                )}
              >
                {showReply ? "キャンセル" : "返信する"}
              </button>
            )}

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
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    isMine && !isChairMsg ? "text-white/80" : "text-muted",
                  )}
                >
                  <span aria-hidden>♡</span>
                  <span>{likeCount}</span>
                </span>
              )
            )}

            {isAdmin && !isDeleted && depth === 0 && (
              <button
                onClick={() => onToggleImportant(message.id, false)}
                className={cn(
                  "font-medium tracking-wide",
                  isMine && !isChairMsg
                    ? "text-white/90 hover:text-white"
                    : "text-muted hover:text-gold-500",
                )}
              >
                重要意見から外す
              </button>
            )}
            {isAdmin && !isDeleted && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(message.content);
                    setEditing(true);
                  }}
                  className={cn(
                    "font-medium tracking-wide",
                    isMine && !isChairMsg
                      ? "text-white/90 hover:text-white"
                      : "text-muted hover:text-ink",
                  )}
                >
                  編集
                </button>
                <button
                  type="button"
                  onClick={() => void doDelete()}
                  className={cn(
                    "font-medium tracking-wide",
                    isMine && !isChairMsg
                      ? "text-white/90 hover:text-white"
                      : "text-muted hover:text-con",
                  )}
                >
                  削除
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showReply && !isDeleted && (
        <div className="ml-4">
          <MessageInput
            stance={isModerator ? "chair" : myStance}
            disabled={!isModerator && !myStance}
            placeholder={
              isModerator
                ? "議長として返信…"
                : myStance
                  ? "返信を入力…"
                  : "立場を選んでください"
            }
            onSend={async (c) => {
              await onReply(c, message.id);
              setShowReply(false);
            }}
          />
        </div>
      )}

      {open && replies.length > 0 && (
        <div className="flex flex-col gap-2">
          {replies.map((r) => (
            <ThreadNode
              key={r.id}
              message={r}
              depth={depth + 1}
              childrenByParent={childrenByParent}
              profiles={profiles}
              meId={meId}
              isAdmin={isAdmin}
              isModerator={isModerator}
              isNameVisible={isNameVisible}
              myStance={myStance}
              likesEnabled={likesEnabled}
              likes={likes}
              onToggleLike={onToggleLike}
              onReply={onReply}
              onToggleImportant={onToggleImportant}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
