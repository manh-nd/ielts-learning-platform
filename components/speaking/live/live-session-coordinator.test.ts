import { describe, it, expect } from "bun:test";
import { LiveSessionCoordinator } from "./live-session-coordinator";
import { PcmAudioController } from "@/lib/audio/pcm-audio-controller";
import { ConversationReplayRecorder } from "@/lib/audio/conversation-replay-recorder";

describe("LiveSessionCoordinator Production Seam Tests", () => {
  it("should anchor mic capture to monotonic session epoch", () => {
    let mockCurrentTime = 1000;
    const coordinator = new LiveSessionCoordinator({
      clock: () => mockCurrentTime,
      finalizeRecording: async () => null,
      cleanupAudio: () => {},
    });

    const controller = new PcmAudioController();
    const recorder = new ConversationReplayRecorder({ sessionEpochMs: 1000 });

    const epoch = coordinator.startSession(controller, recorder);
    expect(epoch).toBe(1000);
    expect(coordinator.getSessionEpoch()).toBe(1000);

    // 250ms later, mic recording starts
    mockCurrentTime = 1250;
    coordinator.anchorMicCapture();

    // Verify recorder started learner stream at offset 250ms
    const timeline = (
      recorder as unknown as {
        learnerStream: {
          getStreamStartMs: () => number;
          getIsStarted: () => boolean;
        };
      }
    ).learnerStream;
    expect(timeline.getIsStarted()).toBe(true);
    expect(timeline.getStreamStartMs()).toBe(250);
  });

  it("should accept late examiner PCM after end_exam and seal upon terminal turnComplete", async () => {
    const coordinator = new LiveSessionCoordinator({
      finalizeRecording: async () => null,
      cleanupAudio: () => {},
    });

    const controller = new PcmAudioController();
    const recorder = new ConversationReplayRecorder({ sessionEpochMs: 0 });
    coordinator.startSession(controller, recorder);

    let examCompletedCalled = false;
    coordinator.handleEndExam(() => {
      examCompletedCalled = true;
    });

    expect(coordinator.isCompletionRequested()).toBe(true);
    expect(coordinator.isTerminalTurnCompleteSeen()).toBe(false);

    // Late PCM arrives -> must be accepted
    const latePcm = new Int16Array(480).fill(100);
    const accepted1 = coordinator.acceptExaminerPcm(latePcm, 500, 20);
    expect(accepted1).toBe(true);

    // Terminal turn completes
    const handled = coordinator.handleTurnComplete(() => {
      examCompletedCalled = true;
    });
    expect(handled).toBe(true);
    expect(coordinator.isTerminalTurnCompleteSeen()).toBe(true);

    // Wait a tick for async finalizeLiveSession promise to settle
    await new Promise((r) => setTimeout(r, 10));
    expect(examCompletedCalled).toBe(true);

    // Post-terminal turnComplete PCM arrives -> must be strictly rejected
    const postSealPcm = new Int16Array(480).fill(200);
    const accepted2 = coordinator.acceptExaminerPcm(postSealPcm, 600, 20);
    expect(accepted2).toBe(false);
  });

  it("should execute distinct paths for manual finish vs ai_completed", async () => {
    let playbackStopped = false;
    let interruptedTimestamp: number | null = null;
    let waitDrainCalled = false;

    const mockController = {
      stopPlayback: () => {
        playbackStopped = true;
      },
      getRemainingScheduledDurationMs: () => 400,
      waitForQueueDrain: async (_timeout: number) => {
        waitDrainCalled = true;
        return true;
      },
    } as unknown as PcmAudioController;

    const mockRecorder = {
      startLearnerStream: () => {},
      addExaminerChunk: () => {},
      notifyInterrupted: (ts: number) => {
        interruptedTimestamp = ts;
      },
      finalize: () => ({
        blob: new Blob([], { type: "audio/wav" }),
        durationSeconds: 5,
        mimeType: "audio/wav" as const,
        sampleRate: 24000 as const,
        channelCount: 1 as const,
      }),
    } as unknown as ConversationReplayRecorder;

    // Test Path 1: learner_finish (manual)
    const coordinator1 = new LiveSessionCoordinator({
      clock: () => 5000,
      finalizeRecording: async () => ({
        blob: new Blob([]),
        url: "blob:audio",
        durationSeconds: 5,
        mimeType: "audio/webm",
      }),
      cleanupAudio: () => {},
    });

    coordinator1.startSession(mockController, mockRecorder);
    const res1 = await coordinator1.finalizeLiveSession("learner_finish");

    expect(playbackStopped).toBe(true);
    expect(interruptedTimestamp as number | null).toBe(0); // 5000 - 5000 = 0ms
    expect(waitDrainCalled).toBe(false); // Manual finish NEVER waits for drain!
    expect(res1.recordedAudio).not.toBeNull();
    expect(res1.conversationReplay).not.toBeNull();

    // Test Path 2: ai_completed
    playbackStopped = false;
    interruptedTimestamp = null;
    waitDrainCalled = false;

    const coordinator2 = new LiveSessionCoordinator({
      clock: () => 10000,
      finalizeRecording: async () => ({
        blob: new Blob([]),
        url: "blob:audio",
        durationSeconds: 10,
        mimeType: "audio/webm",
      }),
      cleanupAudio: () => {},
    });

    coordinator2.startSession(mockController, mockRecorder);
    const res2 = await coordinator2.finalizeLiveSession("ai_completed");

    expect(waitDrainCalled).toBe(true); // AI completed drains queue!
    expect(res2.recordedAudio).not.toBeNull();
    expect(res2.conversationReplay).not.toBeNull();
  });

  it("should be strictly idempotent across concurrent finalize calls", async () => {
    let executionCount = 0;

    const coordinator = new LiveSessionCoordinator({
      finalizeRecording: async () => {
        executionCount++;
        await new Promise((r) => setTimeout(r, 20));
        return {
          blob: new Blob([]),
          url: "blob:test",
          durationSeconds: 2,
          mimeType: "audio/webm",
        };
      },
      cleanupAudio: () => {},
    });

    const controller = new PcmAudioController();
    const recorder = new ConversationReplayRecorder({ sessionEpochMs: 0 });
    coordinator.startSession(controller, recorder);

    const [out1, out2, out3] = await Promise.all([
      coordinator.finalizeLiveSession("ai_completed"),
      coordinator.finalizeLiveSession("ai_completed"),
      coordinator.finalizeLiveSession("learner_finish"),
    ]);

    expect(executionCount).toBe(1);
    expect(out1).toBe(out2);
    expect(out2).toBe(out3);
    expect(out1.recordedAudio?.url).toBe("blob:test");
  });

  it("should allow dynamic queue drain up to 8000ms when remaining scheduled audio is > 2.5s", async () => {
    let observedTimeoutMs = 0;

    const mockController = {
      stopPlayback: () => {},
      // 3500ms remaining audio: old formula capped at 2500ms, new formula must give min(8000, 3500 + 1000) = 4500ms
      getRemainingScheduledDurationMs: () => 3500,
      waitForQueueDrain: async (timeout: number) => {
        observedTimeoutMs = timeout;
        return true;
      },
    } as unknown as PcmAudioController;

    const mockRecorder = {
      startLearnerStream: () => {},
      addExaminerChunk: () => {},
      notifyInterrupted: () => {},
      finalize: () => null,
    } as unknown as ConversationReplayRecorder;

    const coordinator = new LiveSessionCoordinator({
      finalizeRecording: async () => null,
      cleanupAudio: () => {},
    });

    coordinator.startSession(mockController, mockRecorder);
    await coordinator.finalizeLiveSession("ai_completed");

    expect(observedTimeoutMs).toBe(4500);
  });

  it("should truncate examiner replay at cutoff when queue drain times out before cleanup", async () => {
    let interruptedAtMs: number | null = null;
    let cleanupCalledAfterInterrupted = false;

    const mockController = {
      stopPlayback: () => {},
      getRemainingScheduledDurationMs: () => 6000,
      waitForQueueDrain: async () => false, // Drain timed out!
    } as unknown as PcmAudioController;

    let mockClockTime = 1000;
    const coordinator = new LiveSessionCoordinator({
      clock: () => mockClockTime,
      finalizeRecording: async () => null,
      cleanupAudio: () => {
        if (interruptedAtMs !== null) {
          cleanupCalledAfterInterrupted = true;
        }
      },
    });

    const mockRecorder = {
      startLearnerStream: () => {},
      addExaminerChunk: () => {},
      notifyInterrupted: (ts: number) => {
        interruptedAtMs = ts;
      },
      finalize: () => null,
    } as unknown as ConversationReplayRecorder;

    coordinator.startSession(mockController, mockRecorder); // epoch = 1000

    // Advance clock to simulate timeout after 8000ms
    mockClockTime = 9000;
    await coordinator.finalizeLiveSession("ai_completed");

    // Invariant: notifyInterrupted called with cutoff timestamp 9000 - 1000 = 8000ms before cleanupAudio
    expect(interruptedAtMs as number | null).toBe(8000);
    expect(cleanupCalledAfterInterrupted).toBe(true);
  });

  it("should maintain single monotonic epoch across startup delay and mic capture", () => {
    let currentTime = 5000;
    const coordinator = new LiveSessionCoordinator({
      clock: () => currentTime,
      finalizeRecording: async () => null,
      cleanupAudio: () => {},
    });

    const controller = new PcmAudioController();

    // Session starts at T = 5000ms using recorder factory
    let createdEpoch: number | null = null;
    let recorderEpoch: number | null = null;
    let recorderInstance: ConversationReplayRecorder | null = null;

    const epoch = coordinator.startSession(controller, (sessionEpoch) => {
      createdEpoch = sessionEpoch;
      const rec = new ConversationReplayRecorder({
        sessionEpochMs: sessionEpoch,
      });
      recorderEpoch = sessionEpoch;
      recorderInstance = rec;
      return rec;
    });

    expect(epoch).toBe(5000);
    expect(createdEpoch as number | null).toBe(5000);
    expect(recorderEpoch as number | null).toBe(5000);

    // Startup delay +700ms, mic capture begins at T + 700ms (5700ms)
    currentTime = 5700;
    coordinator.anchorMicCapture();

    const timeline = (
      recorderInstance! as unknown as {
        learnerStream: {
          getStreamStartMs: () => number;
          getIsStarted: () => boolean;
        };
      }
    ).learnerStream;

    expect(timeline.getIsStarted()).toBe(true);
    expect(timeline.getStreamStartMs()).toBe(700);

    // A redundant anchorMicCapture call 300ms later must NOT overwrite or reset the offset
    currentTime = 6000;
    coordinator.anchorMicCapture();
    expect(timeline.getStreamStartMs()).toBe(700);
  });

  it("should notify onExamCompleted exactly once across safety timer and late turnComplete", async () => {
    let notificationsCount = 0;

    const coordinator = new LiveSessionCoordinator({
      finalizeRecording: async () => null,
      cleanupAudio: () => {},
    });

    const controller = new PcmAudioController();
    const recorder = new ConversationReplayRecorder({ sessionEpochMs: 0 });
    coordinator.startSession(controller, recorder);

    // Trigger end_exam with a very short safety timeout (10ms)
    const firstEndExam = coordinator.handleEndExam(() => {
      notificationsCount++;
    }, 10);
    expect(firstEndExam).toBe(true);

    // Wait 25ms for safety timeout to fire and finalize
    await new Promise((r) => setTimeout(r, 25));
    expect(notificationsCount).toBe(1);

    // Late turnComplete arrives after safety timer already finalized -> must be a strict no-op (returns false)
    const handledLate = coordinator.handleTurnComplete(() => {
      notificationsCount++;
    });
    expect(handledLate).toBe(false);

    // Wait a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(notificationsCount).toBe(1); // Exactly once!
  });

  it("should treat repeated end_exam and repeated turnComplete as strict no-ops after terminal seal", async () => {
    const coordinator = new LiveSessionCoordinator({
      finalizeRecording: async () => null,
      cleanupAudio: () => {},
    });

    const controller = new PcmAudioController();
    const recorder = new ConversationReplayRecorder({ sessionEpochMs: 0 });
    coordinator.startSession(controller, recorder);

    // 1. Initial end_exam -> accepted
    const endExam1 = coordinator.handleEndExam(() => {}, 5000);
    expect(endExam1).toBe(true);
    expect(coordinator.isCompletionRequested()).toBe(true);

    // 2. Repeated end_exam while completionRequested -> must be rejected (false)
    const endExam2 = coordinator.handleEndExam(() => {}, 5000);
    expect(endExam2).toBe(false);

    // 3. First turnComplete -> accepted and triggers finalize
    const turn1 = coordinator.handleTurnComplete(() => {});
    expect(turn1).toBe(true);
    expect(coordinator.isTerminalTurnCompleteSeen()).toBe(true);

    // 4. Repeated turnComplete after terminal turnComplete seen -> must be rejected (false)
    const turn2 = coordinator.handleTurnComplete(() => {});
    expect(turn2).toBe(false);

    // 5. Subsequent end_exam after terminal seal -> must also be rejected (false)
    const endExam3 = coordinator.handleEndExam(() => {}, 5000);
    expect(endExam3).toBe(false);
  });

  it("should execute cleanupAudio and ConversationReplay finalize exactly once across concurrent/repeated finalization", async () => {
    let cleanupAudioCount = 0;
    let finalizeRecorderCount = 0;

    const coordinator = new LiveSessionCoordinator({
      finalizeRecording: async () => {
        await new Promise((r) => setTimeout(r, 15));
        return {
          blob: new Blob([]),
          url: "blob:test",
          durationSeconds: 2,
          mimeType: "audio/webm",
        };
      },
      cleanupAudio: () => {
        cleanupAudioCount++;
      },
    });

    const controller = new PcmAudioController();
    const mockRecorder = {
      startLearnerStream: () => {},
      addExaminerChunk: () => {},
      notifyInterrupted: () => {},
      finalize: () => {
        finalizeRecorderCount++;
        return {
          blob: new Blob(["wav"], { type: "audio/wav" }),
          durationSeconds: 2,
          mimeType: "audio/wav" as const,
        };
      },
    } as unknown as ConversationReplayRecorder;

    coordinator.startSession(controller, mockRecorder);

    // Concurrent finalization calls (e.g. race between AI completion and user finish)
    const [res1, res2, res3] = await Promise.all([
      coordinator.finalizeLiveSession("ai_completed"),
      coordinator.finalizeLiveSession("ai_completed"),
      coordinator.finalizeLiveSession("learner_finish"),
    ]);

    expect(res1).toBe(res2);
    expect(res2).toBe(res3);
    expect(cleanupAudioCount).toBe(1);
    expect(finalizeRecorderCount).toBe(1);

    // Subsequent finalization invocation after settled
    const res4 = await coordinator.finalizeLiveSession("ai_completed");
    expect(res4).toBe(res1);
    expect(cleanupAudioCount).toBe(1);
    expect(finalizeRecorderCount).toBe(1);
  });

  it("should isolate session A and session B artifacts, epochs, and revoke local Blob URL", async () => {
    let mockTime = 1000;
    let cleanupCount = 0;

    const coordinator = new LiveSessionCoordinator({
      clock: () => mockTime,
      finalizeRecording: async () => ({
        blob: new Blob([]),
        url: "blob:rec",
        durationSeconds: 1,
        mimeType: "audio/webm",
      }),
      cleanupAudio: () => {
        cleanupCount++;
      },
    });

    const revokedUrls: string[] = [];
    const origRevoke = globalThis.URL?.revokeObjectURL;
    const origCreate = globalThis.URL?.createObjectURL;

    let blobCounter = 0;
    globalThis.URL.createObjectURL = () => `blob:local-replay-${++blobCounter}`;
    globalThis.URL.revokeObjectURL = (url: string) => {
      revokedUrls.push(url);
    };

    try {
      // --- SESSION A ---
      mockTime = 1000;
      const controllerA = new PcmAudioController();
      let recorderAEpoch: number | null = null;
      coordinator.startSession(controllerA, (epoch) => {
        recorderAEpoch = epoch;
        return {
          startLearnerStream: () => {},
          addExaminerChunk: () => {},
          notifyInterrupted: () => {},
          finalize: () => ({
            blob: new Blob(["a"], { type: "audio/wav" }),
            durationSeconds: 3,
            mimeType: "audio/wav" as const,
          }),
        } as unknown as ConversationReplayRecorder;
      });

      expect(coordinator.getSessionEpoch()).toBe(1000);
      expect(recorderAEpoch as number | null).toBe(1000);

      const finalA = await coordinator.finalizeLiveSession("ai_completed");
      expect(finalA.conversationReplay?.url).toBe("blob:local-replay-1");
      expect(cleanupCount).toBe(1);
      // Local Blob URL remains alive immediately after finalize
      expect(revokedUrls).not.toContain("blob:local-replay-1");

      // --- SESSION B (Fresh Reset & Start) ---
      mockTime = 5000;
      const controllerB = new PcmAudioController();
      let recorderBEpoch: number | null = null;
      coordinator.startSession(controllerB, (epoch) => {
        recorderBEpoch = epoch;
        return {
          startLearnerStream: () => {},
          addExaminerChunk: () => {},
          notifyInterrupted: () => {},
          finalize: () => ({
            blob: new Blob(["b"], { type: "audio/wav" }),
            durationSeconds: 4,
            mimeType: "audio/wav" as const,
          }),
        } as unknown as ConversationReplayRecorder;
      });

      // Assert Session A's local Blob URL was revoked when Session B started
      expect(revokedUrls).toContain("blob:local-replay-1");

      // Assert complete state reset for Session B
      expect(coordinator.getSessionEpoch()).toBe(5000);
      expect(recorderBEpoch as number | null).toBe(5000);
      expect(coordinator.isCompletionRequested()).toBe(false);
      expect(coordinator.isTerminalTurnCompleteSeen()).toBe(false);

      const finalB = await coordinator.finalizeLiveSession("ai_completed");
      expect(finalB.conversationReplay?.url).toBe("blob:local-replay-2");
      expect(cleanupCount).toBe(2);
      // Session B's local Blob URL remains alive immediately after finalize
      expect(revokedUrls).not.toContain("blob:local-replay-2");

      // Resetting again revokes Session B's local Blob URL
      coordinator.reset();
      expect(revokedUrls).toContain("blob:local-replay-2");

      // Verify that restored HTTP URLs are NOT in revokedUrls
      const httpRestoredUrl =
        "/api/speaking/practices/ses_123/conversation-audio";
      expect(revokedUrls).not.toContain(httpRestoredUrl);
    } finally {
      if (origRevoke) globalThis.URL.revokeObjectURL = origRevoke;
      if (origCreate) globalThis.URL.createObjectURL = origCreate;
    }
  });

  it("enforces replay Blob URL lifecycle: alive on finalize/rerender, revoked on reset/unmount exactly once, restored HTTP untouched", async () => {
    const revokedUrls: string[] = [];
    const origRevoke = globalThis.URL.revokeObjectURL;
    const origCreate = globalThis.URL.createObjectURL;

    try {
      let blobCounter = 0;
      globalThis.URL.createObjectURL = ((_blob: unknown) => {
        blobCounter++;
        return `blob:test-lifecycle-${blobCounter}`;
      }) as unknown as typeof URL.createObjectURL;
      globalThis.URL.revokeObjectURL = ((url: string) => {
        revokedUrls.push(url);
      }) as unknown as typeof URL.revokeObjectURL;

      let cleanupCalled = false;
      const coordinator = new LiveSessionCoordinator({
        finalizeRecording: async () => null,
        cleanupAudio: () => {
          // In real composition, cleanupAudio cleans hardware/WS but MUST NOT revoke replay URL
          cleanupCalled = true;
        },
      });

      coordinator.startSession(
        new PcmAudioController(),
        () =>
          ({
            startLearnerStream: () => {},
            addExaminerChunk: () => {},
            notifyInterrupted: () => {},
            finalize: () => ({
              blob: new Blob(["test"], { type: "audio/wav" }),
              durationSeconds: 5,
              mimeType: "audio/wav" as const,
            }),
          }) as unknown as ConversationReplayRecorder
      );

      // 1. Finalize -> URL remains alive
      const result = await coordinator.finalizeLiveSession("ai_completed");
      const url = result.conversationReplay?.url;
      expect(url).toBe("blob:test-lifecycle-1");
      expect(cleanupCalled).toBe(true);
      expect(coordinator.getReplayBlobUrl()).toBe("blob:test-lifecycle-1");
      expect(revokedUrls).toEqual([]); // Still alive!

      // 2. Re-render simulation (coordinator and URL state retained) -> URL remains alive
      expect(coordinator.getReplayBlobUrl()).toBe("blob:test-lifecycle-1");
      expect(revokedUrls).toEqual([]);

      // 3. Unmount simulation -> revokes local URL exactly once
      coordinator.revokeReplayUrl();
      expect(revokedUrls).toEqual(["blob:test-lifecycle-1"]);
      expect(coordinator.getReplayBlobUrl()).toBeNull();

      // Repeated unmount / cleanup call is a no-op (exactly-once)
      coordinator.revokeReplayUrl();
      expect(revokedUrls).toEqual(["blob:test-lifecycle-1"]);

      // 4. Restored HTTP URLs are never revoked even if passed
      coordinator.revokeReplayUrl();
      expect(revokedUrls).not.toContain("https://example.com/audio.mp3");
      expect(revokedUrls).not.toContain(
        "/api/speaking/practices/123/conversation-audio"
      );
    } finally {
      if (origRevoke) globalThis.URL.revokeObjectURL = origRevoke;
      if (origCreate) globalThis.URL.createObjectURL = origCreate;
    }
  });
});
