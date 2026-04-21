import { NextResponse } from "next/server";
import { requireChairOrAppAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface KickPayload {
  room_id: string;
  user_id: string;
}

export async function POST(request: Request) {
  let payload: KickPayload;
  try {
    payload = (await request.json()) as KickPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!payload.room_id || !payload.user_id) {
    return NextResponse.json(
      { error: "room_id and user_id required" },
      { status: 400 },
    );
  }

  const auth = await requireChairOrAppAdmin(payload.room_id);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (auth.kind === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Only kick users currently in this room.
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, room_id, role")
    .eq("id", payload.user_id)
    .maybeSingle();

  if (!target || target.room_id !== payload.room_id) {
    return NextResponse.json(
      { error: "user not in this room" },
      { status: 404 },
    );
  }
  if (target.role === "app_admin") {
    return NextResponse.json(
      { error: "cannot kick an app admin" },
      { status: 403 },
    );
  }

  const { error } = await admin
    .from("profiles")
    .update({ room_id: null })
    .eq("id", payload.user_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
