"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateNickname } from "@/lib/utils";

export function SignupForm() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        throw new Error("正しいメールアドレスを入力してください。");
      }
      if (password.length < 6) {
        throw new Error("パスワードは 6 文字以上にしてください。");
      }
      if (!name.trim()) {
        throw new Error("名前を入力してください。");
      }

      const finalNick = nickname.trim() || trimmedEmail.split("@")[0];

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            name: name.trim(),
            nickname: finalNick,
          },
        },
      });
      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        if (msg.includes("already")) {
          throw new Error(
            "このメールアドレスは既に登録されています。ログインしてください。",
          );
        }
        throw new Error("登録に失敗しました: " + signUpError.message);
      }

      // Email 確認 ON の場合、session は null になる。
      if (!data.session) {
        setInfo(
          "確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。",
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-4">
      <Field label="メールアドレス">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="例: tanaka@example.com"
        />
      </Field>

      <Field label="パスワード（6文字以上）">
        <input
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />
      </Field>

      <Field label="名前（議長機能を使う場合に表示されます）">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          placeholder="例: 山田 太郎"
        />
      </Field>

      <Field label="ニックネーム（チャットでの表示名・空欄ならメールのローカル部）">
        <div className="flex gap-2">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="input flex-1"
            placeholder="例: パンダ1234"
            maxLength={20}
          />
          <button
            type="button"
            onClick={() => setNickname(generateNickname())}
            className="btn-secondary whitespace-nowrap"
          >
            ランダム
          </button>
        </div>
      </Field>

      {info && (
        <p className="rounded-sm border border-gold-500/50 bg-gold-500/15 px-3 py-2 text-sm text-ink">
          {info}
        </p>
      )}

      {error && (
        <p className="rounded-sm border border-con/50 bg-con/20 px-3 py-2 text-sm text-ink">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "作成中…" : "アカウントを作成"}
      </button>

      <p className="text-xs text-muted">
        パスワードを忘れた場合は、ログイン画面の「パスワードを忘れた方」からメール経由で再設定できます。
      </p>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium tracking-wide text-ink">{label}</span>
      {children}
    </label>
  );
}
