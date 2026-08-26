import { base64ToFloat32 } from "./pcm-utils";

/**
 * Low-latency PCM 24kHz Stream Player for Gemini Live API
 * Schedules gapless playback of incoming audio chunks using Web Audio API AudioBufferSourceNodes.
 */
export class AudioStreamPlayer {
  private audioContext: AudioContext | null = null;
  private nextPlayTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private isPlaying = false;
  private readonly sampleRate = 24000; // Gemini Live Output PCM rate
  private onStateChange?: (isPlaying: boolean) => void;

  public get isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  constructor(onStateChange?: (isPlaying: boolean) => void) {
    this.onStateChange = onStateChange;
  }

  private initContext() {
    if (!this.audioContext || this.audioContext.state === "closed") {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: this.sampleRate });
    }
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  /**
   * Appends and schedules a Base64 PCM chunk (24kHz, 16-bit mono)
   */
  public queueChunk(base64Pcm: string) {
    if (!base64Pcm) return;
    this.initContext();
    if (!this.audioContext) return;

    try {
      const float32Samples = base64ToFloat32(base64Pcm);
      if (float32Samples.length === 0) return;

      const audioBuffer = this.audioContext.createBuffer(
        1,
        float32Samples.length,
        this.sampleRate
      );
      audioBuffer.getChannelData(0).set(float32Samples);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      const currentTime = this.audioContext.currentTime;
      const startTime = Math.max(currentTime + 0.005, this.nextPlayTime);
      source.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.activeSources.push(source);
      if (!this.isPlaying) {
        this.isPlaying = true;
        this.onStateChange?.(true);
      }

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
        if (this.activeSources.length === 0) {
          this.isPlaying = false;
          this.onStateChange?.(false);
        }
      };
    } catch (err) {
      console.error(
        "[AudioStreamPlayer] Error decoding or scheduling chunk:",
        err
      );
    }
  }

  /**
   * Interrupts playback immediately, stops all playing buffers and flushes queue
   */
  public interrupt() {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignored if already stopped
      }
    }
    this.activeSources = [];
    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime;
    }
    if (this.isPlaying) {
      this.isPlaying = false;
      this.onStateChange?.(false);
    }
  }

  /**
   * Cleans up audio context and active sources
   */
  public close() {
    this.interrupt();
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
