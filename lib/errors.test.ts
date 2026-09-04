import { describe, it, expect } from "bun:test";
import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  toErrorResponse,
} from "./errors";

describe("Custom Errors Hierarchy", () => {
  it("should create AppError with default 500 status and code", () => {
    const error = new AppError("Something went wrong");
    expect(error.message).toBe("Something went wrong");
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe("AppError");
  });

  it("should create UnauthorizedError with 401 status", () => {
    const error = new UnauthorizedError("Session expired");
    expect(error.message).toBe("Session expired");
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe("UnauthorizedError");
  });

  it("should create ForbiddenError with 403 status", () => {
    const error = new ForbiddenError("Teacher only");
    expect(error.message).toBe("Teacher only");
    expect(error.code).toBe("FORBIDDEN");
    expect(error.statusCode).toBe(403);
    expect(error.name).toBe("ForbiddenError");
  });

  it("should create NotFoundError with 404 status", () => {
    const error = new NotFoundError("Classroom not found");
    expect(error.message).toBe("Classroom not found");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("NotFoundError");
  });

  it("should create ValidationError with 400 status and details", () => {
    const details = { field: "email", reason: "invalid_format" };
    const error = new ValidationError("Invalid email", details);
    expect(error.message).toBe("Invalid email");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual(details);
    expect(error.name).toBe("ValidationError");
  });

  it("should create ConflictError with 409 status and code", () => {
    const error = new ConflictError("Learner already enrolled");
    expect(error.message).toBe("Learner already enrolled");
    expect(error.code).toBe("CONFLICT");
    expect(error.statusCode).toBe(409);
    expect(error.name).toBe("ConflictError");
  });

  it("should convert AppError to Response with correct status and body", async () => {
    const error = new ForbiddenError("Only teachers can grade homework", {
      requiredRole: "teacher",
    });
    const response = toErrorResponse(error);
    expect(response.status).toBe(403);

    const body = (await response.json()) as {
      error: { message: string; code: string; details?: unknown };
    };
    expect(body.error.message).toBe("Only teachers can grade homework");
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.details).toEqual({ requiredRole: "teacher" });
  });

  it("should convert standard generic Error to 500 Response", async () => {
    const error = new Error("Database timeout");
    const response = toErrorResponse(error);
    expect(response.status).toBe(500);

    const body = (await response.json()) as {
      error: { message: string; code: string };
    };
    expect(body.error.message).toBe("Database timeout");
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("should convert unknown throw value to 500 Response", async () => {
    const response = toErrorResponse("random string error");
    expect(response.status).toBe(500);

    const body = (await response.json()) as {
      error: { message: string; code: string };
    };
    expect(body.error.message).toBe("Đã xảy ra lỗi không xác định.");
    expect(body.error.code).toBe("UNKNOWN_ERROR");
  });
});
