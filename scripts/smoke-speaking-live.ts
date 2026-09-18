/** Explicit opt-in; no credential rotation and no audio/transcript logging. */
import { GoogleGenAI, Modality } from "@google/genai";
import assert from "node:assert/strict";
if (process.env.RUN_GEMINI_LIVE_SMOKE !== "true")
  throw new Error(
    "Set RUN_GEMINI_LIVE_SMOKE=true to explicitly enable provider traffic."
  );
const key = process.env.GEMINI_BETA_API_KEY;
if (!key) throw new Error("GEMINI_BETA_API_KEY is required.");
const ai = new GoogleGenAI({
  apiKey: key,
  httpOptions: { apiVersion: "v1beta" },
});
const model = "gemini-3.8-live";
const token = await ai.authTokens.create({
  config: {
    uses: 1,
    expireTime: new Date(Date.now() + 30 * 60000).toISOString(),
    liveConnectConstraints: {
      model,
      config: { responseModalities: [Modality.AUDIO] },
    },
  },
});
assert.ok(token.name);
const browser = new GoogleGenAI({
  apiKey: token.name,
  httpOptions: { apiVersion: "v1beta" },
});
let handle: string | undefined;
let audio = 0;
let transcript = 0;
let session: Awaited<ReturnType<typeof browser.live.connect>> | undefined;
let failure: Error | undefined;
let reconnectRequested = false;
async function connect(resume = false) {
  session = await browser.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      sessionResumption: resume ? { handle } : {},
      contextWindowCompression: { slidingWindow: {} },
    },
    callbacks: {
      onmessage(message) {
        if (message.goAway) reconnectRequested = true;
        if (
          message.sessionResumptionUpdate?.resumable &&
          message.sessionResumptionUpdate.newHandle
        )
          handle = message.sessionResumptionUpdate.newHandle;
        if (message.serverContent?.modelTurn?.parts?.some((p) => p.inlineData))
          audio++;
        if (message.serverContent?.outputTranscription?.text) transcript++;
      },
      onerror() {
        failure = new Error("Live provider connection failed");
      },
    },
  });
}
try {
  await connect();
  session!.sendRealtimeInput({ text: "Say hello to the learner, then wait." });
  const deadline = Date.now() + 30000;
  while (
    (!audio || !transcript || !handle) &&
    Date.now() < deadline &&
    !failure
  )
    await Bun.sleep(100);
  if (failure) throw failure;
  assert.ok(
    audio > 0 && transcript > 0 && handle,
    "Expected audio, transcription and resumable handle"
  );
  session!.close();
  await connect(true);
  const before = audio;
  session!.sendRealtimeInput({ text: "Say we have reconnected." });
  const resumedDeadline = Date.now() + 30000;
  while (audio === before && Date.now() < resumedDeadline && !failure)
    await Bun.sleep(100);
  if (failure) throw failure;
  assert.ok(audio > before, "Resumed connection must produce audio");
  const soakMs = Number(process.env.GEMINI_LIVE_SOAK_MS || 0);
  if (soakMs) {
    assert.ok(
      Number.isFinite(soakMs) && soakMs >= 660000 && soakMs <= 1200000,
      "Soak duration must be between 11 and 20 minutes"
    );
    const until = Date.now() + soakMs;
    let nextPrompt = Date.now();
    while (Date.now() < until) {
      if (failure) throw failure;
      if (reconnectRequested) {
        reconnectRequested = false;
        session!.close();
        await connect(true);
      }
      if (Date.now() >= nextPrompt) {
        session!.sendRealtimeInput({ text: "Say ready, then wait." });
        nextPrompt = Date.now() + 30000;
      }
      await Bun.sleep(100);
    }
    console.log("Gemini Live connection-duration soak: PASS");
  }
  console.log("Gemini Live handshake/audio/transcription/resumption: PASS");
} finally {
  session?.close();
}
