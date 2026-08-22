import type { Meta, StoryObj } from "@storybook/react";
import React, { useState, useEffect } from "react";
import { AudioWaveformVisualizer } from "./audio-waveform-visualizer";

const meta: Meta<typeof AudioWaveformVisualizer> = {
  title: "IELTS/Speaking/AudioWaveformVisualizer",
  component: AudioWaveformVisualizer,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-[500px] p-6 bg-card border rounded-xl shadow-sm">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AudioWaveformVisualizer>;

/**
 * Live audio recording mode with active AnalyserNode
 */
export const LiveMode: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (typeof window !== "undefined") {
        const AudioCtx =
          window.AudioContext ||
          // @ts-expect-error webkit prefix fallback
          window.webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const node = ctx.createAnalyser();
          setAnalyser(node);
          return () => {
            ctx.close();
          };
        }
      }
    }, []);

    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span className="font-semibold text-destructive flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-destructive animate-ping" />
            Live Voice Frequency Stream
          </span>
          <span>AnalyserNode (FFT: 256)</span>
        </div>
        <div className="p-3 bg-muted/40 rounded-lg border">
          <AudioWaveformVisualizer
            isLive={true}
            analyserNode={analyser}
            height={68}
            barCount={42}
          />
        </div>
      </div>
    );
  },
};

/**
 * Static playback mode with progress at 45%
 */
export const PlaybackModeStatic: Story = {
  args: {
    isLive: false,
    audioDuration: 60,
    currentTime: 27,
    barCount: 40,
    height: 64,
  },
};

/**
 * Interactive playback mode supporting click-to-seek
 */
export const PlaybackInteractiveSeeker: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [time, setTime] = useState<number>(15);
    const duration = 90;

    return (
      <div className="space-y-3">
        <div className="flex justify-between text-xs text-muted-foreground font-mono">
          <span>Click anywhere on waveform to seek:</span>
          <span className="font-bold text-foreground">
            {time.toFixed(1)}s / {duration}s
          </span>
        </div>
        <div className="p-3 bg-muted/30 rounded-lg border">
          <AudioWaveformVisualizer
            isLive={false}
            audioDuration={duration}
            currentTime={time}
            onSeek={(newTime) => setTime(newTime)}
            height={72}
            barCount={48}
          />
        </div>
      </div>
    );
  },
};
