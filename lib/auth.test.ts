import { describe, it, expect } from "bun:test";
import { auth } from "./auth";
import { GET, POST } from "@/app/api/auth/[...all]/route";

describe("Better Auth Server Configuration", () => {
  it("should initialize betterAuth instance with valid options", () => {
    expect(auth).toBeDefined();
    expect(typeof auth.handler).toBe("function");
    expect(auth.api).toBeDefined();
    expect(auth.options).toBeDefined();
  });

  it("should configure email and password with security settings", () => {
    expect(auth.options.emailAndPassword?.enabled).toBe(true);
    expect(auth.options.emailAndPassword?.minPasswordLength).toBe(8);
    expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(
      true
    );
  });

  it("should configure user additionalFields with role property", () => {
    expect(auth.options.user?.additionalFields?.role).toBeDefined();
    expect(auth.options.user?.additionalFields?.role.defaultValue).toBe(
      "learner"
    );
    expect(auth.options.user?.additionalFields?.role.required).toBe(true);
    expect(auth.options.user?.additionalFields?.role.input).toBe(false);
  });

  it("should export Next.js App Router GET and POST handlers", () => {
    expect(typeof GET).toBe("function");
    expect(typeof POST).toBe("function");
  });
});
