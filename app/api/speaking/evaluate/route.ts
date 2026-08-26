import { NextRequest, NextResponse } from "next/server";
import {
  evaluateSpeakingAudio,
  SpeakingAudioInput,
} from "@/lib/gemini/speaking-evaluator";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      topicTitle = "IELTS Speaking Examination",
      part1Question = "Part 1 Introduction and Interview",
      part2Topic = "Part 2 Individual Long Turn Cue Card",
      part3Theme = "Part 3 Two-Way Discussion",
      transcripts = [],
      audioBase64,
      durationSeconds = 120,
    } = body;

    // Filter candidate transcripts vs examiner transcripts
    const userTranscripts = (
      transcripts as Array<{ sender: string; text: string }>
    )
      .filter((t) => t.sender === "user")
      .map((t) => t.text)
      .join(" ");

    const transcriptSuffix = userTranscripts
      ? `\n(Candidate real-time spoken transcript: "${userTranscripts.slice(0, 500)}...")`
      : "";

    // Prepare evaluation items for Part 1, Part 2, and Part 3
    const items: SpeakingAudioInput[] = [
      {
        partNumber: 1,
        itemIndex: 0,
        promptQuestion: `${topicTitle} - Part 1: ${part1Question}${transcriptSuffix}`,
        audioBase64: audioBase64 || undefined,
        mimeType: audioBase64 ? "audio/webm" : undefined,
        durationSeconds: Math.round(durationSeconds / 3),
      },
      {
        partNumber: 2,
        itemIndex: 0,
        promptQuestion: `${topicTitle} - Part 2 Cue Card: ${part2Topic}${transcriptSuffix}`,
        audioBase64: audioBase64 || undefined,
        mimeType: audioBase64 ? "audio/webm" : undefined,
        durationSeconds: Math.round(durationSeconds / 3),
      },
      {
        partNumber: 3,
        itemIndex: 0,
        promptQuestion: `${topicTitle} - Part 3 Discussion: ${part3Theme}${transcriptSuffix}`,
        audioBase64: audioBase64 || undefined,
        mimeType: audioBase64 ? "audio/webm" : undefined,
        durationSeconds: Math.round(durationSeconds / 3),
      },
    ];

    const result = await evaluateSpeakingAudio(items);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    console.error("[EvaluateSpeakingAPI] Evaluation error:", error);
    return NextResponse.json(
      {
        error: "Failed to evaluate speaking session",
        message:
          (error as Error)?.message ||
          "Internal error during speaking assessment",
      },
      { status: 500 }
    );
  }
}
