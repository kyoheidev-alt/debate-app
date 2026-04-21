import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PRESENCE_ENTRY_COOKIE_PREFIX } from "@/lib/supabase/types";

/**
 * Best-effort presence cleanup for `navigator.sendBeacon` on browser
 * close / tab unload. Body must be `application/json` with `{ room_id }`
 * (sendBeacon supports JSON via a Blob).
 *
 * Always returns 204 (sendBeacon discards the response). Errors are
 * intentionally swallowed; if the cleanup fails the row will go stale on
 * its own after PRESENCE_ACTIVE_WINDOW_MS.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      room_id?: string;
    } | null;
    const roomId = body?.room_id;
    if (!roomId) return new NextResponse(null, { status: 204 });

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
  } catch {
    // swallow; sendBeacon is fire-and-forget
  }
  return new NextResponse(null, { status: 204 });
}
