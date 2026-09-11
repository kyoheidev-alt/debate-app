import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Brand } from "@/components/Brand";

export const metadata: Metadata = {
  title: "使い方",
  description: "匿名ディベートチャットの操作方法（参加者・議長・アプリ管理者）",
};

export default function GuidePage() {
  return (
    <div className="relative min-h-screen text-ink">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <Image
          src="/bg-login.png"
          alt=""
          fill
          priority={false}
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

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 pb-16">
        <div>
          <h1 className="heading-serif text-2xl text-gold-500">使い方・操作方法</h1>
          <p className="mt-2 text-sm text-muted">
            役割ごとに、画面の進め方をまとめています。
          </p>
        </div>

        <section className="card bg-navy-700/85 space-y-4">
          <h2 className="heading-serif text-lg text-ink border-b border-navy-600 pb-2">
            参加者（学生）
          </h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
            <li>
              <strong className="text-ink">トップページ</strong>で、議長から共有された{" "}
              <strong className="text-gold-500">招待リンク</strong>
              をそのまま貼るか、ルームIDを入力して入室ページへ進みます。
            </li>
            <li>
              ルームページで議長から登録された{" "}
              <strong className="text-ink">ID（学籍番号など）</strong>{" "}
              を入力します。本人確認ダイアログが出たら内容を確認し、「入室する」を押します。
            </li>
            <li>
              初回のみ、画面上の指示にしたがって{" "}
              <strong className="text-ink">ニックネーム</strong>
              を設定します（自動生成も利用できます）。
            </li>
            <li>
              チャット画面では、「賛成」「反対」を選んでから発言できます。画面上部のグラフはルーム全体の賛否の人数表示です。
            </li>
            <li>
              画面幅が狭い場合は、チャット画面上部のタブで「チャット」と「重要意見」を切り替えられます。
            </li>
          </ol>
        </section>

        <section className="card bg-navy-700/85 space-y-4">
          <h2 className="heading-serif text-lg text-ink border-b border-navy-600 pb-2">
            議長（ルーム管理者）
          </h2>
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
            <li>
              「議長としてログイン」からアカウントにサインインし、
              <strong className="text-ink">ダッシュボード</strong>
              でルームの作成・参加ができます。
            </li>
            <li>
              ルームを作成するとあなたが議長になります。表示された{" "}
              <strong className="text-gold-500">ルームID</strong>
              を参加者に共有してください。
            </li>
            <li>
              「ルーム管理」から、参加用のIDの登録・設定、通知の確認などができます。
            </li>
            <li>
              チャットでは賛否を選ばず、議長として中立の発言ができます。必要に応じて発言を「重要」にピックアップし、右カラム（スマホでは「重要」タブ）で議論を整理できます。
            </li>
          </ol>
        </section>

        <section className="card bg-navy-700/85 space-y-4">
          <h2 className="heading-serif text-lg text-ink border-b border-navy-600 pb-2">
            退出・複数端末について
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
            <li>
              参加者はチャット画面上部の<strong className="text-ink">「退出する」</strong>
              でルームを抜けます（議長・アプリ管理者は通常のログアウトを利用します）。
            </li>
            <li>
              同じ参加者IDで別の端末から入り直すと、これまでの端末側のセッションは自動的に終了する設計になっています。
            </li>
          </ul>
        </section>

        <p className="text-center text-xs text-muted">
          不明な点がある場合は、授業または議長にお問い合わせください。
        </p>
      </main>
    </div>
  );
}
