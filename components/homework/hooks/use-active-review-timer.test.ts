import { describe, it, expect } from "bun:test";
import { formatReviewDuration } from "./use-active-review-timer";

describe("ActiveReviewTimer Utilities (Issue #76, Ticket #52 Kịch bản 5)", () => {
  it("should format duration in MM:SS correctly", () => {
    expect(formatReviewDuration(0)).toBe("00:00");
    expect(formatReviewDuration(-500)).toBe("00:00");
    expect(formatReviewDuration(45000)).toBe("00:45");
    expect(formatReviewDuration(90000)).toBe("01:30");
    expect(formatReviewDuration(150000)).toBe("02:30");
    expect(formatReviewDuration(3665000)).toBe("61:05");
  });

  it("should handle rounding down fractional seconds", () => {
    expect(formatReviewDuration(1200)).toBe("00:01");
    expect(formatReviewDuration(1999)).toBe("00:01");
    expect(formatReviewDuration(2000)).toBe("00:02");
  });
});
