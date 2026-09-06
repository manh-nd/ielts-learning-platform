/**
 * Pure Audio Infrastructure: Conversation Replay Recorder
 *
 * Captures, aligns, and mixes the full Speaking Practice conversation:
 * - Learner microphone PCM: 16 kHz Int16 mono (placed via continuous sample-domain cursor)
 * - Gemini examiner PCM: 24 kHz Int16 mono (placed via AudioContext scheduled audible playback time)
 * - Sample-accurate silence/gaps, alternating turns, and overlapping/barge-in speech
 * - Final output: 24 kHz 16-bit mono RIFF WAV
 *
 * Invariants:
 * - Strictly derived, replay-only playback material (never assessment evidence).
 * - Gemini examiner output is preserved at 100% native 24 kHz bit-exact quality.
 * - Learner 16 kHz PCM is upsampled to 24 kHz using linear interpolation:
 *     sourcePosition = outputIndex * 16000 / 24000 = outputIndex * 2/3
 * - Strict memory bounding (raw PCM budget + projected finalization allocation guard).
 * - Pure browser/audio infrastructure: ZERO dependencies on React, Next.js, Drizzle, or Gemini SDK.
 */

export type MonotonicClock = () => number;

export const defaultMonotonicClock: MonotonicClock = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export const MAX_RAW_PCM_BYTES = 35 * 1024 * 1024; // 35 MB raw PCM budget
export const MAX_REPLAY_DURATION_MS = 15 * 60 * 1000; // 15 minutes max duration
export const MAX_PROJECTED_FINALIZE_BYTES = 180 * 1024 * 1024; // 180 MB peak allocation guard

export interface ExaminerScheduledSegment {
  scheduledStartMs: number;
  durationMs: number;
  pcm: Int16Array;
}

export interface ConversationReplayOutput {
  blob: Blob;
  durationSeconds: number;
  mimeType: "audio/wav";
  sampleRate: 24000;
  channelCount: 1;
}

export interface ConversationReplayRecorderOptions {
  sessionEpochMs: number;
  clock?: MonotonicClock;
  maxRawPcmBytes?: number;
  maxReplayDurationMs?: number;
  maxProjectedFinalizeBytes?: number;
}

/**
 * Continuous sample-domain stream for 16 kHz learner microphone audio.
 * Prevents callback-arrival jitter by driving chunk start times from total samples captured.
 */
export class LearnerAudioTimelineStream {
  private streamStartMs: number = 0;
  private samplesCaptured: number = 0;
  private isStarted: boolean = false;

  start(streamStartMs: number) {
    this.streamStartMs = streamStartMs;
    this.samplesCaptured = 0;
    this.isStarted = true;
  }

  getIsStarted(): boolean {
    return this.isStarted;
  }

  getStreamStartMs(): number {
    return this.streamStartMs;
  }

  getTotalSamples(): number {
    return this.samplesCaptured;
  }

  appendChunk(pcm: Int16Array): { startMs: number; pcm: Int16Array } {
    const startMs = this.streamStartMs + (this.samplesCaptured / 16000) * 1000;
    this.samplesCaptured += pcm.length;
    return { startMs, pcm };
  }

  reset() {
    this.streamStartMs = 0;
    this.samplesCaptured = 0;
    this.isStarted = false;
  }
}

/**
 * Upsamples 16 kHz Int16 PCM to 24 kHz Int16 PCM using exact mathematical linear interpolation:
 *   sourcePosition = m * (16000 / 24000) = m * (2 / 3)
 *   i0 = floor(sourcePosition), i1 = min(i0 + 1, N_16k - 1)
 *   fraction = sourcePosition - i0
 *   output[m] = round((1 - fraction) * source[i0] + fraction * source[i1])
 */
export function upsample16kTo24k(source16k: Int16Array): Int16Array {
  if (source16k.length === 0) {
    return new Int16Array(0);
  }

  const outputLength = Math.round((source16k.length * 3) / 2);
  const output24k = new Int16Array(outputLength);

  for (let m = 0; m < outputLength; m++) {
    const sourcePosition = (m * 2) / 3;
    const i0 = Math.floor(sourcePosition);
    const i1 = Math.min(i0 + 1, source16k.length - 1);
    const fraction = sourcePosition - i0;
    const interpolated =
      (1 - fraction) * source16k[i0] + fraction * source16k[i1];
    output24k[m] = Math.round(interpolated);
  }

  return output24k;
}

/**
 * Encodes 24 kHz 16-bit mono PCM into a standard 44-byte RIFF WAV Blob.
 */
export function pcmInt16ToWavBlob(
  pcmData: Int16Array,
  sampleRate = 24000
): Blob {
  const dataSize = pcmData.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // "RIFF"
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + dataSize, true);
  // "WAVE"
  view.setUint32(8, 0x57415645, false);

  // "fmt "
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // 1 Channel (Mono)
  view.setUint32(24, sampleRate, true); // 24000
  view.setUint32(28, sampleRate * 2, true); // Byte rate (24000 * 2)
  view.setUint16(32, 2, true); // Block align (2)
  view.setUint16(34, 16, true); // 16 bits per sample

  // "data"
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, dataSize, true);

  new Int16Array(buffer, 44).set(pcmData);

  return new Blob([buffer], { type: "audio/wav" });
}

export class ConversationReplayRecorder {
  private sessionEpochMs: number;
  private clock: MonotonicClock;
  private maxRawPcmBytes: number;
  private maxReplayDurationMs: number;
  private maxProjectedFinalizeBytes: number;

  private learnerStream: LearnerAudioTimelineStream =
    new LearnerAudioTimelineStream();
  private learnerChunks: Int16Array[] = [];
  private examinerSegments: ExaminerScheduledSegment[] = [];

  private totalRawPcmBytes: number = 0;
  private isSealed: boolean = false;
  private isDisabled: boolean = false;

  constructor(options: ConversationReplayRecorderOptions) {
    this.sessionEpochMs = options.sessionEpochMs;
    this.clock = options.clock || defaultMonotonicClock;
    this.maxRawPcmBytes = options.maxRawPcmBytes || MAX_RAW_PCM_BYTES;
    this.maxReplayDurationMs =
      options.maxReplayDurationMs || MAX_REPLAY_DURATION_MS;
    this.maxProjectedFinalizeBytes =
      options.maxProjectedFinalizeBytes || MAX_PROJECTED_FINALIZE_BYTES;
  }

  /**
   * Starts the continuous learner stream at the specified timeline offset relative to epoch.
   */
  startLearnerStream(streamStartOffsetMs?: number) {
    if (this.isDisabled) return;
    const startMs =
      streamStartOffsetMs !== undefined
        ? streamStartOffsetMs
        : Math.max(0, this.clock() - this.sessionEpochMs);
    this.learnerStream.start(startMs);
  }

  /**
   * Appends 16 kHz Int16 learner PCM chunk.
   */
  addLearnerChunk(pcmChunk: Int16Array) {
    if (this.isDisabled || this.isSealed || pcmChunk.length === 0) return;

    if (!this.learnerStream.getIsStarted()) {
      this.startLearnerStream();
    }

    const byteLength = pcmChunk.byteLength;
    if (this.totalRawPcmBytes + byteLength > this.maxRawPcmBytes) {
      console.warn(
        `[ConversationReplayRecorder] Raw PCM byte budget exceeded (${this.totalRawPcmBytes + byteLength} > ${this.maxRawPcmBytes}). Disabling replay.`
      );
      this.disableAndReleaseBuffers();
      return;
    }

    this.learnerStream.appendChunk(pcmChunk);
    this.learnerChunks.push(pcmChunk);
    this.totalRawPcmBytes += byteLength;
  }

  /**
   * Adds 24 kHz Int16 examiner PCM chunk scheduled at specific timeline offset relative to epoch.
   */
  addExaminerChunk(
    pcmChunk: Int16Array,
    scheduledStartTimeMs: number,
    durationMs?: number
  ) {
    if (this.isDisabled || this.isSealed || pcmChunk.length === 0) return;

    const byteLength = pcmChunk.byteLength;
    if (this.totalRawPcmBytes + byteLength > this.maxRawPcmBytes) {
      console.warn(
        `[ConversationReplayRecorder] Raw PCM byte budget exceeded (${this.totalRawPcmBytes + byteLength} > ${this.maxRawPcmBytes}). Disabling replay.`
      );
      this.disableAndReleaseBuffers();
      return;
    }

    const calculatedDurationMs =
      durationMs !== undefined ? durationMs : (pcmChunk.length / 24000) * 1000;

    this.examinerSegments.push({
      scheduledStartMs: scheduledStartTimeMs,
      durationMs: calculatedDurationMs,
      pcm: pcmChunk,
    });
    this.totalRawPcmBytes += byteLength;
  }

  /**
   * Handles barge-in / learner interruption:
   * - Segments scheduled after stopTimestampMs are discarded.
   * - Segments currently playing at stopTimestampMs are truncated sample-accurately.
   */
  notifyInterrupted(stopTimestampMs: number) {
    if (this.isDisabled) return;

    const updatedSegments: ExaminerScheduledSegment[] = [];

    for (const seg of this.examinerSegments) {
      const segEndMs = seg.scheduledStartMs + seg.durationMs;

      if (seg.scheduledStartMs >= stopTimestampMs) {
        // Future scheduled chunk: never audibly played -> discard completely
        continue;
      }

      if (segEndMs > stopTimestampMs) {
        // Cut off mid-playback -> truncate PCM sample-accurately
        const audibleDurationMs = stopTimestampMs - seg.scheduledStartMs;
        const audibleSamples = Math.max(
          0,
          Math.round((audibleDurationMs * 24000) / 1000)
        );
        if (audibleSamples > 0) {
          const truncatedPcm = seg.pcm.subarray(0, audibleSamples);
          updatedSegments.push({
            scheduledStartMs: seg.scheduledStartMs,
            durationMs: (audibleSamples / 24000) * 1000,
            pcm: truncatedPcm,
          });
        }
      } else {
        // Finished before interruption -> keep intact
        updatedSegments.push(seg);
      }
    }

    this.examinerSegments = updatedSegments;
  }

  /**
   * Seals recorder: no further audio chunks accepted.
   */
  seal() {
    this.isSealed = true;
  }

  getIsDisabled(): boolean {
    return this.isDisabled;
  }

  getTotalRawPcmBytes(): number {
    return this.totalRawPcmBytes;
  }

  /**
   * Disables recorder and immediately releases all internal buffers to prevent OOM.
   */
  disableAndReleaseBuffers() {
    this.isDisabled = true;
    this.learnerChunks = [];
    this.examinerSegments = [];
    this.learnerStream.reset();
  }

  /**
   * Finalizes ConversationReplay:
   * 1. Checks memory & duration bounds.
   * 2. Concatenates 16 kHz learner stream and upsamples to 24 kHz.
   * 3. Places learner and native 24 kHz examiner audio onto common 24 kHz Int32 timeline accumulator.
   * 4. Applies saturating clamp to signed 16-bit range.
   * 5. Encodes 24 kHz mono RIFF WAV Blob.
   * 6. Releases chunk arrays.
   */
  finalize(): ConversationReplayOutput | null {
    if (this.isDisabled) {
      return null;
    }

    this.seal();

    const learnerTotalSamples16k = this.learnerStream.getTotalSamples();
    const learnerStreamStartMs = this.learnerStream.getStreamStartMs();
    const learnerDurationMs = (learnerTotalSamples16k / 16000) * 1000;
    const learnerEndMs =
      learnerTotalSamples16k > 0 ? learnerStreamStartMs + learnerDurationMs : 0;

    let examinerEndMs = 0;
    for (const seg of this.examinerSegments) {
      const end = seg.scheduledStartMs + seg.durationMs;
      if (end > examinerEndMs) {
        examinerEndMs = end;
      }
    }

    const tMaxMs = Math.max(learnerEndMs, examinerEndMs);

    if (
      tMaxMs <= 0 ||
      (learnerTotalSamples16k === 0 && this.examinerSegments.length === 0)
    ) {
      this.disableAndReleaseBuffers();
      return null;
    }

    // Guard: Max duration
    if (tMaxMs > this.maxReplayDurationMs) {
      console.warn(
        `[ConversationReplayRecorder] Session timeline duration exceeded (${tMaxMs}ms > ${this.maxReplayDurationMs}ms). Disabling replay.`
      );
      this.disableAndReleaseBuffers();
      return null;
    }

    const totalOutputSamples24k = Math.ceil((tMaxMs * 24000) / 1000);

    // Guard: Projected finalization allocation (Int32 accum + Int16 output + WAV byte buffer)
    const projectedFinalizeBytes = totalOutputSamples24k * 8 + 44;
    if (projectedFinalizeBytes > this.maxProjectedFinalizeBytes) {
      console.warn(
        `[ConversationReplayRecorder] Projected finalization memory exceeded (${projectedFinalizeBytes} > ${this.maxProjectedFinalizeBytes}). Disabling replay.`
      );
      this.disableAndReleaseBuffers();
      return null;
    }

    // 1. Concatenate continuous 16 kHz learner stream
    const continuousLearner16k = new Int16Array(learnerTotalSamples16k);
    let learnerOffset = 0;
    for (const chunk of this.learnerChunks) {
      continuousLearner16k.set(chunk, learnerOffset);
      learnerOffset += chunk.length;
    }

    // 2. Mathematically upsample learner stream 16 kHz -> 24 kHz
    const learnerUpsampled24k = upsample16kTo24k(continuousLearner16k);

    // 3. Allocate Int32 timeline accumulator (zero-filled = silence)
    const accumulator24k = new Int32Array(totalOutputSamples24k);

    // 4. Accumulate learner 24 kHz audio onto timeline
    const learnerStartIndex24k = Math.round(
      (learnerStreamStartMs * 24000) / 1000
    );
    for (let i = 0; i < learnerUpsampled24k.length; i++) {
      const targetIdx = learnerStartIndex24k + i;
      if (targetIdx < totalOutputSamples24k) {
        accumulator24k[targetIdx] += learnerUpsampled24k[i];
      }
    }

    // 5. Accumulate native 24 kHz examiner audio onto timeline
    for (const seg of this.examinerSegments) {
      const segStartIndex24k = Math.round(
        (seg.scheduledStartMs * 24000) / 1000
      );
      for (let i = 0; i < seg.pcm.length; i++) {
        const targetIdx = segStartIndex24k + i;
        if (targetIdx >= 0 && targetIdx < totalOutputSamples24k) {
          accumulator24k[targetIdx] += seg.pcm[i];
        }
      }
    }

    // 6. Saturating clamp to signed Int16 range [-32768, 32767]
    const outputPcm24k = new Int16Array(totalOutputSamples24k);
    for (let i = 0; i < totalOutputSamples24k; i++) {
      const sample = accumulator24k[i];
      outputPcm24k[i] =
        sample > 32767 ? 32767 : sample < -32768 ? -32768 : sample;
    }

    // 7. Encode 24 kHz WAV Blob
    const blob = pcmInt16ToWavBlob(outputPcm24k, 24000);
    const durationSeconds = Math.max(1, Math.round((tMaxMs / 1000) * 10) / 10);

    // 8. Clean up all intermediate buffers
    this.disableAndReleaseBuffers();

    return {
      blob,
      durationSeconds,
      mimeType: "audio/wav",
      sampleRate: 24000,
      channelCount: 1,
    };
  }

  reset() {
    this.learnerChunks = [];
    this.examinerSegments = [];
    this.learnerStream.reset();
    this.totalRawPcmBytes = 0;
    this.isSealed = false;
    this.isDisabled = false;
  }
}
