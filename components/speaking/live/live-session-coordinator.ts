/**
 * Production Live Session Coordinator
 *
 * Encapsulates the production session lifecycle, monotonic epoch anchoring,
 * and exactly-once finalization state machine for Live Speaking Practice.
 *
 * Invariants:
 * - One monotonic epoch per live session.
 * - Anchors learner PCM to microphone capture start time.
 * - Disallows post-seal examiner PCM.
 * - Provides distinct finalization paths:
 *   - "learner_finish": immediate stopPlayback(), notifyInterrupted(stopTimestampMs), no queue drain.
 *   - "ai_completed": dynamic queue drain with timeout derived from remaining duration + safety margin.
 * - Guarantees exactly-once idempotent execution.
 */

import type { PcmAudioController } from "@/lib/audio/pcm-audio-controller";
import type { ConversationReplayRecorder } from "@/lib/audio/conversation-replay-recorder";
import type {
  RecordedAudioData,
  ConversationReplayData,
  FinalizedLiveSessionAudio,
} from "./types";

export interface LiveSessionCoordinatorOptions {
  clock?: () => number;
  onStatusChange?: (status: "disconnecting" | "idle") => void;
  onEnded?: () => void;
  finalizeRecording: () => Promise<RecordedAudioData | null>;
  cleanupAudio: () => void;
}

export class LiveSessionCoordinator {
  private clock: () => number;
  private onStatusChange?: (status: "disconnecting" | "idle") => void;
  private onEnded?: () => void;
  private finalizeRecording: () => Promise<RecordedAudioData | null>;
  private cleanupAudio: () => void;

  private sessionEpoch: number | null = null;
  private completionRequested: boolean = false;
  private terminalTurnCompleteSeen: boolean = false;
  private hasNotifiedExamCompleted: boolean = false;
  private safetyTimer: NodeJS.Timeout | null = null;
  private finalizePromise: Promise<FinalizedLiveSessionAudio> | null = null;
  private replayBlobUrl: string | null = null;

  private audioController: PcmAudioController | null = null;
  private replayRecorder: ConversationReplayRecorder | null = null;

  constructor(options: LiveSessionCoordinatorOptions) {
    this.clock =
      options.clock ||
      (() =>
        typeof performance !== "undefined" ? performance.now() : Date.now());
    this.onStatusChange = options.onStatusChange;
    this.onEnded = options.onEnded;
    this.finalizeRecording = options.finalizeRecording;
    this.cleanupAudio = options.cleanupAudio;
  }

  /**
   * Resets coordinator lifecycle for a new live session.
   * Also revokes any previously created ConversationReplay Object URL.
   */
  reset() {
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
    this.revokeReplayUrl();
    this.sessionEpoch = null;
    this.completionRequested = false;
    this.terminalTurnCompleteSeen = false;
    this.hasNotifiedExamCompleted = false;
    this.finalizePromise = null;
    this.audioController = null;
    this.replayRecorder = null;
  }

  /**
   * Revokes the managed ConversationReplay Object URL if one was created.
   */
  revokeReplayUrl() {
    if (this.replayBlobUrl) {
      try {
        const urlApi =
          typeof window !== "undefined" && window.URL
            ? window.URL
            : typeof URL !== "undefined"
              ? URL
              : null;
        if (urlApi && typeof urlApi.revokeObjectURL === "function") {
          urlApi.revokeObjectURL(this.replayBlobUrl);
        }
      } catch {
        // Ignored
      }
      this.replayBlobUrl = null;
    }
  }

  /**
   * Initializes a new session epoch and binds audio controller & recorder.
   * If recorder is passed as a factory function (epoch: number) => ConversationReplayRecorder,
   * it is instantiated using the exact single session epoch.
   */
  startSession(
    controller: PcmAudioController,
    recorder:
      | ConversationReplayRecorder
      | ((epoch: number) => ConversationReplayRecorder)
  ): number {
    this.reset();
    const epoch = this.clock();
    this.sessionEpoch = epoch;
    this.audioController = controller;
    this.replayRecorder =
      typeof recorder === "function" ? recorder(epoch) : recorder;
    return epoch;
  }

  getSessionEpoch(): number | null {
    return this.sessionEpoch;
  }

  isCompletionRequested(): boolean {
    return this.completionRequested;
  }

  isTerminalTurnCompleteSeen(): boolean {
    return this.terminalTurnCompleteSeen;
  }

  /**
   * Called when microphone recording starts successfully.
   * Anchors the learner stream start time relative to the session epoch.
   */
  anchorMicCapture() {
    if (this.sessionEpoch === null || !this.replayRecorder) return;
    const streamStartOffsetMs = Math.max(0, this.clock() - this.sessionEpoch);
    this.replayRecorder.startLearnerStream(streamStartOffsetMs);
  }

  /**
   * Invokes onExamCompleted callback at most once per live session.
   */
  private notifyExamCompletedOnce(onExamCompleted?: () => void) {
    if (this.hasNotifiedExamCompleted) return;
    this.hasNotifiedExamCompleted = true;
    onExamCompleted?.();
  }

  /**
   * Called when Gemini emits the end_exam tool call.
   * Starts terminal turn protocol: completionRequested = true.
   * Sets safety timeout (default 5000ms) in case turnComplete is never received.
   */
  handleEndExam(onExamCompleted?: () => void, safetyTimeoutMs = 5000) {
    this.completionRequested = true;

    if (!this.safetyTimer) {
      this.safetyTimer = setTimeout(() => {
        this.safetyTimer = null;
        this.terminalTurnCompleteSeen = true;
        void this.finalizeLiveSession("ai_completed").then(() => {
          this.notifyExamCompletedOnce(onExamCompleted);
        });
      }, safetyTimeoutMs);
    }
  }

  /**
   * Called when Gemini emits serverContent.turnComplete.
   * If completionRequested is true, this marks terminalTurnCompleteSeen and triggers finalize.
   */
  handleTurnComplete(onExamCompleted?: () => void): boolean {
    if (!this.completionRequested) {
      return false;
    }

    this.terminalTurnCompleteSeen = true;
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }

    void this.finalizeLiveSession("ai_completed").then(() => {
      this.notifyExamCompletedOnce(onExamCompleted);
    });

    return true;
  }

  /**
   * Accepts late examiner PCM chunks arriving after end_exam,
   * but strictly rejects chunks if terminalTurnComplete has already been observed.
   */
  acceptExaminerPcm(
    pcm: Int16Array,
    scheduledStartTimeMs: number,
    durationMs: number
  ): boolean {
    if (this.terminalTurnCompleteSeen || this.sessionEpoch === null) {
      return false;
    }

    if (!this.replayRecorder) {
      return false;
    }

    const scheduledStartMs = scheduledStartTimeMs - this.sessionEpoch;
    this.replayRecorder.addExaminerChunk(pcm, scheduledStartMs, durationMs);
    return true;
  }

  /**
   * Handles user barge-in or manual interruption.
   */
  handleInterruption() {
    if (this.audioController) {
      this.audioController.stopPlayback();
    }
    if (this.replayRecorder && this.sessionEpoch !== null) {
      const stopTimestampMs = Math.max(0, this.clock() - this.sessionEpoch);
      this.replayRecorder.notifyInterrupted(stopTimestampMs);
    }
  }

  /**
   * Exactly-once session finalization.
   */
  finalizeLiveSession(
    reason: "ai_completed" | "learner_finish"
  ): Promise<FinalizedLiveSessionAudio> {
    if (this.finalizePromise) {
      return this.finalizePromise;
    }

    const promise = (async (): Promise<FinalizedLiveSessionAudio> => {
      this.onStatusChange?.("disconnecting");

      if (this.safetyTimer) {
        clearTimeout(this.safetyTimer);
        this.safetyTimer = null;
      }

      const controller = this.audioController;
      const recorder = this.replayRecorder;

      if (reason === "learner_finish") {
        // Manual finish: immediately stop playback, notify interruption, skip queue drain
        if (controller) {
          controller.stopPlayback();
        }
        if (recorder && this.sessionEpoch !== null) {
          const stopTimestampMs = Math.max(0, this.clock() - this.sessionEpoch);
          recorder.notifyInterrupted(stopTimestampMs);
        }
      } else {
        // AI finish: dynamic queue drain with timeout derived from remaining duration + safety margin
        if (controller) {
          try {
            const remainingDurationMs =
              controller.getRemainingScheduledDurationMs();
            // Drain timeout: remaining duration + 1000ms safety margin, capped at 8000ms
            const drainTimeoutMs = Math.min(8000, remainingDurationMs + 1000);
            const drained = await controller.waitForQueueDrain(drainTimeoutMs);
            if (!drained) {
              console.warn(
                "[LiveSessionCoordinator] Audio queue drain timed out. Truncating examiner replay at cutoff."
              );
              if (recorder && this.sessionEpoch !== null) {
                const cutoffTimestampMs = Math.max(
                  0,
                  this.clock() - this.sessionEpoch
                );
                recorder.notifyInterrupted(cutoffTimestampMs);
              }
            }
          } catch (drainErr) {
            console.warn(
              "[LiveSessionCoordinator] Audio queue drain timeout:",
              drainErr
            );
            if (recorder && this.sessionEpoch !== null) {
              const cutoffTimestampMs = Math.max(
                0,
                this.clock() - this.sessionEpoch
              );
              recorder.notifyInterrupted(cutoffTimestampMs);
            }
          }
        }
      }

      // Finalize authoritative learner recording
      let audioData: RecordedAudioData | null = null;
      try {
        audioData = await this.finalizeRecording();
      } catch (err) {
        console.warn(
          "[LiveSessionCoordinator] Error finalizing recording:",
          err
        );
      }

      // Finalize derived conversation replay
      let replayData: ConversationReplayData | null = null;
      if (recorder) {
        try {
          const replayOut = recorder.finalize();
          if (replayOut) {
            this.revokeReplayUrl();
            let url = "";
            try {
              const urlApi =
                typeof window !== "undefined" && window.URL
                  ? window.URL
                  : typeof URL !== "undefined"
                    ? URL
                    : null;
              if (urlApi && typeof urlApi.createObjectURL === "function") {
                url = urlApi.createObjectURL(replayOut.blob);
                this.replayBlobUrl = url;
              }
            } catch {
              // Ignore in tests
            }
            replayData = {
              blob: replayOut.blob,
              url,
              durationSeconds: replayOut.durationSeconds,
              mimeType: replayOut.mimeType,
            };
          }
        } catch (replayErr) {
          console.warn(
            "[LiveSessionCoordinator] Error finalizing replay:",
            replayErr
          );
        }
      }

      this.cleanupAudio();
      this.onStatusChange?.("idle");
      this.onEnded?.();

      return {
        recordedAudio: audioData,
        conversationReplay: replayData,
      };
    })();

    this.finalizePromise = promise;
    return promise;
  }
}
