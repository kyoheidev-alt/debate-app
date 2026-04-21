"use server";

import { revalidatePath } from "next/cache";
import { requireAppAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function setUserRole(
  loginId: string,
  role: "user" | "app_admin",
) {
  const auth = await requireAppAdmin();
  if (auth.kind !== "ok") throw new Error("forbidden");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("login_id", loginId)
    .maybeSingle();
  if (!profile) throw new Error(`ID '${loginId}' のユーザーが見つかりません`);

  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", profile.id);
  if (error) throw new Error(error.message);

  revalidatePath("/sys");
}
