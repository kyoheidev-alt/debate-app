import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatRoom } from "./ChatRoom";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/rooms/${id}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, login_id, nickname, role, room_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/login");

  const { data: room } = await supabase
    .from("rooms")
    .select(
      "id, theme, is_name_visible, chair_id, likes_enabled, current_topic_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!room) notFound();

  const isAppAdmin = profile.role === "app_admin";
  const isChair = room.chair_id === profile.id;
  const isMember = profile.room_id === id;

  if (!isAppAdmin && !isChair && !isMember) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-8 text-center">
        <h1 className="text-xl font-bold">このルームには参加できません</h1>
        <p className="text-slate-600">
          このルームのメンバーではありません。議長から招待を受けるか、ダッシュボードからルームIDを入力して参加してください。
        </p>
        <Link href="/dashboard" className="btn-primary">
          ダッシュボードへ
        </Link>
      </div>
    );
  }

  return (
    <ChatRoom
      room={room}
      me={profile}
      isChair={isChair}
      isAppAdmin={isAppAdmin}
    />
  );
}
