/**
 * Participant stance (left / right of the chat). Chairs and app_admins
 * never have a participant stance — they post with `MessageStance='chair'`.
 */
export type Stance = "pro" | "con";

/**
 * Stance stored on a message row. `'chair'` is reserved for moderator
 * (chair / app_admin) messages and is rendered center-aligned with a
 * distinct color and badge.
 */
export type MessageStance = "pro" | "con" | "chair";

export type Role = "user" | "app_admin";

export interface Profile {
  id: string;
  name: string;
  login_id: string;
  nickname: string;
  role: Role;
  room_id: string | null;
  created_at: string;
}

export interface Room {
  id: string;
  theme: string;
  chair_id: string;
  is_name_visible: boolean;
  likes_enabled: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  stance: MessageStance;
  is_important: boolean;
  parent_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

/**
 * Row in `message_likes`. (message_id, user_id) is the composite PK — a
 * user may like a given message at most once.
 */
export interface MessageLike {
  message_id: string;
  user_id: string;
  created_at: string;
}

/**
 * Returns true if this profile was created by chair self-signup
 * (`/signup` with a real email) or is an app_admin. Students that entered
 * through `/r/[id]/enter` have a numeric/alphanumeric login_id without
 * `@` and never get chair-only UI affordances.
 */
export function isChairCapableAccount(profile: {
  login_id: string;
  role: Role;
}): boolean {
  return profile.role === "app_admin" || profile.login_id.includes("@");
}

export interface StanceRow {
  user_id: string;
  room_id: string;
  stance: Stance;
  updated_at: string;
}

/**
 * Row in `room_participants`. Tracks live presence of students within a
 * room. Chairs / app_admins are NOT recorded here.
 */
export interface RoomParticipant {
  room_id: string;
  user_id: string;
  entry_token: string;
  joined_at: string;
  last_seen_at: string;
}

/** Chair-only notifications surfaced via the bell on /manage. */
export type NotificationKind =
  | "unknown_login_attempt"
  | "duplicate_entry_attempt";

/**
 * A participant is considered "active" if its last_seen_at is within
 * this many milliseconds. Must comfortably exceed the heartbeat interval
 * so a normally-running browser is never accidentally treated as stale.
 */
export const PRESENCE_ACTIVE_WINDOW_MS = 60_000;
export const PRESENCE_HEARTBEAT_INTERVAL_MS = 30_000;
export const PRESENCE_ENTRY_COOKIE_PREFIX = "dbt_entry_token_";

/**
 * STUDENT-ONLY synthetic-email mapping.
 *
 * Students (role='user') log in with their student_id only; we map it to
 * a synthetic email so we can ride on Supabase Auth's email-based session
 * machinery. Students never see or type this email.
 *
 * Chairs (role='user' who own a room) and app_admins use a REAL email
 * directly with `signInWithPassword({ email, password })` and do NOT go
 * through this helper.
 *
 * The `.local` TLD is rejected by Supabase's public signUp() validator
 * but accepted by the Service Role admin.createUser API, which is the
 * only path that creates student accounts (see `lib/createUsers.ts`).
 */
export function studentLoginIdToEmail(loginId: string): string {
  return `${loginId.trim().toLowerCase()}@debate.local`;
}
