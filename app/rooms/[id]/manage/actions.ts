"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireChairOrAppAdmin } from "@/lib/auth";
import { shouldArchiveTopic } from "@/lib/topics";

export async function updateRoomTheme(roomId: string, theme: string) {
  const auth = await requireChairOrAppAdmin(roomId);
  if (auth.kind !== "ok") redirect("/login");

  const next = theme.trim();
  if (!next) throw new Error("テーマを入力してください。");

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("rooms")
    .select("theme")
    .eq("id", roomId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!existing) throw new Error("ルームが見つかりません");

  // Same text must not close the live chat. A different text updates
  // rooms.theme; the database trigger then opens a new topic and leaves
  // existing message rows on the previous one.
  if (!shouldArchiveTopic(existing.theme, next)) {
    revalidatePath(`/rooms/${roomId}/manage`);
    revalidatePath(`/rooms/${roomId}`);
    return;
  }

  const { error } = await supabase
    .from("rooms")
    .update({ theme: next })
    .eq("id", roomId);
  if (error) throw new Error(error.message);

  revalidatePath(`/rooms/${roomId}/manage`);
  revalidatePath(`/rooms/${roomId}`);
}

export async function setNameVisibility(roomId: string, visible: boolean) {
  const auth = await requireChairOrAppAdmin(roomId);
  if (auth.kind !== "ok") redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ is_name_visible: visible })
    .eq("id", roomId);
  if (error) throw new Error(error.message);

  revalidatePath(`/rooms/${roomId}/manage`);
  revalidatePath(`/rooms/${roomId}`);
}

/**
 * Sets the per-room override for the registered-student cap.
 * Pass `null` to clear the override and fall back to
 * `app_settings.default_room_user_limit`.
 */
export async function setRoomUserLimit(
  roomId: string,
  value: number | null,
) {
  const auth = await requireChairOrAppAdmin(roomId);
  if (auth.kind !== "ok") redirect("/login");

  if (value !== null) {
    if (!Number.isFinite(value) || value < 1 || value > 10000) {
      throw new Error("人数は 1〜10000 の整数で指定してください");
    }
    value = Math.floor(value);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ user_limit: value })
    .eq("id", roomId);
  if (error) throw new Error(error.message);

  revalidatePath(`/rooms/${roomId}/manage`);
}

export async function setLikesEnabled(roomId: string, enabled: boolean) {
  const auth = await requireChairOrAppAdmin(roomId);
  if (auth.kind !== "ok") redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ likes_enabled: enabled })
    .eq("id", roomId);
  if (error) throw new Error(error.message);

  revalidatePath(`/rooms/${roomId}/manage`);
  revalidatePath(`/rooms/${roomId}`);
}

export async function deleteRoom(roomId: string) {
  const auth = await requireChairOrAppAdmin(roomId);
  if (auth.kind !== "ok") redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase.from("rooms").delete().eq("id", roomId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard`);
  redirect("/dashboard");
}
