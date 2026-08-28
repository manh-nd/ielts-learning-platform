import { requireRoleOrRedirect } from "@/lib/authorization";
import { LiveSpeakingClientView } from "./live-speaking-client-view";

export const metadata = {
  title: "Phòng Thi Speaking Trực Tiếp | Chilly IELTS",
  description:
    "Thi thử IELTS Speaking thời gian thực 1-on-1 với Giám khảo AI (Examiner).",
};

export default async function LearnerLiveSpeakingPage() {
  const session = await requireRoleOrRedirect(["learner", "teacher"]);

  return (
    <div className="space-y-6 pb-12">
      <LiveSpeakingClientView candidateName={session.user.name || "Học viên"} />
    </div>
  );
}
