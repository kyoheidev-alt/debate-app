import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
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
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Brand size="sm" />
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
        <h1 className="heading-serif text-2xl text-ink">アカウント作成</h1>
        <SignupForm />
        <p className="text-center text-sm text-muted">
          既にアカウントをお持ちですか？{" "}
          <Link className="text-gold-500 underline hover:text-gold-400" href="/login">
            ログイン
          </Link>
        </p>
      </main>
    </div>
  );
}
