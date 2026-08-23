import { describe, it, expect } from "bun:test";
import { user, session, account, verification } from "./auth-schema";
import { getTableColumns } from "drizzle-orm";

describe("Identity Auth Schema", () => {
  it("should define user table with required fields and role column", () => {
    const columns = getTableColumns(user);

    expect(columns.id).toBeDefined();
    expect(columns.name).toBeDefined();
    expect(columns.email).toBeDefined();
    expect(columns.emailVerified).toBeDefined();
    expect(columns.image).toBeDefined();
    expect(columns.createdAt).toBeDefined();
    expect(columns.updatedAt).toBeDefined();
    expect(columns.role).toBeDefined();
    expect(columns.role.default).toBe("learner");
  });

  it("should define session table with userId relation and token", () => {
    const columns = getTableColumns(session);

    expect(columns.id).toBeDefined();
    expect(columns.expiresAt).toBeDefined();
    expect(columns.token).toBeDefined();
    expect(columns.createdAt).toBeDefined();
    expect(columns.updatedAt).toBeDefined();
    expect(columns.ipAddress).toBeDefined();
    expect(columns.userAgent).toBeDefined();
    expect(columns.userId).toBeDefined();
  });

  it("should define account table with provider details and credentials", () => {
    const columns = getTableColumns(account);

    expect(columns.id).toBeDefined();
    expect(columns.accountId).toBeDefined();
    expect(columns.providerId).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.accessToken).toBeDefined();
    expect(columns.refreshToken).toBeDefined();
    expect(columns.password).toBeDefined();
    expect(columns.createdAt).toBeDefined();
  });

  it("should define verification table with token and expiry", () => {
    const columns = getTableColumns(verification);

    expect(columns.id).toBeDefined();
    expect(columns.identifier).toBeDefined();
    expect(columns.value).toBeDefined();
    expect(columns.expiresAt).toBeDefined();
    expect(columns.createdAt).toBeDefined();
  });
});
