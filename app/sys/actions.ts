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

/**
 * Updates the global default cap on `app_settings.default_room_user_limit`.
 * Used as the fallback for any room whose `user_limit` is NULL.
 */
export async function updateGlobalUserLimit(value: number) {
  const auth = await requireAppAdmin();
  if (auth.kind !== "ok") throw new Error("forbidden");
  if (!Number.isFinite(value) || value < 1 || value > 10000) {
    throw new Error("人数は 1〜10000 の整数で指定してください");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .update({
      default_room_user_limit: Math.floor(value),
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
    })
    .eq("id", true);
  if (error) throw new Error(error.message);

  revalidatePath("/sys");
}

/**
 * Marks a report as handled by the current app_admin. If
 * `deleteMessage` is true, also soft-deletes the offending message
 * (the chair-style "[議長により削除されました]" replacement is
 * applied; replies and likes are preserved).
 */
export async function resolveReport(
  reportId: string,
  options: { deleteMessage: boolean; note?: string },
) {
  const auth = await requireAppAdmin();
  if (auth.kind !== "ok") throw new Error("forbidden");

  const admin = createAdminClient();

  if (options.deleteMessage) {
    const { data: report } = await admin
      .from("message_reports")
      .select("message_id")
      .eq("id", reportId)
      .maybeSingle();
    if (!report) throw new Error("通報が見つかりません");
    const { error: delError } = await admin
      .from("messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", report.message_id);
    if (delError) throw new Error(delError.message);
  }

  const { error } = await admin
    .from("message_reports")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: auth.userId,
      resolution_note: options.note?.slice(0, 500) ?? null,
    })
    .eq("id", reportId);
  if (error) throw new Error(error.message);

  revalidatePath("/sys");
}
