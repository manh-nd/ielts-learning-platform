import {
  NoiseSuppressorOptions,
  NoiseSuppressionMetrics,
  INoiseSuppressorProcessor,
} from "./types";
import { SpectralGateNoiseSuppressor } from "./spectral-gate-processor";
import { WasmNoiseSuppressor } from "./wasm-noise-processor";
import { loadNoiseSuppressorWorklet } from "./noise-suppressor-worklet";

export interface NoiseSuppressorGraph {
  inputNode: AudioNode;
  outputNode: AudioNode;
  cleanStream: MediaStream;
  processor: INoiseSuppressorProcessor;
  setEnabled: (enabled: boolean) => void;
  getMetrics: () => NoiseSuppressionMetrics;
  disconnect: () => void;
}

/**
 * Creates a Web Audio API graph that performs real-time background noise
 * suppression using an AudioWorkletNode (dedicated audio thread).
 *
 * Falls back to the legacy ScriptProcessorNode when AudioWorklet is not
 * available (Safari < 14.1 or non-secure contexts).
 */
export async function createNoiseSuppressorNode(
  audioContext: AudioContext,
  options: NoiseSuppressorOptions = {}
): Promise<NoiseSuppressorGraph> {
  const sampleRate = options.sampleRate ?? audioContext.sampleRate ?? 16000;
  const processor: INoiseSuppressorProcessor =
    options.mode === "wasm"
      ? new WasmNoiseSuppressor({ ...options, sampleRate })
      : new SpectralGateNoiseSuppressor({ ...options, sampleRate });

  // Web Audio Node setup
  const inputNode = audioContext.createGain();
  const outputNode = audioContext.createGain();
  const destinationNode = audioContext.createMediaStreamDestination();

  // ─── AudioWorkletNode path (preferred) ────────────────────────────────────
  if (audioContext.audioWorklet && typeof AudioWorkletNode !== "undefined") {
    try {
      await loadNoiseSuppressorWorklet(audioContext);

      const workletNode = new AudioWorkletNode(
        audioContext,
        "noise-suppressor-processor",
        { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 }
      );

      // Forward DSP-processed audio from the worklet into our outputNode
      inputNode.connect(workletNode);
      workletNode.connect(outputNode);
      outputNode.connect(destinationNode);

      // Sync initial enabled state into the worklet
      workletNode.port.postMessage({
        type: "setEnabled",
        enabled: processor.isEnabled(),
      });

      // Receive async metrics from the worklet thread and forward them to the
      // JS-side processor object so callers get live data via getMetrics()
      workletNode.port.onmessage = (evt: MessageEvent) => {
        const { type, metrics } = evt.data ?? {};
        if (type === "metrics" && metrics) {
          // Patch the JS-side processor metrics via setOptions trick:
          // setOptions is a no-op for metric state, so we store metrics in a
          // closure variable instead.
          latestWorkletMetrics = metrics as NoiseSuppressionMetrics;
        }
      };

      let latestWorkletMetrics: NoiseSuppressionMetrics | null = null;

      const setEnabled = (enabled: boolean) => {
        processor.setEnabled(enabled);
        workletNode.port.postMessage({ type: "setEnabled", enabled });
      };

      const getMetrics = (): NoiseSuppressionMetrics => {
        // Prefer live worklet metrics when available; fall back to JS-side estimate
        return latestWorkletMetrics ?? processor.getMetrics();
      };

      const disconnect = () => {
        try {
          workletNode.port.onmessage = null;
          inputNode.disconnect(workletNode);
          workletNode.disconnect(outputNode);
          outputNode.disconnect(destinationNode);
        } catch {
          // Ignore disconnect errors during teardown
        }
      };

      return {
        inputNode,
        outputNode,
        cleanStream: destinationNode.stream,
        processor,
        setEnabled,
        getMetrics,
        disconnect,
      };
    } catch {
      // AudioWorklet failed (e.g. module load error) — fall through to legacy path
    }
  }

  // ─── ScriptProcessorNode fallback (Safari < 14.1, non-secure contexts) ───
  // NOTE: ScriptProcessorNode is deprecated and runs on the main thread.
  // It is kept here only as a last-resort fallback.
  let scriptProcessor: ScriptProcessorNode | null = null;

  try {
    const bufferSize = 512;
    scriptProcessor = audioContext.createScriptProcessor(
      bufferSize,
      1, // mono input
      1 // mono output
    );

    scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
      const inputBuffer = event.inputBuffer.getChannelData(0);
      const outputBuffer = event.outputBuffer.getChannelData(0);

      if (!processor.isEnabled()) {
        outputBuffer.set(inputBuffer);
        return;
      }

      const processed = processor.process(inputBuffer);
      outputBuffer.set(processed);
    };

    inputNode.connect(scriptProcessor);
    scriptProcessor.connect(outputNode);
    outputNode.connect(destinationNode);
  } catch {
    // If ScriptProcessor also fails, fall back to direct passthrough
    inputNode.connect(outputNode);
    outputNode.connect(destinationNode);
  }

  const setEnabled = (enabled: boolean) => {
    processor.setEnabled(enabled);
  };

  const getMetrics = (): NoiseSuppressionMetrics => {
    return processor.getMetrics();
  };

  const disconnect = () => {
    try {
      if (scriptProcessor) {
        scriptProcessor.onaudioprocess = null;
        inputNode.disconnect(scriptProcessor);
        scriptProcessor.disconnect(outputNode);
        scriptProcessor = null;
      }
      inputNode.disconnect();
      outputNode.disconnect();
    } catch {
      // Ignore disconnect errors during teardown
    }
  };

  return {
    inputNode,
    outputNode,
    cleanStream: destinationNode.stream,
    processor,
    setEnabled,
    getMetrics,
    disconnect,
  };
}
