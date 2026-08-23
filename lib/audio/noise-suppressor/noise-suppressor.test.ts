import { describe, it, expect, beforeEach } from "bun:test";
import {
  SpectralGateNoiseSuppressor,
  WasmNoiseSuppressor,
  createNoiseSuppressorNode,
} from "./index";

describe("SpectralGateNoiseSuppressor", () => {
  let suppressor: SpectralGateNoiseSuppressor;
  const sampleRate = 16000;

  beforeEach(() => {
    suppressor = new SpectralGateNoiseSuppressor({
      sampleRate,
      attenuationDb: -18,
      thresholdDb: -42,
      attackMs: 5,
      releaseMs: 50,
      highPassCutoffHz: 80,
    });
  });

  it("should initialize with default active state and metrics", () => {
    expect(suppressor.isEnabled()).toBe(true);
    const metrics = suppressor.getMetrics();
    expect(metrics.framesProcessed).toBe(0);
    expect(metrics.isSpeechDetected).toBe(false);
    expect(metrics.activeMode).toBe("spectral-gate");
  });

  it("should pass through audio unchanged when disabled", () => {
    suppressor.setEnabled(false);
    expect(suppressor.isEnabled()).toBe(false);

    const input = new Float32Array([0.1, -0.2, 0.3, -0.4, 0.5]);
    const output = suppressor.process(input);

    expect(output).toEqual(input);
  });

  it("should attenuate low-level background noise (e.g. mic hiss, fan noise)", () => {
    // Generate 512 samples of low-amplitude white noise (~ -50 dBFS)
    const len = 512;
    const noiseInput = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      noiseInput[i] = (Math.random() * 2 - 1) * 0.003; // ~ -50 dB
    }

    // Process multiple frames to allow adaptive noise floor to converge
    let lastOutput: Float32Array = noiseInput;
    for (let f = 0; f < 5; f++) {
      lastOutput = suppressor.process(noiseInput);
    }

    // Calculate RMS of original vs filtered
    const inputRms = Math.sqrt(
      noiseInput.reduce((acc, val) => acc + val * val, 0) / len
    );
    const outputRms = Math.sqrt(
      lastOutput.reduce((acc, val) => acc + val * val, 0) / len
    );

    expect(outputRms).toBeLessThan(inputRms * 0.7); // Significant attenuation
    const metrics = suppressor.getMetrics();
    expect(metrics.isSpeechDetected).toBe(false);
  });

  it("should preserve speech-like signals and flag speech activity", () => {
    const len = 512;
    const speechInput = new Float32Array(len);

    // Generate simulated vocal tone (440Hz + 880Hz harmonic with healthy volume ~ -12 dBFS)
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      speechInput[i] =
        0.2 * Math.sin(2 * Math.PI * 440 * t) +
        0.1 * Math.sin(2 * Math.PI * 880 * t);
    }

    // Process frames
    let output: Float32Array = speechInput;
    for (let f = 0; f < 5; f++) {
      output = suppressor.process(speechInput);
    }

    const inputRms = Math.sqrt(
      speechInput.reduce((acc, val) => acc + val * val, 0) / len
    );
    const outputRms = Math.sqrt(
      output.reduce((acc, val) => acc + val * val, 0) / len
    );

    // Speech amplitude should be well-preserved (> 80% of original signal)
    expect(outputRms).toBeGreaterThan(inputRms * 0.8);

    const metrics = suppressor.getMetrics();
    expect(metrics.isSpeechDetected).toBe(true);
    expect(metrics.speechProbability).toBeGreaterThan(0.3);
    expect(metrics.snrDb).toBeGreaterThan(15);
  });

  it("should attenuate low-frequency rumble via high-pass filter", () => {
    const len = 512;
    const rumbleInput = new Float32Array(len);

    // Generate 30Hz sub-rumble (well below 80Hz cutoff)
    for (let i = 0; i < len; i++) {
      const t = i / sampleRate;
      rumbleInput[i] = 0.5 * Math.sin(2 * Math.PI * 30 * t);
    }

    let output: Float32Array = rumbleInput;
    for (let f = 0; f < 4; f++) {
      output = suppressor.process(rumbleInput);
    }

    const inputRms = Math.sqrt(
      rumbleInput.reduce((acc, val) => acc + val * val, 0) / len
    );
    const outputRms = Math.sqrt(
      output.reduce((acc, val) => acc + val * val, 0) / len
    );

    expect(outputRms).toBeLessThan(inputRms * 0.5);
  });

  it("should reset state cleanly", () => {
    const input = new Float32Array(256).fill(0.3);
    suppressor.process(input);
    expect(suppressor.getMetrics().framesProcessed).toBeGreaterThan(0);

    suppressor.reset();
    const metrics = suppressor.getMetrics();
    expect(metrics.framesProcessed).toBe(0);
    expect(metrics.isSpeechDetected).toBe(false);
  });
});

describe("WasmNoiseSuppressor", () => {
  it("should initialize and process audio via adaptive fallback gracefully", () => {
    const wasmSuppressor = new WasmNoiseSuppressor({
      sampleRate: 16000,
      enabled: true,
    });

    expect(wasmSuppressor.isEnabled()).toBe(true);

    const input = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      input[i] = 0.1 * Math.sin((i / 16000) * 1000 * 2 * Math.PI);
    }

    const output = wasmSuppressor.process(input);
    expect(output.length).toBe(256);

    const metrics = wasmSuppressor.getMetrics();
    expect(metrics.framesProcessed).toBe(1);
  });
});

describe("createNoiseSuppressorNode", () => {
  it("should instantiate Web Audio graph with fallback when AudioContext is provided", () => {
    // Mock AudioContext for test environment
    const mockAudioContext = {
      sampleRate: 16000,
      createGain: () => ({
        connect: () => {},
        disconnect: () => {},
      }),
      createMediaStreamDestination: () => ({
        stream: {} as MediaStream,
      }),
      createScriptProcessor: () => ({
        onaudioprocess: null,
        connect: () => {},
        disconnect: () => {},
      }),
    } as unknown as AudioContext;

    const graph = createNoiseSuppressorNode(mockAudioContext, {
      enabled: true,
    });

    expect(graph.inputNode).toBeDefined();
    expect(graph.outputNode).toBeDefined();
    expect(graph.processor).toBeDefined();

    graph.setEnabled(false);
    expect(graph.processor.isEnabled()).toBe(false);

    expect(() => graph.disconnect()).not.toThrow();
  });
});
