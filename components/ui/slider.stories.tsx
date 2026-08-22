import type { Meta, StoryObj } from "@storybook/react";
import React, { useState } from "react";
import { Slider } from "./slider";

const meta: Meta<typeof Slider> = {
  title: "UI/Slider",
  component: Slider,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Thành phần Slider chọn điểm tiêu chí IELTS (0.0 đến 9.0 theo bước 0.5) cho giáo viên trong màn hình chấm bài (Teacher Review Workspace).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  render: () => (
    <div className="w-80 space-y-2">
      <Slider defaultValue={[7]} min={0} max={9} step={0.5} />
    </div>
  ),
};

export const ScoreSliderWithDisplay: Story = {
  render: function ScoreSliderDemo() {
    const [score, setScore] = useState<number>(7.0);

    return (
      <div className="w-80 p-4 border rounded-lg space-y-3 bg-card text-card-foreground">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold">Task Achievement (TA)</span>
          <span className="font-bold text-primary text-sm">
            Band {score.toFixed(1)}
          </span>
        </div>
        <Slider
          value={[score]}
          onValueChange={(val) => {
            if (Array.isArray(val)) setScore(val[0]);
            else if (typeof val === "number") setScore(val);
          }}
          min={0}
          max={9}
          step={0.5}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0.0</span>
          <span>4.5</span>
          <span>9.0</span>
        </div>
      </div>
    );
  },
};
