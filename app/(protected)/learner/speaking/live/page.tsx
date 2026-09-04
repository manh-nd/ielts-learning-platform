import { requireRoleOrRedirect } from "@/lib/authorization";
import { LiveSpeakingClientView } from "./live-speaking-client-view";
import { db } from "@/lib/db";
import { user } from "@/modules/identity/infrastructure/auth-schema";
import { devConsentCache } from "@/app/api/learner/consent/route";
import { eq } from "drizzle-orm";

export const metadata = {
  title: "Phòng Thi Speaking Trực Tiếp | Chilly IELTS",
  description:
    "Thi thử IELTS Speaking thời gian thực 1-on-1 với Giám khảo AI (Examiner).",
};

export default async function LearnerLiveSpeakingPage() {
  const session = await requireRoleOrRedirect("learner");

  let initialHasConsent = Boolean(
    (session.user as unknown as { consentFreeTierAt?: unknown })
      ?.consentFreeTierAt
  );

  if (!initialHasConsent) {
    if (devConsentCache.has(session.user.id)) {
      initialHasConsent = true;
    } else if (process.env.DATABASE_URL) {
      try {
        const rows = await db
          .select({ consentFreeTierAt: user.consentFreeTierAt })
          .from(user)
          .where(eq(user.id, session.user.id))
          .limit(1);
        if (rows.length > 0 && rows[0].consentFreeTierAt) {
          initialHasConsent = true;
        }
      } catch {
        // ignore lookup error
      }
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <LiveSpeakingClientView
        candidateName={session.user.name || "Học viên"}
        userId={session.user.id}
        initialHasConsent={initialHasConsent}
      />
    </div>
  );
}
