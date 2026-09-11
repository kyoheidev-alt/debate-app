import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { EnterForm } from "@/app/r/[id]/enter/EnterForm";
import { Brand } from "@/components/Brand";

export const dynamic = "force-dynamic";

export default async function RoomEnterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: room } = await admin
    .from("rooms")
    .select("id, theme, chair_id")
    .eq("id", id)
    .maybeSingle();
  if (!room) notFound();

  const { data: chair } = await admin
    .from("profiles")
    .select("nickname")
    .eq("id", room.chair_id)
    .maybeSingle();

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
            ディベートルーム
          </p>
          <div className="gold-accent">
            <h1 className="heading-serif text-xl leading-snug text-ink">
              {room.theme}
            </h1>
          </div>
          {chair && (
            <p className="text-sm text-muted">
              議長: <span className="font-medium text-ink">{chair.nickname}</span>
            </p>
          )}
          <p className="text-sm text-muted">
            チャットではニックネームで表示されます。本名は出ません。
          </p>
        </section>

        <EnterForm roomId={room.id} />

        <p className="rounded-md border border-gold-500/35 bg-navy-900/80 px-4 py-3 text-center text-xs leading-relaxed text-gold-200 shadow-sm">
          IDがわからない場合は、議長に Teams で聞いてください。
        </p>
      </main>
    </div>
  );
}
