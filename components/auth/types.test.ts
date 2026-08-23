import { describe, expect, it } from "bun:test";
import { evaluatePasswordStrength } from "./types";

describe("evaluatePasswordStrength", () => {
  it("should rate empty password as score 0 and Rất yếu", () => {
    const res = evaluatePasswordStrength("");
    expect(res.score).toBe(0);
    expect(res.label).toBe("Rất yếu");
    expect(res.criteria.minLength).toBe(false);
    expect(res.criteria.hasUppercase).toBe(false);
    expect(res.criteria.hasLowercase).toBe(false);
    expect(res.criteria.hasNumberOrSpecial).toBe(false);
  });

  it("should rate single criterion password as score 1 and Yếu", () => {
    const res = evaluatePasswordStrength("abcdefgh");
    expect(res.criteria.minLength).toBe(true);
    expect(res.criteria.hasLowercase).toBe(true);
    expect(res.criteria.hasUppercase).toBe(false);
    expect(res.criteria.hasNumberOrSpecial).toBe(false);
    expect(res.score).toBe(2);
    expect(res.label).toBe("Trung bình");
  });

  it("should rate 4 criteria password under 12 chars as score 3 and Mạnh", () => {
    const res = evaluatePasswordStrength("Password123!");
    expect(res.criteria.minLength).toBe(true);
    expect(res.criteria.hasUppercase).toBe(true);
    expect(res.criteria.hasLowercase).toBe(true);
    expect(res.criteria.hasNumberOrSpecial).toBe(true);
    expect(res.score).toBe(4);
    expect(res.label).toBe("Rất mạnh");
  });

  it("should rate 4 criteria password with 12+ chars as score 4 and Rất mạnh", () => {
    const res = evaluatePasswordStrength("StrongPassword2026!#");
    expect(res.criteria.minLength).toBe(true);
    expect(res.criteria.hasUppercase).toBe(true);
    expect(res.criteria.hasLowercase).toBe(true);
    expect(res.criteria.hasNumberOrSpecial).toBe(true);
    expect(res.score).toBe(4);
    expect(res.label).toBe("Rất mạnh");
  });
});
