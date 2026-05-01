import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ReportPayload {
  message_id: string;
  reason?: string;
}

export async function POST(request: Request) {
  let payload: ReportPayload;
  try {
    payload = (await request.json()) as ReportPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!payload.message_id || typeof payload.message_id !== "string") {
    return NextResponse.json(
      { error: "message_id required" },
      { status: 400 },
    );
  }

  const reason = (payload.reason ?? "").trim();
  if (reason.length > 500) {
    return NextResponse.json(
      { error: "reason は 500 文字以内で入力してください" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Look up the reporter's current room and the target message together
  // so we can attach the correct room_id and run our duplicate-report
  // guard. RLS will independently reject mismatches on INSERT below.
  const [profileRes, messageRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("room_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("id, room_id, user_id")
      .eq("id", payload.message_id)
      .maybeSingle(),
  ]);

  const room_id = profileRes.data?.room_id;
  const message = messageRes.data;
  if (!room_id || !message) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (message.room_id !== room_id) {
    return NextResponse.json({ error: "wrong_room" }, { status: 403 });
  }
  if (message.user_id === user.id) {
    return NextResponse.json({ error: "cannot_report_self" }, { status: 403 });
  }

  // Soft duplicate guard. (We deliberately don't add a UNIQUE constraint
  // — letting a reporter resubmit with a clearer reason is friendlier
  // than a hard DB error.)
  const { data: existing } = await supabase
    .from("message_reports")
    .select("id")
    .eq("message_id", payload.message_id)
    .eq("reporter_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "already_reported" },
      { status: 409 },
    );
  }

  const { error: insertError } = await supabase
    .from("message_reports")
    .insert({
      message_id: payload.message_id,
      room_id,
      reporter_id: user.id,
      reason,
    });

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
