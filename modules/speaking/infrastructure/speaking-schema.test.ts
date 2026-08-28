import { describe, it, expect } from "bun:test";
import {
  speakingSessions,
  speakingResponses,
  speakingReviewAnnotations,
} from "./speaking-schema";
import { getTableColumns } from "drizzle-orm";

describe("Speaking Database Schema (ADR-0004)", () => {
  it("should define speakingSessions table with expected columns and metadata", () => {
    const columns = getTableColumns(speakingSessions);

    expect(columns.id).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.candidateName).toBeDefined();
    expect(columns.topicTitle).toBeDefined();
    expect(columns.status).toBeDefined();
    expect(columns.durationSeconds).toBeDefined();
    expect(columns.overallBand).toBeDefined();
    expect(columns.scorecardJson).toBeDefined();
    expect(columns.evidenceJson).toBeDefined();
    expect(columns.createdAt).toBeDefined();
    expect(columns.updatedAt).toBeDefined();
  });

  it("should define speakingResponses table with question/part markers and transcript columns", () => {
    const columns = getTableColumns(speakingResponses);

    expect(columns.id).toBeDefined();
    expect(columns.sessionId).toBeDefined();
    expect(columns.partNumber).toBeDefined();
    expect(columns.itemIndex).toBeDefined();
    expect(columns.promptQuestion).toBeDefined();
    expect(columns.storageKey).toBeDefined();
    expect(columns.audioUrl).toBeDefined();
    expect(columns.mimeType).toBeDefined();
    expect(columns.startMs).toBeDefined();
    expect(columns.endMs).toBeDefined();
    expect(columns.durationSeconds).toBeDefined();
    expect(columns.liveTranscript).toBeDefined();
    expect(columns.verifiedTranscript).toBeDefined();
    expect(columns.createdAt).toBeDefined();
  });

  it("should define speakingReviewAnnotations table with timestamp clips and teacher review fields", () => {
    const columns = getTableColumns(speakingReviewAnnotations);

    expect(columns.id).toBeDefined();
    expect(columns.sessionId).toBeDefined();
    expect(columns.responseId).toBeDefined();
    expect(columns.category).toBeDefined();
    expect(columns.timestampSeconds).toBeDefined();
    expect(columns.audioClipStartMs).toBeDefined();
    expect(columns.audioClipEndMs).toBeDefined();
    expect(columns.originalQuote).toBeDefined();
    expect(columns.comment).toBeDefined();
    expect(columns.createdAt).toBeDefined();
  });

  it("should support nullable userId for guest/mock test candidate sessions", () => {
    const columns = getTableColumns(speakingSessions);
    // userId is nullable for guest/anonymous mock tests
    expect(columns.userId.notNull).toBe(false);
    expect(columns.candidateName.notNull).toBe(false);
    expect(columns.topicTitle.notNull).toBe(true);
  });
});
