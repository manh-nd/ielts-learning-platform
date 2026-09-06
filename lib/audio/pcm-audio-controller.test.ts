import { describe, it, expect } from "bun:test";
import { PcmAudioController } from "./pcm-audio-controller";

describe("PcmAudioController", () => {
  it("should instantiate cleanly with default idle state", () => {
    const controller = new PcmAudioController();
    expect(controller).toBeDefined();
    expect(controller.isPlaying()).toBe(false);
    expect(controller.getMediaStream()).toBeNull();
  });

  it("should stop playback without throwing when not playing", () => {
    const controller = new PcmAudioController();
    expect(() => controller.stopPlayback()).not.toThrow();
    expect(() => controller.cleanupPlayback()).not.toThrow();
    expect(() => controller.close()).not.toThrow();
  });

  it("should register mic and speaker callbacks", () => {
    const controller = new PcmAudioController();
    let micLevel = -1;
    let speakerLevel = -1;

    controller.onMicLevel((level) => {
      micLevel = level;
    });
    controller.onSpeakerLevel((level) => {
      speakerLevel = level;
    });

    expect(micLevel).toBe(-1);
    expect(speakerLevel).toBe(-1);
  });

  it("should return 0 remaining scheduled duration when idle", () => {
    const controller = new PcmAudioController();
    expect(controller.getRemainingScheduledDurationMs()).toBe(0);
  });

  it("should resolve waitForQueueDrain immediately when queue is empty", async () => {
    const controller = new PcmAudioController();
    const drained = await controller.waitForQueueDrain(100);
    expect(drained).toBe(true);
  });

  it("should invoke onScheduled callback when audio chunk is scheduled in mock AudioContext", () => {
    // Setup minimal AudioContext mock on globalThis.window
    const originalWindow = (globalThis as unknown as { window?: unknown })
      .window;
    const mockCurrentTime = 1.0;

    class MockAudioContext {
      currentTime = mockCurrentTime;
      createAnalyser() {
        return {
          fftSize: 256,
          connect: () => {},
        };
      }
      createBuffer(_channels: number, length: number, sampleRate: number) {
        return {
          duration: length / sampleRate,
          getChannelData: () => new Float32Array(length),
        };
      }
      createBufferSource() {
        return {
          buffer: null,
          connect: () => {},
          start: () => {},
          stop: () => {},
          onended: null as (() => void) | null,
        };
      }
      destination = {};
      close = async () => {};
    }

    (globalThis as unknown as { window: unknown }).window = {
      AudioContext: MockAudioContext,
    };

    try {
      const controller = new PcmAudioController();
      // Base64 chunk of 480 bytes = 240 Int16 samples at 24kHz = 10ms
      const pcm10ms = new Int16Array(240).fill(1000);
      const base64Chunk = Buffer.from(pcm10ms.buffer).toString("base64");

      let scheduledInfo: {
        scheduledStartTimeMs: number;
        durationMs: number;
      } | null = null;
      controller.playAudioChunk(base64Chunk, (info) => {
        scheduledInfo = info;
      });

      expect(scheduledInfo).not.toBeNull();
      expect(scheduledInfo!.durationMs).toBe(10);
      expect(scheduledInfo!.scheduledStartTimeMs).toBeGreaterThan(0);
      expect(controller.getRemainingScheduledDurationMs()).toBeGreaterThan(0);

      controller.stopPlayback();
      expect(controller.getRemainingScheduledDurationMs()).toBe(0);
    } finally {
      (globalThis as unknown as { window?: unknown }).window = originalWindow;
    }
  });
});
