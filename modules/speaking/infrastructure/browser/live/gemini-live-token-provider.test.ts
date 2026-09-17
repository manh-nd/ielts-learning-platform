import { describe, it, expect } from "bun:test";
import { DefaultGeminiLiveTokenProvider } from "./gemini-live-token-provider";

describe("gemini-live-token-provider", () => {
  it("fetches token successfully and returns GeminiLiveTokenDto", async () => {
    const mockFetch = async (
      _input: string | URL | Request,
      _init?: RequestInit
    ) => {
      return new Response(
        JSON.stringify({
          token: "ephemeral_token_abc123",
          model: "gemini-3.8-live",
          expiresAt: "2026-09-17T22:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const provider = new DefaultGeminiLiveTokenProvider(
      "/api/speaking/live-token",
      mockFetch
    );
    const dto = await provider.fetchToken();

    expect(dto.token).toBe("ephemeral_token_abc123");
    expect(dto.model).toBe("gemini-3.8-live");
    expect(dto.expiresAt).toBe("2026-09-17T22:00:00.000Z");
  });

  it("throws informative error when token endpoint returns non-200 status", async () => {
    const mockFetch = async () => {
      return new Response(
        JSON.stringify({ message: "Unauthorized learner access" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    };

    const provider = new DefaultGeminiLiveTokenProvider(
      "/api/speaking/live-token",
      mockFetch
    );

    await expect(provider.fetchToken()).rejects.toThrow(
      "Failed to obtain live token (401): Unauthorized learner access"
    );
  });

  it("throws error when response missing token field", async () => {
    const mockFetch = async () => {
      return new Response(JSON.stringify({ model: "gemini-3.8-live" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const provider = new DefaultGeminiLiveTokenProvider(
      "/api/speaking/live-token",
      mockFetch
    );

    await expect(provider.fetchToken()).rejects.toThrow(
      "Invalid live token response: missing token string."
    );
  });
});
