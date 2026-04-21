import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChairCapableAccount } from "@/lib/supabase/types";
import { CreateRoomCard } from "./CreateRoomCard";
import { JoinRoomCard } from "./JoinRoomCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, login_id, nickname, role, room_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/login");

  // Students never see /dashboard. Send them straight to their current
  // room (or the LP if they aren't in one).
  if (!isChairCapableAccount(profile)) {
    redirect(profile.room_id ? `/rooms/${profile.room_id}` : "/");
  }

  const [chairRoomsRes, currentRoomRes] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, theme, is_name_visible, created_at")
      .eq("chair_id", user.id)
      .order("created_at", { ascending: false }),
    profile.room_id
      ? supabase
          .from("rooms")
          .select("id, theme, chair_id")
          .eq("id", profile.room_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const chairRooms = chairRoomsRes.data ?? [];
  const currentRoom = currentRoomRes.data;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-lg font-semibold">
            ダッシュボード
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              {profile.nickname}
              <span className="ml-1 text-xs text-slate-400">
                ({profile.login_id})
              </span>
            </span>
            <Link href="/settings" className="btn-secondary text-xs">
              設定
            </Link>
            <form action="/auth/signout" method="post">
              <button className="btn-secondary text-xs" type="submit">
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8">
        {/* 現在参加中のルーム */}
        <section className="card flex flex-col gap-3">
          <h2 className="text-lg font-semibold">現在参加中のルーム</h2>
          {currentRoom ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{currentRoom.theme}</p>
                <p className="font-mono text-xs text-slate-500">
                  ID: {currentRoom.id}
                </p>
              </div>
              <Link
                href={`/rooms/${currentRoom.id}`}
                className="btn-primary text-sm"
              >
                チャットを開く
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              現在どのルームにも参加していません。下から参加するか、ルームを作成してください。
            </p>
          )}
        </section>

        {/* ルーム参加（ルームID入力） */}
        <JoinRoomCard />

        {/* ルーム作成 */}
        <CreateRoomCard />

        {/* 議長として作成したルーム一覧 */}
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">あなたが議長のルーム</h2>
          {chairRooms.length === 0 ? (
            <p className="rounded-lg bg-white p-4 text-sm text-slate-500 shadow-sm">
              まだ議長を務めるルームはありません。
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {chairRooms.map((room) => (
                <li
                  key={room.id}
                  className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{room.theme}</p>
                    <p className="font-mono text-xs text-slate-500">
                      ID: {room.id}
                    </p>
                    <p className="text-xs text-slate-500">
                      実名表示: {room.is_name_visible ? "ON" : "OFF"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/rooms/${room.id}/manage`}
                      className="btn-secondary text-sm"
                    >
                      管理
                    </Link>
                    <Link
                      href={`/rooms/${room.id}`}
                      className="btn-primary text-sm"
                    >
                      入室
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
