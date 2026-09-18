/**
 * Infrastructure protocol event union for Gemini Live WebSocket communication.
 * Internal to Infrastructure only — MUST NOT be imported by Application or Presentation layers.
 */
export type GeminiLiveProtocolEvent =
  | { type: "setup_complete" }
  | {
      type: "server_content";
      interrupted?: boolean;
      turnComplete?: boolean;
      modelTurnAudioParts?: Array<{ mimeType: string; data: string }>;
      outputTranscription?: string;
      inputTranscription?: string;
    }
  | {
      type: "tool_call";
      calls: Array<{
        id?: string;
        name: string;
        args?: Record<string, unknown>;
      }>;
    }
  | {
      type: "session_resumption_update";
      resumptionHandle: string;
      resumable: boolean;
    }
  | { type: "go_away"; timeLeft?: number }
  | { type: "unknown" };

interface RawGeminiWireMessage {
  setupComplete?: Record<string, unknown>;
  toolCall?: {
    functionCalls?: Array<{
      id?: string;
      name: string;
      args?: Record<string, unknown>;
    }>;
  };
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    toolCall?: {
      functionCalls?: Array<{
        id?: string;
        name: string;
        args?: Record<string, unknown>;
      }>;
    };
    modelTurn?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
        text?: string;
      }>;
    };
    outputTranscription?: { text?: string };
    inputTranscription?: { text?: string };
  };
  goAway?: Record<string, unknown>;
  sessionResumptionUpdate?: {
    resumable?: boolean;
    newHandle?: string;
    resumptionHandle?: string;
  };
}

/**
 * Pure protocol parser mapping raw Gemini Live WebSocket JSON string to GeminiLiveProtocolEvent[].
 *
 * Array return invariant:
 * A single raw payload may produce multiple protocol events (e.g., embedded tool call + server content).
 * Preserves current dispatch order: tool calls are processed first, followed by server content.
 */
export function mapGeminiLiveMessage(
  rawJson: string
): GeminiLiveProtocolEvent[] {
  if (!rawJson || typeof rawJson !== "string") {
    return [{ type: "unknown" }];
  }

  let obj: RawGeminiWireMessage;
  try {
    obj = JSON.parse(rawJson) as RawGeminiWireMessage;
  } catch {
    return [{ type: "unknown" }];
  }

  if (typeof obj !== "object" || obj === null) {
    return [{ type: "unknown" }];
  }

  const events: GeminiLiveProtocolEvent[] = [];

  // 1. Setup complete
  if (obj.setupComplete) {
    events.push({ type: "setup_complete" });
  }

  // 2. Session resumption update
  if (obj.sessionResumptionUpdate) {
    const handle =
      obj.sessionResumptionUpdate.newHandle ||
      obj.sessionResumptionUpdate.resumptionHandle;
    if (handle || obj.sessionResumptionUpdate.resumable === false) {
      events.push({
        type: "session_resumption_update",
        resumptionHandle: handle || "",
        resumable: obj.sessionResumptionUpdate.resumable === true,
      });
    }
  }

  // 3. GoAway signal
  if (obj.goAway) {
    events.push({
      type: "go_away",
      timeLeft:
        typeof obj.goAway.timeLeft === "string"
          ? Number.parseFloat(obj.goAway.timeLeft) * 1000
          : undefined,
    });
  }

  // 4. Tool calls (top-level or embedded in serverContent)
  const toolCalls =
    obj.toolCall?.functionCalls || obj.serverContent?.toolCall?.functionCalls;
  if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
    events.push({
      type: "tool_call",
      calls: toolCalls.map((c) => ({
        id: c.id,
        name: c.name,
        args: c.args,
      })),
    });
  }

  // 5. Server content (audio, transcription, interrupted, turnComplete)
  if (obj.serverContent) {
    const sc = obj.serverContent;

    const audioParts: Array<{ mimeType: string; data: string }> = [];
    if (sc.modelTurn?.parts && Array.isArray(sc.modelTurn.parts)) {
      for (const part of sc.modelTurn.parts) {
        if (part.inlineData?.data) {
          audioParts.push({
            mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
            data: part.inlineData.data,
          });
        }
      }
    }

    const hasInterrupted = Boolean(sc.interrupted);
    const hasTurnComplete = Boolean(sc.turnComplete);
    const outputText = sc.outputTranscription?.text;
    const inputText = sc.inputTranscription?.text;
    const hasAudio = audioParts.length > 0;

    // Only emit server_content if it contains meaningful data or lifecycle flags
    if (
      hasInterrupted ||
      hasTurnComplete ||
      hasAudio ||
      outputText !== undefined ||
      inputText !== undefined
    ) {
      events.push({
        type: "server_content",
        interrupted: sc.interrupted,
        turnComplete: sc.turnComplete,
        modelTurnAudioParts: hasAudio ? audioParts : undefined,
        outputTranscription: outputText,
        inputTranscription: inputText,
      });
    }
  }

  if (events.length === 0) {
    return [{ type: "unknown" }];
  }

  return events;
}
