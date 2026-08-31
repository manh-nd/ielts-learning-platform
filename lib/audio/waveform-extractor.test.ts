import { describe, it, expect } from "vitest";
import {
  generateFallbackAmplitudes,
  computeAmplitudesFromChannelData,
  extractWaveformAmplitudes,
} from "./waveform-extractor";

describe("waveform-extractor", () => {
  it("generates fallback amplitudes with correct length and clamped bounds", () => {
    const bars = generateFallbackAmplitudes(32);
    expect(bars).toHaveLength(32);
    for (const amp of bars) {
      expect(amp).toBeGreaterThanOrEqual(0.12);
      expect(amp).toBeLessThanOrEqual(0.95);
    }
  });

  it("computes amplitudes accurately from channel data", () => {
    // 4800 samples, 48 bars -> 100 samples per bar
    const channelData = new Float32Array(4800);
    // First 24 bars are silent, last 24 bars have audio
    for (let i = 2400; i < 4800; i++) {
      channelData[i] = Math.sin(i * 0.1) * 0.8;
    }

    const amplitudes = computeAmplitudesFromChannelData(channelData, 48);
    expect(amplitudes).toHaveLength(48);

    // Silent half should be near baseline minimum
    expect(amplitudes[0]).toBeCloseTo(0.12, 1);
    expect(amplitudes[10]).toBeCloseTo(0.12, 1);

    // Active half should have elevated amplitudes
    expect(amplitudes[30]).toBeGreaterThan(0.5);
    expect(amplitudes[40]).toBeGreaterThan(0.5);
  });

  it("safely falls back when source is empty or invalid", async () => {
    const res = await extractWaveformAmplitudes(new ArrayBuffer(0), 40);
    expect(res).toHaveLength(40);
    expect(res[0]).toBeGreaterThan(0);
  });
});
