import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, login_id, nickname, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/login");

  const isAdmin = profile.role === "app_admin";
  const backHref = isAdmin ? "/sys" : "/dashboard";
  const backLabel = isAdmin ? "アプリ管理者ダッシュボード" : "ダッシュボード";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href={backHref} className="text-lg font-semibold">
            ← {backLabel}
          </Link>
          <span className="text-sm text-slate-500">
            {profile.login_id}
            {isAdmin && (
              <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                app_admin
              </span>
            )}
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <h1 className="text-2xl font-bold">プロフィール設定</h1>

        <section className="card flex flex-col gap-2">
          <p className="text-sm text-slate-600">
            ログインIDは登録時のメールアドレスで固定です。表示名（名前・ニックネーム）のみ変更できます。
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-slate-500">ログインID</dt>
            <dd className="font-mono">{profile.login_id}</dd>
            <dt className="text-slate-500">ロール</dt>
            <dd>{profile.role}</dd>
          </dl>
        </section>

        <SettingsForm
          initialName={profile.name}
          initialNickname={profile.nickname}
        />
      </main>
    </div>
  );
}
