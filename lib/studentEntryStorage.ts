/**
 * Browser localStorage helpers for the student entry flow.
 *
 * Saves `(roomId, loginId)` after a successful entry so that on the next
 * visit we can pre-fill the form. This is purely a UX nicety — the
 * server-side authority is still the Supabase Auth session that
 * `confirmEnter` issues. Anything in localStorage is treated as untrusted
 * suggestion-only data.
 */

const KEY_LAST_ROOM = "debate-app:lastRoomId";
const KEY_ROOM_LOGIN_PREFIX = "debate-app:roomLogin:";

export function saveStudentEntry(roomId: string, loginId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_LAST_ROOM, roomId);
    window.localStorage.setItem(KEY_ROOM_LOGIN_PREFIX + roomId, loginId);
  } catch {
    // ignore quota errors / storage unavailable
  }
}

export function getLastRoomId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY_LAST_ROOM);
  } catch {
    return null;
  }
}

export function getLoginIdForRoom(roomId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY_ROOM_LOGIN_PREFIX + roomId);
  } catch {
    return null;
  }
}

export function clearStudentEntry(roomId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY_ROOM_LOGIN_PREFIX + roomId);
    if (window.localStorage.getItem(KEY_LAST_ROOM) === roomId) {
      window.localStorage.removeItem(KEY_LAST_ROOM);
    }
  } catch {
    // ignore
  }
}
