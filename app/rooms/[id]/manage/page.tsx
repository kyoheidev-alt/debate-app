import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoomSettingsForm } from "./RoomSettingsForm";
import { ParticipantsTable } from "./ParticipantsTable";
import { AddUserForm } from "./AddUserForm";
import { UserCsvImport } from "./UserCsvImport";
import { DeleteRoomButton } from "./DeleteRoomButton";
import { NotificationBell } from "./NotificationBell";
import { RosterPanel } from "./RosterPanel";

export const dynamic = "force-dynamic";

export default async function RoomManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/login");

  const { data: room } = await supabase
    .from("rooms")
    .select("id, theme, is_name_visible, chair_id, likes_enabled")
    .eq("id", id)
    .maybeSingle();
  if (!room) notFound();

  const isChair = room.chair_id === user.id;
  const isAppAdmin = profile.role === "app_admin";
  if (!isChair && !isAppAdmin) {
    redirect(`/rooms/${id}`);
  }

  const { data: participants } = await supabase
    .from("profiles")
    .select("id, name, login_id, nickname, role")
    .eq("room_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-pro hover:underline">
              ← ダッシュボード
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold">ルーム管理</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell roomId={room.id} />
            <Link href={`/rooms/${room.id}`} className="btn-primary text-sm">
              チャットへ入室
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold">{room.theme}</h1>
          <p className="font-mono text-xs text-slate-500">ID: {room.id}</p>
          {isAppAdmin && !isChair && (
            <p className="mt-1 text-xs text-amber-700">
              アプリ管理者として閲覧中（このルームの議長ではありません）
            </p>
          )}
        </div>

        <section className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold">ルーム設定</h2>
          <RoomSettingsForm
            roomId={room.id}
            theme={room.theme}
            isNameVisible={room.is_name_visible}
            likesEnabled={room.likes_enabled}
          />
        </section>

        <section className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold">在室者（リアルタイム）</h2>
          <p className="text-sm text-slate-600">
            学籍番号は1端末のみ入室できます。誰かが入室中は同じIDで別端末から入れません（最大60秒で自動解放）。
          </p>
          <RosterPanel
            roomId={room.id}
            participants={(participants ?? []).map((p) => ({
              id: p.id,
              nickname: p.nickname,
              name: p.name,
              login_id: p.login_id,
            }))}
          />
        </section>

        <section className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold">参加者一覧（発言者ID確認）</h2>
          <ParticipantsTable
            roomId={room.id}
            participants={participants ?? []}
          />
        </section>

        <section className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold">ユーザーを追加（単票入力）</h2>
          <AddUserForm roomId={room.id} />
        </section>

        <section className="card flex flex-col gap-4">
          <h2 className="text-lg font-semibold">ユーザーを追加（CSV一括）</h2>
          <UserCsvImport roomId={room.id} />
        </section>

        <section className="card flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-red-700">危険な操作</h2>
          <p className="text-sm text-slate-600">
            ルームを削除するとメッセージとスタンスもすべて消去されます。
          </p>
          <DeleteRoomButton roomId={room.id} />
        </section>
      </main>
    </div>
  );
}
