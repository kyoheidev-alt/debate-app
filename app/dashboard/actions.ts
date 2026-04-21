"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChairCapableAccount } from "@/lib/supabase/types";

export async function createRoom(formData: FormData) {
  const theme = String(formData.get("theme") ?? "").trim();
  if (!theme) {
    throw new Error("テーマを入力してください。");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Defense in depth: students must not create rooms even if they craft
  // the request manually. Only chair-capable accounts (real-email signup
  // or app_admin) may.
  const { data: profile } = await supabase
    .from("profiles")
    .select("login_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isChairCapableAccount(profile)) {
    throw new Error("ルームを作成できるのは議長アカウントのみです。");
  }

  const { data, error } = await supabase
    .from("rooms")
    .insert({ theme, chair_id: user.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  redirect(`/rooms/${data.id}/manage`);
}

export async function joinRoom(formData: FormData) {
  const roomId = String(formData.get("room_id") ?? "").trim();
  if (!roomId) {
    throw new Error("ルーム ID を入力してください。");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ room_id: roomId })
    .eq("id", user.id);
  if (error) throw new Error("ルームへの参加に失敗しました: " + error.message);

  revalidatePath("/dashboard");
  redirect(`/rooms/${roomId}`);
}

export async function leaveCurrentRoom() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ room_id: null })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
}
