import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authorization";
import {
  toErrorResponse,
  AppError,
  ValidationError,
  ForbiddenError,
} from "@/lib/errors";
import {
  isValidTelemetryEventName,
  isValidTelemetryContextType,
  TelemetryUserRole,
} from "@/modules/telemetry/domain/telemetry-types";
import { recordTelemetryEvent } from "@/modules/telemetry/infrastructure/telemetry-repository";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req.headers);
    const authenticatedUserId = session.user.id;
    const authenticatedUserRole = (session.user.role ||
      "learner") as TelemetryUserRole;

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError("Invalid JSON payload in request body.");
    }

    const {
      eventName,
      contextType,
      contextId,
      durationMs,
      properties,
      userId: requestedUserId,
    } = body;

    // Security invariant: Prevent spoofing events under another user's ID
    if (requestedUserId && requestedUserId !== authenticatedUserId) {
      throw new ForbiddenError(
        "Bị từ chối: Không thể ghi nhận telemetry thay cho người dùng khác."
      );
    }

    // Taxonomy validation
    if (!isValidTelemetryEventName(eventName)) {
      throw new ValidationError(
        `Invalid eventName '${String(eventName)}': Must be a canonical event in the defined taxonomy (§7.2).`
      );
    }

    if (!isValidTelemetryContextType(contextType)) {
      throw new ValidationError(
        `Invalid contextType '${String(contextType)}': Must be 'practice', 'homework', or 'system'.`
      );
    }

    let parsedDurationMs: number | null = null;
    if (durationMs !== undefined && durationMs !== null) {
      if (
        typeof durationMs !== "number" ||
        isNaN(durationMs) ||
        durationMs < 0
      ) {
        throw new ValidationError("durationMs must be a non-negative number.");
      }
      parsedDurationMs = Math.round(durationMs);
    }

    let parsedProperties: Record<string, unknown> = {};
    if (properties !== undefined && properties !== null) {
      if (typeof properties !== "object" || Array.isArray(properties)) {
        throw new ValidationError("properties must be a JSON object.");
      }
      parsedProperties = properties as Record<string, unknown>;
    }

    const record = await recordTelemetryEvent({
      userId: authenticatedUserId,
      userRole: authenticatedUserRole,
      eventName,
      contextType,
      contextId: typeof contextId === "string" ? contextId : null,
      durationMs: parsedDurationMs,
      properties: parsedProperties,
    });

    return NextResponse.json(
      {
        success: true,
        eventId: record.id,
        eventName: record.eventName,
        createdAt: record.createdAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return toErrorResponse(error);
    }
    console.error("[TelemetryAPI] Internal server error:", error);
    return NextResponse.json(
      {
        error: "Failed to record telemetry event",
        message: (error as Error)?.message || "Internal error",
      },
      { status: 500 }
    );
  }
}
