import {
  practicePlanCompleted,
  validatePracticePlan,
  type PracticePlan,
  type PracticePrompt,
  type PracticeAnswer,
} from "../domain/practice-plan";

export interface PracticeConversationEffects {
  speak(prompt: PracticePrompt): void;
  activity(started: boolean): void;
  changed(): void;
  completed(): void;
}
export type PracticeConversationPhase =
  "idle" | "identity" | "preparing" | "answering" | "closing" | "ended";

/** Owns progression; microphone timestamps and explicit intent are authoritative, never transcripts. */
export class PracticeConversationCoordinator {
  readonly plan: PracticePlan;
  private endedEarly = false;
  private phase: PracticeConversationPhase = "idle";
  private prompts: PracticePrompt[] = [];
  private index = 0;
  private answers: PracticeAnswer[] = [];
  private startedAt = 0;
  private answerStarted: number | null = null;
  private lastSpeech: number | null = null;
  private transcript = "";
  private deadline: number | null = null;
  private suspendedAt: number | null = null;
  private active = false;
  private accepting = false;
  private generation = 0;

  constructor(
    plan: PracticePlan,
    private effects: PracticeConversationEffects,
    private now = () => Date.now()
  ) {
    if (!validatePracticePlan(plan)) throw new Error("Invalid practice plan");
    this.plan = structuredClone(plan);
  }
  get snapshot() {
    return {
      title: this.plan.title,
      cueCard: this.plan.cueCard,
      phase: this.phase,
      scope: this.plan.scope,
      prompt: this.prompts[this.index] ?? null,
      answers: [...this.answers],
      suspended: this.suspendedAt !== null,
      remainingSeconds:
        this.deadline === null
          ? 0
          : Math.max(
              0,
              Math.ceil(
                (this.deadline - (this.suspendedAt ?? this.now())) / 1000
              )
            ),
      complete:
        !this.endedEarly && practicePlanCompleted(this.plan, this.answers),
    };
  }
  start(recordingStartedAt = this.now()) {
    if (this.phase !== "idle") return;
    this.startedAt = recordingStartedAt;
    if (this.plan.scope === "part_2") {
      this.phase = "preparing";
      this.deadline = this.now() + 60000;
      this.effects.speak({
        id: "preparation",
        text: "You have one minute to prepare the cue card shown on screen. Select Start early when ready.",
      });
    } else {
      this.prompts =
        this.plan.scope === "part_1"
          ? [
              {
                id: "identity",
                text: "Could you please tell me your full name?",
              },
              ...this.plan.questions,
            ]
          : [...this.plan.questions];
      this.phase = this.plan.scope === "part_1" ? "identity" : "answering";
      this.ask();
    }
    this.effects.changed();
  }
  startSpeaking() {
    if (this.phase !== "preparing" || this.suspendedAt !== null) return;
    this.prompts = [
      { id: this.plan.cueCard!.id, text: this.plan.cueCard!.text },
      ...this.plan.questions,
    ];
    this.index = 0;
    this.phase = "answering";
    this.deadline = null;
    this.ask();
    this.effects.changed();
  }
  private ask() {
    this.accepting = false;
    this.generation++;
    const prompt = this.prompts[this.index];
    this.effects.speak(
      this.plan.scope === "part_3" && this.index === 0
        ? {
            ...prompt,
            text: `Let's discuss ${this.plan.title}. ${prompt.text}`,
          }
        : prompt
    );
  }
  /** Called only after examiner generation and local playback have drained. */
  examinerFinished() {
    if (this.suspendedAt !== null) return;
    if (this.phase === "closing") {
      this.phase = "ended";
      this.effects.completed();
    } else if (this.phase === "answering" || this.phase === "identity")
      this.accepting = true;
    if (
      this.plan.scope === "part_2" &&
      this.index === 0 &&
      this.phase === "answering" &&
      this.deadline === null
    )
      this.deadline = this.now() + 120000;
    this.effects.changed();
  }
  microphone(speech: boolean) {
    if (
      this.suspendedAt !== null ||
      !["answering", "identity"].includes(this.phase)
    )
      return;
    if (!speech) {
      this.tick();
      return;
    }
    // Barge-in belongs to the current prompt, never the next prompt.
    this.accepting = true;
    if (
      this.plan.scope === "part_2" &&
      this.index === 0 &&
      this.deadline === null
    )
      this.deadline = this.now() + 120000;
    if (!this.active) {
      this.active = true;
      this.effects.activity(true);
    }
    if (this.answerStarted === null) this.answerStarted = this.now();
    this.lastSpeech = this.now();
  }
  appendTranscript(text: string) {
    if (this.active) this.transcript += text;
  }
  done() {
    if (
      this.suspendedAt !== null ||
      !this.accepting ||
      this.answerStarted === null
    )
      return;
    const prompt = this.prompts[this.index];
    this.answers.push({
      id: `${prompt.id}:${this.generation}`,
      questionId: prompt.id,
      promptQuestion: prompt.text,
      turnKind:
        this.phase === "identity" ? "identity_check" : "practice_answer",
      partNumber: Number(this.plan.scope.slice(-1)),
      itemIndex: this.answers.length,
      startMs: this.answerStarted - this.startedAt,
      endMs:
        Math.max(this.answerStarted + 1, this.lastSpeech ?? this.now()) -
        this.startedAt,
      liveTranscript: this.transcript,
    });
    this.resetAnswer();
    this.deadline = null;
    this.index++;
    if (this.index >= this.prompts.length) {
      this.phase = "closing";
      this.effects.speak({
        id: "closing",
        text: "Thank you. That concludes your speaking practice.",
      });
    } else {
      this.phase = "answering";
      this.ask();
    }
    this.effects.changed();
  }
  private resetAnswer() {
    if (this.active) this.effects.activity(false);
    this.active = false;
    this.accepting = false;
    this.answerStarted = null;
    this.lastSpeech = null;
    this.transcript = "";
  }
  repeat() {
    if (
      this.suspendedAt !== null ||
      !["identity", "answering"].includes(this.phase)
    )
      return;
    this.resetAnswer();
    this.ask();
  }
  tick() {
    if (this.suspendedAt !== null) return;
    if (
      this.phase === "preparing" &&
      this.deadline !== null &&
      this.now() >= this.deadline
    )
      return this.startSpeaking();
    if (this.phase !== "identity" && this.phase !== "answering") return;
    const longTurn = this.plan.scope === "part_2" && this.index === 0;
    if (longTurn) {
      if (this.deadline !== null && this.now() >= this.deadline) {
        if (this.answerStarted !== null) this.done();
        else this.endEarly();
      }
    } else if (this.lastSpeech !== null && this.now() - this.lastSpeech >= 1200)
      this.done();
  }
  suspend() {
    if (this.suspendedAt === null) {
      this.suspendedAt = this.now();
      this.effects.changed();
    }
  }
  resume() {
    if (this.suspendedAt === null) return;
    const gap = this.now() - this.suspendedAt;
    if (this.deadline !== null) this.deadline += gap;
    this.lastSpeech = null;
    this.suspendedAt = null;
    this.effects.changed();
  }
  endEarly() {
    if (this.phase === "ended") return;
    this.endedEarly = this.phase !== "closing";
    if (this.answerStarted !== null) {
      const prompt = this.prompts[this.index];
      this.answers.push({
        completed: false,
        id: `${prompt.id}:${this.generation}`,
        questionId: prompt.id,
        promptQuestion: prompt.text,
        turnKind:
          this.phase === "identity" ? "identity_check" : "practice_answer",
        partNumber: Number(this.plan.scope.slice(-1)),
        itemIndex: this.answers.length,
        startMs: this.answerStarted - this.startedAt,
        endMs:
          Math.max(this.answerStarted + 1, this.lastSpeech ?? this.now()) -
          this.startedAt,
        liveTranscript: this.transcript,
      });
    }
    this.resetAnswer();
    this.phase = "ended";
    this.deadline = null;
    this.effects.changed();
  }
}
