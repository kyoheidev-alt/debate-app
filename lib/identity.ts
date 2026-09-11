import type { Profile, Role } from "@/lib/supabase/types";

/** Columns the chat client is allowed to request for other students. */
export function profileSelectColumns(revealRealName: boolean): string {
  return revealRealName
    ? "id, name, nickname, role, login_id, room_id"
    : "id, nickname, role, room_id";
}

export type PublicChatProfile = Pick<
  Profile,
  "id" | "nickname" | "role" | "room_id"
> &
  Partial<Pick<Profile, "name" | "login_id">>;

/**
 * Strips real name / student number unless the chair turned 実名表示 ON
 * (or the caller is a moderator viewing manage UI).
 */
export function toPublicChatProfile(
  row: {
    id: string;
    nickname: string;
    role: Role;
    room_id: string | null;
    name?: string | null;
    login_id?: string | null;
  },
  revealRealName: boolean,
): PublicChatProfile {
  const pub: PublicChatProfile = {
    id: row.id,
    nickname: row.nickname,
    role: row.role,
    room_id: row.room_id,
  };
  if (revealRealName) {
    if (row.name) pub.name = row.name;
    if (row.login_id) pub.login_id = row.login_id;
  }
  return pub;
}

export const MIN_STUDENT_MESSAGE_CHARS = 8;
