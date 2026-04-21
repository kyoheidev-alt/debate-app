import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookies on every request and guards
 * protected route groups:
 *   /dashboard, /rooms/**       -> requires authenticated user
 *   /settings                   -> requires authenticated user
 *   /rooms/[id]/manage          -> chair of the room or app_admin
 *   /sys, /sys/**               -> requires app_admin (except /sys/login)
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isDashboardPath = pathname.startsWith("/dashboard");
  const isSettingsPath = pathname.startsWith("/settings");
  const roomMatch = pathname.match(/^\/rooms\/([^/]+)(?:\/|$)/);
  const isSysPath =
    pathname.startsWith("/sys") && !pathname.startsWith("/sys/login");
  const manageMatch = pathname.match(/^\/rooms\/([^/]+)\/manage(?:\/|$)/);

  // 未ログインで保護パスに来たら /login or /sys/login へ
  if (!user && (isDashboardPath || isSettingsPath || isSysPath)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = isSysPath ? "/sys/login" : "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  // 未ログインで /rooms/[id]** に来たら学生用入室フローへ
  if (!user && roomMatch) {
    const roomId = roomMatch[1];
    const redirect = request.nextUrl.clone();
    redirect.pathname = `/r/${roomId}/enter`;
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  if (user) {
    if (isSysPath) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile || profile.role !== "app_admin") {
        const redirect = request.nextUrl.clone();
        redirect.pathname = "/sys/login";
        redirect.searchParams.set("error", "not_admin");
        return NextResponse.redirect(redirect);
      }
    }

    if (manageMatch) {
      const roomId = manageMatch[1];
      const [{ data: profile }, { data: room }] = await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
        supabase.from("rooms").select("chair_id").eq("id", roomId).maybeSingle(),
      ]);
      const isAppAdmin = profile?.role === "app_admin";
      const isChair = room?.chair_id === user.id;
      if (!isAppAdmin && !isChair) {
        const redirect = request.nextUrl.clone();
        redirect.pathname = `/rooms/${roomId}`;
        return NextResponse.redirect(redirect);
      }
    }
  }

  return response;
}
