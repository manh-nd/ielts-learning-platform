import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";
import type { UserRole } from "@/modules/identity/infrastructure/auth-schema";

/**
 * Client Auth SDK for Next.js App Router (Client Components).
 * Re-exports reactive hooks and actions for authentication.
 */
export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || undefined,
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  getSession,
  revokeSession,
  revokeSessions,
} = authClient;

export type ClientSession = typeof authClient.$Infer.Session;
export type ClientUser = typeof authClient.$Infer.Session.user;

export type { UserRole };
