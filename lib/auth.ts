import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Authorized =
  | { kind: "ok"; userId: string; isAppAdmin: boolean }
  | { kind: "unauthorized" }
  | { kind: "forbidden" };

/**
 * Verifies the caller is authenticated and is allowed to manage `roomId`:
 * either the chair of that room, or an app_admin.
 */
export async function requireChairOrAppAdmin(
  roomId: string,
): Promise<Authorized> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthorized" };

  const [profileRes, roomRes] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("rooms").select("chair_id").eq("id", roomId).maybeSingle(),
  ]);

  const isAppAdmin = profileRes.data?.role === "app_admin";
  const isChair = roomRes.data?.chair_id === user.id;

  if (!isAppAdmin && !isChair) return { kind: "forbidden" };
  return { kind: "ok", userId: user.id, isAppAdmin };
}

export async function requireAppAdmin(): Promise<Authorized> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "app_admin") return { kind: "forbidden" };
  return { kind: "ok", userId: user.id, isAppAdmin: true };
}
