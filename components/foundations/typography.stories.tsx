import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Design System/Foundations/Typography",
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj;

const VIETNAMESE_PROBE_CHARS =
  "ă â ê ô ơ ư đ ắ ằ ẳ ẵ ặ ế ề ể ễ ệ ớ ờ ở ỡ ợ ứ ừ ử ữ ự Ă Â Ê Ô Ơ Ư Đ Ắ Ằ Ẳ Ẵ Ặ Ế Ề Ể Ễ Ệ Ớ Ờ Ở Ỡ Ợ Ứ Ừ Ử Ữ Ự";

const SAMPLE_PARAGRAPH =
  "Nền tảng Chilly IELTS cung cấp hệ thống phòng luyện thi ảo thông minh kết hợp trí tuệ nhân tạo và đội ngũ giảng viên chuyên môn cao. Thí sinh được trải nghiệm chấm chữa chi tiết từng tiêu chí: Độ trôi chảy, Vốn từ vựng, Ngữ pháp chính xác và Phát âm chuẩn xác.";

export const VietnameseCoverage: Story = {
  render: () => (
    <div className="max-w-4xl mx-auto p-6 space-y-8 font-sans text-foreground">
      {/* Dedicated font probe for automated Chromium CDP platform font verification */}
      <div
        data-testid="vietnamese-font-probe"
        className="text-base font-normal tracking-normal border p-3 rounded-md bg-muted/20"
      >
        {VIETNAMESE_PROBE_CHARS}
      </div>

      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          Typography System — Vietnamese & Latin Extended Coverage
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verification of deterministic typography rendering using project-owned{" "}
          <code className="text-xs font-mono text-foreground font-semibold bg-muted px-1.5 py-0.5 rounded">
            Chilly Inter
          </code>{" "}
          and{" "}
          <code className="text-xs font-mono text-foreground font-semibold bg-muted px-1.5 py-0.5 rounded">
            Chilly Geist Mono
          </code>
          .
        </p>
      </div>

      {/* Weight Spectrum: Upright */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Production Weights (Normal / Upright)
        </h2>

        <div className="space-y-3">
          <div className="p-4 rounded-lg border bg-card space-y-1">
            <div className="flex justify-between items-center text-xs text-muted-foreground font-mono">
              <span>Weight 400 — Regular</span>
              <span>font-normal</span>
            </div>
            <p className="text-base font-normal leading-relaxed">
              {SAMPLE_PARAGRAPH}
            </p>
            <p className="text-sm font-normal text-muted-foreground">
              {VIETNAMESE_PROBE_CHARS}
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-card space-y-1">
            <div className="flex justify-between items-center text-xs text-muted-foreground font-mono">
              <span>Weight 500 — Medium</span>
              <span>font-medium</span>
            </div>
            <p className="text-base font-medium leading-relaxed">
              {SAMPLE_PARAGRAPH}
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              {VIETNAMESE_PROBE_CHARS}
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-card space-y-1">
            <div className="flex justify-between items-center text-xs text-muted-foreground font-mono">
              <span>Weight 600 — Semibold</span>
              <span>font-semibold</span>
            </div>
            <p className="text-base font-semibold leading-relaxed">
              {SAMPLE_PARAGRAPH}
            </p>
            <p className="text-sm font-semibold text-muted-foreground">
              {VIETNAMESE_PROBE_CHARS}
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-card space-y-1">
            <div className="flex justify-between items-center text-xs text-muted-foreground font-mono">
              <span>Weight 700 — Bold</span>
              <span>font-bold</span>
            </div>
            <p className="text-base font-bold leading-relaxed">
              {SAMPLE_PARAGRAPH}
            </p>
            <p className="text-sm font-bold text-muted-foreground">
              {VIETNAMESE_PROBE_CHARS}
            </p>
          </div>
        </div>
      </section>

      {/* Weight Spectrum: Italic */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Production Weights (Italic)
        </h2>

        <div className="space-y-3">
          <div className="p-4 rounded-lg border bg-card space-y-1 italic">
            <div className="flex justify-between items-center text-xs text-muted-foreground font-mono not-italic">
              <span>Weight 400 — Regular Italic</span>
              <span>font-normal italic</span>
            </div>
            <p className="text-base font-normal leading-relaxed">
              {SAMPLE_PARAGRAPH}
            </p>
            <p className="text-sm font-normal text-muted-foreground">
              {VIETNAMESE_PROBE_CHARS}
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-card space-y-1 italic">
            <div className="flex justify-between items-center text-xs text-muted-foreground font-mono not-italic">
              <span>Weight 600 — Semibold Italic</span>
              <span>font-semibold italic</span>
            </div>
            <p className="text-base font-semibold leading-relaxed">
              {SAMPLE_PARAGRAPH}
            </p>
            <p className="text-sm font-semibold text-muted-foreground">
              {VIETNAMESE_PROBE_CHARS}
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-card space-y-1 italic">
            <div className="flex justify-between items-center text-xs text-muted-foreground font-mono not-italic">
              <span>Weight 700 — Bold Italic</span>
              <span>font-bold italic</span>
            </div>
            <p className="text-base font-bold leading-relaxed">
              {SAMPLE_PARAGRAPH}
            </p>
            <p className="text-sm font-bold text-muted-foreground">
              {VIETNAMESE_PROBE_CHARS}
            </p>
          </div>
        </div>
      </section>

      {/* Monospace Technical Spectrum */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Monospace Contract (ASCII / Numerics / Technical)
        </h2>

        <div className="p-4 rounded-lg border bg-card space-y-2">
          <div className="flex justify-between items-center text-xs text-muted-foreground font-mono">
            <span>Chilly Geist Mono Variable</span>
            <span>font-mono</span>
          </div>
          <div className="font-mono text-sm space-y-1">
            <div>0123456789 (Band 7.5, Duration: 02:45, Tokens: 1,420)</div>
            <div>FC: 8.0 • LR: 7.5 • GRA: 7.0 • PR: 7.5</div>
            <div>[STATUS_OK] latency=42ms model=gemini-3.7-flash</div>
          </div>
        </div>
      </section>
    </div>
  ),
};
