import { db } from "@/lib/db";
import { telemetryEvents } from "./telemetry-schema";
import type {
  TelemetryEventInput,
  TelemetryEventRecord,
} from "../domain/telemetry-types";
import { eq, and, desc } from "drizzle-orm";

const globalForTelemetry = globalThis as unknown as {
  devTelemetryCache?: TelemetryEventRecord[];
};

export const devTelemetryCache: TelemetryEventRecord[] =
  globalForTelemetry.devTelemetryCache || [];

if (process.env.NODE_ENV !== "production") {
  globalForTelemetry.devTelemetryCache = devTelemetryCache;
}

export function clearDevTelemetryCache(): void {
  devTelemetryCache.length = 0;
}

export async function recordTelemetryEvent(
  input: TelemetryEventInput & { userId: string }
): Promise<TelemetryEventRecord> {
  const eventId = crypto.randomUUID();
  const now = new Date();

  const record: TelemetryEventRecord = {
    id: eventId,
    userId: input.userId,
    userRole: input.userRole || "learner",
    eventName: input.eventName,
    contextType: input.contextType,
    contextId: input.contextId ?? null,
    durationMs:
      typeof input.durationMs === "number"
        ? Math.round(input.durationMs)
        : null,
    properties: input.properties || {},
    createdAt: now,
  };

  // 1. Attempt PostgreSQL persistence if DATABASE_URL is present
  if (process.env.DATABASE_URL) {
    try {
      await db.insert(telemetryEvents).values({
        id: record.id,
        userId: record.userId,
        userRole: record.userRole,
        eventName: record.eventName,
        contextType: record.contextType,
        contextId: record.contextId,
        durationMs: record.durationMs,
        properties: record.properties,
        createdAt: record.createdAt,
      });
    } catch (err) {
      console.warn("[TelemetryRepository] Database insert warning:", err);
    }
  }

  // 2. Always store in dev cache for offline/test assertions
  devTelemetryCache.push(record);

  return record;
}

export async function queryTelemetryEvents(filter: {
  userId?: string;
  eventName?: string;
  contextType?: string;
  contextId?: string;
  limit?: number;
}): Promise<TelemetryEventRecord[]> {
  const limit = filter.limit ?? 50;

  if (process.env.DATABASE_URL) {
    try {
      const conditions = [];
      if (filter.userId) {
        conditions.push(eq(telemetryEvents.userId, filter.userId));
      }
      if (filter.eventName) {
        conditions.push(eq(telemetryEvents.eventName, filter.eventName));
      }
      if (filter.contextType) {
        conditions.push(
          eq(
            telemetryEvents.contextType,
            filter.contextType as "practice" | "homework" | "system"
          )
        );
      }
      if (filter.contextId) {
        conditions.push(eq(telemetryEvents.contextId, filter.contextId));
      }

      const query = db
        .select()
        .from(telemetryEvents)
        .orderBy(desc(telemetryEvents.createdAt))
        .limit(limit);

      const rows =
        conditions.length > 0
          ? await query.where(and(...conditions))
          : await query;

      if (rows.length > 0) {
        return rows.map((r) => ({
          id: r.id,
          userId: r.userId,
          userRole: r.userRole,
          eventName: r.eventName as TelemetryEventRecord["eventName"],
          contextType: r.contextType,
          contextId: r.contextId,
          durationMs: r.durationMs,
          properties: (r.properties as Record<string, unknown>) || {},
          createdAt: r.createdAt,
        }));
      }
    } catch (err) {
      console.warn("[TelemetryRepository] Database query warning:", err);
    }
  }

  // Fallback to in-memory dev cache
  return devTelemetryCache
    .filter((e) => {
      if (filter.userId && e.userId !== filter.userId) return false;
      if (filter.eventName && e.eventName !== filter.eventName) return false;
      if (filter.contextType && e.contextType !== filter.contextType)
        return false;
      if (filter.contextId && e.contextId !== filter.contextId) return false;
      return true;
    })
    .slice(-limit)
    .reverse();
}
