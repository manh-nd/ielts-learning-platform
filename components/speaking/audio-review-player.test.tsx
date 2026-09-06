import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { Window } from "happy-dom";
import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

// 1. Mock wavesurfer.js boundary
class MockWaveSurfer {
  options: {
    container: HTMLElement;
    url: string;
    waveColor?: string;
    progressColor?: string;
    [key: string]: unknown;
  };
  listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  isPlaying = false;
  currentTime = 0;
  duration = 10;
  playbackRate = 1.0;
  isDestroyed = false;

  constructor(options: MockWaveSurfer["options"]) {
    this.options = options;
  }

  on(event: string, callback: (...args: unknown[]) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback
      );
    };
  }

  emit(event: string, ...args: unknown[]) {
    this.listeners[event]?.forEach((cb) => cb(...args));
  }

  play = mock(async () => {
    this.isPlaying = true;
    this.emit("play");
  });

  pause = mock(() => {
    this.isPlaying = false;
    this.emit("pause");
  });

  destroy = mock(() => {
    this.isDestroyed = true;
    this.listeners = {};
  });

  seekTo = mock((progress: number) => {
    this.currentTime = progress * this.duration;
    this.emit("timeupdate", this.currentTime);
  });

  setTime = mock((time: number) => {
    this.currentTime = time;
    this.emit("timeupdate", this.currentTime);
  });

  setPlaybackRate = mock((rate: number, _preservePitch?: boolean) => {
    this.playbackRate = rate;
  });

  getDuration = mock(() => this.duration);
  getCurrentTime = mock(() => this.currentTime);
  getMediaElement = mock(() => {
    const audio = document.createElement("audio");
    return audio;
  });
}

const mockInstances: MockWaveSurfer[] = [];

mock.module("wavesurfer.js", () => {
  return {
    default: {
      create: mock((options: MockWaveSurfer["options"]) => {
        const instance = new MockWaveSurfer(options);
        mockInstances.push(instance);
        return instance;
      }),
    },
  };
});

// Setup DOM globals with happy-dom
const happyWindow = new Window({ url: "http://localhost:3000" });
Object.assign(globalThis, {
  window: happyWindow,
  document: happyWindow.document,
  HTMLElement: happyWindow.HTMLElement,
  HTMLDivElement: happyWindow.HTMLDivElement,
  HTMLButtonElement: happyWindow.HTMLButtonElement,
  customElements: happyWindow.customElements,
  IS_REACT_ACT_ENVIRONMENT: true,
});

// Now import component under test
import {
  AudioReviewPlayer,
  type AudioReviewPlayerRef,
  type AudioReviewMarker,
} from "./audio-review-player";

describe("AudioReviewPlayer SSR smoke tests", () => {
  it("renders idle standby state when src is null", () => {
    const html = renderToString(
      <AudioReviewPlayer src={null} ariaLabel="Speaking Audio" />
    );

    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Speaking Audio"');
    expect(html).toContain("Chưa có bản ghi âm");
    expect(html).not.toContain("Tốc độ phát");
  });

  it("renders structure with controls and speed group when src is provided", () => {
    const markers: AudioReviewMarker[] = [
      { id: "m1", timeSeconds: 1.2, label: "Phát âm chưa chuẩn" },
    ];

    const html = renderToString(
      <AudioReviewPlayer
        src="/api/teacher/submissions/sub_1/audio/prompt_1"
        ariaLabel="Bài nói của học viên"
        markers={markers}
      />
    );

    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Bài nói của học viên"');
    expect(html).toContain("Tốc độ phát");
    expect(html).toContain("0.8x");
    expect(html).toContain("1x");
    expect(html).toContain("1.2x");
    expect(html).toContain("1.5x");
    expect(html).toContain("Đang tải âm thanh...");
  });
});

describe("AudioReviewPlayer Mocked WaveSurfer Lifecycle & Behavior", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockInstances.length = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  describe("Lifecycle", () => {
    it("creates exactly one WaveSurfer instance for first src", async () => {
      await act(async () => {
        root.render(
          <AudioReviewPlayer
            src="https://example.com/audio1.wav"
            ariaLabel="Bản ghi âm kiểm thử"
          />
        );
      });

      expect(mockInstances.length).toBe(1);
      expect(mockInstances[0].options.url).toBe(
        "https://example.com/audio1.wav"
      );
      expect(mockInstances[0].isDestroyed).toBe(false);
    });

    it("destroys previous instance and creates a fresh instance when src changes", async () => {
      await act(async () => {
        root.render(
          <AudioReviewPlayer
            src="https://example.com/audio1.wav"
            ariaLabel="Bản ghi âm kiểm thử"
          />
        );
      });

      expect(mockInstances.length).toBe(1);
      const firstInstance = mockInstances[0];

      await act(async () => {
        root.render(
          <AudioReviewPlayer
            src="https://example.com/audio2.wav"
            ariaLabel="Bản ghi âm kiểm thử"
          />
        );
      });

      expect(firstInstance.isDestroyed).toBe(true);
      expect(firstInstance.destroy).toHaveBeenCalled();
      expect(mockInstances.length).toBe(2);
      expect(mockInstances[1].options.url).toBe(
        "https://example.com/audio2.wav"
      );
      expect(mockInstances[1].isDestroyed).toBe(false);
    });

    it("destroys current instance on unmount", async () => {
      await act(async () => {
        root.render(
          <AudioReviewPlayer
            src="https://example.com/audio1.wav"
            ariaLabel="Bản ghi âm kiểm thử"
          />
        );
      });

      expect(mockInstances.length).toBe(1);
      const instance = mockInstances[0];

      await act(async () => {
        root.unmount();
      });

      expect(instance.isDestroyed).toBe(true);
      expect(instance.destroy).toHaveBeenCalled();
    });
  });

  describe("Events synchronization", () => {
    it("synchronizes ready event: sets duration, enables controls, clears loading", async () => {
      await act(async () => {
        root.render(
          <AudioReviewPlayer
            src="https://example.com/audio.wav"
            ariaLabel="Bản ghi âm kiểm thử"
          />
        );
      });

      const instance = mockInstances[0];
      instance.duration = 15;
      const playBtn = container.querySelector(
        '[data-testid="audio-player-play-pause"]'
      ) as HTMLButtonElement;
      expect(playBtn.disabled).toBe(true);

      await act(async () => {
        instance.emit("ready", 15);
      });

      expect(playBtn.disabled).toBe(false);
      const timeDisplay = container.querySelector(
        '[data-testid="audio-player-time"]'
      );
      expect(timeDisplay?.textContent).toContain("00:15");
    });

    it("synchronizes play and pause events with play button state", async () => {
      await act(async () => {
        root.render(
          <AudioReviewPlayer
            src="https://example.com/audio.wav"
            ariaLabel="Bản ghi âm kiểm thử"
          />
        );
      });

      const instance = mockInstances[0];
      await act(async () => {
        instance.emit("ready", 10);
      });

      const playBtn = container.querySelector(
        '[data-testid="audio-player-play-pause"]'
      ) as HTMLButtonElement;
      expect(playBtn.getAttribute("aria-label")).toBe("Phát");

      await act(async () => {
        instance.emit("play");
      });
      expect(playBtn.getAttribute("aria-label")).toBe("Tạm dừng");

      await act(async () => {
        instance.emit("pause");
      });
      expect(playBtn.getAttribute("aria-label")).toBe("Phát");
    });

    it("synchronizes timeupdate event and calls onTimeUpdate callback", async () => {
      const onTimeUpdate = mock((_time: number) => {});
      await act(async () => {
        root.render(
          <AudioReviewPlayer
            src="https://example.com/audio.wav"
            ariaLabel="Bản ghi âm kiểm thử"
            onTimeUpdate={onTimeUpdate}
          />
        );
      });

      const instance = mockInstances[0];
      await act(async () => {
        instance.emit("ready", 30);
      });

      await act(async () => {
        instance.emit("timeupdate", 5.4);
      });

      const timeDisplay = container.querySelector(
        '[data-testid="audio-player-time"]'
      );
      expect(timeDisplay?.textContent).toContain("00:05");
      expect(onTimeUpdate).toHaveBeenCalledWith(5.4);
    });

    it("preserves correct finish semantics: isPlaying=false, currentTime=duration, onTimeUpdate(duration)", async () => {
      const onTimeUpdate = mock((_time: number) => {});
      await act(async () => {
        root.render(
          <AudioReviewPlayer
            src="https://example.com/audio.wav"
            ariaLabel="Bản ghi âm kiểm thử"
            onTimeUpdate={onTimeUpdate}
          />
        );
      });

      const instance = mockInstances[0];
      instance.duration = 25;
      await act(async () => {
        instance.emit("ready", 25);
        instance.emit("play");
      });

      const playBtn = container.querySelector(
        '[data-testid="audio-player-play-pause"]'
      ) as HTMLButtonElement;
      expect(playBtn.getAttribute("aria-label")).toBe("Tạm dừng");

      await act(async () => {
        instance.emit("finish");
      });

      // Player stops playing, currentTime is duration (not 0), time shows 00:25 / 00:25
      expect(playBtn.getAttribute("aria-label")).toBe("Phát");
      const timeDisplay = container.querySelector(
        '[data-testid="audio-player-time"]'
      );
      expect(timeDisplay?.textContent).toBe("00:25/00:25");
      expect(onTimeUpdate).toHaveBeenCalledWith(25);
    });

    it("synchronizes error event into accessible alert display", async () => {
      await act(async () => {
        root.render(
          <AudioReviewPlayer
            src="https://example.com/audio.wav"
            ariaLabel="Bản ghi âm kiểm thử"
          />
        );
      });

      const instance = mockInstances[0];
      await act(async () => {
        instance.emit("error", new Error("Decoding audio failed"));
      });

      const alert = container.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert?.textContent).toContain("Decoding audio failed");
    });
  });

  describe("Imperative Ref Controls", () => {
    it("supports seekTo, play, and pause through ref", async () => {
      const ref = React.createRef<AudioReviewPlayerRef>();
      await act(async () => {
        root.render(
          <AudioReviewPlayer
            ref={ref}
            src="https://example.com/audio.wav"
            ariaLabel="Bản ghi âm kiểm thử"
          />
        );
      });

      const instance = mockInstances[0];
      instance.duration = 20;
      await act(async () => {
        instance.emit("ready", 20);
      });

      expect(ref.current).not.toBeNull();

      // seekTo(10) -> progress 10/20 = 0.5
      await act(async () => {
        ref.current?.seekTo(10);
      });
      expect(instance.seekTo).toHaveBeenCalledWith(0.5);

      // play()
      await act(async () => {
        await ref.current?.play();
      });
      expect(instance.play).toHaveBeenCalled();

      // pause()
      await act(async () => {
        ref.current?.pause();
      });
      expect(instance.pause).toHaveBeenCalled();
    });
  });

  describe("User Controls", () => {
    it("changes playback rate with pitch preservation via setPlaybackRate", async () => {
      await act(async () => {
        root.render(
          <AudioReviewPlayer
            src="https://example.com/audio.wav"
            ariaLabel="Bản ghi âm kiểm thử"
          />
        );
      });

      const instance = mockInstances[0];
      await act(async () => {
        instance.emit("ready", 10);
      });

      const speed15Btn = container.querySelector(
        '[data-testid="audio-player-speed-1.5"]'
      ) as HTMLButtonElement;
      expect(speed15Btn).not.toBeNull();

      await act(async () => {
        speed15Btn.click();
      });

      expect(instance.setPlaybackRate).toHaveBeenCalledWith(1.5, true);
      expect(speed15Btn.getAttribute("aria-pressed")).toBe("true");
    });

    it("activates marker, seeks player via setTime, and fires onMarkerActivate", async () => {
      const onMarkerActivate = mock((_id: string) => {});
      const markers: AudioReviewMarker[] = [
        { id: "mark_1", timeSeconds: 4.5, label: "Pronunciation slip" },
      ];

      await act(async () => {
        root.render(
          <AudioReviewPlayer
            src="https://example.com/audio.wav"
            ariaLabel="Bản ghi âm kiểm thử"
            markers={markers}
            onMarkerActivate={onMarkerActivate}
          />
        );
      });

      const instance = mockInstances[0];
      await act(async () => {
        instance.emit("ready", 10);
      });

      const markerBtn = container.querySelector(
        '[data-testid="audio-marker-mark_1"]'
      ) as HTMLButtonElement;
      expect(markerBtn).not.toBeNull();

      await act(async () => {
        markerBtn.click();
      });

      expect(instance.setTime).toHaveBeenCalledWith(4.5);
      expect(onMarkerActivate).toHaveBeenCalledWith("mark_1");
    });
  });
});
