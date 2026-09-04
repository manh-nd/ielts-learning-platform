import { describe, it, expect, beforeEach } from "bun:test";
import { telemetryEvents } from "./telemetry-schema";
import { getTableColumns } from "drizzle-orm";
import {
  SPEAKING_PRACTICE_EVENT_NAMES,
  SPEAKING_HOMEWORK_EVENT_NAMES,
  TELEMETRY_EVENT_NAMES,
  isValidTelemetryEventName,
  isValidTelemetryContextType,
  isValidTelemetryUserRole,
  isRoleAuthorizedForEvent,
} from "../domain/telemetry-types";
import {
  recordTelemetryEvent,
  queryTelemetryEvents,
  clearDevTelemetryCache,
} from "./telemetry-repository";

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

  it("should enforce RBAC authorization matrix for learner, teacher, and system", () => {
    // Learner authorization
    expect(isRoleAuthorizedForEvent("learner", "practice_started")).toBe(true);
    expect(isRoleAuthorizedForEvent("learner", "practice_audio_error")).toBe(
      true
    );
    expect(isRoleAuthorizedForEvent("learner", "homework_submitted")).toBe(
      true
    );
    expect(
      isRoleAuthorizedForEvent("learner", "teacher_assessment_published")
    ).toBe(false);
    expect(isRoleAuthorizedForEvent("learner", "practice_purged")).toBe(true);

    // Teacher authorization
    expect(
      isRoleAuthorizedForEvent("teacher", "teacher_assessment_published")
    ).toBe(true);
    expect(
      isRoleAuthorizedForEvent("teacher", "teacher_ai_proposal_accepted")
    ).toBe(true);
    expect(isRoleAuthorizedForEvent("teacher", "homework_viewed")).toBe(true);
    expect(isRoleAuthorizedForEvent("teacher", "practice_started")).toBe(false);
    expect(isRoleAuthorizedForEvent("teacher", "practice_audio_error")).toBe(
      false
    );
    expect(isRoleAuthorizedForEvent("teacher", "practice_purged")).toBe(false);

    // System authorization (can emit all events)
    for (const event of TELEMETRY_EVENT_NAMES) {
      expect(isRoleAuthorizedForEvent("system", event)).toBe(true);
    }
  });

  describe("Telemetry Repository & Cache Fallback", () => {
    beforeEach(() => {
      clearDevTelemetryCache();
    });

    it("should store and query telemetry events with accurate filters", async () => {
      await recordTelemetryEvent({
        userId: "user_repo_test_1",
        userRole: "learner",
        eventName: "practice_started",
        contextType: "practice",
        contextId: "ses_repo_1",
      });

      await recordTelemetryEvent({
        userId: "user_repo_test_1",
        userRole: "learner",
        eventName: "practice_feedback_ready",
        contextType: "practice",
        contextId: "ses_repo_1",
        durationMs: 3100,
      });

      await recordTelemetryEvent({
        userId: "user_repo_test_2",
        userRole: "teacher",
        eventName: "teacher_assessment_published",
        contextType: "homework",
        contextId: "hw_repo_2",
      });

      // Query by user
      const user1Events = await queryTelemetryEvents({
        userId: "user_repo_test_1",
      });
      expect(user1Events.length).toBe(2);

      // Query by eventName
      const startedEvents = await queryTelemetryEvents({
        eventName: "practice_started",
      });
      expect(startedEvents.length).toBe(1);
      expect(startedEvents[0].userId).toBe("user_repo_test_1");

      // Query with non-matching filter returns empty array [] without error
      const nonExistent = await queryTelemetryEvents({
        userId: "non_existent_user",
      });
      expect(nonExistent).toEqual([]);
    });
  });
});
