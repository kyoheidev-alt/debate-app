import Image from "next/image";
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
    .select("name, nickname")
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
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Brand size="sm" />
        </div>
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
        <section className="card flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold-500">
            Debate Room
          </p>
          <div className="gold-accent">
            <h1 className="heading-serif text-xl leading-snug text-ink">
              {room.theme}
            </h1>
          </div>
          {chair && (
            <p className="text-sm text-muted">
              議長: <span className="font-medium text-ink">{chair.name}</span>
            </p>
          )}
          <p className="font-mono text-[11px] text-muted/80">ID: {room.id}</p>
        </section>

        <EnterForm roomId={room.id} />

        <p className="text-center text-xs text-muted">
          IDがわからない場合は議長にお問い合わせください。
        </p>
      </main>
    </div>
  );
}
