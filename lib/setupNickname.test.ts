import { describe, expect, it } from "vitest";
import { initialSetupNickname } from "./setupNickname";

describe("initialSetupNickname", () => {
  it("leaves the first-entry field blank when the stored nickname is the student id", () => {
    expect(
      initialSetupNickname({
        nickname: "2417022",
        has_set_nickname: false,
      }),
    ).toBe("");
  });

  it("does not prefill a real name or login_id before the student saves a nickname", () => {
    expect(
      initialSetupNickname({
        nickname: "山田太郎",
        has_set_nickname: false,
      }),
    ).toBe("");
    expect(
      initialSetupNickname({
        nickname: "student001",
        has_set_nickname: false,
      }),
    ).toBe("");
  });

  it("keeps a nickname the student already saved", () => {
    expect(
      initialSetupNickname({
        nickname: "パンダ1234",
        has_set_nickname: true,
      }),
    ).toBe("パンダ1234");
  });

  it("keeps a saved nickname even when it matches a student id", () => {
    expect(
      initialSetupNickname({
        nickname: "2417022",
        has_set_nickname: true,
      }),
    ).toBe("2417022");
  });
});
