import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { RoomIdEntryForm } from "./RoomIdEntryForm";

export default function Home() {
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
        <div className="absolute inset-0 bg-navy-900/75 backdrop-blur-[2px]" />
      </div>

      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
        <div className="flex flex-1 flex-col items-center justify-center gap-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <Brand size="lg" asLink={false} />
            <p className="heading-serif text-sm tracking-[0.4em] text-gold-500">
              ANONYMOUS DEBATE ROOM
            </p>
            <p className="text-sm text-muted">
              議長から共有されたルームIDを入力して入室します。
            </p>
          </div>

          <div className="w-full max-w-md">
            <div className="card bg-navy-700/90">
              <RoomIdEntryForm />
            </div>
          </div>
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-navy-600 pt-6 text-xs text-muted">
          <Link href="/login" className="tracking-wide hover:text-gold-500">
            議長としてログイン
          </Link>
          <Link href="/signup" className="tracking-wide hover:text-gold-500">
            議長アカウントを新規作成
          </Link>
        </footer>
      </main>
    </div>
  );
}
