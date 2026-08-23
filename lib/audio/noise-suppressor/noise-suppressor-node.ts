import {
  NoiseSuppressorOptions,
  NoiseSuppressionMetrics,
  INoiseSuppressorProcessor,
} from "./types";
import { SpectralGateNoiseSuppressor } from "./spectral-gate-processor";
import { WasmNoiseSuppressor } from "./wasm-noise-processor";

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
 * Creates a Web Audio API graph node that performs real-time background noise suppression.
 * Can be connected between MediaStreamAudioSourceNode and downstream nodes (MediaRecorder, Analyser, etc.)
 */
export function createNoiseSuppressorNode(
  audioContext: AudioContext,
  options: NoiseSuppressorOptions = {}
): NoiseSuppressorGraph {
  const sampleRate = options.sampleRate ?? audioContext.sampleRate ?? 16000;
  const processor: INoiseSuppressorProcessor =
    options.mode === "wasm"
      ? new WasmNoiseSuppressor({ ...options, sampleRate })
      : new SpectralGateNoiseSuppressor({ ...options, sampleRate });

  // Web Audio Node setup
  const inputNode = audioContext.createGain();
  const outputNode = audioContext.createGain();
  const destinationNode = audioContext.createMediaStreamDestination();

  // Create real-time audio chunk processor (bufferSize 512 or 1024)
  // ScriptProcessorNode provides maximum cross-browser compatibility (Safari, Mobile, Chrome, Firefox)
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
    // If ScriptProcessor fails, fallback to direct passthrough
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
