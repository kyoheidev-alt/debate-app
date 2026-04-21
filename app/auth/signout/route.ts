import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PRESENCE_ENTRY_COOKIE_PREFIX } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Clean up any presence rows + entry-token cookies this browser holds.
  // We can't enumerate all cookies typed by name without iteration, so we
  // sweep the cookie jar for our prefix and DELETE matching rows.
  if (user) {
    const cookieStore = await cookies();
    const admin = createAdminClient();
    for (const c of cookieStore.getAll()) {
      if (!c.name.startsWith(PRESENCE_ENTRY_COOKIE_PREFIX)) continue;
      const roomId = c.name.slice(PRESENCE_ENTRY_COOKIE_PREFIX.length);
      if (!roomId) continue;
      await admin
        .from("room_participants")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .eq("entry_token", c.value);
      cookieStore.delete(c.name);
    }
  }

  await supabase.auth.signOut();
  const url = new URL("/", request.url);
  return NextResponse.redirect(url, { status: 303 });
}
