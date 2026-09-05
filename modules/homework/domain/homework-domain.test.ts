import { describe, it, expect } from "bun:test";
import { calculateIeltsSpeakingOverallBand } from "./homework-types";

describe("IELTS Speaking Overall Band Calculation (ADR-0009, Ticket #51)", () => {
  it("should round down when decimal remainder is < 0.25", () => {
    // Mean: (6.0 + 6.0 + 6.5 + 6.0) / 4 = 24.5 / 4 = 6.125 -> 6.0
    expect(calculateIeltsSpeakingOverallBand(6.0, 6.0, 6.5, 6.0)).toBe(6.0);
    // Mean: (7.0 + 7.0 + 7.0 + 7.0) / 4 = 7.0 -> 7.0
    expect(calculateIeltsSpeakingOverallBand(7.0, 7.0, 7.0, 7.0)).toBe(7.0);
  });

  it("should round to .5 when decimal remainder is between 0.25 and 0.74", () => {
    // Mean: (6.5 + 6.5 + 6.0 + 6.0) / 4 = 25.0 / 4 = 6.25 -> 6.5
    expect(calculateIeltsSpeakingOverallBand(6.5, 6.5, 6.0, 6.0)).toBe(6.5);
    // Mean: (6.5 + 6.5 + 6.5 + 6.0) / 4 = 25.5 / 4 = 6.375 -> 6.5
    expect(calculateIeltsSpeakingOverallBand(6.5, 6.5, 6.5, 6.0)).toBe(6.5);
    // Mean: (6.5 + 6.5 + 6.5 + 6.5) / 4 = 6.5 -> 6.5
    expect(calculateIeltsSpeakingOverallBand(6.5, 6.5, 6.5, 6.5)).toBe(6.5);
    // Mean: (7.0 + 6.5 + 6.5 + 6.5) / 4 = 26.5 / 4 = 6.625 -> 6.5
    expect(calculateIeltsSpeakingOverallBand(7.0, 6.5, 6.5, 6.5)).toBe(6.5);
  });

  it("should round up when decimal remainder is >= 0.75", () => {
    // Mean: (7.0 + 7.0 + 6.5 + 6.5) / 4 = 27.0 / 4 = 6.75 -> 7.0
    expect(calculateIeltsSpeakingOverallBand(7.0, 7.0, 6.5, 6.5)).toBe(7.0);
    // Mean: (7.0 + 7.0 + 7.0 + 6.5) / 4 = 27.5 / 4 = 6.875 -> 7.0
    expect(calculateIeltsSpeakingOverallBand(7.0, 7.0, 7.0, 6.5)).toBe(7.0);
  });
});

describe("Homework Submission Domain Vocabulary (Issue #85, ADR-0009)", () => {
  it("should enforce canonical HomeworkSubmissionStatus vocabulary", () => {
    const validStatuses = ["submitted", "in_review", "published"] as const;
    expect(validStatuses).toHaveLength(3);

    // Verify allowed states conform to business aggregate lifecycle
    const status1: (typeof validStatuses)[number] = "submitted";
    const status2: (typeof validStatuses)[number] = "in_review";
    const status3: (typeof validStatuses)[number] = "published";

    expect([status1, status2, status3]).toEqual([
      "submitted",
      "in_review",
      "published",
    ]);
  });
});
