import { GoogleGenAI } from "@google/genai";

interface KeyState {
  key: string;
  client: GoogleGenAI;
  cooldownUntil: number;
  consecutiveFailures: number;
  isDailyExhausted: boolean;
}

export function maskKeyFingerprint(key: string): string {
  if (!key || key.startsWith("DEV_") || key.length < 8) {
    return "key_***dev";
  }
  return `key_***${key.slice(-4)}`;
}

export class GeminiKeyRotator {
  private keyStates: KeyState[] = [];
  private currentIndex = 0;

  constructor(rawKeys?: string) {
    const keys = (
      rawKeys ||
      process.env.GEMINI_API_KEYS ||
      process.env.GEMINI_API_KEY ||
      ""
    )
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (keys.length === 0) {
      // Fallback for development/testing when env var is not yet configured
      this.keyStates = [
        {
          key: "DEV_PLACEHOLDER_KEY",
          client: new GoogleGenAI({ apiKey: "DEV_PLACEHOLDER_KEY" }),
          cooldownUntil: 0,
          consecutiveFailures: 0,
          isDailyExhausted: false,
        },
      ];
    } else {
      this.keyStates = keys.map((key) => ({
        key,
        client: new GoogleGenAI({ apiKey: key }),
        cooldownUntil: 0,
        consecutiveFailures: 0,
        isDailyExhausted: false,
      }));
    }
  }

  public get totalKeys(): number {
    return this.keyStates.length;
  }

  public getNextClient(): {
    client: GoogleGenAI;
    key: string;
    keyFingerprint: string;
  } {
    const now = Date.now();
    const availableKeys = this.keyStates.filter(
      (k) => k.cooldownUntil <= now && !k.isDailyExhausted
    );

    if (availableKeys.length === 0) {
      // Fallback to nearest expiring key if none immediately available
      const nearest = [...this.keyStates].sort(
        (a, b) => a.cooldownUntil - b.cooldownUntil
      )[0];
      return {
        client: nearest.client,
        key: nearest.key,
        keyFingerprint: maskKeyFingerprint(nearest.key),
      };
    }

    this.currentIndex = (this.currentIndex + 1) % availableKeys.length;
    const selected = availableKeys[this.currentIndex];
    return {
      client: selected.client,
      key: selected.key,
      keyFingerprint: maskKeyFingerprint(selected.key),
    };
  }

  public markRateLimited(key: string, isDailyLimit = false) {
    const state = this.keyStates.find((k) => k.key === key);
    if (!state) return;

    state.consecutiveFailures += 1;
    if (isDailyLimit) {
      state.isDailyExhausted = true;
      // 24 hours daily exhaustion
      state.cooldownUntil = Date.now() + 24 * 60 * 60 * 1000;
      console.warn(
        `[GeminiKeyRotator] Key ${maskKeyFingerprint(key)} daily quota exhausted (RPD). Marked daily-exhausted.`
      );
    } else {
      // 60 seconds RPM cooldown
      const cooldownMs = 60 * 1000;
      state.cooldownUntil = Date.now() + cooldownMs;
      console.warn(
        `[GeminiKeyRotator] Key ${maskKeyFingerprint(key)} rate limited (RPM). Cooldown for 60s.`
      );
    }
  }

  public areAllKeysDailyExhausted(): boolean {
    return (
      this.keyStates.length > 0 &&
      this.keyStates.every(
        (k) =>
          k.isDailyExhausted || k.cooldownUntil > Date.now() + 5 * 60 * 1000
      )
    );
  }

  public resetKeyStates() {
    this.currentIndex = 0;
    for (const state of this.keyStates) {
      state.cooldownUntil = 0;
      state.consecutiveFailures = 0;
      state.isDailyExhausted = false;
    }
  }

  public async executeWithRotation<T>(
    fn: (
      client: GoogleGenAI,
      key: string,
      keyFingerprint: string
    ) => Promise<T>,
    maxRetries = this.keyStates.length
  ): Promise<T> {
    let attempts = 0;
    let lastError: unknown = null;

    while (attempts < maxRetries) {
      attempts++;
      const { client, key, keyFingerprint } = this.getNextClient();

      try {
        const result = await fn(client, key, keyFingerprint);
        const state = this.keyStates.find((k) => k.key === key);
        if (state) state.consecutiveFailures = 0;
        return result;
      } catch (error: unknown) {
        lastError = error;
        const errorMessage = String((error as Error)?.message || error);
        const is429 =
          errorMessage.includes("429") ||
          errorMessage.includes("RESOURCE_EXHAUSTED") ||
          errorMessage.includes("quota");

        if (is429) {
          const isDaily =
            errorMessage.includes("PerDay") ||
            errorMessage.includes("daily") ||
            errorMessage.includes("quota exceeded");
          this.markRateLimited(key, isDaily);
          console.warn(
            `[GeminiKeyRotator] Rotating to next key (Attempt ${attempts}/${maxRetries})...`
          );
          continue;
        }

        throw error;
      }
    }

    throw new Error(
      `All API keys in pool exhausted. Last error: ${String(lastError)}`
    );
  }
}

export const geminiRotator = new GeminiKeyRotator();
