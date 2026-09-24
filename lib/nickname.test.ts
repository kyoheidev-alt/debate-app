import { describe, expect, it } from "vitest";
import {
  NICKNAME_GUIDANCE,
  NICKNAME_MAX_LENGTH,
  chatAuthorLabel,
  nicknameUpdateFilter,
  profileIdFromNicknameBroadcast,
  upsertPublicChatProfile,
  validateNickname,
} from "./nickname";

describe("validateNickname", () => {
  it("trims and accepts a name within 20 characters", () => {
    expect(validateNickname("  パンダ1234  ")).toEqual({
      ok: true,
      nickname: "パンダ1234",
    });
    expect(validateNickname("あ".repeat(NICKNAME_MAX_LENGTH))).toEqual({
      ok: true,
      nickname: "あ".repeat(20),
    });
  });

  it("rejects an empty name", () => {
    expect(validateNickname("   ")).toEqual({
      ok: false,
      error: "ニックネームを入力してください。",
    });
  });

  it("rejects a name longer than 20 characters", () => {
    const result = validateNickname("あ".repeat(21));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("20");
    }
  });
});

describe("nicknameUpdateFilter", () => {
  it("writes only the signed-in user's row", () => {
    expect(nicknameUpdateFilter("student-me")).toEqual({ id: "student-me" });
  });

  it("does not accept a missing actor", () => {
    expect(() => nicknameUpdateFilter("")).toThrow(/ログイン/);
  });
});

describe("mid-debate nickname display", () => {
  const profiles = {
    a: {
      id: "a",
      nickname: "旧名",
      role: "user" as const,
      room_id: "room-1",
    },
    b: {
      id: "b",
      nickname: "ビー",
      role: "user" as const,
      room_id: "room-1",
    },
  };

  it("relabels that person's existing messages from the current profile", () => {
    const messageUserId = "a" as const;
    expect(chatAuthorLabel(profiles[messageUserId], false)).toBe("旧名");

    const next = upsertPublicChatProfile(
      profiles,
      {
        id: "a",
        nickname: "新名",
        role: "user",
        room_id: "room-1",
        name: "山田太郎",
        login_id: "2417022",
      },
      false,
    );

    expect(chatAuthorLabel(next[messageUserId], false)).toBe("新名");
    expect(next.b.nickname).toBe("ビー");
    expect(next.a.name).toBeUndefined();
    expect(next.a.login_id).toBeUndefined();
  });

  it("keeps the chair's 実名表示 behavior", () => {
    const next = upsertPublicChatProfile(
      profiles,
      {
        id: "a",
        nickname: "新名",
        role: "user",
        room_id: "room-1",
        name: "山田太郎",
        login_id: "2417022",
      },
      true,
    );
    expect(chatAuthorLabel(next.a, true)).toBe("山田太郎");
    expect(next.a.login_id).toBe("2417022");
  });

  it("ignores a nickname stuffed into the realtime payload", () => {
    const userId = profileIdFromNicknameBroadcast({
      user_id: "a",
      nickname: "なりすまし",
    });
    expect(userId).toBe("a");

    const next = upsertPublicChatProfile(
      profiles,
      {
        id: userId!,
        nickname: profiles.a.nickname,
        role: "user",
        room_id: "room-1",
      },
      false,
    );
    expect(chatAuthorLabel(next.a, false)).toBe("旧名");
  });

  it("does not store a real name when 実名表示 is off, even if the row has one", () => {
    const next = upsertPublicChatProfile(
      profiles,
      { ...profiles.a, name: "山田太郎", login_id: "2417022" },
      false,
    );
    expect(next).toBe(profiles);
    expect(next.a.name).toBeUndefined();
  });
});

describe("nickname guidance", () => {
  it("tells students not to use a real name or student id", () => {
    expect(NICKNAME_GUIDANCE).toContain("本名や学籍番号は使わない");
  });
});
