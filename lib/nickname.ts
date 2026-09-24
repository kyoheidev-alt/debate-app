import {
  toPublicChatProfile,
  type PublicChatProfile,
} from "@/lib/identity";
import type { Role } from "@/lib/supabase/types";

/** Same limit as the first-entry nickname form. */
export const NICKNAME_MAX_LENGTH = 20;

export const NICKNAME_FIELD_LABEL = "ニックネーム（20文字以内）";

/** Shown at first entry and again when renaming during a debate. */
export const NICKNAME_GUIDANCE =
  "チャットに出る名前です。本名や学籍番号は使わないでください。";

/** Realtime broadcast on the room channel. Payload is only `{ user_id }`. */
export const NICKNAME_CHANGED_EVENT = "nickname_changed";

export function validateNickname(
  raw: string,
): { ok: true; nickname: string } | { ok: false; error: string } {
  const nickname = raw.trim();
  if (!nickname) {
    return { ok: false, error: "ニックネームを入力してください。" };
  }
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    return {
      ok: false,
      error: "ニックネームは 20 文字以内にしてください。",
    };
  }
  return { ok: true, nickname };
}

/**
 * Row filter for a nickname write. Callers must pass the signed-in user id.
 * There is no target-user argument: a student cannot rename anyone else.
 */
export function nicknameUpdateFilter(actorId: string): { id: string } {
  if (!actorId) {
    throw new Error("ログインが必要です。");
  }
  return { id: actorId };
}

/**
 * Other clients announce that a profile changed. The nickname in the
 * payload is ignored so a peer cannot paint a fake name; the receiver
 * re-reads the profile row.
 */
export function profileIdFromNicknameBroadcast(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const userId = (payload as { user_id?: unknown }).user_id;
  if (typeof userId !== "string") return null;
  const id = userId.trim();
  return id.length > 0 ? id : null;
}

/**
 * Label on a message. Messages store `user_id` only, so this always
 * reflects the profile currently in memory — including a mid-debate rename.
 * When the chair has 実名表示 on, the real name still wins.
 */
export function chatAuthorLabel(
  author: { nickname?: string | null; name?: string | null } | undefined,
  isNameVisible: boolean,
): string {
  return (isNameVisible && author?.name) || author?.nickname || "不明";
}

export function upsertPublicChatProfile(
  profiles: Record<string, PublicChatProfile>,
  row: {
    id: string;
    nickname: string;
    role: Role;
    room_id: string | null;
    name?: string | null;
    login_id?: string | null;
  },
  revealRealName: boolean,
): Record<string, PublicChatProfile> {
  const next = toPublicChatProfile(row, revealRealName);
  const prev = profiles[next.id];
  if (
    prev &&
    prev.nickname === next.nickname &&
    prev.role === next.role &&
    prev.room_id === next.room_id &&
    prev.name === next.name &&
    prev.login_id === next.login_id
  ) {
    return profiles;
  }
  return { ...profiles, [next.id]: next };
}
