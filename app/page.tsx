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
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <Brand size="lg" asLink={false} />

          <div className="w-full max-w-md">
            <div className="card bg-navy-700/90">
              <p className="mb-4 text-sm leading-relaxed text-muted">
                授業で使う匿名ディベートです。発言はニックネームで表示されます。
                生徒の方は、議長から共有された
                <span className="font-semibold text-ink">リンクをそのまま貼る</span>
                か、ルームIDを入力してください。
              </p>
              <RoomIdEntryForm />
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-navy-600 pt-4 text-sm">
                <Link
                  href="/guide"
                  className="font-semibold text-gold-500 underline-offset-2 hover:text-gold-400 hover:underline"
                >
                  使い方
                </Link>
                <Link
                  href="/login"
                  className="font-semibold text-ink underline-offset-2 hover:text-gold-500 hover:underline"
                >
                  議長としてログイン
                </Link>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-navy-600 pt-6 text-sm text-muted">
          <Link href="/signup" className="tracking-wide hover:text-gold-500">
            議長アカウントを新規作成
          </Link>
        </footer>
      </main>
    </div>
  );
}
