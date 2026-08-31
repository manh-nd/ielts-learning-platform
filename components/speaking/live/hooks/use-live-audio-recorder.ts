"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { RecordedAudioData } from "../types";
import { PcmAudioController } from "@/lib/audio/pcm-audio-controller";

export interface UseLiveAudioRecorderOptions {
  enableNoiseSuppression?: boolean;
  onMicLevel?: (level: number) => void;
  onMuteChange?: (isMuted: boolean) => void;
}

export interface UseLiveAudioRecorderReturn {
  isMuted: boolean;
  isNoiseSuppressionActive: boolean;
  inputVolume: number;
  recordedAudio: RecordedAudioData | null;
  startRecording: (
    controller: PcmAudioController,
    onPcmChunk?: (base64Chunk: string, rms: number) => void
  ) => Promise<void>;
  stopRecording: () => void;
  finalizeRecording: () => Promise<RecordedAudioData | null>;
  resetRecording: () => void;
  toggleMute: () => void;
  toggleNoiseSuppression: (enabled?: boolean) => void;
  cleanup: () => void;
}

export function getSupportedMediaRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidateTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const type of candidateTypes) {
    try {
      if (
        typeof MediaRecorder.isTypeSupported === "function" &&
        MediaRecorder.isTypeSupported(type)
      ) {
        return type;
      }
    } catch {
      // continue
    }
  }
  return undefined;
}

export function pcmBase64ChunksToWavBlob(
  base64Chunks: string[],
  sampleRate = 16000
): Blob {
  const byteArrays: Uint8Array[] = [];
  let totalLength = 0;
  for (const chunk of base64Chunks) {
    const binary =
      typeof atob !== "undefined"
        ? atob(chunk)
        : Buffer.from(chunk, "base64").toString("binary");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    byteArrays.push(bytes);
    totalLength += bytes.length;
  }

  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of byteArrays) {
    combined.set(arr, offset);
    offset += arr.length;
  }

  const wavBuffer = new ArrayBuffer(44 + totalLength);
  const view = new DataView(wavBuffer);

  // "RIFF"
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + totalLength, true);
  // "WAVE"
  view.setUint32(8, 0x57415645, false);

  // "fmt "
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // 1 Channel (Mono)
  view.setUint32(24, sampleRate, true); // 16000
  view.setUint32(28, sampleRate * 2, true); // Byte rate (16000 * 2)
  view.setUint16(32, 2, true); // Block align (2)
  view.setUint16(34, 16, true); // 16 bits per sample

  // "data"
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, totalLength, true);

  new Uint8Array(wavBuffer, 44).set(combined);

  return new Blob([wavBuffer], { type: "audio/wav" });
}

export function useLiveAudioRecorder(
  options: UseLiveAudioRecorderOptions = {}
): UseLiveAudioRecorderReturn {
  const { enableNoiseSuppression = true, onMicLevel, onMuteChange } = options;

  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isNoiseSuppressionActive, setIsNoiseSuppressionActive] =
    useState<boolean>(enableNoiseSuppression);
  const [inputVolume, setInputVolume] = useState<number>(0);
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudioData | null>(
    null
  );

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const rawPcmChunksRef = useRef<string[]>([]);
  const recordStartTimeRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(false);
  const isNoiseSuppressionActiveRef = useRef<boolean>(enableNoiseSuppression);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isNoiseSuppressionActiveRef.current = isNoiseSuppressionActive;
  }, [isNoiseSuppressionActive]);

  const startRecording = useCallback(
    async (
      controller: PcmAudioController,
      onPcmChunk?: (base64Chunk: string, rms: number) => void
    ) => {
      recordedChunksRef.current = [];
      rawPcmChunksRef.current = [];
      recordStartTimeRef.current = Date.now();
      setRecordedAudio(null);

      controller.onMicLevel((level) => {
        if (isMutedRef.current) {
          setInputVolume(0);
          onMicLevel?.(0);
          return;
        }
        setInputVolume(level);
        onMicLevel?.(level);
      });

      await controller.startRecording((base64PCM, rms) => {
        rawPcmChunksRef.current.push(base64PCM);
        onPcmChunk?.(base64PCM, rms);
      });

      const micStream = controller.getMediaStream();
      if (micStream && typeof MediaRecorder !== "undefined") {
        try {
          recordedChunksRef.current = [];
          const mimeType = getSupportedMediaRecorderMimeType();
          let recorder: MediaRecorder;
          try {
            recorder = mimeType
              ? new MediaRecorder(micStream, { mimeType })
              : new MediaRecorder(micStream);
          } catch {
            recorder = new MediaRecorder(micStream);
          }
          recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size > 0) {
              recordedChunksRef.current.push(ev.data);
            }
          };
          recorder.start(1000);
          mediaRecorderRef.current = recorder;
        } catch (recErr) {
          console.warn(
            "[useLiveAudioRecorder] MediaRecorder start error:",
            recErr
          );
        }
      }
    },
    [onMicLevel]
  );

  const finalizeRecording =
    useCallback(async (): Promise<RecordedAudioData | null> => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        await new Promise<void>((resolve) => {
          let isResolved = false;
          const done = () => {
            if (!isResolved) {
              isResolved = true;
              resolve();
            }
          };

          recorder.addEventListener("stop", done, { once: true });
          recorder.addEventListener("error", done, { once: true });

          try {
            recorder.stop();
          } catch {
            done();
          }
        });
      }

      if (recordedChunksRef.current.length > 0) {
        const mimeType = recorder?.mimeType || "audio/webm;codecs=opus";
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        let url = "";
        try {
          if (
            typeof window !== "undefined" &&
            window.URL &&
            typeof window.URL.createObjectURL === "function"
          ) {
            url = window.URL.createObjectURL(blob);
          }
        } catch {
          // Ignored in test / headless environments
        }
        const durationSeconds = Math.max(
          1,
          Math.round(
            (Date.now() - (recordStartTimeRef.current || Date.now())) / 1000
          )
        );

        const audioData: RecordedAudioData = {
          blob,
          url,
          durationSeconds,
          mimeType,
        };

        setRecordedAudio(audioData);
        return audioData;
      }

      // Secondary fallback: assemble WAV Blob from raw PCM chunks if MediaRecorder produced 0 chunks
      if (rawPcmChunksRef.current.length > 0) {
        const blob = pcmBase64ChunksToWavBlob(rawPcmChunksRef.current, 16000);
        let url = "";
        try {
          if (
            typeof window !== "undefined" &&
            window.URL &&
            typeof window.URL.createObjectURL === "function"
          ) {
            url = window.URL.createObjectURL(blob);
          }
        } catch {
          // Ignored
        }
        const durationSeconds = Math.max(
          1,
          Math.round(
            (Date.now() - (recordStartTimeRef.current || Date.now())) / 1000
          )
        );

        const audioData: RecordedAudioData = {
          blob,
          url,
          durationSeconds,
          mimeType: "audio/wav",
        };

        setRecordedAudio(audioData);
        return audioData;
      }

      return null;
    }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignored
      }
    }
    mediaRecorderRef.current = null;
    setInputVolume(0);
  }, []);

  const resetRecording = useCallback(() => {
    recordedChunksRef.current = [];
    rawPcmChunksRef.current = [];
    recordStartTimeRef.current = 0;
    setRecordedAudio(null);
    setInputVolume(0);
  }, []);

  const cleanup = useCallback(() => {
    stopRecording();
    resetRecording();
  }, [stopRecording, resetRecording]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      onMuteChange?.(next);
      return next;
    });
  }, [onMuteChange]);

  const toggleNoiseSuppression = useCallback((enabled?: boolean) => {
    setIsNoiseSuppressionActive((prev) => {
      const next = enabled !== undefined ? enabled : !prev;
      isNoiseSuppressionActiveRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isMuted,
    isNoiseSuppressionActive,
    inputVolume,
    recordedAudio,
    startRecording,
    stopRecording,
    finalizeRecording,
    resetRecording,
    toggleMute,
    toggleNoiseSuppression,
    cleanup,
  };
}
