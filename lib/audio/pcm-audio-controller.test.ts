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
});
