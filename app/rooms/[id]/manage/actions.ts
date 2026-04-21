"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireChairOrAppAdmin } from "@/lib/auth";

export async function updateRoomTheme(roomId: string, theme: string) {
  const auth = await requireChairOrAppAdmin(roomId);
  if (auth.kind !== "ok") redirect("/login");

  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ theme: theme.trim() })
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
