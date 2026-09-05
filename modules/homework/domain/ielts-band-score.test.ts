import { expect, it } from "bun:test";
import { getIeltsBandScoreIssue } from "./ielts-band-score";

it("accepts IELTS scores from zero to nine in half-band steps", () => {
  for (const score of [0, 0.5, 6, 6.5, 9])
    expect(getIeltsBandScoreIssue(score)).toBeNull();
});

it("rejects non-numbers, non-finite values, out-of-range scores and fractional steps", () => {
  for (const score of [undefined, null, "7", NaN, {}, true])
    expect(getIeltsBandScoreIssue(score)).toBe("not_number");
  for (const score of [-0.5, 9.5, Infinity, -Infinity])
    expect(getIeltsBandScoreIssue(score)).toBe("out_of_range");
  for (const score of [6.1, 6.25, 6.75])
    expect(getIeltsBandScoreIssue(score)).toBe("invalid_step");
});
