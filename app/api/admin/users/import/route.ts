import { NextResponse } from "next/server";
import { requireChairOrAppAdmin } from "@/lib/auth";
import { createUsersForRoom, type UserRow } from "@/lib/createUsers";

interface ImportPayload {
  room_id: string;
  rows: UserRow[];
}

export async function POST(request: Request) {
  let payload: ImportPayload;
  try {
    payload = (await request.json()) as ImportPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!payload.room_id) {
    return NextResponse.json({ error: "room_id required" }, { status: 400 });
  }
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    return NextResponse.json({ error: "no_rows" }, { status: 400 });
  }
  if (payload.rows.length > 500) {
    return NextResponse.json({ error: "too_many_rows" }, { status: 400 });
  }

  const auth = await requireChairOrAppAdmin(payload.room_id);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (auth.kind === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const results = await createUsersForRoom(payload.rows, payload.room_id);
  const success = results.filter((r) => r.ok).length;
  return NextResponse.json({
    total: results.length,
    success,
    failed: results.length - success,
    results,
  });
}
