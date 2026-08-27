import { NextRequest, NextResponse } from "next/server";
import {
  evaluateSpeakingAudio,
  SpeakingAudioInput,
} from "@/lib/gemini/speaking-evaluator";
import { getSpeakingAudioBuffer } from "@/lib/storage/s3-client";
import { db } from "@/lib/db";
import {
  speakingSessions,
  speakingResponses,
  speakingReviewAnnotations,
} from "@/lib/db/schema";

export const runtime = "nodejs";

export interface CandidateTurnMarkerInput {
  partNumber: number;
  itemIndex: number;
  promptQuestion: string;
  startMs: number;
  endMs: number;
  liveTranscript?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId = "anonymous",
      sessionId = `ses_${Date.now()}`,
      topicTitle = "IELTS Speaking Examination",
      part1Question = "Part 1 Introduction and Interview",
      part2Topic = "Part 2 Individual Long Turn Cue Card",
      part3Theme = "Part 3 Two-Way Discussion",
      transcripts = [],
      turnMarkers = [] as CandidateTurnMarkerInput[],
      audioBase64,
      storageKey,
      durationSeconds = 120,
    } = body;

    // 1. Resolve Audio Payload from S3 storageKey or direct base64
    let audioBuffer: Buffer | undefined;
    let mimeType = "audio/webm;codecs=opus";

    if (storageKey) {
      const audioData = await getSpeakingAudioBuffer(storageKey);
      if (audioData) {
        audioBuffer = audioData.buffer;
        mimeType = audioData.mimeType;
      }
    }

    if (!audioBuffer && audioBase64) {
      audioBuffer = Buffer.from(audioBase64, "base64");
    }

    // 2. Prepare items for evaluation
    let items: SpeakingAudioInput[] = [];

    const typedTurnMarkers = (turnMarkers || []) as CandidateTurnMarkerInput[];
    if (typedTurnMarkers.length > 0) {
      // Use exact candidate turn markers captured during the live session
      items = typedTurnMarkers.map((marker: CandidateTurnMarkerInput) => ({
        partNumber: marker.partNumber,
        itemIndex: marker.itemIndex,
        promptQuestion: marker.promptQuestion,
        startMs: marker.startMs,
        endMs: marker.endMs,
        liveTranscript: marker.liveTranscript,
        audioBuffer,
        mimeType,
        durationSeconds: Math.max(
          1,
          Math.round((marker.endMs - marker.startMs) / 1000)
        ),
      }));
    } else {
      // Fallback default 3-part split
      const userTranscripts = (
        transcripts as Array<{ sender: string; text: string }>
      )
        .filter((t) => t.sender === "user")
        .map((t) => t.text)
        .join(" ");

      items = [
        {
          partNumber: 1,
          itemIndex: 0,
          promptQuestion: `${topicTitle} - Part 1: ${part1Question}`,
          audioBuffer,
          audioBase64: !audioBuffer ? audioBase64 : undefined,
          mimeType,
          liveTranscript: userTranscripts.slice(0, 300),
          durationSeconds: Math.round(durationSeconds / 3),
        },
        {
          partNumber: 2,
          itemIndex: 0,
          promptQuestion: `${topicTitle} - Part 2 Cue Card: ${part2Topic}`,
          audioBuffer,
          audioBase64: !audioBuffer ? audioBase64 : undefined,
          mimeType,
          liveTranscript: userTranscripts.slice(300, 700),
          durationSeconds: Math.round(durationSeconds / 3),
        },
        {
          partNumber: 3,
          itemIndex: 0,
          promptQuestion: `${topicTitle} - Part 3 Discussion: ${part3Theme}`,
          audioBuffer,
          audioBase64: !audioBuffer ? audioBase64 : undefined,
          mimeType,
          liveTranscript: userTranscripts.slice(700),
          durationSeconds: Math.round(durationSeconds / 3),
        },
      ];
    }

    // 3. Execute 2-Stage Evaluation Engine
    const result = await evaluateSpeakingAudio(items);

    // 4. Persist to Database via Drizzle ORM (fail-safe for dev/test)
    try {
      if (process.env.DATABASE_URL) {
        await db
          .insert(speakingSessions)
          .values({
            id: sessionId,
            userId,
            topicTitle,
            status: "evaluated",
            targetPart: "full",
            durationSeconds,
            overallBand: result.overallScorecard.overallBand,
            scorecardJson: result.overallScorecard,
            evidenceJson: result.evidence || null,
            practiceMonologue:
              result.overallScorecard.generalFeedback.practiceMonologue,
          })
          .onConflictDoNothing();

        for (let i = 0; i < result.partEvaluations.length; i++) {
          const partEval = result.partEvaluations[i];
          const responseId = `resp_${sessionId}_p${partEval.partNumber}_${partEval.itemIndex}`;
          const correspondingItem = items[i];

          await db
            .insert(speakingResponses)
            .values({
              id: responseId,
              sessionId,
              partNumber: partEval.partNumber,
              itemIndex: partEval.itemIndex,
              promptQuestion: partEval.promptQuestion,
              storageKey: storageKey || null,
              audioUrl: storageKey
                ? `/api/speaking/upload-direct?key=${encodeURIComponent(storageKey)}`
                : null,
              mimeType,
              startMs: correspondingItem?.startMs || 0,
              endMs: correspondingItem?.endMs || 0,
              durationSeconds: correspondingItem?.durationSeconds || 0,
              liveTranscript: partEval.candidateTranscript,
              verifiedTranscript: partEval.verifiedTranscript || null,
            })
            .onConflictDoNothing();

          // Save timestamped pronunciation annotations
          for (const pr of partEval.pronunciationNotes) {
            await db
              .insert(speakingReviewAnnotations)
              .values({
                id: `ann_${responseId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                sessionId,
                responseId,
                category: "pronunciation",
                timestampSeconds:
                  pr.timestampSeconds || (pr.startMs ? pr.startMs / 1000 : 0),
                audioClipStartMs: pr.startMs || null,
                audioClipEndMs: pr.endMs || null,
                originalQuote: pr.word,
                comment: `${pr.detectedIssue}. Recommendation: ${pr.recommendation}`,
              })
              .onConflictDoNothing();
          }
        }
      }
    } catch (dbErr) {
      console.warn(
        "[EvaluateSpeakingAPI] Database persistence non-fatal warning:",
        dbErr
      );
    }

    return NextResponse.json({
      success: true,
      result,
      sessionId,
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
