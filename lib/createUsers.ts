import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { studentLoginIdToEmail } from "@/lib/supabase/types";

export interface UserRow {
  login_id: string;
  /**
   * Optional. Students never need a password (entry flow uses login_id +
   * identity confirmation). Kept for backward-compatible CSVs; if omitted
   * a strong random password is generated server-side and never exposed.
   */
  password?: string;
  name: string;
  /**
   * Optional. If the chair leaves this blank, the student will be
   * required to set their own nickname at first entry (STEP3) — the
   * `has_set_nickname` flag is left at the default `false` so
   * `/r/[id]/setup-nickname` forces them through. This is the single
   * required-nickname checkpoint and preserves anonymity at the moment
   * it actually matters (chat).
   */
  nickname?: string;
}

export interface UserResult {
  login_id: string;
  ok: boolean;
  error?: string;
}

/**
 * Creates auth users + profiles via the Service Role client. The handle_new_user
 * trigger creates the profile row; we then UPDATE to set the room_id and
 * any explicit overrides.
 *
 * The caller MUST already have verified that the requester is allowed to
 * assign users to `roomId` (chair of room, or app_admin).
 */
export async function createUsersForRoom(
  rows: UserRow[],
  roomId: string,
): Promise<UserResult[]> {
  const admin = createAdminClient();
  const out: UserResult[] = [];

  for (const row of rows) {
    const login_id = (row.login_id ?? "").trim();
    const providedPw = (row.password ?? "").trim();
    const name = (row.name ?? "").trim();
    const nickname = (row.nickname ?? "").trim();

    if (!login_id || !name) {
      out.push({
        login_id,
        ok: false,
        error: "login_id / name は必須です",
      });
      continue;
    }
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(login_id)) {
      out.push({
        login_id,
        ok: false,
        error: "ID は半角英数記号 (_ . -) の 3〜32 文字で指定してください",
      });
      continue;
    }
    if (nickname && nickname.length > 20) {
      out.push({
        login_id,
        ok: false,
        error: "ニックネームは20文字以内で指定してください",
      });
      continue;
    }

    // パスワードレス入室フロー用にランダムパスワードを発行（誰にも開示しない）。
    // CSVで明示指定があれば従う（後方互換）。
    const password =
      providedPw.length >= 6 ? providedPw : randomBytes(24).toString("base64url");

    // If a nickname was supplied by the chair, pass it to the trigger so
    // `has_set_nickname` can be flipped to true right away (we do that
    // in the UPDATE below). Otherwise leave user_metadata.nickname unset
    // so the trigger's fallback (login_id) is used and has_set_nickname
    // stays false — the student will be forced through STEP3 at entry.
    const metadata: Record<string, string> = { login_id, name };
    if (nickname) metadata.nickname = nickname;

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: studentLoginIdToEmail(login_id),
        password,
        email_confirm: true,
        user_metadata: metadata,
      });

    if (createError || !created.user) {
      out.push({
        login_id,
        ok: false,
        error: createError?.message ?? "createUser failed",
      });
      continue;
    }

    // The handle_new_user trigger already inserted the profile from the
    // user_metadata. Update room_id (and re-affirm the fields the chair
    // can set) here. Only flip has_set_nickname when the chair provided
    // an explicit nickname.
    const profileUpdate: Record<string, unknown> = {
      name,
      login_id,
      room_id: roomId,
    };
    if (nickname) {
      profileUpdate.nickname = nickname;
      profileUpdate.has_set_nickname = true;
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", created.user.id);

    if (updateError) {
      // Roll back the auth user so the import is idempotent.
      await admin.auth.admin.deleteUser(created.user.id);
      out.push({
        login_id,
        ok: false,
        error: updateError.message,
      });
      continue;
    }

    out.push({ login_id, ok: true });
  }

  return out;
}
