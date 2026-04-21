"use server";

import { createClient } from "@/lib/supabase/server";
import { requireChairOrAppAdmin } from "@/lib/auth";

/**
 * Edit the content of a message in-place. Allowed for the chair of the
 * message's room and for app_admins. Authors can edit their own messages
 * via the same RLS policy, but they go through Supabase client-side from
 * the browser (no server action needed) — this action is the moderator
 * path and stamps `edited_at` so the UI can show "(編集済み)".
 */
export async function editMessage(
  messageId: string,
  contentRaw: string,
): Promise<void> {
  const content = contentRaw.trim();
  if (!messageId) throw new Error("messageId が不正です。");
  if (!content) throw new Error("本文を入力してください。");
  if (content.length > 2000) {
    throw new Error("本文は 2000 文字以内で入力してください。");
  }

  const supabase = await createClient();

  // We need the room_id to run requireChairOrAppAdmin.
  const { data: msg, error: fetchErr } = await supabase
    .from("messages")
    .select("id, room_id, deleted_at")
    .eq("id", messageId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!msg) throw new Error("メッセージが見つかりません。");
  if (msg.deleted_at)
    throw new Error("削除済みのメッセージは編集できません。");

  const auth = await requireChairOrAppAdmin(msg.room_id);
  if (auth.kind !== "ok") {
    throw new Error("この操作は議長またはアプリ管理者のみ実行できます。");
  }

  const { error } = await supabase
    .from("messages")
    .update({ content, edited_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw new Error(error.message);
}

/**
 * Soft-delete a message. The row stays (replies/likes are preserved) but
 * `deleted_at` is set and the content is blanked so the chat renders a
 * placeholder. Chair / app_admin only.
 */
export async function deleteMessage(messageId: string): Promise<void> {
  if (!messageId) throw new Error("messageId が不正です。");

  const supabase = await createClient();

  const { data: msg, error: fetchErr } = await supabase
    .from("messages")
    .select("id, room_id, deleted_at")
    .eq("id", messageId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!msg) throw new Error("メッセージが見つかりません。");
  if (msg.deleted_at) return; // idempotent

  const auth = await requireChairOrAppAdmin(msg.room_id);
  if (auth.kind !== "ok") {
    throw new Error("この操作は議長またはアプリ管理者のみ実行できます。");
  }

  const { error } = await supabase
    .from("messages")
    .update({
      content: "",
      deleted_at: new Date().toISOString(),
      is_important: false,
    })
    .eq("id", messageId);
  if (error) throw new Error(error.message);
}
