import { describe, expect, it } from "vitest";
import {
  archivedTopicSections,
  countSideSpeakers,
  liveTopicMessages,
  shouldArchiveTopic,
} from "./topics";

const current = "topic-now";
const previous = "topic-prev";

describe("shouldArchiveTopic", () => {
  it("does not archive when the theme text is unchanged", () => {
    expect(shouldArchiveTopic("給食は必要か", "給食は必要か")).toBe(false);
  });

  it("ignores surrounding whitespace", () => {
    expect(shouldArchiveTopic("  給食は必要か  ", "給食は必要か")).toBe(false);
  });

  it("archives when the theme text differs", () => {
    expect(shouldArchiveTopic("給食は必要か", "制服は必要か")).toBe(true);
  });

  it("does not archive an empty theme", () => {
    expect(shouldArchiveTopic("給食は必要か", "   ")).toBe(false);
  });
});

describe("live and archived messages", () => {
  const messages = [
    {
      id: "m1",
      topic_id: previous,
      content: "前の賛成",
      created_at: "2026-09-01T00:00:00.000Z",
    },
    {
      id: "m2",
      topic_id: current,
      content: "いまの反対",
      created_at: "2026-09-02T00:00:00.000Z",
    },
  ];

  it("keeps only the current topic in the live chat", () => {
    expect(liveTopicMessages(messages, current).map((m) => m.id)).toEqual([
      "m2",
    ]);
  });

  it("labels the previous topic with its own theme and keeps message content", () => {
    const sections = archivedTopicSections(
      [
        { id: previous, theme: "給食は必要か", ordinal: 1 },
        { id: current, theme: "制服は必要か", ordinal: 2 },
      ],
      messages,
      current,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0]?.theme).toBe("給食は必要か");
    expect(sections[0]?.messages.map((m) => m.content)).toEqual(["前の賛成"]);
  });

  it("lists newer previous topics first", () => {
    const sections = archivedTopicSections(
      [
        { id: "t1", theme: "最初", ordinal: 1 },
        { id: "t2", theme: "途中", ordinal: 2 },
        { id: current, theme: "いま", ordinal: 3 },
      ],
      [],
      current,
    );
    expect(sections.map((s) => s.theme)).toEqual(["途中", "最初"]);
  });
});

describe("countSideSpeakers", () => {
  it("counts distinct speakers on the current topic only", () => {
    const all = [
      {
        user_id: "a",
        stance: "pro" as const,
        deleted_at: null,
        created_at: "2026-09-01T00:00:00.000Z",
        topic_id: previous,
      },
      {
        user_id: "b",
        stance: "con" as const,
        deleted_at: null,
        created_at: "2026-09-01T00:01:00.000Z",
        topic_id: previous,
      },
      {
        user_id: "a",
        stance: "con" as const,
        deleted_at: null,
        created_at: "2026-09-02T00:00:00.000Z",
        topic_id: current,
      },
    ];
    const live = liveTopicMessages(all, current);
    expect(countSideSpeakers(live)).toEqual({ pro: 0, con: 1 });
  });

  it("uses each person's latest pro/con post and skips chair and deleted posts", () => {
    expect(
      countSideSpeakers([
        {
          user_id: "a",
          stance: "pro",
          deleted_at: null,
          created_at: "2026-09-02T00:00:00.000Z",
        },
        {
          user_id: "a",
          stance: "con",
          deleted_at: null,
          created_at: "2026-09-02T00:05:00.000Z",
        },
        {
          user_id: "b",
          stance: "pro",
          deleted_at: "2026-09-02T00:06:00.000Z",
          created_at: "2026-09-02T00:04:00.000Z",
        },
        {
          user_id: "chair",
          stance: "chair",
          deleted_at: null,
          created_at: "2026-09-02T00:07:00.000Z",
        },
      ]),
    ).toEqual({ pro: 0, con: 1 });
  });

  it("is empty when the live topic has no posts", () => {
    expect(countSideSpeakers([])).toEqual({ pro: 0, con: 0 });
  });
});
