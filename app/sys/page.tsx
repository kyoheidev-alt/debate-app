import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { GrantAdminForm } from "./GrantAdminForm";
import { GlobalLimitForm } from "./GlobalLimitForm";
import { ReportsList, type ReportListItem } from "./ReportsList";

export const dynamic = "force-dynamic";

export default async function SysHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sys/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("nickname, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!me || me.role !== "app_admin") redirect("/sys/login?error=not_admin");

  const [{ data: rooms }, { data: users }, { data: settings }, { data: reportRows }] =
    await Promise.all([
      supabase
        .from("rooms")
        .select(
          "id, theme, chair_id, is_name_visible, user_limit, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, name, login_id, nickname, role, room_id, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("app_settings")
        .select("default_room_user_limit")
        .eq("id", true)
        .maybeSingle(),
      supabase
        .from("message_reports")
        .select(
          `
          id, message_id, room_id, reporter_id, reason,
          resolved_at, resolved_by, resolution_note, created_at,
          messages:message_id ( content, deleted_at, created_at, user_id ),
          reporter:reporter_id ( login_id, nickname ),
          room:room_id ( theme )
        `,
        )
        .order("resolved_at", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const usersById = new Map((users ?? []).map((u) => [u.id, u]));
  const defaultLimit = settings?.default_room_user_limit ?? 50;

  // Per-room registered student counts (used for the chair UI on
  // /manage and surfaced in the rooms list below).
  const roomCounts = new Map<string, number>();
  for (const u of users ?? []) {
    if (u.room_id) {
      roomCounts.set(u.room_id, (roomCounts.get(u.room_id) ?? 0) + 1);
    }
  }

  // Resolve the author login_id/nickname for each reported message
  // through the already-loaded users map. Supabase's PostgREST join
  // typing always widens nested relations to arrays even for !inner /
  // 1-to-1 FKs, so we normalize here.
  type Joined<T> = T | T[] | null;
  type RawReportRow = {
    id: string;
    message_id: string;
    room_id: string;
    reporter_id: string;
    reason: string;
    resolved_at: string | null;
    resolved_by: string | null;
    resolution_note: string | null;
    created_at: string;
    messages: Joined<{
      content: string;
      deleted_at: string | null;
      created_at: string;
      user_id: string;
    }>;
    reporter: Joined<{ login_id: string; nickname: string }>;
    room: Joined<{ theme: string }>;
  };

  function pickOne<T>(v: Joined<T>): T | null {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
  }

  const reports: ReportListItem[] = (
    (reportRows ?? []) as unknown as RawReportRow[]
  ).map((r) => {
    const m = pickOne(r.messages);
    const reporter = pickOne(r.reporter);
    const room = pickOne(r.room);
    const author = m ? usersById.get(m.user_id) : null;
    return {
      id: r.id,
      message_id: r.message_id,
      room_id: r.room_id,
      reporter_id: r.reporter_id,
      reason: r.reason,
      resolved_at: r.resolved_at,
      resolved_by: r.resolved_by,
      resolution_note: r.resolution_note,
      created_at: r.created_at,
      message_content: m?.content ?? "(取得不可)",
      message_deleted_at: m?.deleted_at ?? null,
      message_created_at: m?.created_at ?? r.created_at,
      message_user_id: m?.user_id ?? "",
      reporter_login_id: reporter?.login_id ?? "(不明)",
      reporter_nickname: reporter?.nickname ?? "(不明)",
      author_login_id: author?.login_id ?? "(不明)",
      author_nickname: author?.nickname ?? "(不明)",
      room_theme: room?.theme ?? "(不明)",
    };
  });

  return (
    <div className="min-h-screen bg-navy-900 text-ink">
      <header className="border-b border-navy-600 bg-navy-800/95 text-ink">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/sys" className="text-lg font-semibold">
              アプリ管理者ダッシュボード
            </Link>
            <span className="rounded bg-navy-700 px-2 py-0.5 text-xs uppercase tracking-wide">
              SYS
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span>{me.nickname}</span>
            <Link
              href="/settings"
              className="rounded-md border border-navy-600 bg-navy-700 px-3 py-1.5 text-xs text-ink hover:border-gold-500 hover:text-gold-500"
            >
              設定
            </Link>
            <form action="/auth/signout" method="post">
              <button
                className="rounded-md border border-navy-600 bg-navy-700 px-3 py-1.5 text-xs text-ink hover:border-gold-500 hover:text-gold-500"
                type="submit"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <ReportsList initial={reports} />

        <section className="card flex flex-col gap-3">
          <h2 className="text-lg font-semibold">ルーム人数上限（全体既定値）</h2>
          <p className="text-sm text-muted">
            各ルームに登録できる学生数のデフォルト上限です。議長は部屋ごとに上書きできます（空欄ならこの値が適用されます）。
          </p>
          <GlobalLimitForm currentValue={defaultLimit} />
        </section>

        <section className="card flex flex-col gap-3">
          <h2 className="text-lg font-semibold">アプリ管理者権限の付与</h2>
          <p className="text-sm text-muted">
            議長のメールアドレス（または一般ユーザーのID）を入力してアプリ管理者権限を付与または剥奪します。
            アプリ管理者は全ルーム/全ユーザーを操作できます。
          </p>
          <GrantAdminForm />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">
            全ルーム ({rooms?.length ?? 0})
          </h2>
          {!rooms || rooms.length === 0 ? (
            <p className="rounded-sm border border-navy-600 bg-navy-700 p-4 text-sm text-muted shadow-md">
              ルームはまだありません。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rooms.map((r) => {
                const chair = usersById.get(r.chair_id);
                const limit = r.user_limit ?? defaultLimit;
                const count = roomCounts.get(r.id) ?? 0;
                return (
                  <li
                    key={r.id}
                    className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{r.theme}</p>
                      <p className="font-mono text-xs text-muted">
                        ID: {r.id}
                      </p>
                      <p className="text-xs text-muted">
                        議長:{" "}
                        {chair
                          ? `${chair.nickname} (${chair.login_id})`
                          : "（不明）"}
                      </p>
                      <p className="text-xs text-muted">
                        登録: {count} / {limit} 名
                        {r.user_limit == null && (
                          <span className="ml-1 text-muted/80">(既定)</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/rooms/${r.id}/manage`}
                        className="btn-secondary text-sm"
                      >
                        管理
                      </Link>
                      <Link
                        href={`/rooms/${r.id}`}
                        className="btn-primary text-sm"
                      >
                        入室
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink">
            全ユーザー ({users?.length ?? 0})
          </h2>
          <div className="overflow-x-auto rounded-lg border border-navy-600 bg-navy-700 shadow-md">
            <table className="min-w-full text-sm">
              <thead className="bg-navy-800 text-left text-ink">
                <tr>
                  <th className="px-3 py-2 font-semibold">ID</th>
                  <th className="px-3 py-2 font-semibold">ニックネーム</th>
                  <th className="px-3 py-2 font-semibold">名前</th>
                  <th className="px-3 py-2 font-semibold">ロール</th>
                  <th className="px-3 py-2 font-semibold">所属ルーム</th>
                </tr>
              </thead>
              <tbody className="text-ink">
                {(users ?? []).map((u) => (
                  <tr key={u.id} className="border-b border-navy-600 last:border-0">
                    <td className="px-3 py-2 text-ink">{u.login_id}</td>
                    <td className="px-3 py-2 font-medium text-ink">
                      {u.nickname}
                    </td>
                    <td className="px-3 py-2 font-medium text-ink">
                      {u.name}
                    </td>
                    <td className="px-3 py-2">
                      {u.role === "app_admin" ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          app_admin
                        </span>
                      ) : (
                        <span className="text-xs text-muted">user</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">
                      {u.room_id ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
