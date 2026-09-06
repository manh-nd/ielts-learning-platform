import { describe, it, expect } from "bun:test";
import { renderToString } from "react-dom/server";
import {
  AudioReviewPlayer,
  type AudioReviewMarker,
} from "./audio-review-player";

describe("AudioReviewPlayer Component", () => {
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
