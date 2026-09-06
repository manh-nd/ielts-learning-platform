import { describe, it, expect } from "bun:test";
import {
  ConversationReplayRecorder,
  LearnerAudioTimelineStream,
  upsample16kTo24k,
} from "./conversation-replay-recorder";

describe("ConversationReplayRecorder Unit Tests", () => {
  describe("16k -> 24k Mathematical Linear Upsampler", () => {
    it("should upsample 16kHz sine wave to 24kHz with exact 3:2 sample count ratio", () => {
      const numSamples16k = 1600; // 0.1s of 16kHz
      const input16k = new Int16Array(numSamples16k);
      for (let i = 0; i < numSamples16k; i++) {
        input16k[i] = Math.round(
          10000 * Math.sin((2 * Math.PI * 440 * i) / 16000)
        );
      }

      const output24k = upsample16kTo24k(input16k);
      const expected24kSamples = Math.round((numSamples16k * 3) / 2); // 2400 samples

      expect(output24k.length).toBe(expected24kSamples);
      expect(output24k.length).toBe(2400);

      // Verify boundary samples
      expect(output24k[0]).toBe(input16k[0]);
    });

    it("should produce identical output for one continuous buffer vs arbitrary chunk concatenation", () => {
      const total16kSamples = 3200; // 0.2s of 16kHz
      const fullInput16k = new Int16Array(total16kSamples);
      for (let i = 0; i < total16kSamples; i++) {
        fullInput16k[i] = Math.round(
          15000 * Math.sin((2 * Math.PI * 300 * i) / 16000)
        );
      }

      // Upsample full block directly
      const singleBlockOutput = upsample16kTo24k(fullInput16k);

      // Simulate chunked arrival and concatenation into continuous buffer
      const chunkSizes = [73, 512, 1024, 300, 800, 491];
      const concatenated16k = new Int16Array(total16kSamples);
      let offset = 0;
      for (const size of chunkSizes) {
        const chunk = fullInput16k.subarray(offset, offset + size);
        concatenated16k.set(chunk, offset);
        offset += size;
      }

      const chunkedOutput = upsample16kTo24k(concatenated16k);

      expect(chunkedOutput.length).toBe(singleBlockOutput.length);
      for (let i = 0; i < singleBlockOutput.length; i++) {
        expect(
          Math.abs(chunkedOutput[i] - singleBlockOutput[i])
        ).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("LearnerAudioTimelineStream Sample-Domain Cursor", () => {
    it("should place consecutive arbitrary chunks with zero gap and zero overlap", () => {
      const stream = new LearnerAudioTimelineStream();
      stream.start(100); // starts at 100ms offset

      const chunk1 = new Int16Array(160); // 10ms at 16kHz
      const res1 = stream.appendChunk(chunk1);
      expect(res1.startMs).toBe(100);

      const chunk2 = new Int16Array(320); // 20ms at 16kHz
      const res2 = stream.appendChunk(chunk2);
      expect(res2.startMs).toBe(110); // 100 + 10ms

      const chunk3 = new Int16Array(1600); // 100ms at 16kHz
      const res3 = stream.appendChunk(chunk3);
      expect(res3.startMs).toBe(130); // 110 + 20ms

      expect(stream.getTotalSamples()).toBe(160 + 320 + 1600);
    });
  });

  describe("Recorder Mixing & Timeline Placement", () => {
    it("should mix learner and native 24k examiner audio into 24kHz WAV with saturating clamp", async () => {
      const mockNow = 1000;
      const clock = () => mockNow;

      const recorder = new ConversationReplayRecorder({
        sessionEpochMs: 1000,
        clock,
      });

      // Learner speaks from t=0ms to t=100ms (1600 samples at 16kHz)
      recorder.startLearnerStream(0);
      const learnerPcm = new Int16Array(1600).fill(20000);
      recorder.addLearnerChunk(learnerPcm);

      // Examiner speaks from t=50ms to t=150ms (2400 samples at 24kHz)
      const examinerPcm = new Int16Array(2400).fill(20000);
      recorder.addExaminerChunk(examinerPcm, 50, 100);

      const result = recorder.finalize();
      expect(result).not.toBeNull();
      expect(result!.sampleRate).toBe(24000);
      expect(result!.mimeType).toBe("audio/wav");

      const arrayBuffer = await result!.blob.arrayBuffer();
      expect(arrayBuffer.byteLength).toBeGreaterThan(44);

      // Verify WAV header
      const view = new DataView(arrayBuffer);
      const riff = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      );
      expect(riff).toBe("RIFF");
      const sampleRate = view.getUint32(24, true);
      expect(sampleRate).toBe(24000);
      const bitsPerSample = view.getUint16(34, true);
      expect(bitsPerSample).toBe(16);

      // Inspect mixed samples: in overlapping region (50ms - 100ms), 20000 + 20000 = 40000 -> clamped to 32767
      const samples = new Int16Array(arrayBuffer, 44);
      // At t=75ms -> sample index 75 * 24 = 1800
      expect(samples[1800]).toBe(32767);
    });

    it("should handle barge-in: truncate active examiner segment and discard future segments", () => {
      const recorder = new ConversationReplayRecorder({
        sessionEpochMs: 0,
        clock: () => 0,
      });

      // Segment 1: 0ms to 3000ms (24000 * 3 = 72000 samples)
      const seg1Pcm = new Int16Array(72000).fill(5000);
      recorder.addExaminerChunk(seg1Pcm, 0, 3000);

      // Segment 2: scheduled in future 4000ms to 6000ms
      const seg2Pcm = new Int16Array(48000).fill(5000);
      recorder.addExaminerChunk(seg2Pcm, 4000, 2000);

      // Interruption occurs at 1700ms
      recorder.notifyInterrupted(1700);

      const result = recorder.finalize();
      expect(result).not.toBeNull();

      // Total output duration should not exceed 1700ms (40800 samples at 24kHz)
      const expectedMaxSamples = Math.ceil((1700 * 24000) / 1000);
      expect(result!.sampleRate * result!.durationSeconds).toBeLessThanOrEqual(
        expectedMaxSamples + 2400
      );
      expect(result!.durationSeconds).toBeCloseTo(1.7, 1);
    });
  });

  describe("Memory Bounds & Projected Finalization Guard", () => {
    it("should gracefully disable and return null when raw PCM budget is exceeded", () => {
      const recorder = new ConversationReplayRecorder({
        sessionEpochMs: 0,
        maxRawPcmBytes: 1000, // tiny budget for test
      });

      recorder.startLearnerStream(0);
      const largePcm = new Int16Array(600); // 1200 bytes > 1000 bytes
      recorder.addLearnerChunk(largePcm);

      expect(recorder.getIsDisabled()).toBe(true);
      expect(recorder.finalize()).toBeNull();
    });

    it("should gracefully disable when sparse timeline exceeds projected finalization memory guard", () => {
      const recorder = new ConversationReplayRecorder({
        sessionEpochMs: 0,
        maxProjectedFinalizeBytes: 10000, // 10 KB projected allocation limit for test
      });

      // Two tiny chunks (few bytes of raw PCM) but separated by 10 minutes (600,000ms)
      recorder.startLearnerStream(0);
      recorder.addLearnerChunk(new Int16Array(10)); // 20 bytes

      recorder.addExaminerChunk(new Int16Array(10), 600000, 1); // at 10 minutes

      // Raw PCM is under 100 bytes, but T_max = 600,000ms requires 14.4M samples -> ~115 MB projected!
      const result = recorder.finalize();
      expect(result).toBeNull();
      expect(recorder.getIsDisabled()).toBe(true);
    });

    it("should gracefully disable when max replay duration is exceeded", () => {
      const recorder = new ConversationReplayRecorder({
        sessionEpochMs: 0,
        maxReplayDurationMs: 60000, // 1 minute limit for test
      });

      recorder.startLearnerStream(0);
      recorder.addLearnerChunk(new Int16Array(10));
      recorder.addExaminerChunk(new Int16Array(10), 120000, 1); // 2 minutes

      expect(recorder.finalize()).toBeNull();
      expect(recorder.getIsDisabled()).toBe(true);
    });
  });
});
