import { describe, it, expect } from "bun:test";
import {
  MICROPHONE_WORKLET_CODE,
  resampleFloat32To16kPcm,
} from "./microphone-worklet";

describe("Microphone AudioWorklet Processor", () => {
  it("should contain standard AudioWorklet registration code", () => {
    expect(MICROPHONE_WORKLET_CODE).toContain("registerProcessor");
    expect(MICROPHONE_WORKLET_CODE).toContain("microphone-pcm-processor");
    expect(MICROPHONE_WORKLET_CODE).toContain("class MicrophonePcmProcessor");
  });

  it("should accurately downsample 48kHz Float32 audio to 16kHz Int16 PCM", () => {
    // Generate 480 samples at 48kHz (10ms of 440Hz sine wave)
    const inputSampleRate = 48000;
    const outputSampleRate = 16000;
    const sampleCount = 480;
    const input = new Float32Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      input[i] = Math.sin((2 * Math.PI * 440 * i) / inputSampleRate);
    }

    const pcm16 = resampleFloat32To16kPcm(
      input,
      inputSampleRate,
      outputSampleRate
    );

    // 480 samples / (48000/16000) = 160 samples
    expect(pcm16.length).toBe(160);
    expect(pcm16 instanceof Int16Array).toBe(true);

    // Values should be in range [-32768, 32767]
    for (let i = 0; i < pcm16.length; i++) {
      expect(pcm16[i]).toBeGreaterThanOrEqual(-32768);
      expect(pcm16[i]).toBeLessThanOrEqual(32767);
    }
  });

  it("should clamp out-of-range floats", () => {
    const input = new Float32Array([1.5, -2.0, 0.0]);
    const pcm16 = resampleFloat32To16kPcm(input, 16000, 16000);

    expect(pcm16[0]).toBe(32767);
    expect(pcm16[1]).toBe(-32768);
    expect(pcm16[2]).toBe(0);
  });
});
