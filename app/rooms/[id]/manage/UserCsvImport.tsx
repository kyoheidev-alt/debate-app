"use client";

import Papa from "papaparse";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface ParsedRow {
  login_id: string;
  password?: string;
  name: string;
  nickname: string;
}

interface ResultRow {
  login_id: string;
  ok: boolean;
  error?: string;
}

const HEADER_MAP: Record<string, keyof ParsedRow> = {
  login_id: "login_id",
  id: "login_id",
  ID: "login_id",
  password: "password",
  パスワード: "password",
  name: "name",
  名前: "name",
  本名: "name",
  nickname: "nickname",
  ニックネーム: "nickname",
};

export function UserCsvImport({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    setWarning(null);
    setResults(null);
    setRows([]);
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete(parsed) {
        const out: ParsedRow[] = [];
        const skipped: { row: number; reason: string }[] = [];
        parsed.data.forEach((raw, idx) => {
          const normalized: Partial<ParsedRow> = {};
          for (const [key, value] of Object.entries(raw)) {
            const mapped = HEADER_MAP[key];
            if (mapped) normalized[mapped] = String(value ?? "").trim();
          }
          // Only login_id and name are required. nickname is optional —
          // if blank, the student will be forced through STEP3 to set
          // their own nickname at first entry (匿名性は入室時に確保).
          if (!normalized.login_id || !normalized.name) {
            skipped.push({
              row: idx + 2, // +1 header, +1 1-based
              reason: "login_id / name のどちらかが空です",
            });
            return;
          }
          if (!normalized.nickname) normalized.nickname = "";
          out.push(normalized as ParsedRow);
        });
        if (out.length === 0) {
          setError(
            `有効な行が見つかりません。必須ヘッダー: login_id (or ID), name (or 名前)。任意: nickname, password`,
          );
          return;
        }
        if (skipped.length > 0) {
          setWarning(
            `${skipped.length} 行をスキップしました（login_id / name のどちらかが空）: ${skipped
              .slice(0, 5)
              .map((s) => `行${s.row}`)
              .join(", ")}${skipped.length > 5 ? " ほか" : ""}`,
          );
        }
        setRows(out);
      },
      error(err) {
        setError("CSVのパースに失敗しました: " + err.message);
      },
    });
  }

  async function onImport() {
    if (rows.length === 0) return;
    setPending(true);
    setError(null);
    setWarning(null);
    setResults(null);
    try {
      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ room_id: roomId, rows }),
      });
      const json = (await res.json()) as {
        results?: ResultRow[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "import failed");
      }
      setResults(json.results ?? []);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "import failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-600">
        必須ヘッダー（日本語可）:{" "}
        <code className="rounded bg-slate-100 px-1.5">login_id</code>{" "}
        <code className="rounded bg-slate-100 px-1.5">name</code>{" "}
        <span className="text-slate-400">
          (任意:{" "}
          <code className="rounded bg-slate-100 px-1.5">nickname</code>{" "}
          <code className="rounded bg-slate-100 px-1.5">password</code>)
        </span>
      </p>
      <p className="text-xs text-slate-500">
        ニックネームは任意です（未設定なら本人が入室時に設定します。匿名性は入室時に必須化されます）。
        一般ユーザーはパスワード不要で入室できます（ID + 本人確認）。
        password 列があってもサーバ側でランダム値に置き換えられ、誰にも開示されません。
      </p>

      <input
        type="file"
        accept=".csv,text/csv"
        onChange={onFile}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-pro file:px-3 file:py-1.5 file:text-white"
      />

      {rows.length > 0 && (
        <div className="rounded-md border bg-slate-50 p-3 text-sm">
          <p className="font-medium">{rows.length} 件読み込みました。</p>
          <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-slate-600">
            {rows.slice(0, 10).map((r, i) => (
              <li key={i}>
                {r.name} ({r.login_id}){" "}
                {r.nickname ? (
                  <>→ {r.nickname}</>
                ) : (
                  <span className="text-slate-400">
                    → ニックネームは本人が入室時に設定
                  </span>
                )}
              </li>
            ))}
            {rows.length > 10 && <li>… ほか {rows.length - 10} 件</li>}
          </ul>
        </div>
      )}

      <button
        onClick={onImport}
        disabled={pending || rows.length === 0}
        className="btn-primary self-start"
      >
        {pending ? "登録中…" : `${rows.length} 件を登録してこのルームに追加`}
      </button>

      {warning && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {warning}
        </p>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {results && (
        <div className="rounded-md border bg-white p-3 text-sm">
          <p className="mb-2 font-medium">
            成功: {results.filter((r) => r.ok).length} /{" "}
            失敗: {results.filter((r) => !r.ok).length}
          </p>
          {results.filter((r) => !r.ok).length > 0 && (
            <ul className="max-h-40 overflow-y-auto text-xs text-red-700">
              {results
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.login_id}>
                    {r.login_id}: {r.error}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
