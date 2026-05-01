import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Brand } from "@/components/Brand";
import { NicknameForm } from "./NicknameForm";

export const dynamic = "force-dynamic";

export default async function SetupNicknamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/r/${id}/enter`);
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, room_id, nickname, has_set_nickname")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "user" || profile.room_id !== id) {
    redirect(`/r/${id}/enter`);
  }

  if (profile.has_set_nickname) {
    redirect(`/rooms/${id}`);
  }

  const { data: room } = await admin
    .from("rooms")
    .select("id, theme")
    .eq("id", id)
    .maybeSingle();
  if (!room) notFound();

  return (
    <div className="relative min-h-screen text-ink">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <Image
          src="/bg-login.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-navy-900/78 backdrop-blur-[2px]" />
      </div>

      <header className="border-b border-navy-600/60 bg-navy-800/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3">
          <Brand href="/" size="sm" />
          <Link
            href="/"
            className="text-xs font-semibold tracking-wide text-gold-500 underline-offset-2 hover:text-gold-400 hover:underline"
          >
            トップページへ
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
        <section className="card flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold-500">
            ニックネーム設定
          </p>
          <div className="gold-accent">
            <h1 className="heading-serif text-xl leading-snug text-ink">
              {room.theme}
            </h1>
          </div>
          <p className="text-sm text-muted">
            チャットでの表示名を決めてください。後から議長が変更することはできますが、
            匿名性を保つため本名以外を推奨します。
          </p>
        </section>

        <NicknameForm roomId={room.id} initialNickname={profile.nickname ?? ""} />
      </main>
    </div>
  );
}
