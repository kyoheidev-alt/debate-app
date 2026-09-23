import type { MessageStance } from "@/lib/supabase/types";

/**
 * True when saving `nextTheme` should close the live topic.
 * Surrounding whitespace is ignored. An empty next theme never archives
 * (the caller rejects it instead).
 *
 * The database trigger `archive_room_on_theme_change` uses the same rule.
 */
export function shouldArchiveTopic(
  currentTheme: string,
  nextTheme: string,
): boolean {
  const next = nextTheme.trim();
  if (!next) return false;
  return currentTheme.trim() !== next;
}

export interface TopicLabel {
  id: string;
  theme: string;
  ordinal: number;
}

export interface ArchivedTopicSection<T> {
  id: string;
  theme: string;
  ordinal: number;
  messages: T[];
}

/** Messages that belong to the live prompt. A missing topic id keeps every row live. */
export function liveTopicMessages<T extends { topic_id: string }>(
  messages: T[],
  currentTopicId: string | null,
): T[] {
  if (!currentTopicId) return messages;
  return messages.filter((m) => m.topic_id === currentTopicId);
}

/**
 * Previous prompts, newest first. Each section is labeled with that
 * prompt's theme and includes every message written under it.
 */
export function archivedTopicSections<
  T extends { topic_id: string; created_at: string },
>(
  topics: TopicLabel[],
  messages: T[],
  currentTopicId: string | null,
): ArchivedTopicSection<T>[] {
  const previous = topics
    .filter((t) => t.id !== currentTopicId)
    .sort((a, b) => b.ordinal - a.ordinal);

  const known = new Set(previous.map((t) => t.id));
  const sections: ArchivedTopicSection<T>[] = previous.map((t) => ({
    id: t.id,
    theme: t.theme,
    ordinal: t.ordinal,
    messages: messages
      .filter((m) => m.topic_id === t.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));

  const orphanIds = [
    ...new Set(
      messages
        .map((m) => m.topic_id)
        .filter((id) => id && id !== currentTopicId && !known.has(id)),
    ),
  ];
  for (const id of orphanIds) {
    sections.push({
      id,
      theme: "前の議題",
      ordinal: 0,
      messages: messages
        .filter((m) => m.topic_id === id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    });
  }

  return sections;
}

export interface SideCountMessage {
  user_id: string;
  stance: MessageStance;
  deleted_at: string | null;
  created_at: string;
}

/**
 * Headcount for the agree/disagree barometer.
 * One person, one side: their latest non-deleted pro/con message.
 * Chair posts and soft-deleted posts do not count.
 */
export function countSideSpeakers(messages: SideCountMessage[]): {
  pro: number;
  con: number;
} {
  const latest = new Map<string, { stance: "pro" | "con"; at: number }>();
  for (const m of messages) {
    if (m.deleted_at) continue;
    if (m.stance !== "pro" && m.stance !== "con") continue;
    const at = new Date(m.created_at).getTime();
    const prev = latest.get(m.user_id);
    if (!prev || at >= prev.at) {
      latest.set(m.user_id, { stance: m.stance, at });
    }
  }
  let pro = 0;
  let con = 0;
  for (const row of latest.values()) {
    if (row.stance === "pro") pro += 1;
    else con += 1;
  }
  return { pro, con };
}
