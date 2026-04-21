"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PRESENCE_ENTRY_COOKIE_PREFIX } from "@/lib/supabase/types";

export type HeartbeatResult = { stillIn: boolean };

/**
 * Refresh `last_seen_at` for the calling user's presence row in a room.
 *
 * Returns `{ stillIn: false }` when:
 *   - no auth session,
 *   - no entry_token cookie,
 *   - or the row has been replaced (different entry_token / deleted).
 *
 * The client uses that signal to redirect away with a "別の端末で入り直
 * されました" message.
 */
export async function heartbeat(roomId: string): Promise<HeartbeatResult> {
  if (!roomId) return { stillIn: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { stillIn: false };

  const cookieStore = await cookies();
  const token = cookieStore.get(
    `${PRESENCE_ENTRY_COOKIE_PREFIX}${roomId}`,
  )?.value;
  if (!token) return { stillIn: false };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("room_participants")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .eq("entry_token", token)
    .select("user_id");

  // A transient DB error (network blip, etc.) must NOT kick the user
  // out. Only an authoritative "row is gone / taken over" response
  // should end the session.
  if (error) return { stillIn: true };
  return { stillIn: !!data && data.length > 0 };
}

/**
 * Explicit "退出" button. Removes the presence row (matching token) and
 * signs the auth session out. The caller is expected to redirect to "/".
 */
export async function leaveRoom(roomId: string): Promise<void> {
  if (!roomId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const cookieKey = `${PRESENCE_ENTRY_COOKIE_PREFIX}${roomId}`;
  const token = cookieStore.get(cookieKey)?.value;

  if (user && token) {
    const admin = createAdminClient();
    await admin
      .from("room_participants")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .eq("entry_token", token);
  }

  cookieStore.delete(cookieKey);
  await supabase.auth.signOut();
}
