import type { Meta, StoryObj } from "@storybook/react";
import { useState, useEffect } from "react";
import { expect, userEvent, within, fn, waitFor } from "storybook/test";
import {
  AudioReviewPlayer,
  type AudioReviewMarker,
} from "./audio-review-player";
import {
  restoreNativeAudioApis,
  resetAudioMocks,
} from "../../.storybook/mocks/audio-api.mock";
import { createSteppedEnvelopeWavBlob } from "@/test/fixtures/audio-fixtures";

const meta: Meta<typeof AudioReviewPlayer> = {
  title: "Patterns/Audio/AudioReviewPlayer",
  component: AudioReviewPlayer,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[520px] p-4 bg-background border rounded-xl shadow-xs">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => {
    // Restore native browser Web Audio for authentic binary waveform decoding
    restoreNativeAudioApis();
  },
  afterEach: () => {
    // Restore mock environment for subsequent stories
    resetAudioMocks();
  },
};

export default meta;
type Story = StoryObj<typeof AudioReviewPlayer>;

const sampleMarkers: AudioReviewMarker[] = [
  { id: "marker-1", timeSeconds: 0.6, label: "Trọng âm từ chưa chuẩn" },
  { id: "marker-2", timeSeconds: 1.2, label: "Ngắt nghỉ tự nhiên" },
];

/**
 * Story helper that generates an authentic 2-second stepped-envelope WAV blob on mount
 * and properly revokes the object URL on unmount to prevent memory leaks.
 */
function SteppedAudioFixtureWrapper({
  markers,
  onMarkerActivate,
  muted = true,
}: {
  markers?: readonly AudioReviewMarker[];
  onMarkerActivate?: (id: string) => void;
  muted?: boolean;
}) {
  const [blobUrl] = useState<string>(() => {
    const blob = createSteppedEnvelopeWavBlob(2);
    return URL.createObjectURL(blob);
  });

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  return (
    <AudioReviewPlayer
      src={blobUrl}
      ariaLabel="Bản ghi âm mẫu kiểm thử"
      markers={markers}
      onMarkerActivate={onMarkerActivate}
      muted={muted}
    />
  );
}

/**
 * Helper to measure the maximum vertical pixel spread of painted waveform bars
 * across a horizontal window (startPercent to endPercent).
 */
function measureWindowVerticalSpread(
  canvas: HTMLCanvasElement,
  startPercent: number,
  endPercent: number
): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;

  const width = canvas.width;
  const height = canvas.height;
  const startX = Math.floor(width * startPercent);
  const endX = Math.floor(width * endPercent);

  const imgData = ctx.getImageData(
    startX,
    0,
    Math.max(1, endX - startX),
    height
  );
  const data = imgData.data;
  const w = Math.max(1, endX - startX);

  let maxSpread = 0;
  for (let col = 0; col < w; col++) {
    let top = height;
    let bottom = 0;
    for (let row = 0; row < height; row++) {
      const idx = (row * w + col) * 4;
      const alpha = data[idx + 3];
      if (alpha > 50) {
        if (row < top) top = row;
        if (row > bottom) bottom = row;
      }
    }
    if (bottom >= top) {
      const spread = bottom - top;
      if (spread > maxSpread) maxSpread = spread;
    }
  }

  return maxSpread;
}

/**
 * Scoped helper that intercepts fetch for a mock endpoint returning a pending Promise
 * to deterministically render the loading state without network timing dependencies.
 */
function LoadingAudioFixtureWrapper() {
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes("mock-loading-audio")) {
        return new Promise<Response>(() => {});
      }
      return originalFetch(input, init);
    }) as typeof fetch;
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <AudioReviewPlayer
      src="https://mock-loading-audio.local/audio.wav"
      ariaLabel="Đang tải âm thanh"
    />
  );
}

/**
 * 1. Standby state when no audio source is provided
 */
export const StandbyEmpty: Story = {
  args: {
    src: null,
    ariaLabel: "Chưa có bản ghi âm",
  },
};

/**
 * 2. Deterministic Loading state
 */
export const Loading: Story = {
  render: () => <LoadingAudioFixtureWrapper />,
};

/**
 * 3. Error state when an audio source fails to load
 */
export const BrokenSource: Story = {
  args: {
    src: "/api/invalid-audio-stream-missing.wav",
    ariaLabel: "Bản ghi âm không tồn tại",
  },
};

/**
 * 4. Ready state with authentic stepped-envelope waveform (silence -> low -> high -> silence)
 */
export const ReadyWithSteppedWaveform: Story = {
  render: () => <SteppedAudioFixtureWrapper />,
};

/**
 * 5. Playing state: transition into active playback via play interaction
 */
export const Playing: Story = {
  render: () => <SteppedAudioFixtureWrapper />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const playBtn = await canvas.findByTestId("audio-player-play-pause");
    await waitFor(() => expect(playBtn).not.toBeDisabled(), { timeout: 5000 });
    await userEvent.click(playBtn);
    await waitFor(() => {
      expect(canvas.getByLabelText(/Tạm dừng/i)).toBeInTheDocument();
    });
  },
};

/**
 * 6. Interactive review mode with timestamps and pronunciation markers
 */
export const WithMarkers: Story = {
  render: (args) => (
    <SteppedAudioFixtureWrapper
      markers={sampleMarkers}
      onMarkerActivate={args.onMarkerActivate}
    />
  ),
  args: {
    onMarkerActivate: fn(),
  },
};

/**
 * 7. Real-browser Chromium acceptance interaction test:
 * - Decodes genuine binary audio bytes into WaveSurfer canvas
 * - Accurately reports duration (00:02)
 * - Verifies robust stepped amplitude envelope across horizontal sampling windows
 * - Toggles play/pause state and synchronizes icon/aria-label
 * - Adjusts playback speed with pitch preservation
 * - Activates pronunciation marker and seeks
 */
export const RealAudioInteractionTest: Story = {
  render: (args) => (
    <SteppedAudioFixtureWrapper
      markers={sampleMarkers}
      onMarkerActivate={args.onMarkerActivate}
    />
  ),
  args: {
    onMarkerActivate: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // 1. Wait for player to decode real binary audio and reach ready state
    await waitFor(
      () => {
        expect(
          canvas.getByTestId("audio-player-play-pause")
        ).not.toBeDisabled();
      },
      { timeout: 5000 }
    );
    const playPauseBtn = canvas.getByTestId("audio-player-play-pause");

    // 2. Verify accurate duration decoded from the 2-second WAV fixture
    const timeDisplay = canvas.getByTestId("audio-player-time");
    await expect(timeDisplay.textContent).toContain("00:02");

    // 3. Verify waveform canvas was rendered and reflects stepped amplitude envelope
    const waveformContainer = canvas.getByTestId(
      "audio-waveform-canvas-container"
    );
    const shadowHost = waveformContainer.querySelector("div");
    const waveCanvas = (shadowHost?.shadowRoot?.querySelector("canvas") ||
      waveformContainer.querySelector("canvas")) as HTMLCanvasElement | null;
    expect(waveCanvas).not.toBeNull();
    expect(waveCanvas?.width).toBeGreaterThan(0);

    // Sample horizontal windows across waveform columns:
    // Silence window ~10%, Low amplitude ~35%, High amplitude ~65%, Silence window ~90%
    const silenceSpread1 = measureWindowVerticalSpread(waveCanvas!, 0.08, 0.12);
    const lowSpread = measureWindowVerticalSpread(waveCanvas!, 0.33, 0.37);
    const highSpread = measureWindowVerticalSpread(waveCanvas!, 0.63, 0.67);
    const silenceSpread2 = measureWindowVerticalSpread(waveCanvas!, 0.88, 0.92);

    expect(highSpread).toBeGreaterThan(lowSpread);
    expect(lowSpread).toBeGreaterThan(silenceSpread1);
    expect(lowSpread).toBeGreaterThan(silenceSpread2);

    // 4. Test play button interaction & state synchronization
    await userEvent.click(playPauseBtn);
    await waitFor(() => {
      expect(canvas.getByLabelText(/Tạm dừng/i)).toBeInTheDocument();
    });

    // Pause toggle
    await userEvent.click(playPauseBtn);
    await waitFor(() => {
      expect(canvas.getByLabelText(/^Phát$/i)).toBeInTheDocument();
    });

    // 5. Test reset button (rewinds time to beginning)
    const resetBtn = canvas.getByTestId("audio-player-reset");
    await userEvent.click(resetBtn);
    await waitFor(() => {
      expect(canvas.getByTestId("audio-player-time").textContent).toContain(
        "00:00"
      );
    });

    // 6. Test speed selection (1.2x) & underlying player rate
    const speed12Btn = canvas.getByTestId("audio-player-speed-1.2");
    await userEvent.click(speed12Btn);
    await expect(speed12Btn).toHaveAttribute("aria-pressed", "true");

    const mediaEl = (shadowHost?.shadowRoot?.querySelector("audio") ||
      waveformContainer.querySelector("audio")) as HTMLAudioElement | null;
    expect(mediaEl).not.toBeNull();
    expect(mediaEl!.playbackRate).toBe(1.2);
    expect(mediaEl!.preservesPitch).toBe(true);

    // 7. Test marker activation and seeking
    const marker2Btn = canvas.getByTestId("audio-marker-marker-2");
    await userEvent.click(marker2Btn);
    expect(args.onMarkerActivate).toHaveBeenCalledWith("marker-2");

    // Marker 2 is at 1.2s -> asserts real media currentTime and time display
    await waitFor(() => {
      expect(mediaEl!.currentTime).toBeCloseTo(1.2, 1);
      expect(canvas.getByTestId("audio-player-time").textContent).toContain(
        "00:01"
      );
    });
  },
};
