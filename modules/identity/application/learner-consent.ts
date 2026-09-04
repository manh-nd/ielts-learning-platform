import { db } from "@/lib/db";
import { user } from "@/modules/identity/infrastructure/auth-schema";
import { eq } from "drizzle-orm";

// In-memory fallback cache when DATABASE_URL is not configured (e.g. unit tests or local dev)
export const devConsentCache = new Map<string, Date>();

/**
 * Checks whether a learner has recorded consent for the Free Tier pilot.
 */
export async function hasLearnerConsent(userId: string): Promise<boolean> {
  if (devConsentCache.has(userId)) {
    return true;
  }

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select({ consentFreeTierAt: user.consentFreeTierAt })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (rows.length > 0 && rows[0].consentFreeTierAt) {
        return true;
      }
    } catch (err) {
      console.warn(
        "[learner-consent] Error querying user consent from database:",
        err
      );
    }
  }

  return false;
}

/**
 * Retrieves the date when the learner recorded consent, or null.
 */
export async function getLearnerConsentDate(
  userId: string
): Promise<Date | null> {
  const cachedDate = devConsentCache.get(userId);
  if (cachedDate) {
    return cachedDate;
  }

  if (process.env.DATABASE_URL) {
    try {
      const rows = await db
        .select({ consentFreeTierAt: user.consentFreeTierAt })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (rows.length > 0 && rows[0].consentFreeTierAt) {
        return rows[0].consentFreeTierAt;
      }
    } catch (err) {
      console.warn(
        "[learner-consent] Error querying consent date from database:",
        err
      );
    }
  }

  return null;
}

/**
 * Records explicit learner consent for the Free Tier pilot in database (or dev fallback).
 */
export async function recordLearnerConsent(userId: string): Promise<Date> {
  const consentDate = new Date();

  if (process.env.DATABASE_URL) {
    await db
      .update(user)
      .set({
        consentFreeTierAt: consentDate,
        updatedAt: consentDate,
      })
      .where(eq(user.id, userId));
  }

  devConsentCache.set(userId, consentDate);
  return consentDate;
}

/**
 * Clears the dev consent cache (useful for test isolation).
 */
export function clearDevConsentCache(): void {
  devConsentCache.clear();
}
