import type {
  SpeakingLiveExaminerPort,
  SpeakingLiveExaminerEvent,
  StartSpeakingLiveExaminerInput,
  SendCandidateAudioInput,
  SendSpeakingExaminerTextInput,
  SpeakingLiveExaminerActionResponse,
} from "../ports/speaking-live-examiner.port";
/** Deterministic port-level fake: callers drive events, no provider or microphone required. */
export class FakeSpeakingLiveExaminer implements SpeakingLiveExaminerPort {
  readonly commands: unknown[] = [];
  private listeners = new Set<(event: SpeakingLiveExaminerEvent) => void>();
  constructor(private autoRespond = false) {}
  async connect(input: StartSpeakingLiveExaminerInput) {
    this.commands.push(input);
    this.emit({ type: "connected" });
  }
  sendCandidateAudio(input: SendCandidateAudioInput) {
    this.commands.push(input);
  }
  endCandidateAudio() {
    this.commands.push("audio_end");
  }
  startCandidateActivity() {
    this.commands.push("activity_start");
  }
  endCandidateActivity() {
    this.commands.push("activity_end");
  }
  presentPrompt(input: { questionId: string; text: string }) {
    this.sendText({ text: input.text });
  }
  sendText(input: SendSpeakingExaminerTextInput) {
    this.commands.push(input);
    if (this.autoRespond) {
      this.emit({
        type: "examiner_transcript_updated",
        text: input.text.split(": ").slice(1).join(": ") || input.text,
      });
      this.emit({ type: "live_turn_completed" });
    }
  }
  respondToExaminerAction(input: SpeakingLiveExaminerActionResponse) {
    this.commands.push(input);
  }
  subscribe(listener: (event: SpeakingLiveExaminerEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  emit(event: SpeakingLiveExaminerEvent) {
    for (const listener of this.listeners) listener(event);
  }
  async disconnect() {
    this.commands.push("disconnect");
  }
  dispose() {
    this.listeners.clear();
  }
}
