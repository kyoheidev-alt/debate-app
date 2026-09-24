"use server";

import { redirect } from "next/navigation";
import { validateNickname } from "@/lib/nickname";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function saveNickname(roomId: string, nicknameRaw: string) {
  const parsed = validateNickname(nicknameRaw);
  if (!parsed.ok) throw new Error(parsed.error);
  const nickname = parsed.nickname;
  if (!roomId) {
    throw new Error("ルームIDが不正です。");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/r/${roomId}/enter`);
  }

  // Service Role: bypass RLS so we can also flip has_set_nickname.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, room_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "user" || profile.room_id !== roomId) {
    redirect(`/r/${roomId}/enter`);
  }

  const { error } = await admin
    .from("profiles")
    .update({ nickname, has_set_nickname: true })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  redirect(`/rooms/${roomId}`);
}
