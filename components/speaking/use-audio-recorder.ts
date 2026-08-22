"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type AudioRecorderStatus =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "paused"
  | "processing"
  | "playback"
  | "error";

export type AudioRecorderErrorType =
  "permission_denied" | "device_not_found" | "unsupported" | "unknown";

export interface AudioRecorderError {
  type: AudioRecorderErrorType;
  message: string;
  originalError?: unknown;
}

export interface UseAudioRecorderOptions {
  /**
   * Maximum recording time in seconds (e.g., 120s for IELTS Speaking Part 2).
   * Automatically stops recording when limit is reached.
   */
  maxDurationSeconds?: number;
  /**
   * Callback fired when recording finishes and audio blob is ready.
   */
  onRecordingComplete?: (blob: Blob, duration: number) => void;
  /**
   * Callback fired if maximum duration is reached.
   */
  onMaxDurationReached?: () => void;
  /**
   * Custom audio constraints for getUserMedia.
   */
  audioConstraints?: MediaStreamConstraints;
}

export interface UseAudioRecorderReturn {
  status: AudioRecorderStatus;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  analyserNode: AnalyserNode | null;
  error: AudioRecorderError | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}

/**
 * Helper to select the most compatible supported audio MIME type.
 */
export function getPreferredAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";

  const candidateMimeTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=aac",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/wav",
  ];

  for (const type of candidateMimeTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return "";
}

export const DEFAULT_IELTS_AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    channelCount: 1,
    sampleRate: 16000,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

export function useAudioRecorder(
  options: UseAudioRecorderOptions = {}
): UseAudioRecorderReturn {
  const {
    maxDurationSeconds,
    onRecordingComplete,
    onMaxDurationReached,
    audioConstraints = DEFAULT_IELTS_AUDIO_CONSTRAINTS,
  } = options;

  const [status, setStatus] = useState<AudioRecorderStatus>("idle");
  const [duration, setDuration] = useState<number>(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState<AudioRecorderError | null>(null);

  // References to keep non-reactive mutable state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<number>(0);

  // Synchronize duration ref with state for callbacks
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Cleanup helper to release media tracks and audio contexts
  const cleanupMediaResources = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch {
        // Ignore close errors
      }
      audioContextRef.current = null;
    }

    setAnalyserNode(null);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      setStatus("processing");
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // In case recorder already stopped
      }
    }
  }, []);

  const startRecording = useCallback(async () => {
    // Check browser compatibility
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      setError({
        type: "unsupported",
        message:
          "Trình duyệt không hỗ trợ Web Audio hoặc MediaRecorder API cần thiết.",
      });
      setStatus("error");
      return;
    }

    // Revoke previous audio URL if any
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    setAudioBlob(null);
    setError(null);
    setDuration(0);
    audioChunksRef.current = [];
    setStatus("requesting_permission");

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(audioConstraints);
      mediaStreamRef.current = stream;

      // Setup Web Audio API Analyser for Live Waveform
      const AudioCtxClass =
        window.AudioContext ||
        // @ts-expect-error webkit prefix fallback
        window.webkitAudioContext;

      if (AudioCtxClass) {
        const audioCtx = new AudioCtxClass();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        setAnalyserNode(analyser);
      }

      // Initialize MediaRecorder
      const mimeType = getPreferredAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        cleanupMediaResources();

        const selectedMime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: selectedMime });
        const finalDuration = durationRef.current;

        setAudioBlob(blob);
        const newUrl = URL.createObjectURL(blob);
        setAudioUrl(newUrl);
        setStatus("playback");

        if (onRecordingComplete) {
          onRecordingComplete(blob, finalDuration);
        }
      };

      recorder.onerror = (evt) => {
        cleanupMediaResources();
        setError({
          type: "unknown",
          message: "Lỗi trong quá trình ghi âm.",
          originalError: evt,
        });
        setStatus("error");
      };

      // Start recording with 500ms time slice chunks
      recorder.start(500);
      setStatus("recording");

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => {
          const next = prev + 1;
          if (maxDurationSeconds && next >= maxDurationSeconds) {
            stopRecording();
            if (onMaxDurationReached) {
              onMaxDurationReached();
            }
          }
          return next;
        });
      }, 1000);
    } catch (err: unknown) {
      cleanupMediaResources();

      let errorType: AudioRecorderErrorType = "unknown";
      let errorMessage = "Không thể khởi động Microphone.";

      if (err instanceof DOMException) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          errorType = "permission_denied";
          errorMessage =
            "Quyền truy cập Microphone bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt.";
        } else if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError"
        ) {
          errorType = "device_not_found";
          errorMessage =
            "Không tìm thấy thiết bị Microphone trên máy tính của bạn.";
        } else if (err.name === "NotSupportedError") {
          errorType = "unsupported";
          errorMessage =
            "Định dạng hoặc cấu hình âm thanh không được hỗ trợ bởi thiết bị.";
        }
      }

      setError({
        type: errorType,
        message: errorMessage,
        originalError: err,
      });
      setStatus("error");
    }
  }, [
    audioConstraints,
    audioUrl,
    cleanupMediaResources,
    maxDurationSeconds,
    onMaxDurationReached,
    onRecordingComplete,
    stopRecording,
  ]);

  const pauseRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      setStatus("paused");
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      setStatus("recording");

      // Resume timer
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => {
          const next = prev + 1;
          if (maxDurationSeconds && next >= maxDurationSeconds) {
            stopRecording();
            if (onMaxDurationReached) {
              onMaxDurationReached();
            }
          }
          return next;
        });
      }, 1000);
    }
  }, [maxDurationSeconds, onMaxDurationReached, stopRecording]);

  const resetRecording = useCallback(() => {
    cleanupMediaResources();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    setStatus("idle");
  }, [audioUrl, cleanupMediaResources]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupMediaResources();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl, cleanupMediaResources]);

  return {
    status,
    duration,
    audioBlob,
    audioUrl,
    analyserNode,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  };
}
