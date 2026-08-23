/**
 * Custom application errors hierarchy for IELTS Assessment Platform.
 * Provides structured error codes, HTTP status codes, and serialization helpers.
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    options: {
      code?: string;
      statusCode?: number;
      details?: unknown;
      cause?: unknown;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.code = options.code ?? "INTERNAL_SERVER_ERROR";
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details;

    // Maintains proper stack trace for where error was thrown (V8 / Node / Bun)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 401 Unauthorized Error - Unauthenticated request or expired session.
 */
export class UnauthorizedError extends AppError {
  constructor(
    message = "Yêu cầu xác thực: Phiên đăng nhập không tồn tại hoặc đã hết hạn.",
    details?: unknown
  ) {
    super(message, {
      code: "UNAUTHORIZED",
      statusCode: 401,
      details,
    });
  }
}

/**
 * 403 Forbidden Error - Authenticated user lacks required permissions or role.
 */
export class ForbiddenError extends AppError {
  constructor(
    message = "Bị từ chối truy cập: Bạn không có quyền thực hiện thao tác này.",
    details?: unknown
  ) {
    super(message, {
      code: "FORBIDDEN",
      statusCode: 403,
      details,
    });
  }
}

/**
 * 404 Not Found Error - Requested resource does not exist.
 */
export class NotFoundError extends AppError {
  constructor(
    message = "Không tìm thấy tài nguyên được yêu cầu.",
    details?: unknown
  ) {
    super(message, {
      code: "NOT_FOUND",
      statusCode: 404,
      details,
    });
  }
}

/**
 * 400 Validation Error - Invalid client input or schema constraint violation.
 */
export class ValidationError extends AppError {
  constructor(message = "Dữ liệu yêu cầu không hợp lệ.", details?: unknown) {
    super(message, {
      code: "VALIDATION_ERROR",
      statusCode: 400,
      details,
    });
  }
}

export interface ErrorResponseBody {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

/**
 * Converts any caught error into a standardized JSON Response.
 */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      } satisfies ErrorResponseBody,
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    return Response.json(
      {
        error: {
          message: error.message || "Đã xảy ra lỗi máy chủ nội bộ.",
          code: "INTERNAL_SERVER_ERROR",
        },
      } satisfies ErrorResponseBody,
      { status: 500 }
    );
  }

  return Response.json(
    {
      error: {
        message: "Đã xảy ra lỗi không xác định.",
        code: "UNKNOWN_ERROR",
      },
    } satisfies ErrorResponseBody,
    { status: 500 }
  );
}
