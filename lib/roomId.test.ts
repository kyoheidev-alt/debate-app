import { describe, expect, it } from "vitest";
import { extractRoomId } from "./roomId";

const ID = "11111111-2222-3333-4444-555555555555";

describe("extractRoomId", () => {
  it("accepts a bare UUID", () => {
    expect(extractRoomId(ID)).toBe(ID);
  });

  it("normalizes uppercase and surrounding whitespace", () => {
    expect(extractRoomId(`  ${ID.toUpperCase()}  `)).toBe(ID);
  });

  it("extracts the id from an invite URL", () => {
    expect(
      extractRoomId(`https://debate-app-pi.vercel.app/r/${ID}/enter`),
    ).toBe(ID);
  });

  it("extracts the id from a Teams-style pasted sentence", () => {
    expect(
      extractRoomId(`入室はこちら https://example.com/r/${ID}/enter です`),
    ).toBe(ID);
  });

  it("rejects empty or non-id input", () => {
    expect(extractRoomId("")).toBeNull();
    expect(extractRoomId("abc")).toBeNull();
    expect(extractRoomId("ルームID")).toBeNull();
  });
});
