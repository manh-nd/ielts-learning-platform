import {
  loadMicrophoneWorklet,
  resampleFloat32To16kPcm,
} from "./worklets/microphone-worklet";

/**
 * Low-latency PCM Audio Controller (Recording & Playback)
 * Designed for Gemini Live 3.1 bidirectional audio stream:
 * - 16kHz 16-bit Mono PCM Input (Microphone via AudioWorklet)
 * - 24kHz 16-bit Mono PCM Output (AudioBufferSourceNode RingBuffer with instant interruption clear)
 */
export class PcmAudioController {
  private recordAudioContext: AudioContext | null = null;
  private playAudioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  private nextScheduledTime: number = 0;

  // Analysers for volume measurement
  private micAnalyser: AnalyserNode | null = null;
  private speakerAnalyser: AnalyserNode | null = null;

  private onMicLevelCallback: ((level: number) => void) | null = null;
  private onSpeakerLevelCallback: ((level: number) => void) | null = null;
  private isClosed: boolean = false;

  constructor() {}

  /**
   * Returns true if there are currently scheduled audio nodes playing.
   */
  isPlaying(): boolean {
    return this.activeSourceNodes.length > 0;
  }

  /**
   * Returns the underlying MediaStream (useful for parallel MediaRecorder).
   */
  getMediaStream(): MediaStream | null {
    return this.micStream;
  }

  /**
   * Starts recording audio from microphone, downsampling it to 16kHz 16-bit mono PCM.
   * Utilizes AudioWorkletProcessor where available, with fallback to ScriptProcessor.
   */
  async startRecording(
    onAudioChunk: (base64Chunk: string, rms: number) => void
  ) {
    this.stopRecording();
    this.isClosed = false;

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      return;
    }

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    const AudioContextClass =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextClass) return;

    this.recordAudioContext = new AudioContextClass();
    const sourceNode = this.recordAudioContext.createMediaStreamSource(
      this.micStream
    );

    // Setup Analyser for Mic level
    this.micAnalyser = this.recordAudioContext.createAnalyser();
    this.micAnalyser.fftSize = 256;
    sourceNode.connect(this.micAnalyser);

    const inputSampleRate = this.recordAudioContext.sampleRate;
    const outputSampleRate = 16000;

    const handleRawFloatChunk = (inputData: Float32Array) => {
      const resampledData = resampleFloat32To16kPcm(
        inputData,
        inputSampleRate,
        outputSampleRate
      );

      // Measure Mic volume RMS
      let sum = 0;
      for (let i = 0; i < resampledData.length; i++) {
        const val = resampledData[i] / 32768.0;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / resampledData.length);
      if (this.onMicLevelCallback) {
        this.onMicLevelCallback(rms);
      }

      // Convert Int16Array to Base64
      const base64 = this.arrayBufferToBase64(resampledData.buffer);
      onAudioChunk(base64, rms);
    };

    // Try AudioWorklet first
    let workletLoaded = false;
    if (
      "audioWorklet" in this.recordAudioContext &&
      this.recordAudioContext.audioWorklet
    ) {
      try {
        await loadMicrophoneWorklet(this.recordAudioContext);
        this.workletNode = new AudioWorkletNode(
          this.recordAudioContext,
          "microphone-pcm-processor"
        );
        this.workletNode.port.onmessage = (event) => {
          if (event.data instanceof Float32Array) {
            handleRawFloatChunk(event.data);
          }
        };
        sourceNode.connect(this.workletNode);
        workletLoaded = true;
      } catch (workletErr) {
        console.warn(
          "[PcmAudioController] AudioWorklet init failed, using fallback:",
          workletErr
        );
      }
    }

    // Fallback to ScriptProcessor if AudioWorklet not available or failed
    if (!workletLoaded) {
      const bufferSize = 2048;
      this.scriptProcessor = this.recordAudioContext.createScriptProcessor(
        bufferSize,
        1,
        1
      );
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.recordAudioContext) return;
        const inputData = e.inputBuffer.getChannelData(0);
        handleRawFloatChunk(new Float32Array(inputData));
      };
      sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.recordAudioContext.destination);
    }

    if (this.recordAudioContext.state === "suspended") {
      await this.recordAudioContext.resume();
    }
  }

  /**
   * Stops recording and releases microphone stream.
   */
  stopRecording() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode.port.onmessage = null;
      this.workletNode = null;
    }
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.recordAudioContext) {
      this.recordAudioContext.close().catch(() => {});
      this.recordAudioContext = null;
    }
    this.micAnalyser = null;
    if (this.onMicLevelCallback) {
      this.onMicLevelCallback(0);
    }
  }

  /**
   * Schedules a 24kHz mono PCM audio chunk for gapless playback.
   */
  playAudioChunk(base64Chunk: string) {
    if (this.isClosed) return;

    if (!this.playAudioContext) {
      const AudioContextClass =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;
      if (!AudioContextClass) return;
      this.playAudioContext = new AudioContextClass();

      // Setup Analyser for Speaker level
      this.speakerAnalyser = this.playAudioContext.createAnalyser();
      this.speakerAnalyser.fftSize = 256;
      this.speakerAnalyser.connect(this.playAudioContext.destination);
    }

    const arrayBuffer = this.base64ToArrayBuffer(base64Chunk);
    const int16Data = new Int16Array(arrayBuffer);
    const float32Samples = new Float32Array(int16Data.length);

    let sum = 0;
    for (let i = 0; i < int16Data.length; i++) {
      const sample = int16Data[i] / 32768.0;
      float32Samples[i] = sample;
      sum += sample * sample;
    }

    // Measure speaker amplitude
    if (this.onSpeakerLevelCallback) {
      const rms = Math.sqrt(sum / int16Data.length);
      this.onSpeakerLevelCallback(rms);
    }

    // Create 24kHz buffer
    const audioBuffer = this.playAudioContext.createBuffer(
      1,
      float32Samples.length,
      24000
    );
    audioBuffer.getChannelData(0).set(float32Samples);

    const sourceNode = this.playAudioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;

    if (this.speakerAnalyser) {
      sourceNode.connect(this.speakerAnalyser);
    } else {
      sourceNode.connect(this.playAudioContext.destination);
    }

    const now = this.playAudioContext.currentTime;
    let startTime = this.nextScheduledTime;

    if (startTime < now) {
      startTime = now + 0.02; // 20ms lead-in
    }

    sourceNode.start(startTime);
    this.nextScheduledTime = startTime + audioBuffer.duration;
    this.activeSourceNodes.push(sourceNode);

    sourceNode.onended = () => {
      this.activeSourceNodes = this.activeSourceNodes.filter(
        (n) => n !== sourceNode
      );
      if (this.activeSourceNodes.length === 0 && this.onSpeakerLevelCallback) {
        this.onSpeakerLevelCallback(0);
      }
    };
  }

  /**
   * Clears all future scheduled audio buffers and resets queue.
   */
  clearQueue() {
    this.nextScheduledTime = 0;
  }

  /**
   * Immediately stops all active playing source nodes and clears playback queue.
   * Call this immediately on barge-in / user interruption.
   */
  stopPlayback() {
    this.activeSourceNodes.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Ignored
      }
    });
    this.activeSourceNodes = [];
    this.clearQueue();
    if (this.onSpeakerLevelCallback) {
      this.onSpeakerLevelCallback(0);
    }
  }

  /**
   * Fully cleans up playback audio context.
   */
  cleanupPlayback() {
    this.stopPlayback();
    if (this.playAudioContext) {
      this.playAudioContext.close().catch(() => {});
      this.playAudioContext = null;
    }
    this.speakerAnalyser = null;
  }

  /**
   * Cleans up all audio resources (both record and playback).
   */
  close() {
    this.isClosed = true;
    this.stopRecording();
    this.cleanupPlayback();
  }

  // Amplitude callbacks
  onMicLevel(callback: (level: number) => void) {
    this.onMicLevelCallback = callback;
  }

  onSpeakerLevel(callback: (level: number) => void) {
    this.onSpeakerLevelCallback = callback;
  }

  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return typeof window !== "undefined"
      ? window.btoa(binary)
      : Buffer.from(buffer).toString("base64");
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    if (typeof window !== "undefined") {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }
    return Buffer.from(base64, "base64").buffer;
  }
}
