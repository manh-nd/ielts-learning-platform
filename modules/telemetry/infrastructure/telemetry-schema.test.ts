import { describe, it, expect } from "bun:test";
import { telemetryEvents } from "./telemetry-schema";
import { getTableColumns } from "drizzle-orm";
import {
  SPEAKING_PRACTICE_EVENT_NAMES,
  SPEAKING_HOMEWORK_EVENT_NAMES,
  TELEMETRY_EVENT_NAMES,
  isValidTelemetryEventName,
  isValidTelemetryContextType,
  isValidTelemetryUserRole,
} from "../domain/telemetry-types";

describe("Telemetry Database Schema & Domain Contracts (Acceptance Contract §7.1, §7.2)", () => {
  it("should define telemetry_events table with expected columns and types", () => {
    const columns = getTableColumns(telemetryEvents);

    expect(columns.id).toBeDefined();
    expect(columns.id.primary).toBe(true);

    expect(columns.userId).toBeDefined();
    expect(columns.userId.notNull).toBe(true);

    expect(columns.userRole).toBeDefined();
    expect(columns.userRole.notNull).toBe(true);

    expect(columns.eventName).toBeDefined();
    expect(columns.eventName.notNull).toBe(true);

    expect(columns.contextType).toBeDefined();
    expect(columns.contextType.notNull).toBe(true);

    expect(columns.contextId).toBeDefined();
    expect(columns.contextId.notNull).toBe(false);

    expect(columns.durationMs).toBeDefined();
    expect(columns.durationMs.notNull).toBe(false);

    expect(columns.properties).toBeDefined();
    expect(columns.properties.notNull).toBe(true);

    expect(columns.createdAt).toBeDefined();
    expect(columns.createdAt.notNull).toBe(true);
  });

  it("should validate all speaking practice events against taxonomy", () => {
    expect(SPEAKING_PRACTICE_EVENT_NAMES).toContain("practice_started");
    expect(SPEAKING_PRACTICE_EVENT_NAMES).toContain("practice_audio_recorded");
    expect(SPEAKING_PRACTICE_EVENT_NAMES).toContain(
      "practice_submitted_for_feedback"
    );
    expect(SPEAKING_PRACTICE_EVENT_NAMES).toContain("practice_feedback_ready");
    expect(SPEAKING_PRACTICE_EVENT_NAMES).toContain("practice_again_started");
    expect(SPEAKING_PRACTICE_EVENT_NAMES).toContain("practice_audio_error");
    expect(SPEAKING_PRACTICE_EVENT_NAMES).toContain("practice_purged");

    for (const eventName of SPEAKING_PRACTICE_EVENT_NAMES) {
      expect(isValidTelemetryEventName(eventName)).toBe(true);
      expect(TELEMETRY_EVENT_NAMES).toContain(eventName);
    }
  });

  it("should validate all speaking homework events against taxonomy", () => {
    expect(SPEAKING_HOMEWORK_EVENT_NAMES).toContain("homework_viewed");
    expect(SPEAKING_HOMEWORK_EVENT_NAMES).toContain(
      "homework_record_completed"
    );
    expect(SPEAKING_HOMEWORK_EVENT_NAMES).toContain("homework_submitted");
    expect(SPEAKING_HOMEWORK_EVENT_NAMES).toContain("homework_resubmitted");
    expect(SPEAKING_HOMEWORK_EVENT_NAMES).toContain(
      "homework_submit_conflict_rejected"
    );
    expect(SPEAKING_HOMEWORK_EVENT_NAMES).toContain("teacher_review_opened");
    expect(SPEAKING_HOMEWORK_EVENT_NAMES).toContain(
      "teacher_ai_proposal_accepted"
    );
    expect(SPEAKING_HOMEWORK_EVENT_NAMES).toContain(
      "teacher_ai_proposal_rejected"
    );
    expect(SPEAKING_HOMEWORK_EVENT_NAMES).toContain(
      "teacher_assessment_published"
    );

    for (const eventName of SPEAKING_HOMEWORK_EVENT_NAMES) {
      expect(isValidTelemetryEventName(eventName)).toBe(true);
      expect(TELEMETRY_EVENT_NAMES).toContain(eventName);
    }
  });

  it("should reject invalid event names, context types, and user roles", () => {
    expect(isValidTelemetryEventName("arbitrary_event")).toBe(false);
    expect(isValidTelemetryEventName("")).toBe(false);
    expect(isValidTelemetryEventName(null)).toBe(false);

    expect(isValidTelemetryContextType("practice")).toBe(true);
    expect(isValidTelemetryContextType("homework")).toBe(true);
    expect(isValidTelemetryContextType("system")).toBe(true);
    expect(isValidTelemetryContextType("classroom")).toBe(false);

    expect(isValidTelemetryUserRole("learner")).toBe(true);
    expect(isValidTelemetryUserRole("teacher")).toBe(true);
    expect(isValidTelemetryUserRole("system")).toBe(true);
    expect(isValidTelemetryUserRole("admin")).toBe(false);
  });
});
