import { describe, it, expect, beforeEach } from "bun:test";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { POST as PostUploadUrl } from "../conversation-replay/upload-url/route";
import { POST as PostAttach } from "../conversation-replay/route";
import { devSessionCache } from "@/modules/speaking/infrastructure/speaking-practice-repository";
import { persistSpeakingAudioBuffer } from "@/lib/storage/s3-client";

describe("ConversationReplay API Routes (#101)", () => {
  const userId = "learner_api_owner";
  const otherUserId = "learner_attacker";
  const sessionId = "ses_api_test_101";

  const sessionPayload = {
    user: { id: userId, role: "learner" },
    session: {
      id: `sess_${userId}`,
      userId,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  };

  const attackerSessionPayload = {
    user: { id: otherUserId, role: "learner" },
    session: {
      id: `sess_${otherUserId}`,
      userId: otherUserId,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  };

  const authHeaders = {
    cookie: `e2e_mock_session=${encodeURIComponent(JSON.stringify(sessionPayload))}`,
    "content-type": "application/json",
  };

  const attackerHeaders = {
    cookie: `e2e_mock_session=${encodeURIComponent(JSON.stringify(attackerSessionPayload))}`,
    "content-type": "application/json",
  };

  beforeEach(() => {
    devSessionCache.clear();
  });

  describe("POST .../conversation-replay/upload-url", () => {
    it("generates presigned upload url for eligible completed session", async () => {
      devSessionCache.set(sessionId, {
        id: sessionId,
        userId,
        candidateName: "Owner",
        topicTitle: "Topic",
        status: "completed",
        targetPart: "part_1",
        durationSeconds: 30,
        overallBand: null,
        scorecardJson: null,
        evidenceJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new NextRequest(
        `http://localhost:3000/api/speaking/practices/${sessionId}/conversation-replay/upload-url`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ mimeType: "audio/wav" }),
        }
      );

      const res = await PostUploadUrl(req, {
        params: Promise.resolve({ sessionId }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.uploadUrl).toBeDefined();
      // Crucial: storageKey must NOT be leaked to client
      expect(data.storageKey).toBeUndefined();
    });

    it("rejects upload URL request for session belonging to another learner (404)", async () => {
      devSessionCache.set(sessionId, {
        id: sessionId,
        userId,
        candidateName: "Owner",
        topicTitle: "Topic",
        status: "completed",
        targetPart: "part_1",
        durationSeconds: 30,
        overallBand: null,
        scorecardJson: null,
        evidenceJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new NextRequest(
        `http://localhost:3000/api/speaking/practices/${sessionId}/conversation-replay/upload-url`,
        {
          method: "POST",
          headers: attackerHeaders,
          body: JSON.stringify({ mimeType: "audio/wav" }),
        }
      );

      const res = await PostUploadUrl(req, {
        params: Promise.resolve({ sessionId }),
      });
      expect(res.status).toBe(404);
    });

    it("rejects upload URL request for in_progress session (403)", async () => {
      devSessionCache.set(sessionId, {
        id: sessionId,
        userId,
        candidateName: "Owner",
        topicTitle: "Topic",
        status: "in_progress",
        targetPart: "part_1",
        durationSeconds: 0,
        overallBand: null,
        scorecardJson: null,
        evidenceJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new NextRequest(
        `http://localhost:3000/api/speaking/practices/${sessionId}/conversation-replay/upload-url`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ mimeType: "audio/wav" }),
        }
      );

      const res = await PostUploadUrl(req, {
        params: Promise.resolve({ sessionId }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("POST .../conversation-replay (Attach)", () => {
    it("attaches replay metadata when binary is in storage", async () => {
      const storageKey = `speaking/${userId}/${sessionId}/conversation.wav`;
      // Put a minimal RIFF WAV header (44 bytes)
      const wavHeader = Buffer.alloc(44);
      wavHeader.write("RIFF", 0);
      wavHeader.writeUInt32LE(36 + 48000, 4); // file size - 8
      wavHeader.write("WAVE", 8);
      wavHeader.write("fmt ", 12);
      wavHeader.writeUInt32LE(16, 16);
      wavHeader.writeUInt16LE(1, 20); // PCM
      wavHeader.writeUInt16LE(1, 22); // mono
      wavHeader.writeUInt32LE(24000, 24); // 24 kHz
      wavHeader.writeUInt32LE(48000, 28); // byte rate (24000 * 2)
      wavHeader.writeUInt16LE(2, 32);
      wavHeader.writeUInt16LE(16, 34);
      wavHeader.write("data", 36);
      wavHeader.writeUInt32LE(48000, 40); // 1 second of 24k 16-bit mono

      const wavBuffer = Buffer.concat([wavHeader, Buffer.alloc(48000)]);
      await persistSpeakingAudioBuffer(storageKey, wavBuffer, "audio/wav");

      devSessionCache.set(sessionId, {
        id: sessionId,
        userId,
        candidateName: "Owner",
        topicTitle: "Topic",
        status: "completed",
        targetPart: "part_1",
        durationSeconds: 30,
        overallBand: null,
        scorecardJson: null,
        evidenceJson: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new NextRequest(
        `http://localhost:3000/api/speaking/practices/${sessionId}/conversation-replay`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ durationSeconds: 1 }),
        }
      );

      const res = await PostAttach(req, {
        params: Promise.resolve({ sessionId }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.result.attached).toBe(true);

      const updated = devSessionCache.get(sessionId);
      expect(updated?.conversationReplayStorageKey).toBe(storageKey);
      expect(updated?.conversationReplayDurationSeconds).toBe(1);
    });
  });

  describe("GET .../conversation-audio (Streaming)", () => {
    it("streams audio with 200 for full download and 206 for range requests", async () => {
      const storageKey = `speaking/${userId}/${sessionId}/conversation.wav`;
      const fakeAudio = Buffer.from(
        "RIFF....WAVEfmt ....datafake-pcm-bytes-12345"
      );
      await persistSpeakingAudioBuffer(storageKey, fakeAudio, "audio/wav");

      devSessionCache.set(sessionId, {
        id: sessionId,
        userId,
        candidateName: "Owner",
        topicTitle: "Topic",
        status: "completed",
        targetPart: "part_1",
        durationSeconds: 30,
        overallBand: null,
        scorecardJson: null,
        evidenceJson: null,
        conversationReplayStorageKey: storageKey,
        conversationReplayMimeType: "audio/wav",
        conversationReplayDurationSeconds: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 1. Full GET
      const fullReq = new NextRequest(
        `http://localhost:3000/api/speaking/practices/${sessionId}/conversation-audio`,
        {
          method: "GET",
          headers: authHeaders,
        }
      );

      const fullRes = await GET(fullReq, {
        params: Promise.resolve({ sessionId }),
      });
      expect(fullRes.status).toBe(200);
      expect(fullRes.headers.get("content-type")).toBe("audio/wav");
      const fullBytes = await fullRes.arrayBuffer();
      expect(Buffer.from(fullBytes).toString()).toBe(fakeAudio.toString());

      // 2. Range GET
      const rangeReq = new NextRequest(
        `http://localhost:3000/api/speaking/practices/${sessionId}/conversation-audio`,
        {
          method: "GET",
          headers: {
            ...authHeaders,
            range: "bytes=0-3",
          },
        }
      );

      const rangeRes = await GET(rangeReq, {
        params: Promise.resolve({ sessionId }),
      });
      expect(rangeRes.status).toBe(206);
      expect(rangeRes.headers.get("content-range")).toBe(
        `bytes 0-3/${fakeAudio.length}`
      );
      const rangeBytes = await rangeRes.arrayBuffer();
      expect(Buffer.from(rangeBytes).toString()).toBe("RIFF");
    });

    it("returns 404 if accessed by non-owner learner", async () => {
      const storageKey = `speaking/${userId}/${sessionId}/conversation.wav`;
      await persistSpeakingAudioBuffer(
        storageKey,
        Buffer.from("audio"),
        "audio/wav"
      );

      devSessionCache.set(sessionId, {
        id: sessionId,
        userId,
        candidateName: "Owner",
        topicTitle: "Topic",
        status: "completed",
        targetPart: "part_1",
        durationSeconds: 30,
        overallBand: null,
        scorecardJson: null,
        evidenceJson: null,
        conversationReplayStorageKey: storageKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new NextRequest(
        `http://localhost:3000/api/speaking/practices/${sessionId}/conversation-audio`,
        {
          method: "GET",
          headers: attackerHeaders,
        }
      );

      const res = await GET(req, {
        params: Promise.resolve({ sessionId }),
      });
      expect(res.status).toBe(404);
    });
  });
});
