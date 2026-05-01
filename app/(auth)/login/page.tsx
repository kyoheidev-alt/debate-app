"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  // useSearchParams() forces CSR bailout; wrap in Suspense so the rest
  // of the page can prerender.
  return (
    <Suspense
      fallback={<h1 className="text-center text-2xl font-bold text-slate-900">議長ログイン</h1>}
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError || !data.user) {
        throw new Error(
          "ログインに失敗しました。メールアドレスとパスワードを確認してください。",
        );
      }
      router.push(next || "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResetSent(null);
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/login`
              : undefined,
        },
      );
      if (resetError) throw new Error(resetError.message);
      setResetSent(
        "再設定用メールを送信しました。メール内のリンクから新しいパスワードを設定してください。",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-center text-2xl font-bold text-slate-900">議長ログイン</h1>

      {!resetMode ? (
        <form onSubmit={onSubmit} className="card flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium tracking-wide text-ink">メールアドレス</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="例: tanaka@example.com"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium tracking-wide text-ink">パスワード</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </label>

          {error && (
            <p className="rounded-sm border border-con/50 bg-con/20 px-3 py-2 text-sm text-ink">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "ログイン中…" : "ログイン"}
          </button>

          <button
            type="button"
            onClick={() => {
              setResetMode(true);
              setError(null);
            }}
            className="self-start text-xs text-muted hover:text-gold-500 hover:underline"
          >
            パスワードを忘れた方
          </button>
        </form>
      ) : (
        <form onSubmit={onReset} className="card flex flex-col gap-4">
          <p className="text-sm text-muted">
            登録済みのメールアドレスに、パスワード再設定用のリンクを送信します。
          </p>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium tracking-wide text-ink">メールアドレス</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </label>

          {resetSent && (
            <p className="rounded-sm border border-gold-500/50 bg-gold-500/15 px-3 py-2 text-sm text-ink">
              {resetSent}
            </p>
          )}
          {error && (
            <p className="rounded-sm border border-con/50 bg-con/20 px-3 py-2 text-sm text-ink">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? "送信中…" : "再設定メールを送る"}
            </button>
            <button
              type="button"
              onClick={() => {
                setResetMode(false);
                setError(null);
                setResetSent(null);
              }}
              className="btn-secondary"
            >
              戻る
            </button>
          </div>
        </form>
      )}

      <p className="text-center text-sm text-muted">
        アカウントが無い方は{" "}
        <Link
          className="font-semibold text-amber-300 underline hover:text-amber-200"
          href="/signup"
        >
          こちらから登録
        </Link>
      </p>
    </>
  );
}
