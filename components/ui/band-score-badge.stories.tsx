import type { Meta, StoryObj } from "@storybook/react";
import { BandScoreBadge } from "./band-score-badge";

const meta: Meta<typeof BandScoreBadge> = {
  title: "UI/BandScoreBadge",
  component: BandScoreBadge,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Component hiển thị điểm số IELTS Band từ 1.0 đến 9.0 với 4 phân tầng màu sắc năng lực chuẩn (Expert: Emerald, Competent: Blue, Modest: Amber, Limited: Rose).",
      },
    },
  },
  args: {
    score: 7.5,
    size: "md",
    showPrefix: true,
    showDescriptor: false,
    descriptorLang: "vi",
  },
  argTypes: {
    score: {
      control: { type: "number", min: 1.0, max: 9.0, step: 0.5 },
      description: "Điểm số Band IELTS (1.0 - 9.0 theo bước 0.5)",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "xl"],
      description: "Kích thước badge",
    },
    showPrefix: {
      control: "boolean",
      description: "Hiển thị chữ 'Band' phía trước số điểm",
    },
    showDescriptor: {
      control: "boolean",
      description: "Hiển thị nhãn mô tả trình độ CEFR/IELTS",
    },
    descriptorLang: {
      control: "radio",
      options: ["vi", "en"],
      description: "Ngôn ngữ của nhãn mô tả",
    },
  },
};

export default meta;
type Story = StoryObj<typeof BandScoreBadge>;

export const Default: Story = {
  args: {
    score: 7.5,
  },
};

export const ExpertBand: Story = {
  args: {
    score: 8.5,
    showDescriptor: true,
    size: "lg",
  },
};

export const CompetentBand: Story = {
  args: {
    score: 7.0,
    showDescriptor: true,
    size: "md",
  },
};

export const ModestBand: Story = {
  args: {
    score: 5.5,
    showDescriptor: true,
    size: "md",
  },
};

export const LimitedBand: Story = {
  args: {
    score: 4.5,
    showDescriptor: true,
    size: "md",
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <BandScoreBadge score={8.0} size="sm" />
      <BandScoreBadge score={8.0} size="md" />
      <BandScoreBadge score={8.0} size="lg" />
      <BandScoreBadge score={8.0} size="xl" />
    </div>
  ),
};

export const AllBandTiersMatrix: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <BandScoreBadge score={9.0} showDescriptor />
        <BandScoreBadge score={8.5} showDescriptor />
        <BandScoreBadge score={8.0} showDescriptor />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <BandScoreBadge score={7.5} showDescriptor />
        <BandScoreBadge score={7.0} showDescriptor />
        <BandScoreBadge score={6.5} showDescriptor />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <BandScoreBadge score={6.0} showDescriptor />
        <BandScoreBadge score={5.5} showDescriptor />
        <BandScoreBadge score={5.0} showDescriptor />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <BandScoreBadge score={4.5} showDescriptor />
        <BandScoreBadge score={4.0} showDescriptor />
        <BandScoreBadge score={3.5} showDescriptor />
      </div>
    </div>
  ),
};
