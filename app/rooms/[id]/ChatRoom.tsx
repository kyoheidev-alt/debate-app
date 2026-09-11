"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "@/components/Brand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type {
  Message,
  MessageLike,
  MessageStance,
  Room,
  Stance,
  StanceRow,
} from "@/lib/supabase/types";
import {
  PRESENCE_HEARTBEAT_INTERVAL_MS,
  isChairCapableAccount,
} from "@/lib/supabase/types";
import {
  profileSelectColumns,
  toPublicChatProfile,
  type PublicChatProfile,
} from "@/lib/identity";
import { Barometer } from "@/components/chat/Barometer";
import { MessageList, type LikeState } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { ImportantThread } from "@/components/chat/ImportantThread";
import { heartbeat, leaveRoom } from "./presence-actions";
import { editMessage, deleteMessage } from "./actions";
import { clearStudentEntry } from "@/lib/studentEntryStorage";

type RoomLite = Pick<
  Room,
  "id" | "theme" | "is_name_visible" | "chair_id" | "likes_enabled"
>;
type ProfileLite = PublicChatProfile;
type MeProfile = PublicChatProfile & { login_id: string; name: string };

export function ChatRoom({
  room,
  me,
  isChair,
  isAppAdmin,
}: {
  room: RoomLite;
  me: MeProfile;
  isChair: boolean;
  isAppAdmin: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [stances, setStances] = useState<StanceRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [myStance, setMyStance] = useState<Stance | null>(null);
  // likes[messageId] = { count, likedByMe }
  const [likes, setLikes] = useState<Record<string, LikeState>>({});
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [mobileImportantOpen, setMobileImportantOpen] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Moderator (chair of this room or any app_admin) posts neutral
  // messages with stance='chair' and never picks pro/con.
  const isModerator = isChair || isAppAdmin;

  useEffect(() => {
    if (!mobileImportantOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileImportantOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileImportantOpen]);

  // Initial fetch
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [mRes, sRes, pRes] = await Promise.all([
        supabase
          .from("messages")
          .select("*")
          .eq("room_id", room.id)
          .order("created_at", { ascending: true }),
        supabase.from("stances").select("*").eq("room_id", room.id),
        supabase
          .from("profiles")
          .select(profileSelectColumns(room.is_name_visible))
          .eq("room_id", room.id),
      ]);
      if (!mounted) return;
      const msgs = (mRes.data ?? []) as Message[];
      setMessages(msgs);
      setStances((sRes.data ?? []) as StanceRow[]);
      const pmap: Record<string, ProfileLite> = {};
      for (const p of (pRes.data ?? []) as unknown as Array<{
        id: string;
        nickname: string;
        role: ProfileLite["role"];
        room_id: string | null;
        name?: string | null;
        login_id?: string | null;
      }>) {
        pmap[p.id] = toPublicChatProfile(p, room.is_name_visible);
      }
      setProfiles(pmap);
      const mine = (sRes.data ?? []).find(
        (s: StanceRow) => s.user_id === me.id,
      );
      setMyStance(mine?.stance ?? null);

      // Likes: fetch all likes for this room's messages (RLS ensures we
      // only see messages in rooms we belong to, so a bare SELECT is fine).
      const msgIds = msgs.map((m) => m.id);
      if (msgIds.length > 0) {
        const { data: likeRows } = await supabase
          .from("message_likes")
          .select("message_id, user_id, created_at")
          .in("message_id", msgIds);
        if (!mounted) return;
        const lmap: Record<string, LikeState> = {};
        for (const row of (likeRows ?? []) as MessageLike[]) {
          const prev = lmap[row.message_id] ?? {
            count: 0,
            likedByMe: false,
          };
          lmap[row.message_id] = {
            count: prev.count + 1,
            likedByMe: prev.likedByMe || row.user_id === me.id,
          };
        }
        setLikes(lmap);
      }

      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, room.id, me.id, room.is_name_visible]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`room:${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Message;
            setMessages((prev) =>
              prev.some((m) => m.id === row.id) ? prev : [...prev, row],
            );
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === (payload.new as Message).id
                  ? (payload.new as Message)
                  : m,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setMessages((prev) =>
              prev.filter((m) => m.id !== (payload.old as Message).id),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stances", filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as StanceRow;
            setStances((prev) =>
              prev.filter(
                (s) => !(s.user_id === old.user_id && s.room_id === old.room_id),
              ),
            );
            if (old.user_id === me.id) setMyStance(null);
            return;
          }
          const row = payload.new as StanceRow;
          setStances((prev) => {
            const idx = prev.findIndex(
              (s) => s.user_id === row.user_id && s.room_id === row.room_id,
            );
            if (idx === -1) return [...prev, row];
            const next = [...prev];
            next[idx] = row;
            return next;
          });
          if (row.user_id === me.id) setMyStance(row.stance);
        },
      )
      .on(
        "postgres_changes",
        // message_likes has no room_id column, so we can't filter server-
        // side; RLS already limits visibility to our room. We still guard
        // with a messages.has check client-side to avoid stale updates.
        { event: "*", schema: "public", table: "message_likes" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as MessageLike;
            setLikes((prev) => {
              const cur = prev[row.message_id] ?? { count: 0, likedByMe: false };
              return {
                ...prev,
                [row.message_id]: {
                  count: cur.count + 1,
                  likedByMe: cur.likedByMe || row.user_id === me.id,
                },
              };
            });
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as MessageLike;
            setLikes((prev) => {
              const cur = prev[row.message_id];
              if (!cur) return prev;
              const nextCount = Math.max(0, cur.count - 1);
              return {
                ...prev,
                [row.message_id]: {
                  count: nextCount,
                  likedByMe:
                    row.user_id === me.id ? false : cur.likedByMe,
                },
              };
            });
          }
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [supabase, room.id, me.id]);

  const setStance = useCallback(
    async (next: Stance) => {
      const prev = myStance;
      setMyStance(next);
      try {
        const { error } = await supabase
          .from("stances")
          .upsert(
            {
              user_id: me.id,
              room_id: room.id,
              stance: next,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,room_id" },
          );
        if (error) {
          setMyStance(prev);
          alert("立場の更新に失敗しました: " + error.message);
        }
      } catch {
        setMyStance(prev);
        alert("立場の更新に失敗しました。");
      }
    },
    [supabase, me.id, room.id, myStance],
  );

  // ---------- presence (students only) ----------
  // Chairs / app_admins are not tracked in `room_participants`; they may
  // open the chat from multiple devices for moderation.
  useEffect(() => {
    if (isModerator) return;

    let cancelled = false;

    async function tick() {
      try {
        const res = await heartbeat(room.id);
        if (cancelled) return;
        if (!res.stillIn) {
          // Our presence row was replaced (different browser took over)
          // or expired. Clear local hint and bounce back to the LP.
          clearStudentEntry(room.id);
          alert(
            "別の端末からこのIDで入り直されたため、このセッションは終了しました。",
          );
          router.replace("/");
        }
      } catch {
        // network blip — ignore; next tick will retry.
      }
    }

    // First tick happens after the interval (initial entry already set
    // last_seen_at via confirmEnter). On `visibilitychange` to visible,
    // tick immediately to avoid false stale-out after laptop wake.
    const id = window.setInterval(tick, PRESENCE_HEARTBEAT_INTERVAL_MS);
    function onVisible() {
      if (document.visibilityState === "visible") void tick();
    }
    document.addEventListener("visibilitychange", onVisible);

    // NOTE: We intentionally do NOT send a sendBeacon on `pagehide`.
    // `pagehide` fires on ordinary reloads / Fast Refresh / bfcache
    // transitions, and deleting our own row there would cause the next
    // heartbeat to think "someone else took over" and kick the user out
    // for no reason. Rows instead go stale naturally after
    // PRESENCE_ACTIVE_WINDOW_MS (default 60s), which is acceptable for
    // the take-over flow.

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isModerator, room.id, router]);

  const onLeaveClick = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      clearStudentEntry(room.id);
      await leaveRoom(room.id);
    } finally {
      router.replace("/");
    }
  }, [leaving, room.id, router]);

  const sendMessage = useCallback(
    async (content: string, parentId: string | null = null) => {
      let stanceToSend: MessageStance;
      if (isModerator) {
        stanceToSend = "chair";
      } else {
        if (!myStance) {
          alert("先に賛成・反対の立場を選択してください。");
          return;
        }
        stanceToSend = myStance;
      }
      try {
        const { data, error } = await supabase
          .from("messages")
          .insert({
            room_id: room.id,
            user_id: me.id,
            content,
            stance: stanceToSend,
            parent_id: parentId,
          })
          .select("*")
          .single();
        if (error || !data) {
          throw new Error(error?.message ?? "送信に失敗しました");
        }
        const row = data as Message;
        setMessages((prev) =>
          prev.some((m) => m.id === row.id) ? prev : [...prev, row],
        );
      } catch (err) {
        alert(
          "送信に失敗しました: " +
            (err instanceof Error ? err.message : String(err)),
        );
        throw err;
      }
    },
    [supabase, me.id, room.id, myStance, isModerator],
  );

  const toggleImportant = useCallback(
    async (messageId: string, next: boolean) => {
      try {
        const { error } = await supabase
          .from("messages")
          .update({ is_important: next })
          .eq("id", messageId);
        if (error) alert("更新に失敗しました: " + error.message);
      } catch {
        alert("更新に失敗しました。");
      }
    },
    [supabase],
  );

  const toggleLike = useCallback(
    async (messageId: string) => {
      if (!room.likes_enabled) return;
      const cur = likes[messageId] ?? { count: 0, likedByMe: false };
      // Optimistic toggle.
      setLikes((prev) => ({
        ...prev,
        [messageId]: {
          count: cur.likedByMe ? Math.max(0, cur.count - 1) : cur.count + 1,
          likedByMe: !cur.likedByMe,
        },
      }));
      try {
        if (cur.likedByMe) {
          const { error } = await supabase
            .from("message_likes")
            .delete()
            .eq("message_id", messageId)
            .eq("user_id", me.id);
          if (error) {
            setLikes((prev) => ({ ...prev, [messageId]: cur }));
            alert("いいねの解除に失敗しました: " + error.message);
          }
        } else {
          const { error } = await supabase
            .from("message_likes")
            .insert({ message_id: messageId, user_id: me.id });
          if (error) {
            setLikes((prev) => ({ ...prev, [messageId]: cur }));
            alert("いいねに失敗しました: " + error.message);
          }
        }
      } catch {
        setLikes((prev) => ({ ...prev, [messageId]: cur }));
        alert("いいねの更新に失敗しました。");
      }
    },
    [supabase, room.likes_enabled, me.id, likes],
  );

  const onEditMessage = useCallback(
    async (messageId: string, content: string) => {
      await editMessage(messageId, content);
    },
    [],
  );

  const onDeleteMessage = useCallback(async (messageId: string) => {
    await deleteMessage(messageId);
  }, []);

  const proCount = stances.filter((s) => s.stance === "pro").length;
  const conCount = stances.filter((s) => s.stance === "con").length;

  const rootMessages = messages.filter((m) => !m.parent_id);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Message[]>();
    for (const m of messages) {
      if (m.parent_id) {
        const arr = map.get(m.parent_id) ?? [];
        arr.push(m);
        map.set(m.parent_id, arr);
      }
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [messages]);

  const importantRoots = rootMessages.filter((m) => m.is_important);

  // 議長 or アプリ管理者は重要意見ピックアップなどの管理操作が可能
  const canModerate = isChair || isAppAdmin;
  const isChairAccount = isChairCapableAccount(me);

  return (
    <div className="relative flex h-screen flex-col text-ink">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <Image
          src="/bg-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-navy-900/85 backdrop-blur-[2px]" />
      </div>
      <header className="border-b border-navy-600/60 bg-navy-800/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Brand size="sm" className="shrink-0" />
            <div className="min-w-0 gold-accent">
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold-500">
                テーマ
              </p>
              <h1 className="heading-serif truncate text-lg text-ink">
                {room.theme}
              </h1>
              {!isModerator && (
                <p className="mt-0.5 hidden text-[11px] text-muted sm:block">
                  賛成か反対かを選んで、理由を書いて議論しましょう。
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="max-w-[7rem] truncate text-muted sm:max-w-none sm:inline">
              {me.nickname}
              {room.is_name_visible && me.name ? ` (${me.name})` : ""}
            </span>
            {isChairAccount && (
              <Link href="/dashboard" className="btn-secondary text-xs">
                ダッシュボード
              </Link>
            )}
            {canModerate && (
              <Link
                href={`/rooms/${room.id}/manage`}
                className="btn-secondary text-xs"
              >
                ルーム管理
              </Link>
            )}
            {isAppAdmin && (
              <Link href="/sys" className="btn-secondary text-xs">
                /sys
              </Link>
            )}
            {isModerator ? (
              <form action="/auth/signout" method="post">
                <button className="btn-secondary text-xs" type="submit">
                  ログアウト
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={onLeaveClick}
                disabled={leaving}
                className="btn-secondary text-xs"
              >
                {leaving ? "退出中…" : "退出する"}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-hidden px-3 pb-2 pt-0 lg:grid lg:grid-cols-[280px_1fr_360px] lg:gap-4 lg:p-4">
          {/* モバイル: ヘッダー直下の賛否ゲージ帯 */}
          <div className="shrink-0 border-b border-navy-600/80 bg-navy-800/60 px-2 py-2 backdrop-blur-sm lg:hidden">
            <h2 className="sr-only">賛成 vs 反対</h2>
            <Barometer pro={proCount} con={conCount} variant="compact" />
          </div>

          {/* 左: バロメーター（デスクトップのみ） */}
          <aside className="card hidden min-h-0 flex-col gap-4 overflow-y-auto bg-navy-700/75 backdrop-blur-sm lg:flex">
            <h2 className="heading-serif text-center text-sm uppercase tracking-[0.2em] text-gold-500">
              賛成 vs 反対
            </h2>
            <Barometer pro={proCount} con={conCount} />
            {isModerator ? (
              <div className="flex flex-col gap-2 rounded-sm border border-chair/50 bg-chair/15 p-3">
                <p className="text-sm font-semibold text-chair-light">
                  {isChair ? "議長として参加中" : "アプリ管理者として参加中"}
                </p>
                <p className="text-xs text-muted">
                  立場（賛成 / 反対）を選ばずに中立の発言ができます。投稿は紫色で中央に表示されます。
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                  あなたの立場
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStance("pro")}
                    className={`flex-1 rounded-sm border px-3 py-2 font-semibold tracking-wide transition ${
                      myStance === "pro"
                        ? "border-pro bg-pro text-white"
                        : "border-navy-600 bg-navy-800/60 text-ink hover:border-pro"
                    }`}
                  >
                    賛成
                  </button>
                  <button
                    type="button"
                    onClick={() => setStance("con")}
                    className={`flex-1 rounded-sm border px-3 py-2 font-semibold tracking-wide transition ${
                      myStance === "con"
                        ? "border-con bg-con text-white"
                        : "border-navy-600 bg-navy-800/60 text-ink hover:border-con"
                    }`}
                  >
                    反対
                  </button>
                </div>
                {!myStance && (
                  <p className="text-xs text-muted">
                    発言する前に立場を選んでください。
                  </p>
                )}
              </div>
            )}
          </aside>

          {/* 中央: チャット */}
          <section className="card flex min-h-0 flex-1 flex-col overflow-hidden bg-navy-700/75 p-0 backdrop-blur-sm lg:min-h-0">
            {/* モバイル: 上部タブでチャット／重要を切り替え（ドロワー不使用） */}
            <div
              className="flex shrink-0 border-b border-navy-600 lg:hidden"
              role="tablist"
              aria-label="表示の切り替え"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!mobileImportantOpen}
                id="mobile-tab-chat"
                aria-controls="mobile-chat-panel"
                onClick={() => setMobileImportantOpen(false)}
                className={`flex-1 px-3 py-2.5 text-sm font-semibold tracking-wide transition ${
                  !mobileImportantOpen
                    ? "border-b-2 border-gold-500 bg-navy-800/50 text-gold-500"
                    : "text-muted hover:text-ink"
                }`}
              >
                チャット
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileImportantOpen}
                id="mobile-tab-important"
                aria-controls="mobile-important-panel"
                onClick={() => setMobileImportantOpen(true)}
                className={`flex-1 px-3 py-2.5 text-sm font-semibold tracking-wide transition ${
                  mobileImportantOpen
                    ? "border-b-2 border-gold-500 bg-navy-800/50 text-gold-500"
                    : "text-muted hover:text-ink"
                }`}
              >
                重要
              </button>
            </div>

            {/* メインチャット（デスクトップ常時／モバイルはチャットタブ時のみ） */}
            <div
              id="mobile-chat-panel"
              role="tabpanel"
              aria-labelledby="mobile-tab-chat"
              className={
                mobileImportantOpen
                  ? "hidden min-h-0 flex-1 flex-col overflow-hidden lg:flex"
                  : "flex min-h-0 flex-1 flex-col overflow-hidden"
              }
            >
              <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                  <p className="text-center text-sm text-muted">読み込み中…</p>
                ) : (
                  <MessageList
                    messages={rootMessages}
                    profiles={profiles}
                    meId={me.id}
                    isAdmin={canModerate}
                    isNameVisible={room.is_name_visible}
                    likesEnabled={room.likes_enabled}
                    likes={likes}
                    onToggleLike={toggleLike}
                    onToggleImportant={toggleImportant}
                    onEdit={onEditMessage}
                    onDelete={onDeleteMessage}
                  />
                )}
              </div>
              {/* モバイル: 立場（学生）または議長説明 — 入力の直上に常時表示 */}
              <div className="shrink-0 border-t border-navy-600 bg-navy-800/50 px-3 py-2 backdrop-blur-sm lg:hidden">
                {isModerator ? (
                  <div className="flex flex-col gap-1 rounded-sm border border-chair/50 bg-chair/15 p-2">
                    <p className="text-xs font-semibold text-chair-light">
                      {isChair
                        ? "議長として参加中"
                        : "アプリ管理者として参加中"}
                    </p>
                    <p className="text-[11px] leading-snug text-muted">
                      賛成/反対を選ばず中立の発言ができます（中央・紫色）。
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      あなたの立場
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setStance("pro")}
                        className={`flex-1 rounded-sm border px-3 py-2 text-sm font-semibold tracking-wide transition ${
                          myStance === "pro"
                            ? "border-pro bg-pro text-white"
                            : "border-navy-600 bg-navy-800/60 text-ink hover:border-pro"
                        }`}
                      >
                        賛成
                      </button>
                      <button
                        type="button"
                        onClick={() => setStance("con")}
                        className={`flex-1 rounded-sm border px-3 py-2 text-sm font-semibold tracking-wide transition ${
                          myStance === "con"
                            ? "border-con bg-con text-white"
                            : "border-navy-600 bg-navy-800/60 text-ink hover:border-con"
                        }`}
                      >
                        反対
                      </button>
                    </div>
                    {!myStance && (
                      <p className="text-[11px] text-muted">
                        発言する前に立場を選んでください。
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="border-t border-navy-600 bg-navy-800/65 p-3 backdrop-blur-sm">
                <MessageInput
                  disabled={!isModerator && !myStance}
                  stance={isModerator ? "chair" : myStance}
                  onSend={(c) => sendMessage(c, null)}
                />
              </div>
            </div>

            {/* モバイル専用: 重要タブの内容（同一カード内で切り替え） */}
            <div
              id="mobile-important-panel"
              role="tabpanel"
              aria-labelledby="mobile-tab-important"
              className={
                mobileImportantOpen
                  ? "flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden"
                  : "hidden"
              }
            >
              <div className="shrink-0 border-b border-navy-600 px-3 py-2">
                <h2 className="heading-serif text-sm text-gold-500">
                  重要意見
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  議長がピックアップした意見と、それに対する議論ツリー
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <ImportantThread
                  roots={importantRoots}
                  childrenByParent={childrenByParent}
                  profiles={profiles}
                  meId={me.id}
                  isAdmin={canModerate}
                  isModerator={isModerator}
                  isNameVisible={room.is_name_visible}
                  myStance={myStance}
                  likesEnabled={room.likes_enabled}
                  likes={likes}
                  onToggleLike={toggleLike}
                  onReply={(content, parentId) =>
                    sendMessage(content, parentId)
                  }
                  onToggleImportant={toggleImportant}
                  onEdit={onEditMessage}
                  onDelete={onDeleteMessage}
                />
              </div>
            </div>
          </section>

          {/* 右: 重要意見（デスクトップのみ） */}
          <aside className="card hidden min-h-0 flex-col overflow-hidden bg-navy-700/75 p-0 backdrop-blur-sm lg:flex">
            <div className="border-b border-navy-600 px-4 py-3">
              <h2 className="heading-serif text-ink">重要意見</h2>
              <p className="text-xs text-muted">
                議長がピックアップした意見と、それに対する議論ツリー
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <ImportantThread
                roots={importantRoots}
                childrenByParent={childrenByParent}
                profiles={profiles}
                meId={me.id}
                isAdmin={canModerate}
                isModerator={isModerator}
                isNameVisible={room.is_name_visible}
                myStance={myStance}
                likesEnabled={room.likes_enabled}
                likes={likes}
                onToggleLike={toggleLike}
                onReply={(content, parentId) =>
                  sendMessage(content, parentId)
                }
                onToggleImportant={toggleImportant}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
