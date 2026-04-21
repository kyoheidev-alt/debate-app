"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(input: {
  name: string;
  nickname: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です。" };

  const name = input.name.trim();
  const nickname = input.nickname.trim();

  if (!name) return { ok: false, error: "名前を入力してください。" };
  if (name.length > 60) {
    return { ok: false, error: "名前は60文字以内で入力してください。" };
  }
  if (!nickname) return { ok: false, error: "ニックネームを入力してください。" };
  if (nickname.length > 20) {
    return { ok: false, error: "ニックネームは20文字以内で入力してください。" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ name, nickname })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/sys");
  return { ok: true };
}
