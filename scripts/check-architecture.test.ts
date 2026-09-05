import { describe, it, expect } from "bun:test";
import {
  checkSourceFile,
  normalizeModuleSpecifier,
  checkArchitecture,
} from "./check-architecture";

describe("Architecture Guardrails Checker (Issue #86)", () => {
  describe("Path Normalization", () => {
    it("should normalize @/ alias into canonical repository relative path", () => {
      expect(
        normalizeModuleSpecifier(
          "components/homework/card.tsx",
          "@/modules/homework/application/homework-service"
        )
      ).toBe("modules/homework/application/homework-service");
    });

    it("should resolve relative paths relative to source file directory", () => {
      expect(
        normalizeModuleSpecifier(
          "modules/speaking/application/workflow.ts",
          "../infrastructure/repo"
        )
      ).toBe("modules/speaking/infrastructure/repo");

      expect(
        normalizeModuleSpecifier(
          "modules/speaking/domain/speaking-practice.ts",
          "../../homework/domain/homework-types"
        )
      ).toBe("modules/homework/domain/homework-types");
    });

    it("should preserve bare package names", () => {
      expect(
        normalizeModuleSpecifier(
          "modules/speaking/domain/speaking-practice.ts",
          "react"
        )
      ).toBe("react");
      expect(
        normalizeModuleSpecifier(
          "modules/speaking/domain/speaking-practice.ts",
          "@google/genai"
        )
      ).toBe("@google/genai");
    });
  });

  describe("Seam 1: Domain Purity (modules/*/domain/**)", () => {
    it("fails when domain imports React or Next.js", () => {
      const code = `
        import React from "react";
        import { useRouter } from "next/navigation";
        export const x = 1;
      `;
      const violations = checkSourceFile(
        "modules/speaking/domain/speaking-practice.ts",
        code
      );
      expect(violations.length).toBe(2);
      expect(violations[0].ruleName).toBe("Domain Purity");
      expect(violations[0].normalizedTarget).toBe("react");
      expect(violations[1].normalizedTarget).toBe("next/navigation");
    });

    it("fails when domain imports Database, Storage, AI, or Infrastructure", () => {
      const code = `
        import { db } from "@/lib/db";
        import { getSpeakingAudioBuffer } from "@/lib/storage/s3-client";
        import { GoogleGenAI } from "@google/genai";
        import { speakingPracticeRepository } from "../infrastructure/speaking-practice-repository";
      `;
      const violations = checkSourceFile(
        "modules/speaking/domain/speaking-practice.ts",
        code
      );
      expect(violations.length).toBe(4);
      for (const v of violations) {
        expect(v.ruleName).toBe("Domain Purity");
      }
    });

    it("passes when domain contains pure TypeScript types and functions", () => {
      const code = `
        export interface PracticeModel {
          id: string;
          status: "in_progress" | "completed";
        }
        export function isCompleted(status: string): boolean {
          return status === "completed";
        }
      `;
      const violations = checkSourceFile(
        "modules/speaking/domain/speaking-practice.ts",
        code
      );
      expect(violations.length).toBe(0);
    });

    it("passes when domain imports another domain module", () => {
      const code = `
        import type { HomeworkPromptItem } from "@/modules/homework/domain/homework-types";
        export interface CombinedDomain {
          prompt: HomeworkPromptItem;
        }
      `;
      const violations = checkSourceFile(
        "modules/speaking/domain/speaking-practice.ts",
        code
      );
      expect(violations.length).toBe(0);
    });
  });

  describe("Seam 2: UI Infrastructure Isolation", () => {
    it("fails when Speaking or Homework UI imports infrastructure repositories directly", () => {
      const homeworkCode = `
        import { findAssignmentById } from "@/modules/homework/infrastructure/homework-assignment-repository";
        export function HomeworkCard() { return null; }
      `;
      const v1 = checkSourceFile(
        "components/homework/homework-card.tsx",
        homeworkCode
      );
      expect(v1.length).toBe(1);
      expect(v1[0].ruleName).toBe("UI Infrastructure Isolation");
      expect(v1[0].normalizedTarget).toBe(
        "modules/homework/infrastructure/homework-assignment-repository"
      );

      const speakingCode = `
        import { speakingPracticeRepository } from "@/modules/speaking/infrastructure/speaking-practice-repository";
        export function SpeakingView() { return null; }
      `;
      const v2 = checkSourceFile(
        "components/speaking/practice/speaking-cue-card.tsx",
        speakingCode
      );
      expect(v2.length).toBe(1);
      expect(v2[0].ruleName).toBe("UI Infrastructure Isolation");
    });

    it("fails when cleaned protected app pages import DB or Gemini evaluators", () => {
      const code = `
        import { db } from "@/lib/db";
        import { evaluateSpeakingAudio } from "@/lib/gemini/speaking-evaluator";
        export default function Page() { return null; }
      `;
      const violations = checkSourceFile(
        "app/(protected)/teacher/classrooms/page.tsx",
        code
      );
      expect(violations.length).toBe(2);
      expect(violations[0].ruleName).toBe("UI Infrastructure Isolation");
      expect(violations[1].ruleName).toBe("UI Infrastructure Isolation");
    });
  });

  describe("Seam 3: UI -> Application (Valid)", () => {
    it("passes when UI imports from application read-models and use cases", () => {
      const code = `
        import { getLearnerAssignmentDetails } from "@/modules/homework/application/get-learner-homework";
        import type { TeacherReviewCockpitData } from "@/modules/homework/application/homework-read-models";
        import type { HomeworkAssignment } from "@/modules/homework/domain/homework-types";
        export function Cockpit() { return null; }
      `;
      const violations = checkSourceFile(
        "components/homework/teacher-review-cockpit.tsx",
        code
      );
      expect(violations.length).toBe(0);
    });
  });

  describe("Seam 4: Application -> Domain (Valid)", () => {
    it("passes when application services import domain models and policies", () => {
      const code = `
        import type { HomeworkSubmission } from "../domain/homework-types";
        import { calculateIeltsSpeakingOverallBand } from "../domain/homework-types";
        export function calculateOverall(scores: number[]) { return 7.0; }
      `;
      const violations = checkSourceFile(
        "modules/homework/application/submit-homework-attempt.ts",
        code
      );
      expect(violations.length).toBe(0);
    });
  });

  describe("Seam 5: Exact Browser Adapter Exception (Correction #1)", () => {
    it("passes for the exact single source-target exception in live-speaking-examiner-room.tsx", () => {
      const code = `
        import { createSpeakingPracticeBrowserPorts } from "@/modules/speaking/infrastructure/browser/speaking-practice-browser-adapter";
        export function LiveSpeakingExaminerRoom() { return null; }
      `;
      const violations = checkSourceFile(
        "components/speaking/live/live-speaking-examiner-room.tsx",
        code
      );
      expect(violations.length).toBe(0);
    });

    it("fails when any other UI component imports the browser adapter", () => {
      const code = `
        import { createSpeakingPracticeBrowserPorts } from "@/modules/speaking/infrastructure/browser/speaking-practice-browser-adapter";
        export function OtherComponent() { return null; }
      `;
      const violations = checkSourceFile(
        "components/speaking/practice/speaking-cue-card.tsx",
        code
      );
      expect(violations.length).toBe(1);
      expect(violations[0].ruleName).toBe("UI Infrastructure Isolation");
    });
  });

  describe("Seam 6: Application Anti-Laundering Re-export Rule (Correction #3)", () => {
    it("passes when application imports infrastructure for internal orchestration", () => {
      const code = `
        import { homeworkSubmissionRepository } from "../infrastructure/homework-submission-repository";
        import { getSpeakingAudioBuffer } from "@/lib/storage/s3-client";
        export async function submitHomework() {
          return homeworkSubmissionRepository.createAttempt();
        }
      `;
      const violations = checkSourceFile(
        "modules/homework/application/submit-homework-attempt.ts",
        code
      );
      expect(violations.length).toBe(0);
    });

    it("fails when application directly RE-EXPORTS infrastructure implementation", () => {
      const code = `
        export { homeworkSubmissionRepository } from "../infrastructure/homework-submission-repository";
        export { db } from "@/lib/db";
      `;
      const violations = checkSourceFile(
        "modules/homework/application/submit-homework-attempt.ts",
        code
      );
      expect(violations.length).toBe(2);
      expect(violations[0].ruleName).toBe(
        "Application Anti-Laundering Re-export"
      );
      expect(violations[1].ruleName).toBe(
        "Application Anti-Laundering Re-export"
      );
    });

    it("fails when application performs two-step re-export laundering (direct and aliased)", () => {
      const code = `
        import { homeworkSubmissionRepository } from "../infrastructure/homework-submission-repository";
        import { devSessionCache as cache } from "@/modules/speaking/infrastructure/speaking-practice-repository";
        import defaultStorage from "@/lib/storage/s3-client";

        // Two-step re-export: imported above, exported below
        export { homeworkSubmissionRepository };
        export { cache as devSessionCache };
        export default defaultStorage;
      `;
      const violations = checkSourceFile(
        "modules/homework/application/submit-homework-attempt.ts",
        code
      );
      expect(violations.length).toBe(3);
      for (const v of violations) {
        expect(v.ruleName).toBe("Application Anti-Laundering Re-export");
      }
    });

    it("passes when application re-exports other application types/contracts", () => {
      const code = `
        export type { RestoredSpeakingPracticeState } from "./restore-speaking-practice";
      `;
      const violations = checkSourceFile(
        "modules/speaking/application/speaking-practice-workflow.ts",
        code
      );
      expect(violations.length).toBe(0);
    });
  });

  describe("Seam 7: Route Adapter Hygiene (Correction #4 & Route UI isolation)", () => {
    it("fails when route handler imports React or UI components", () => {
      const code = `
        import React from "react";
        import { Button } from "@/components/ui/button";
        export async function POST() { return new Response(); }
      `;
      const violations = checkSourceFile(
        "app/api/learner/practice/[id]/route.ts",
        code
      );
      expect(violations.length).toBe(2);
      expect(violations[0].ruleName).toBe("Route Adapter Hygiene");
      expect(violations[1].ruleName).toBe("Route Adapter Hygiene");
    });

    it("fails when route handler imports from app UI pages/views outside app/api/**", () => {
      const code = `
        import AssignmentPage from "@/app/(protected)/learner/assignments/[id]/page";
        export async function GET() { return new Response(); }
      `;
      const violations = checkSourceFile(
        "app/api/learner/assignments/[id]/route.ts",
        code
      );
      expect(violations.length).toBe(1);
      expect(violations[0].ruleName).toBe("Route Adapter Hygiene");
      expect(violations[0].normalizedTarget).toBe(
        "app/(protected)/learner/assignments/[id]/page"
      );
    });

    it("passes when route handler delegates to application services", () => {
      const code = `
        import { deleteSpeakingPractice } from "@/modules/speaking/application/delete-speaking-practice";
        export async function DELETE() { return new Response(); }
      `;
      const violations = checkSourceFile(
        "app/api/learner/practice/[id]/route.ts",
        code
      );
      expect(violations.length).toBe(0);
    });
  });

  describe("Seam 8: Re-export & Dynamic Import Bypass Prevention in UI", () => {
    it("fails when UI re-exports infrastructure", () => {
      const code = `
        export { homeworkAssignmentRepository } from "@/modules/homework/infrastructure/homework-assignment-repository";
      `;
      const violations = checkSourceFile(
        "components/homework/homework-card.tsx",
        code
      );
      expect(violations.length).toBe(1);
      expect(violations[0].ruleName).toBe("UI Infrastructure Isolation");
    });

    it("fails when UI dynamically imports infrastructure", () => {
      const code = `
        export async function loadRepo() {
          const mod = await import("@/modules/homework/infrastructure/homework-assignment-repository");
          return mod;
        }
      `;
      const violations = checkSourceFile(
        "components/homework/homework-card.tsx",
        code
      );
      expect(violations.length).toBe(1);
      expect(violations[0].statementType).toBe("dynamic_import");
      expect(violations[0].ruleName).toBe("UI Infrastructure Isolation");
    });
  });

  describe("Repository Integration Test", () => {
    it("scans current main codebase and passes with 0 violations", () => {
      const result = checkArchitecture();
      expect(result.scannedFilesCount).toBeGreaterThan(0);
      expect(result.violations).toEqual([]);
    });
  });
});
