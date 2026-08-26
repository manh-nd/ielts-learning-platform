/**
 * Low-latency PCM Audio Controller (Recording & Playback)
 * Adapted directly from Lingua Loop reference implementation.
 */
export class PcmAudioController {
  private recordAudioContext: AudioContext | null = null;
  private playAudioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  private nextScheduledTime: number = 0;

  // Analysers for volume measurement
  private micAnalyser: AnalyserNode | null = null;
  private speakerAnalyser: AnalyserNode | null = null;

  private onMicLevelCallback: ((level: number) => void) | null = null;
  private onSpeakerLevelCallback: ((level: number) => void) | null = null;

  constructor() {}

  /**
   * Returns true if there are currently scheduled audio nodes playing.
   */
  isPlaying(): boolean {
    return this.activeSourceNodes.length > 0;
  }

  /**
   * Returns the underlying MediaStream (useful for MediaRecorder).
   */
  getMediaStream(): MediaStream | null {
    return this.micStream;
  }

  /**
   * Starts recording audio from the microphone, downsampling it to 16kHz 16-bit mono PCM.
   */
  async startRecording(
    onAudioChunk: (base64Chunk: string, rms: number) => void
  ) {
    this.stopRecording();

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
    this.recordAudioContext = new AudioContextClass();
    const sourceNode = this.recordAudioContext.createMediaStreamSource(
      this.micStream
    );

    // Setup Analyser for Mic level
    this.micAnalyser = this.recordAudioContext.createAnalyser();
    this.micAnalyser.fftSize = 256;
    sourceNode.connect(this.micAnalyser);

    const bufferSize = 4096;
    this.scriptProcessor = this.recordAudioContext.createScriptProcessor(
      bufferSize,
      1,
      1
    );

    const inputSampleRate = this.recordAudioContext.sampleRate;
    const outputSampleRate = 16000;

    this.scriptProcessor.onaudioprocess = (e) => {
      if (!this.recordAudioContext) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const resampledData = this.resampleTo16k(
        inputData,
        inputSampleRate,
        outputSampleRate
      );

      // Measure Mic volume amplitude
      let sum = 0;
      for (let i = 0; i < resampledData.length; i++) {
        const val = resampledData[i] / 32768.0;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / resampledData.length);
      if (this.onMicLevelCallback) {
        this.onMicLevelCallback(rms);
      }

      // Convert to Base64
      const base64 = this.arrayBufferToBase64(resampledData.buffer);
      onAudioChunk(base64, rms);
    };

    sourceNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.recordAudioContext.destination);

    if (this.recordAudioContext.state === "suspended") {
      await this.recordAudioContext.resume();
    }
  }

  /**
   * Stops recording and releases microphone stream.
   */
  stopRecording() {
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
      this.recordAudioContext.close();
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
    if (!this.playAudioContext) {
      const AudioContextClass =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;
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

    // Connect to speaker analyser (which is connected to destination)
    if (this.speakerAnalyser) {
      sourceNode.connect(this.speakerAnalyser);
    } else {
      sourceNode.connect(this.playAudioContext.destination);
    }

    const now = this.playAudioContext.currentTime;
    let startTime = this.nextScheduledTime;

    if (startTime < now) {
      // If queue is empty or play latency is exceeded, schedule immediately with tiny buffer
      startTime = now + 0.03;
    }

    sourceNode.start(startTime);
    this.nextScheduledTime = startTime + audioBuffer.duration;
    this.activeSourceNodes.push(sourceNode);

    // Cleanup reference after playback ends
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
   * Immediately stops all active playing source nodes and resets schedule queue.
   * Call this on user interruption.
   */
  stopPlayback() {
    this.activeSourceNodes.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Node might have already finished
      }
    });
    this.activeSourceNodes = [];
    this.nextScheduledTime = 0;
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
      this.playAudioContext.close();
      this.playAudioContext = null;
    }
    this.speakerAnalyser = null;
  }

  /**
   * Cleans up all audio resources (both record and playback).
   */
  close() {
    this.stopRecording();
    this.cleanupPlayback();
  }

  // Volume Amplitude Callbacks
  onMicLevel(callback: (level: number) => void) {
    this.onMicLevelCallback = callback;
  }

  onSpeakerLevel(callback: (level: number) => void) {
    this.onSpeakerLevelCallback = callback;
  }

  // --- Utility resampler & converter methods ---

  private resampleTo16k(
    inputBuffer: Float32Array,
    inputSampleRate: number,
    outputSampleRate: number
  ): Int16Array {
    const ratio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(inputBuffer.length / ratio);
    const result = new Int16Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const index = Math.round(i * ratio);
      let sample = inputBuffer[index];

      // Clamp float32 to [-1.0, 1.0]
      if (sample < -1) sample = -1;
      if (sample > 1) sample = 1;

      // Convert to 16-bit Int
      result[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return result;
  }

  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
