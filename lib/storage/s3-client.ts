import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// In-memory fallback cache for local dev / tests when S3 is unconfigured (persisted on globalThis across Next.js dev route bundles)
const globalForAudioCache = globalThis as unknown as {
  directAudioDevCache?: Map<
    string,
    { data: Buffer; mimeType: string; updatedAt: number }
  >;
};

export const directAudioDevCache =
  globalForAudioCache.directAudioDevCache ||
  new Map<string, { data: Buffer; mimeType: string; updatedAt: number }>();

if (process.env.NODE_ENV !== "production") {
  globalForAudioCache.directAudioDevCache = directAudioDevCache;
}

export interface SpeakingUploadInfo {
  uploadUrl: string;
  storageKey: string;
  isDirectFallback: boolean;
}

/**
 * Builds canonical S3 key: speaking/{userId}/{sessionId}/{filename}
 */
export function buildSpeakingAudioStorageKey(
  userId: string,
  sessionId: string,
  filename: string = "candidate.webm"
): string {
  const cleanUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `speaking/${cleanUserId}/${cleanSessionId}/${filename}`;
}

/**
 * Verifies whether a given storage key belongs to the specified userId and optionally matching sessionId namespace.
 */
export function isSpeakingAudioStorageKeyOwnedBy(
  storageKey: string,
  userId: string,
  sessionId?: string
): boolean {
  if (!storageKey || !userId) return false;
  const cleanUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (sessionId) {
    const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return storageKey.startsWith(`speaking/${cleanUserId}/${cleanSessionId}/`);
  }
  return storageKey.startsWith(`speaking/${cleanUserId}/`);
}

/**
 * Returns S3Client instance if S3 environment variables are provided
 */
function getS3Client(): { client: S3Client; bucket: string } | null {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET_NAME || "ielts-speaking";
  const region = process.env.S3_REGION || "us-east-1";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true, // Required for SeaweedFS & MinIO
  });

  return { client, bucket };
}

/**
 * Generates Presigned PUT URL for direct browser-to-storage upload,
 * or returns internal direct fallback route for dev/test environments.
 */
export async function getSpeakingUploadPresignedUrl(
  storageKey: string,
  mimeType: string = "audio/webm;codecs=opus",
  expiresInSeconds: number = 600
): Promise<SpeakingUploadInfo> {
  const s3 = getS3Client();

  if (s3) {
    const command = new PutObjectCommand({
      Bucket: s3.bucket,
      Key: storageKey,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(s3.client, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      uploadUrl,
      storageKey,
      isDirectFallback: false,
    };
  }

  // Graceful Dev/Test fallback
  const fallbackBase = process.env.NEXT_PUBLIC_APP_URL || "";
  const uploadUrl = `${fallbackBase}/api/speaking/upload-direct?key=${encodeURIComponent(storageKey)}`;

  return {
    uploadUrl,
    storageKey,
    isDirectFallback: true,
  };
}

/**
 * Generates Presigned GET URL for audio playback, or returns fallback direct URL.
 */
export async function getSpeakingDownloadPresignedUrl(
  storageKey: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const s3 = getS3Client();

  if (s3) {
    const command = new GetObjectCommand({
      Bucket: s3.bucket,
      Key: storageKey,
    });

    return await getSignedUrl(s3.client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  const fallbackBase = process.env.NEXT_PUBLIC_APP_URL || "";
  return `${fallbackBase}/api/speaking/upload-direct?key=${encodeURIComponent(storageKey)}`;
}

/**
 * Downloads audio buffer from S3 or dev fallback cache for AI evaluation
 */
export async function getSpeakingAudioBuffer(
  storageKey: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const s3 = getS3Client();

  if (s3) {
    try {
      const command = new GetObjectCommand({
        Bucket: s3.bucket,
        Key: storageKey,
      });
      const response = await s3.client.send(command);
      if (!response.Body) return null;

      const byteArray = await response.Body.transformToByteArray();
      return {
        buffer: Buffer.from(byteArray),
        mimeType: response.ContentType || "audio/webm",
      };
    } catch (err) {
      console.error("[S3Client] Error downloading audio from S3:", err);
      return null;
    }
  }

  const cached = directAudioDevCache.get(storageKey);
  if (cached) {
    return {
      buffer: cached.data,
      mimeType: cached.mimeType,
    };
  }

  return null;
}

// In-Memory Dev Fallback helpers
export async function saveDirectAudioDevFallback(
  storageKey: string,
  data: Buffer,
  mimeType: string
): Promise<void> {
  directAudioDevCache.set(storageKey, {
    data,
    mimeType,
    updatedAt: Date.now(),
  });
}

export async function getDirectAudioDevFallback(
  storageKey: string
): Promise<{ data: Buffer; mimeType: string } | null> {
  const item = directAudioDevCache.get(storageKey);
  return item ? { data: item.data, mimeType: item.mimeType } : null;
}

let simulatedPersistenceFailure = false;
let simulatedDeletionFailure = false;

/**
 * Test helper to simulate storage persistence failures
 */
export function setSimulatedPersistenceFailure(shouldFail: boolean): void {
  simulatedPersistenceFailure = shouldFail;
}

/**
 * Test helper to simulate storage deletion failures
 */
export function setSimulatedDeletionFailure(shouldFail: boolean): void {
  simulatedDeletionFailure = shouldFail;
}

/**
 * Durably persists raw audio buffer to S3 or internal dev fallback cache.
 */
export async function persistSpeakingAudioBuffer(
  storageKey: string,
  data: Buffer,
  mimeType: string = "audio/webm;codecs=opus"
): Promise<{ success: boolean; storageKey: string }> {
  if (simulatedPersistenceFailure) {
    console.warn("[S3Client] Simulated storage persistence failure active.");
    return { success: false, storageKey: "" };
  }

  const s3 = getS3Client();
  if (s3) {
    try {
      const command = new PutObjectCommand({
        Bucket: s3.bucket,
        Key: storageKey,
        Body: data,
        ContentType: mimeType,
      });
      await s3.client.send(command);
      return { success: true, storageKey };
    } catch (err) {
      console.error("[S3Client] Failed to persist audio buffer to S3:", err);
      return { success: false, storageKey };
    }
  }

  // Fallback to dev cache
  await saveDirectAudioDevFallback(storageKey, data, mimeType);
  return { success: true, storageKey };
}

/**
 * Idempotently deletes a single audio object from S3 or dev fallback cache.
 */
export async function deleteSpeakingAudioObject(
  storageKey: string
): Promise<boolean> {
  if (!storageKey) return false;

  if (simulatedDeletionFailure) {
    throw new Error(
      `[S3Client] Simulated storage deletion failure for key "${storageKey}"`
    );
  }

  // 1. Delete from in-memory dev cache
  directAudioDevCache.delete(storageKey);

  // 2. Delete from S3 if configured
  const s3 = getS3Client();
  if (s3) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: s3.bucket,
        Key: storageKey,
      });
      await s3.client.send(command);
    } catch (err) {
      console.error(`[S3Client] Error deleting ${storageKey} from S3:`, err);
      throw err;
    }
  }

  return true;
}

/**
 * Idempotently deletes all audio objects belonging to a specific user and session prefix.
 */
export async function deleteSpeakingAudioSession(
  userId: string,
  sessionId: string
): Promise<number> {
  if (!userId || !sessionId) return 0;

  if (simulatedDeletionFailure) {
    throw new Error(
      `[S3Client] Simulated storage deletion failure for session "${sessionId}"`
    );
  }

  const cleanUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const sessionPrefix = `speaking/${cleanUserId}/${cleanSessionId}/`;

  let deletedCount = 0;

  // 1. Delete from dev cache
  for (const key of Array.from(directAudioDevCache.keys())) {
    if (key.startsWith(sessionPrefix)) {
      directAudioDevCache.delete(key);
      deletedCount++;
    }
  }

  // 2. Delete from S3 if configured
  const s3 = getS3Client();
  if (s3) {
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: s3.bucket,
        Prefix: sessionPrefix,
      });
      const listed = await s3.client.send(listCommand);
      if (listed.Contents && listed.Contents.length > 0) {
        for (const item of listed.Contents) {
          if (item.Key) {
            await s3.client.send(
              new DeleteObjectCommand({
                Bucket: s3.bucket,
                Key: item.Key,
              })
            );
            deletedCount++;
          }
        }
      }
    } catch (err) {
      console.error(
        `[S3Client] Error deleting session audio under ${sessionPrefix}:`,
        err
      );
      throw err;
    }
  }

  return deletedCount;
}
