import { describe, expect, it } from "vitest";
import {
  profileSelectColumns,
  toPublicChatProfile,
} from "./identity";

const row = {
  id: "u1",
  nickname: "タロ",
  role: "user" as const,
  room_id: "r1",
  name: "田中太郎",
  login_id: "student001",
};

describe("toPublicChatProfile", () => {
  it("omits real name and student id when 実名表示 is off", () => {
    const pub = toPublicChatProfile(row, false);
    expect(pub.nickname).toBe("タロ");
    expect(pub.name).toBeUndefined();
    expect(pub.login_id).toBeUndefined();
    expect("name" in pub).toBe(false);
  });

  it("keeps real name when 実名表示 is on", () => {
    const pub = toPublicChatProfile(row, true);
    expect(pub.name).toBe("田中太郎");
    expect(pub.login_id).toBe("student001");
  });
});

describe("profileSelectColumns", () => {
  it("does not request name/login_id when hidden", () => {
    expect(profileSelectColumns(false).split(", ").includes("name")).toBe(
      false,
    );
    expect(profileSelectColumns(false).split(", ").includes("login_id")).toBe(
      false,
    );
  });

  it("requests name when revealed", () => {
    expect(profileSelectColumns(true)).toMatch(/name/);
  });
});
