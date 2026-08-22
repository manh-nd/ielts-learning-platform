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
  navigator.mediaDevices.getUserMedia = async () => {
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
      const interval = timeslice || 1000;
      this.intervalId = setInterval(() => {
        if (this.state === "recording" && this.ondataavailable) {
          const dummyChunk = new Blob(["mock-audio-bytes"], {
            type: this.mimeType,
          });
          const event = new Event("dataavailable") as unknown as BlobEvent;
          Object.defineProperty(event, "data", { value: dummyChunk });
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
      const now = Date.now() / 200;
      for (let i = 0; i < array.length; i++) {
        const val =
          Math.sin(now + i * 0.15) * 60 +
          Math.cos(now * 0.5 + i * 0.05) * 40 +
          120;
        array[i] = Math.max(10, Math.min(255, Math.floor(val)));
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
}
