"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PRESENCE_ACTIVE_WINDOW_MS,
  PRESENCE_HEARTBEAT_INTERVAL_MS,
  type RoomParticipant,
} from "@/lib/supabase/types";

interface ParticipantInfo {
  id: string;
  nickname: string;
  name: string;
  login_id: string;
}

export function RosterPanel({
  roomId,
  participants,
}: {
  roomId: string;
  participants: ParticipantInfo[];
}) {
  const supabase = createClient();
  const [presence, setPresence] = useState<RoomParticipant[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());

  // Initial fetch + Realtime subscription
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("room_participants")
        .select("*")
        .eq("room_id", roomId);
      if (!mounted) return;
      setPresence((data ?? []) as RoomParticipant[]);
    })();

    const channel = supabase
      .channel(`presence:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_participants",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const r = payload.new as RoomParticipant;
            setPresence((prev) =>
              prev.some((x) => x.user_id === r.user_id)
                ? prev.map((x) => (x.user_id === r.user_id ? r : x))
                : [...prev, r],
            );
          } else if (payload.eventType === "UPDATE") {
            const r = payload.new as RoomParticipant;
            setPresence((prev) =>
              prev.map((x) => (x.user_id === r.user_id ? r : x)),
            );
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as RoomParticipant;
            setPresence((prev) =>
              prev.filter((x) => x.user_id !== old.user_id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, roomId]);

  // Re-evaluate "active" badge every ~10s so stale rows visually drop
  // out without waiting for a server event.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const profileById = new Map(participants.map((p) => [p.id, p]));

  // Active = last_seen within window. Stale rows are filtered out
  // entirely from the "在室中" count but still displayed (greyed out)
  // in case a chair wants to see who recently disconnected.
  const rows = presence
    .map((p) => {
      const ageMs = now - new Date(p.last_seen_at).getTime();
      const isActive = ageMs < PRESENCE_ACTIVE_WINDOW_MS;
      return {
        ...p,
        ageMs,
        isActive,
        info: profileById.get(p.user_id),
      };
    })
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.ageMs - b.ageMs;
    });

  const activeCount = rows.filter((r) => r.isActive).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-slate-600">
          在室中:{" "}
          <span className="text-base font-bold text-pro">{activeCount}</span> 人
        </p>
        <p className="text-xs text-slate-400">
          ハートビート {Math.round(PRESENCE_HEARTBEAT_INTERVAL_MS / 1000)}秒間隔
          / {Math.round(PRESENCE_ACTIVE_WINDOW_MS / 1000)}秒で「不在」
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">現在の在室者はいません。</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border bg-white">
          {rows.map((r) => (
            <li
              key={r.user_id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    r.isActive ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  aria-label={r.isActive ? "在室中" : "切断"}
                />
                <span className="font-medium">
                  {r.info?.nickname ?? "(不明)"}
                </span>
                <span className="text-xs text-slate-400">
                  {r.info?.login_id}
                </span>
              </div>
              <span className="text-xs text-slate-500">
                {r.isActive
                  ? `${Math.max(0, Math.floor(r.ageMs / 1000))}秒前`
                  : "切断"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
