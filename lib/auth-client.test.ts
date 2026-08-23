import { describe, it, expect } from "bun:test";
import {
  authClient,
  useSession,
  signIn,
  signUp,
  signOut,
  getSession,
} from "./auth-client";

describe("Client Auth SDK", () => {
  it("should initialize authClient instance with core methods", () => {
    expect(authClient).toBeDefined();
    expect(typeof authClient.signIn).toBe("function");
    expect(typeof authClient.signIn.email).toBe("function");
    expect(typeof authClient.signIn.social).toBe("function");
    expect(typeof authClient.signUp).toBe("function");
    expect(typeof authClient.signUp.email).toBe("function");
    expect(typeof authClient.signOut).toBe("function");
    expect(typeof authClient.useSession).toBe("function");
    expect(typeof authClient.getSession).toBe("function");
  });

  it("should export top-level auth convenience functions and hooks", () => {
    expect(typeof useSession).toBe("function");
    expect(typeof signIn).toBe("function");
    expect(typeof signIn.email).toBe("function");
    expect(typeof signUp).toBe("function");
    expect(typeof signUp.email).toBe("function");
    expect(typeof signOut).toBe("function");
    expect(typeof getSession).toBe("function");
  });
});
