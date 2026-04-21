import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GrantAdminForm } from "@/app/sys/GrantAdminForm";

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

  const [{ data: rooms }, { data: users }] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, theme, chair_id, is_name_visible, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, name, login_id, nickname, role, room_id, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const usersById = new Map((users ?? []).map((u) => [u.id, u]));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-slate-900 text-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/sys" className="text-lg font-semibold">
              アプリ管理者ダッシュボード
            </Link>
            <span className="rounded bg-slate-700 px-2 py-0.5 text-xs uppercase tracking-wide">
              SYS
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span>{me.nickname}</span>
            <Link
              href="/settings"
              className="rounded-md bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600"
            >
              設定
            </Link>
            <form action="/auth/signout" method="post">
              <button
                className="rounded-md bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600"
                type="submit"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
        <section className="card flex flex-col gap-3">
          <h2 className="text-lg font-semibold">アプリ管理者権限の付与</h2>
          <p className="text-sm text-slate-600">
            議長のメールアドレス（または一般ユーザーのID）を入力してアプリ管理者権限を付与または剥奪します。
            アプリ管理者は全ルーム/全ユーザーを操作できます。
          </p>
          <GrantAdminForm />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            全ルーム ({rooms?.length ?? 0})
          </h2>
          {!rooms || rooms.length === 0 ? (
            <p className="rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">
              ルームはまだありません。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rooms.map((r) => {
                const chair = usersById.get(r.chair_id);
                return (
                  <li
                    key={r.id}
                    className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{r.theme}</p>
                      <p className="font-mono text-xs text-slate-500">
                        ID: {r.id}
                      </p>
                      <p className="text-xs text-slate-500">
                        議長:{" "}
                        {chair
                          ? `${chair.nickname} (${chair.login_id})`
                          : "（不明）"}
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
          <h2 className="text-lg font-semibold">
            全ユーザー ({users?.length ?? 0})
          </h2>
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">ニックネーム</th>
                  <th className="px-3 py-2">名前</th>
                  <th className="px-3 py-2">ロール</th>
                  <th className="px-3 py-2">所属ルーム</th>
                </tr>
              </thead>
              <tbody>
                {(users ?? []).map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{u.login_id}</td>
                    <td className="px-3 py-2">{u.nickname}</td>
                    <td className="px-3 py-2">{u.name}</td>
                    <td className="px-3 py-2">
                      {u.role === "app_admin" ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          app_admin
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">user</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">
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
