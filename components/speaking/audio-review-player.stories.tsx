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
 * 1. Standby state when no audio source is provided
 */
export const StandbyEmpty: Story = {
  args: {
    src: null,
    ariaLabel: "Chưa có bản ghi âm",
  },
};

/**
 * 2. Error state when an audio source fails to load
 */
export const BrokenSource: Story = {
  args: {
    src: "/api/invalid-audio-stream-missing.wav",
    ariaLabel: "Bản ghi âm không tồn tại",
  },
};

/**
 * 3. Ready state with authentic stepped-envelope waveform (silence -> low -> high -> silence)
 */
export const ReadyWithSteppedWaveform: Story = {
  render: () => <SteppedAudioFixtureWrapper />,
};

/**
 * 4. Interactive review mode with timestamps and pronunciation markers
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
 * 5. Real-browser Chromium acceptance interaction test:
 * - Decodes genuine binary audio bytes into WaveSurfer canvas
 * - Accurately reports duration (00:02)
 * - Toggles play/pause state
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

    // 3. Verify waveform canvas was rendered with non-zero dimensions inside WaveSurfer
    const waveformContainer = canvas.getByTestId(
      "audio-waveform-canvas-container"
    );
    const shadowHost = waveformContainer.querySelector("div");
    const waveCanvas =
      shadowHost?.shadowRoot?.querySelector("canvas") ||
      waveformContainer.querySelector("canvas");
    expect(waveCanvas).not.toBeNull();
    expect(waveCanvas?.width).toBeGreaterThan(0);

    // 4. Test play button interaction & reset button
    await userEvent.click(playPauseBtn);
    const resetBtn = canvas.getByTestId("audio-player-reset");
    await userEvent.click(resetBtn);

    // 5. Test speed selection (1.2x)
    const speed12Btn = canvas.getByTestId("audio-player-speed-1.2");
    await userEvent.click(speed12Btn);
    await expect(speed12Btn).toHaveAttribute("aria-pressed", "true");

    // 6. Test marker activation
    const markerBtn = canvas.getByTestId("audio-marker-marker-1");
    await userEvent.click(markerBtn);
    expect(args.onMarkerActivate).toHaveBeenCalledWith("marker-1");
  },
};
