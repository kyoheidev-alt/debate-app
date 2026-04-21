import Image from "next/image";
import { Brand } from "@/components/Brand";
import { SysLoginForm } from "./SysLoginForm";

export default async function SysLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError =
    error === "not_admin" ? "アプリ管理者権限がありません。" : null;
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
        <div className="absolute inset-0 bg-navy-900/85 backdrop-blur-[2px]" />
      </div>

      <header className="border-b border-navy-600/60 bg-navy-800/60 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Brand size="sm" />
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-500">
            internal
          </p>
          <h1 className="heading-serif mt-1 text-2xl text-ink">
            アプリ管理者ログイン
          </h1>
        </div>
        <SysLoginForm initialError={initialError} />
      </main>
    </div>
  );
}
