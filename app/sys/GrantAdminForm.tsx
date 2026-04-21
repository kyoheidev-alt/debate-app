"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserRole } from "@/app/sys/actions";

export function GrantAdminForm() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  function submit(role: "app_admin" | "user") {
    setMsg(null);
    startTransition(async () => {
      try {
        await setUserRole(loginId.trim(), role);
        setMsg({
          kind: "ok",
          text: `${loginId} のロールを ${role} に設定しました`,
        });
        setLoginId("");
        router.refresh();
      } catch (err) {
        setMsg({
          kind: "err",
          text: err instanceof Error ? err.message : "失敗しました",
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input flex-1"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          placeholder="議長のメールアドレス または 一般ユーザーのID"
        />
        <button
          type="button"
          onClick={() => submit("app_admin")}
          disabled={pending || !loginId.trim()}
          className="btn-primary"
        >
          管理者にする
        </button>
        <button
          type="button"
          onClick={() => submit("user")}
          disabled={pending || !loginId.trim()}
          className="btn-secondary"
        >
          一般ユーザーに戻す
        </button>
      </div>
      {msg && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            msg.kind === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
