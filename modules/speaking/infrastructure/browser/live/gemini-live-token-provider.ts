/**
 * Infrastructure DTO representing the ephemeral token response for Gemini Live sessions.
 * Owned by Infrastructure — MUST NOT be imported from app/api/** route handler files.
 */
export interface GeminiLiveTokenDto {
  token: string;
  model: string;
  expiresAt: string;
}

/**
 * Interface for obtaining live session ephemeral tokens.
 */
export interface GeminiLiveTokenProvider {
  fetchToken(): Promise<GeminiLiveTokenDto>;
}

export type FetchFunction = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

/**
 * Default browser implementation of GeminiLiveTokenProvider calling the live token endpoint.
 */
export class DefaultGeminiLiveTokenProvider implements GeminiLiveTokenProvider {
  private tokenEndpoint: string;
  private fetchImpl: FetchFunction;

  constructor(
    tokenEndpoint = "/api/speaking/live-token",
    customFetch?: FetchFunction
  ) {
    this.tokenEndpoint = tokenEndpoint;
    this.fetchImpl =
      customFetch ||
      ((input, init) => {
        if (typeof fetch === "undefined") {
          throw new Error("Global fetch is not available in this environment.");
        }
        return fetch(input, init);
      });
  }

  async fetchToken(): Promise<GeminiLiveTokenDto> {
    const res = await this.fetchImpl(this.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      let errorDetail = res.statusText;
      try {
        const body = await res.json();
        if (body && typeof body === "object" && body.message) {
          errorDetail = String(body.message);
        }
      } catch {
        // Ignored fallback
      }
      throw new Error(
        `Failed to obtain live token (${res.status}): ${errorDetail}`
      );
    }

    const data = (await res.json()) as Partial<GeminiLiveTokenDto>;
    if (!data || !data.token) {
      throw new Error("Invalid live token response: missing token string.");
    }

    return {
      token: data.token,
      model: data.model || "gemini-3.8-live",
      expiresAt:
        data.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }
}
