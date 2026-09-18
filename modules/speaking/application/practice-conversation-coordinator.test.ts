import { describe, expect, it } from "bun:test";
import { PracticeConversationCoordinator } from "./practice-conversation-coordinator";
import type { PracticePlan } from "../domain/practice-plan";

function fixture(scope: PracticePlan["scope"] = "part_3") {
  let time = 0;
  const spoken: string[] = [];
  const coordinator = new PracticeConversationCoordinator(
    {
      version: 1,
      scope,
      topicId: "t",
      title: "Topic",
      questions: [
        { id: "q1", text: "Why?" },
        { id: "q2", text: "How?" },
      ],
      ...(scope === "part_2"
        ? {
            cueCard: {
              id: "cue",
              text: "Describe a place",
              bulletPoints: ["Where"],
            },
          }
        : {}),
    },
    {
      speak: (p) => spoken.push(p.id),
      activity() {},
      changed() {},
      completed() {},
    },
    () => time
  );
  return {
    coordinator,
    spoken,
    advance(ms: number) {
      time += ms;
      coordinator.tick();
    },
  };
}
describe("practice progression", () => {
  it("does not advance on silence or examiner completion, and accepts speech without transcript", () => {
    const f = fixture();
    f.coordinator.start();
    f.coordinator.examinerFinished();
    f.advance(10000);
    expect(f.spoken).toEqual(["q1"]);
    f.coordinator.microphone(true);
    f.advance(1200);
    expect(f.spoken).toEqual(["q1", "q2"]);
    expect(f.coordinator.snapshot.answers[0].questionId).toBe("q1");
    f.coordinator.done();
    expect(f.coordinator.snapshot.answers).toHaveLength(1);
  });
  it("does not duplicate questions on resume and preserves microphone timeline", () => {
    const f = fixture();
    f.coordinator.start();
    f.advance(100);
    f.coordinator.microphone(true);
    f.coordinator.suspend();
    f.advance(10000);
    f.coordinator.resume();
    f.advance(2000);
    expect(f.spoken).toEqual(["q1"]);
    f.coordinator.microphone(true);
    f.coordinator.done();
    expect(f.coordinator.snapshot.answers[0].startMs).toBe(100);
    expect(f.coordinator.snapshot.answers[0].endMs).toBe(12100);
  });
  it("excludes identity from question completion and retains question identity on repeat", () => {
    const f = fixture("part_1");
    f.coordinator.start();
    f.coordinator.microphone(true);
    f.coordinator.done();
    f.coordinator.repeat();
    expect(f.spoken).toEqual(["identity", "q1", "q1"]);
    expect(f.coordinator.snapshot.answers[0].turnKind).toBe("identity_check");
    expect(f.coordinator.snapshot.complete).toBe(false);
  });
  it("pauses preparation and ignores ordinary pauses in the long turn", () => {
    const f = fixture("part_2");
    f.coordinator.start();
    f.advance(30000);
    f.coordinator.suspend();
    f.advance(90000);
    expect(f.coordinator.snapshot.remainingSeconds).toBe(30);
    f.coordinator.resume();
    f.advance(30000);
    expect(f.coordinator.snapshot.phase).toBe("answering");
    f.coordinator.microphone(true);
    f.advance(5000);
    expect(f.coordinator.snapshot.answers).toHaveLength(0);
    f.advance(115000);
    expect(f.coordinator.snapshot.answers[0].questionId).toBe("cue");
    expect(f.spoken.at(-1)).toBe("q1");
  });
  it("retains a partial last answer without claiming plan completion", () => {
    const f = fixture();
    f.coordinator.start();
    f.coordinator.microphone(true);
    f.coordinator.done();
    f.coordinator.microphone(true);
    f.coordinator.endEarly();
    expect(f.coordinator.snapshot.answers).toHaveLength(2);
    expect(f.coordinator.snapshot.answers[1].completed).toBe(false);
    expect(f.coordinator.snapshot.complete).toBe(false);
  });
});
