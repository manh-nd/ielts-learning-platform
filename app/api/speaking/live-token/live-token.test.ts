import { describe, it, expect } from "bun:test";
import { buildLiveTokenPayload } from "./route";

describe("Live Token API (Ephemeral Token)", () => {
  it("should build auth token payload with valid expireTime and uses for Gemini v1alpha", () => {
    const expireTime = "2026-08-27T20:00:00.000Z";
    const payload = buildLiveTokenPayload(expireTime, 3);

    expect(payload.expireTime).toBe(expireTime);
    expect(payload.uses).toBe(3);
  });
});
