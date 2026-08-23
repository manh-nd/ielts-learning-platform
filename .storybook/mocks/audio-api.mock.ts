export function setupAudioApiMocks() {
  if (typeof window === "undefined") return;

  class MockMediaStreamTrack {
    kind = "audio";
    enabled = true;
    readyState = "live";
    stop = () => {
      this.readyState = "ended";
    };
  }

  class MockMediaStream {
    active = true;
    private tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()];
    getTracks() {
      return this.tracks;
    }
    getAudioTracks() {
      return this.tracks;
    }
  }

  if (!navigator.mediaDevices) {
    // @ts-expect-error Mocking readonly property
    navigator.mediaDevices = {};
  }

  navigator.mediaDevices.getUserMedia = async (
    _constraints?: MediaStreamConstraints
  ) => {
    return new MockMediaStream() as unknown as MediaStream;
  };

  class MockMediaRecorder extends EventTarget {
    state: "inactive" | "recording" | "paused" = "inactive";
    mimeType: string;
    private intervalId: ReturnType<typeof setInterval> | null = null;

    ondataavailable: ((event: BlobEvent) => void) | null = null;
    onstop: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    static isTypeSupported(type: string) {
      return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].includes(
        type
      );
    }

    constructor(_stream: MediaStream, options?: { mimeType?: string }) {
      super();
      this.mimeType = options?.mimeType || "audio/webm;codecs=opus";
    }

    start(timeslice?: number) {
      this.state = "recording";
      const interval = timeslice || 500;
      this.intervalId = setInterval(() => {
        if (this.state === "recording" && this.ondataavailable) {
          const sampleWav = createSyntheticWavBlob(1);
          const event = new Event("dataavailable") as unknown as BlobEvent;
          Object.defineProperty(event, "data", { value: sampleWav });
          this.ondataavailable(event);
        }
      }, interval);
    }

    stop() {
      this.state = "inactive";
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      if (this.onstop) {
        this.onstop(new Event("stop"));
      }
    }

    pause() {
      this.state = "paused";
    }

    resume() {
      this.state = "recording";
    }
  }

  // @ts-expect-error Global mock injection
  window.MediaRecorder = MockMediaRecorder;

  class MockAnalyserNode {
    fftSize = 256;
    frequencyBinCount = 128;
    smoothingTimeConstant = 0.8;

    getByteFrequencyData(array: Uint8Array) {
      const now = Date.now() / 150;
      for (let i = 0; i < array.length; i++) {
        const val =
          Math.sin(now + i * 0.2) * 70 +
          Math.cos(now * 0.4 + i * 0.1) * 50 +
          128;
        array[i] = Math.max(15, Math.min(255, Math.floor(val)));
      }
    }

    getByteTimeDomainData(array: Uint8Array) {
      for (let i = 0; i < array.length; i++) {
        array[i] = 128 + Math.sin(i * 0.1) * 30;
      }
    }
  }

  class MockAudioContext {
    state = "running";
    createAnalyser() {
      return new MockAnalyserNode();
    }
    createMediaStreamSource() {
      return {
        connect: () => {},
        disconnect: () => {},
      };
    }
    close() {
      this.state = "closed";
      return Promise.resolve();
    }
  }

  // @ts-expect-error Global mock injection
  window.AudioContext = MockAudioContext;
  // @ts-expect-error Webkit compatibility mock
  window.webkitAudioContext = MockAudioContext;

  if (typeof window.URL.createObjectURL !== "function") {
    window.URL.createObjectURL = (blob: Blob) =>
      `blob:mock-audio-stream-${Date.now()}-${blob.size}`;
  }
  if (typeof window.URL.revokeObjectURL !== "function") {
    window.URL.revokeObjectURL = () => {};
  }
}

/**
 * Generate a valid playable PCM WAV audio blob for sandbox playback
 */
function createSyntheticWavBlob(durationSeconds = 1): Blob {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate * durationSeconds;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = numSamples * (bitsPerSample / 8);

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.25;
    const int16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, int16, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Mock simulator: Microphone Permission Denied (NotAllowedError)
 */
export function mockPermissionDenied() {
  setupAudioApiMocks();
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = async () => {
      const error = new DOMException(
        "Permission denied by user or system policy",
        "NotAllowedError"
      );
      throw error;
    };
  }
}

/**
 * Mock simulator: Microphone Device Not Found (NotFoundError)
 */
export function mockDeviceNotFound() {
  setupAudioApiMocks();
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = async () => {
      const error = new DOMException(
        "No microphone input device found",
        "NotFoundError"
      );
      throw error;
    };
  }
}

/**
 * Mock simulator: Unsupported Web Audio / MediaDevices in legacy browsers
 */
export function mockAudioUnsupported() {
  if (typeof window === "undefined") return;
  // @ts-expect-error Simulating legacy browser
  navigator.mediaDevices = undefined;
  // @ts-expect-error Simulating legacy browser
  window.MediaRecorder = undefined;
}

// Save original browser native implementations
let nativeGetUserMedia:
  ((constraints?: MediaStreamConstraints) => Promise<MediaStream>) | null =
  null;
let nativeMediaRecorder: typeof window.MediaRecorder | null = null;
let nativeAudioContext: typeof window.AudioContext | null = null;
let nativeWebkitAudioContext: typeof window.AudioContext | null = null;

if (typeof window !== "undefined") {
  if (
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  ) {
    nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices
    );
  }
  if (typeof window.MediaRecorder !== "undefined") {
    nativeMediaRecorder = window.MediaRecorder;
  }
  if (typeof window.AudioContext !== "undefined") {
    nativeAudioContext = window.AudioContext;
  }
  // @ts-expect-error webkit prefix
  if (typeof window.webkitAudioContext !== "undefined") {
    // @ts-expect-error webkit prefix
    nativeWebkitAudioContext = window.webkitAudioContext;
  }
}

/**
 * Restore original native browser Web Audio & MediaRecorder APIs (for live hardware testing)
 */
export function restoreNativeAudioApis() {
  if (typeof window === "undefined") return;

  if (navigator.mediaDevices && nativeGetUserMedia) {
    navigator.mediaDevices.getUserMedia = nativeGetUserMedia;
  }
  if (nativeMediaRecorder) {
    window.MediaRecorder = nativeMediaRecorder;
  }
  if (nativeAudioContext) {
    window.AudioContext = nativeAudioContext;
  }
  if (nativeWebkitAudioContext) {
    // @ts-expect-error webkit prefix
    window.webkitAudioContext = nativeWebkitAudioContext;
  }
}

/**
 * Reset audio mocks back to fully functional mock state
 */
export function resetAudioMocks() {
  setupAudioApiMocks();
}
