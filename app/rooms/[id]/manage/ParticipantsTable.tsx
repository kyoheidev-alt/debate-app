"use client";

import { useState, useTransition } from "react";

interface Participant {
  id: string;
  name: string;
  login_id: string;
  nickname: string;
  role: string;
}

export function ParticipantsTable({
  roomId,
  participants,
}: {
  roomId: string;
  participants: Participant[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onKick(userId: string, nickname: string) {
    if (!confirm(`${nickname} をルームから強制退出させますか？`)) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/users/kick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ room_id: roomId, user_id: userId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "kick failed");
        return;
      }
      window.location.reload();
    });
  }

  if (participants.length === 0) {
    return <p className="text-sm text-slate-500">まだ参加者はいません。</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">ニックネーム</th>
              <th className="px-3 py-2">名前</th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">発言者ID</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{p.nickname}</td>
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2">{p.login_id}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">
                  {p.id}
                </td>
                <td className="px-3 py-2">
                  {p.role === "app_admin" ? (
                    <span className="text-xs text-slate-500">アプリ管理者</span>
                  ) : (
                    <button
                      onClick={() => onKick(p.id, p.nickname)}
                      disabled={pending}
                      className="btn-danger text-xs"
                    >
                      強制退出
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
