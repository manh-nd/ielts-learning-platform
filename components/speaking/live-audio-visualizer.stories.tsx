import type { Meta, StoryObj } from "@storybook/react";
import { useState, useEffect } from "react";
import { LiveAudioVisualizer } from "./live-audio-visualizer";

const meta: Meta<typeof LiveAudioVisualizer> = {
  title: "Product/Speaking/LiveAudioVisualizer",
  component: LiveAudioVisualizer,
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
type Story = StoryObj<typeof LiveAudioVisualizer>;

/**
 * 1. Active live audio recording stream with connected AnalyserNode
 */
export const ActiveMicStream: Story = {
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
          <LiveAudioVisualizer
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
 * 2. Paused recording stream (freezes into low-amplitude calm baseline)
 */
export const PausedMicStream: Story = {
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
          <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
            Tạm dừng thu âm
          </span>
          <span>isPaused: true</span>
        </div>
        <div className="p-3 bg-muted/40 rounded-lg border">
          <LiveAudioVisualizer
            analyserNode={analyser}
            isPaused={true}
            height={68}
            barCount={42}
          />
        </div>
      </div>
    );
  },
};

/**
 * 3. Idle standby baseline without connected AnalyserNode
 */
export const IdleWithoutNode: Story = {
  args: {
    analyserNode: null,
    barCount: 40,
    height: 64,
  },
};
