import { describe, it, expect } from "bun:test";
import { mapGeminiLiveMessage } from "./gemini-live-message-mapper";

describe("gemini-live-message-mapper", () => {
  it("maps setupComplete payload to [setup_complete]", () => {
    const raw = JSON.stringify({ setupComplete: {} });
    const events = mapGeminiLiveMessage(raw);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "setup_complete" });
  });

  it("maps sessionResumptionUpdate payload to [session_resumption_update]", () => {
    const raw = JSON.stringify({
      sessionResumptionUpdate: { resumable: true, newHandle: "handle_xyz123" },
    });
    const events = mapGeminiLiveMessage(raw);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "session_resumption_update",
      resumable: true,
      resumptionHandle: "handle_xyz123",
    });
  });

  it("maps goAway payload to [go_away]", () => {
    const raw = JSON.stringify({ goAway: { timeLeft: "2.5s" } });
    const events = mapGeminiLiveMessage(raw);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "go_away",
      timeLeft: 2500,
    });
  });

  it("maps top-level toolCall to [tool_call]", () => {
    const raw = JSON.stringify({
      toolCall: {
        functionCalls: [
          { id: "call_1", name: "end_exam", args: { closingRemarks: "Bye" } },
        ],
      },
    });
    const events = mapGeminiLiveMessage(raw);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "tool_call",
      calls: [
        { id: "call_1", name: "end_exam", args: { closingRemarks: "Bye" } },
      ],
    });
  });

  it("maps serverContent audio parts, transcriptions, interrupted, and turnComplete", () => {
    const raw = JSON.stringify({
      serverContent: {
        interrupted: true,
        turnComplete: true,
        modelTurn: {
          parts: [
            {
              inlineData: {
                mimeType: "audio/pcm;rate=24000",
                data: "UEMxMjM=",
              },
            },
          ],
        },
        outputTranscription: { text: "Hello candidate." },
        inputTranscription: { text: "Hello Dr. Harrison." },
      },
    });

    const events = mapGeminiLiveMessage(raw);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "server_content",
      interrupted: true,
      turnComplete: true,
      modelTurnAudioParts: [
        { mimeType: "audio/pcm;rate=24000", data: "UEMxMjM=" },
      ],
      outputTranscription: "Hello candidate.",
      inputTranscription: "Hello Dr. Harrison.",
    });
  });

  it("returns array with tool_call first and server_content second when tool call is embedded in serverContent", () => {
    const raw = JSON.stringify({
      serverContent: {
        toolCall: {
          functionCalls: [
            { id: "call_part2", name: "display_cue_card", args: {} },
          ],
        },
        turnComplete: true,
        outputTranscription: { text: "Here is your cue card." },
      },
    });

    const events = mapGeminiLiveMessage(raw);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      type: "tool_call",
      calls: [{ id: "call_part2", name: "display_cue_card", args: {} }],
    });
    expect(events[1]).toEqual({
      type: "server_content",
      interrupted: undefined,
      turnComplete: true,
      modelTurnAudioParts: undefined,
      outputTranscription: "Here is your cue card.",
      inputTranscription: undefined,
    });
  });

  it("maps empty or unknown JSON to [unknown]", () => {
    expect(mapGeminiLiveMessage("{}")).toEqual([{ type: "unknown" }]);
    expect(mapGeminiLiveMessage("invalid json")).toEqual([{ type: "unknown" }]);
    expect(mapGeminiLiveMessage("")).toEqual([{ type: "unknown" }]);
    expect(mapGeminiLiveMessage(null as unknown as string)).toEqual([
      { type: "unknown" },
    ]);
  });
});
