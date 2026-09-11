import Link from "next/link";
import { Brand } from "@/components/Brand";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-navy-900 text-ink">
      <header className="border-b border-navy-600/60 bg-navy-800/80">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-3">
          <Brand href="/" size="sm" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-16">
        <h1 className="heading-serif text-2xl text-gold-500">
          ページが見つかりません
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          リンクが古い、またはルームIDの入力ミスの可能性があります。議長から共有されたリンクをもう一度開くか、トップページから入り直してください。
        </p>
        <Link href="/" className="btn-primary inline-flex justify-center">
          トップページへ戻る
        </Link>
      </main>
    </div>
  );
}
