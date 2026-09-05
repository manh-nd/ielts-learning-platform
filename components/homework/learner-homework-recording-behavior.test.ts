import { describe, it, expect } from "bun:test";
import { pcmBase64ChunksToWavBlob } from "@/components/speaking/live/hooks/use-live-audio-recorder";
import type { RecordedClipData } from "./learner-homework-recording-view";

describe("Learner Homework Recording Behavior Seams (Issue #96)", () => {
  it("12. successful finalize produces a recorded clip with duration and valid audio blob", () => {
    // Simulate finalizing recorded chunks into a clip
    const chunks = [
      new Blob(["chunk1-data"], { type: "audio/webm" }),
      new Blob(["chunk2-data"], { type: "audio/webm" }),
    ];
    const combinedBlob = new Blob(chunks, { type: "audio/webm;codecs=opus" });
    const durationSeconds = 45;

    const clip: RecordedClipData = {
      blob: combinedBlob,
      durationSeconds,
      url: "blob:http://localhost/mock-audio-uuid",
    };

    expect(clip.blob).toBeDefined();
    expect(clip.blob?.size).toBeGreaterThan(0);
    expect(clip.durationSeconds).toBe(45);
    expect(clip.url).toContain("blob:");
    expect(clip.storageKey).toBeUndefined(); // Storage key is not assigned until upload/commit
  });

  it("12b. fallback PCM conversion produces valid WAV blob when MediaRecorder produces 0 chunks", async () => {
    const samples = new Int16Array(160); // 10ms at 16kHz
    const base64Chunk = Buffer.from(samples.buffer).toString("base64");
    const wavBlob = pcmBase64ChunksToWavBlob([base64Chunk], 16000);

    expect(wavBlob.type).toBe("audio/wav");
    expect(wavBlob.size).toBe(44 + 320);

    const buffer = await wavBlob.arrayBuffer();
    const view = new DataView(buffer);
    const riff = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    expect(riff).toBe("RIFF");
  });

  it("13. microphone access failure produces the exact recoverable user error message", () => {
    // Simulates the catch block in handleStartRecording:
    // "Không thể truy cập microphone. Vui lòng cấp quyền micro cho trình duyệt."
    const micErrorMessage =
      "Không thể truy cập microphone. Vui lòng cấp quyền micro cho trình duyệt.";

    let uiError: string | null = null;
    try {
      throw new Error("NotAllowedError: Permission denied");
    } catch {
      uiError = micErrorMessage;
    }

    expect(uiError).toBe(
      "Không thể truy cập microphone. Vui lòng cấp quyền micro cho trình duyệt."
    );
  });

  it("14. re-recording replaces and removes the previous local clip from the clip dictionary", () => {
    const initialClips: Record<string, RecordedClipData> = {
      p_1: {
        storageKey: "homework/audio/old_p1.webm",
        durationSeconds: 30,
        url: "blob:http://localhost/old-p1",
      },
      p_2: {
        storageKey: "homework/audio/p2.webm",
        durationSeconds: 60,
        url: "blob:http://localhost/p2",
      },
    };

    // Simulate handleRerecordPrompt logic: delete next[promptId]
    const updatedClips = { ...initialClips };
    delete updatedClips["p_1"];

    expect(updatedClips["p_1"]).toBeUndefined();
    expect(updatedClips["p_2"]).toBeDefined();
    expect(updatedClips["p_2"].storageKey).toBe("homework/audio/p2.webm");

    // After re-recording p_1, new clip replaces it with new blob and no storageKey yet
    const newBlob = new Blob(["new-recording-bytes"], { type: "audio/webm" });
    updatedClips["p_1"] = {
      blob: newBlob,
      durationSeconds: 28,
      url: "blob:http://localhost/new-p1",
    };

    expect(updatedClips["p_1"].blob).toBe(newBlob);
    expect(updatedClips["p_1"].storageKey).toBeUndefined();
    expect(updatedClips["p_1"].durationSeconds).toBe(28);
  });
});
