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
    coordinator.handleEndExam(() => {
      notificationsCount++;
    }, 10);

    // Wait 25ms for safety timeout to fire and finalize
    await new Promise((r) => setTimeout(r, 25));
    expect(notificationsCount).toBe(1);

    // Late turnComplete arrives after safety timer already finalized
    const handledLate = coordinator.handleTurnComplete(() => {
      notificationsCount++;
    });

    // Wait a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(handledLate).toBe(true);
    expect(notificationsCount).toBe(1); // Exactly once!
  });

  it("should treat repeated end_exam as idempotent no-op for safety timer", () => {
    const coordinator = new LiveSessionCoordinator({
      finalizeRecording: async () => null,
      cleanupAudio: () => {},
    });

    const controller = new PcmAudioController();
    const recorder = new ConversationReplayRecorder({ sessionEpochMs: 0 });
    coordinator.startSession(controller, recorder);

    coordinator.handleEndExam(() => {}, 5000);
    expect(coordinator.isCompletionRequested()).toBe(true);

    // Second call to end_exam
    coordinator.handleEndExam(() => {}, 5000);
    expect(coordinator.isCompletionRequested()).toBe(true);
  });

  it("should revoke previously created replay blob URL on reset() and revokeReplayUrl()", async () => {
    const coordinator = new LiveSessionCoordinator({
      finalizeRecording: async () => null,
      cleanupAudio: () => {},
    });

    const revokedUrls: string[] = [];
    const origRevoke = globalThis.URL?.revokeObjectURL;
    const origCreate = globalThis.URL?.createObjectURL;

    globalThis.URL.createObjectURL = () => "blob:test-replay-url";
    globalThis.URL.revokeObjectURL = (url: string) => {
      revokedUrls.push(url);
    };

    try {
      const controller = new PcmAudioController();
      const recorder = {
        startLearnerStream: () => {},
        addExaminerChunk: () => {},
        notifyInterrupted: () => {},
        finalize: () => ({
          blob: new Blob(["test"], { type: "audio/wav" }),
          durationSeconds: 1,
          mimeType: "audio/wav" as const,
        }),
      } as unknown as ConversationReplayRecorder;

      coordinator.startSession(controller, recorder);
      const res = await coordinator.finalizeLiveSession("ai_completed");
      expect(res.conversationReplay?.url).toBe("blob:test-replay-url");

      // Reset coordinator for new session -> must revoke old blob URL
      coordinator.reset();
      expect(revokedUrls).toContain("blob:test-replay-url");
    } finally {
      if (origRevoke) globalThis.URL.revokeObjectURL = origRevoke;
      if (origCreate) globalThis.URL.createObjectURL = origCreate;
    }
  });
});
