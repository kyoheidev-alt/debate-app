import { NextResponse } from "next/server";
import { requireChairOrAppAdmin } from "@/lib/auth";
import { createUsersForRoom, type UserRow } from "@/lib/createUsers";

interface SinglePayload {
  room_id: string;
  user: UserRow;
}

export async function POST(request: Request) {
  let payload: SinglePayload;
  try {
    payload = (await request.json()) as SinglePayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!payload.room_id || typeof payload.room_id !== "string") {
    return NextResponse.json({ error: "room_id required" }, { status: 400 });
  }
  if (!payload.user) {
    return NextResponse.json({ error: "user required" }, { status: 400 });
  }

  const auth = await requireChairOrAppAdmin(payload.room_id);
  if (auth.kind === "unauthorized") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (auth.kind === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [result] = await createUsersForRoom([payload.user], payload.room_id);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
