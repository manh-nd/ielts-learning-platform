import { GoogleGenAI } from "@google/genai";

interface KeyState {
  key: string;
  client: GoogleGenAI;
  cooldownUntil: number;
  consecutiveFailures: number;
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
        },
      ];
    } else {
      this.keyStates = keys.map((key) => ({
        key,
        client: new GoogleGenAI({ apiKey: key }),
        cooldownUntil: 0,
        consecutiveFailures: 0,
      }));
    }
  }

  public getNextClient(): { client: GoogleGenAI; key: string } {
    const now = Date.now();
    const availableKeys = this.keyStates.filter((k) => k.cooldownUntil <= now);

    if (availableKeys.length === 0) {
      const nearest = [...this.keyStates].sort(
        (a, b) => a.cooldownUntil - b.cooldownUntil
      )[0];
      return { client: nearest.client, key: nearest.key };
    }

    this.currentIndex = (this.currentIndex + 1) % availableKeys.length;
    const selected = availableKeys[this.currentIndex];
    return { client: selected.client, key: selected.key };
  }

  public markRateLimited(key: string, isDailyLimit = false) {
    const state = this.keyStates.find((k) => k.key === key);
    if (!state) return;

    state.consecutiveFailures += 1;
    const cooldownMs = isDailyLimit ? 60 * 60 * 1000 : 60 * 1000;
    state.cooldownUntil = Date.now() + cooldownMs;
    console.warn(
      `[GeminiKeyRotator] Key ...${key.slice(-6)} rate limited. Cooldown for ${cooldownMs / 1000}s`
    );
  }

  public async executeWithRotation<T>(
    fn: (client: GoogleGenAI, key: string) => Promise<T>,
    maxRetries = this.keyStates.length
  ): Promise<T> {
    let attempts = 0;
    let lastError: unknown = null;

    while (attempts < maxRetries) {
      attempts++;
      const { client, key } = this.getNextClient();

      try {
        const result = await fn(client, key);
        const state = this.keyStates.find((k) => k.key === key);
        if (state) state.consecutiveFailures = 0;
        return result;
      } catch (error: unknown) {
        lastError = error;
        const errorMessage = String((error as Error)?.message || error);
        const is429 =
          errorMessage.includes("429") ||
          errorMessage.includes("RESOURCE_EXHAUSTED");

        if (is429) {
          const isDaily =
            errorMessage.includes("PerDay") ||
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
