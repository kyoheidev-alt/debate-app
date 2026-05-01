"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  PRESENCE_ACTIVE_WINDOW_MS,
  PRESENCE_ENTRY_COOKIE_PREFIX,
  studentLoginIdToEmail,
} from "@/lib/supabase/types";

export type AttemptResult =
  | { status: "found"; name: string; needsNickname: boolean }
  | { status: "unknown" }
  | { status: "not_member" }
  | { status: "not_student" }
  | { status: "error"; message: string };

function normalizeLoginId(raw: string): string {
  return raw.trim();
}

export async function attemptEnter(
  roomId: string,
  loginIdRaw: string,
): Promise<AttemptResult> {
  const loginId = normalizeLoginId(loginIdRaw);
  if (!roomId) return { status: "error", message: "ルームIDが不正です。" };
  if (!loginId) return { status: "error", message: "IDを入力してください。" };

  const admin = createAdminClient();

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomErr) return { status: "error", message: roomErr.message };
  if (!room) return { status: "error", message: "ルームが存在しません。" };

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, name, role, room_id, has_set_nickname")
    .eq("login_id", loginId)
    .maybeSingle();
  if (profileErr) return { status: "error", message: profileErr.message };

  if (!profile) {
    await admin.from("notifications").insert({
      room_id: roomId,
      kind: "unknown_login_attempt",
      payload: { login_id: loginId },
    });
    return { status: "unknown" };
  }

  if (profile.role !== "user") {
    return { status: "not_student" };
  }

  if (profile.room_id !== roomId) {
    await admin.from("notifications").insert({
      room_id: roomId,
      kind: "unknown_login_attempt",
      payload: { login_id: loginId, reason: "not_member" },
    });
    return { status: "not_member" };
  }

  return {
    status: "found",
    name: profile.name,
    needsNickname: !profile.has_set_nickname,
  };
}

export async function confirmEnter(
  roomId: string,
  loginIdRaw: string,
): Promise<void> {
  const loginId = normalizeLoginId(loginIdRaw);
  if (!roomId || !loginId) {
    throw new Error("ルームIDとIDは必須です。");
  }

  const admin = createAdminClient();

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, name, role, room_id, has_set_nickname")
    .eq("login_id", loginId)
    .maybeSingle();
  if (profileErr) throw new Error(profileErr.message);
  if (!profile) throw new Error("登録情報が見つかりません。");
  if (profile.role !== "user") {
    throw new Error("このフローでは入室できません。");
  }
  if (profile.room_id !== roomId) {
    throw new Error("このルームのメンバーではありません。");
  }

  // ---------- presence check (single active session per student) ----------
  const { data: existing } = await admin
    .from("room_participants")
    .select("last_seen_at")
    .eq("room_id", roomId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (existing) {
    const lastSeenMs = new Date(existing.last_seen_at).getTime();
    const ageMs = Date.now() - lastSeenMs;
    if (ageMs < PRESENCE_ACTIVE_WINDOW_MS) {
      // Active in another browser — block, notify chair, do NOT issue a
      // new session. The student must wait for the other side to time
      // out (or close the other tab).
      await admin.from("notifications").insert({
        room_id: roomId,
        kind: "duplicate_entry_attempt",
        payload: { login_id: loginId },
      });
      throw new Error(
        "この学籍番号は既に別の端末で参加中です。先に他の端末で「退出」するか、しばらくしてから再度お試しください。",
      );
    }
  }

  // ---------- claim presence (replace any stale row) ----------
  // We DELETE-then-INSERT (rather than upsert) so the new row gets a
  // fresh entry_token and any in-flight heartbeat from the previous
  // browser will see "row gone" → kicked.
  await admin
    .from("room_participants")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", profile.id);

  const entryToken = crypto.randomUUID();
  const { error: insertErr } = await admin.from("room_participants").insert({
    room_id: roomId,
    user_id: profile.id,
    entry_token: entryToken,
  });
  if (insertErr) {
    throw new Error(`入室登録に失敗しました: ${insertErr.message}`);
  }

  // ---------- issue auth session ----------
  const email = studentLoginIdToEmail(loginId);

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !linkData?.properties?.email_otp) {
    throw new Error(
      `セッション発行に失敗しました: ${linkErr?.message ?? "no otp"}`,
    );
  }

  const otp = linkData.properties.email_otp;
  const supabase = await createClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: "email",
  });
  if (verifyErr) {
    throw new Error(`セッション検証に失敗しました: ${verifyErr.message}`);
  }

  // Stash the entry_token in an httpOnly cookie. Heartbeat / leave
  // server actions read it back to prove this browser owns the row.
  const cookieStore = await cookies();
  cookieStore.set(`${PRESENCE_ENTRY_COOKIE_PREFIX}${roomId}`, entryToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Long-lived enough to survive a typical class session; refreshed on
    // every successful re-entry.
    maxAge: 60 * 60 * 12,
    secure: process.env.NODE_ENV === "production",
  });

  if (!profile.has_set_nickname) {
    redirect(`/r/${roomId}/setup-nickname`);
  } else {
    redirect(`/rooms/${roomId}`);
  }
}
