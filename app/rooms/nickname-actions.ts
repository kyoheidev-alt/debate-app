"use server";

import { createClient } from "@/lib/supabase/server";
import { nicknameUpdateFilter, validateNickname } from "@/lib/nickname";

/**
 * Changes the signed-in user's chat nickname while they stay in the room.
 * The update is limited to `profiles.id = auth.uid()` and only the
 * `nickname` column, so a student cannot rename anyone else and the
 * chair-only 実名表示 flag is left untouched.
 */
export async function updateOwnNickname(
  nicknameRaw: string,
): Promise<{ ok: true; nickname: string } | { ok: false; error: string }> {
  const parsed = validateNickname(nicknameRaw);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です。" };

  const target = nicknameUpdateFilter(user.id);
  const { data, error } = await supabase
    .from("profiles")
    .update({ nickname: parsed.nickname })
    .eq("id", target.id)
    .select("id, nickname")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data || data.id !== target.id) {
    return { ok: false, error: "ニックネームを保存できませんでした。" };
  }
  return { ok: true, nickname: data.nickname };
}
