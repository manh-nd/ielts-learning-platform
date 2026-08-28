import { requireRoleOrRedirect } from "@/lib/authorization";
import { TeacherReviewWorkspace } from "@/components/review/teacher-review-workspace";
import type { ReviewStudentInfo } from "@/components/review/review-header";
import type { Criterion } from "@/components/review/types";

export const metadata = {
  title: "Không gian Chấm bài Giáo viên | Chilly IELTS",
  description: "Không gian chấm bài Writing chuyên sâu cho Giảng viên IELTS.",
};

export default async function TeacherReviewPage() {
  const session = await requireRoleOrRedirect("teacher");

  // Sample submission data for teacher review workspace
  const sampleStudent: ReviewStudentInfo = {
    name: "Nguyễn Minh Khang",
    avatar: "",
    class: "IELTS Intensive K24",
    submissionAttempt: 1,
    submittedAt: new Date().toLocaleDateString("vi-VN"),
  };

  const samplePrompt = {
    id: "prompt-w2-108",
    title: "Cambridge IELTS 18 - Test 1 - Writing Task 2",
    taskType: "TASK_2" as const,
    targetBand: 7.5,
    wordCountMin: 250,
    wordCountMax: 350,
    promptText:
      "Some people believe that unpaid community service should be a compulsory part of high school programmes. To what extent do you agree or disagree?",
    keyInstructions: [
      "Trình bày rõ quan điểm cá nhân (Agree/Disagree/Partly Agree).",
      "Đưa ra các dẫn chứng xác thực từ thực tế giáo dục.",
      "Đáp ứng tối thiểu 250 từ và cấu trúc 4 đoạn rõ ràng.",
    ],
  };

  const sampleEssayHtml = `
    <p>It is often argued that students in high school should be required to participate in unpaid community activities as part of their curriculum. In my opinion, I completely agree with this viewpoint because it fosters social responsibility and helps teenagers develop essential life skills.</p>
    <p>Firstly, compulsory volunteer work instills a deep sense of civic awareness in youth. When adolescents actively engage in assisting vulnerable people or cleaning local parks, they become more empathetic towards societal issues. For instance, high schoolers involved in charity programs often exhibit a greater appreciation for their privileged lives and demonstrate lower tendencies of juvenile delinquency.</p>
    <p>Secondly, community service provides young individuals with practical workplace competencies that cannot be learned solely from textbooks. Through collaborative charity projects, students cultivate vital interpersonal skills such as teamwork, leadership, and time management. These experiences not only boost their university applications but also prepare them effectively for their future professions.</p>
    <p>In conclusion, incorporating mandatory community service into high school education is a highly progressive initiative. It transforms teenagers into compassionate citizens while equipping them with versatile skills for adult life.</p>
  `.trim();

  const sampleAiScores: Record<Criterion, number> = {
    TASK_ACHIEVEMENT: 7.0,
    COHERENCE_COHESION: 7.0,
    LEXICAL_RESOURCE: 6.5,
    GRAMMATICAL_RANGE_ACCURACY: 6.5,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Không gian Chấm bài & Phản hồi Chuyên sâu
        </h1>
        <p className="text-xs text-muted-foreground">
          Xin chào{" "}
          <span className="font-semibold text-foreground">
            {session.user.name}
          </span>{" "}
          (Giáo viên). Bạn đang xem bài nộp Writing Task 2 cần chấm điểm và
          duyệt phản hồi AI.
        </p>
      </div>

      <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-xs">
        <TeacherReviewWorkspace
          student={sampleStudent}
          prompt={samplePrompt}
          initialEssayHtml={sampleEssayHtml}
          initialEssayPlainText={sampleEssayHtml.replace(/<[^>]*>/g, " ")}
          aiScores={sampleAiScores}
          initialAnnotations={[
            {
              errorId: "ai-anno-1",
              criterion: "GRAMMATICAL_RANGE_ACCURACY",
              category: "Sự hòa hợp chủ ngữ - vị ngữ (Subject-Verb Agreement)",
              severity: "minor_slip",
              originalQuote: "has been a subject",
              suggestedCorrection: "have been a subject",
              explanation:
                "Chủ ngữ 'unpaid community activities' là danh từ số nhiều, nên động từ cần chia là 'have been'.",
              source: "ai",
              offsetStart: 80,
              offsetEnd: 98,
            },
            {
              errorId: "teacher-anno-1",
              criterion: "LEXICAL_RESOURCE",
              category: "Nâng cấp từ vựng C1/C2 (Advanced Lexicon)",
              severity: "minor_slip",
              originalQuote: "participate in unpaid community activities",
              suggestedCorrection: "undertake voluntary community services",
              explanation:
                "Nên sử dụng collocations học thuật nâng cao hơn như 'undertake voluntary services'.",
              source: "teacher",
              offsetStart: 120,
              offsetEnd: 145,
            },
          ]}
          initialExaminerSummary="Bài viết có cấu trúc rõ ràng, lập luận chặt chẽ và đạt yêu cầu đề bài. Để nâng band 7.5+, học viên cần mở rộng vốn từ vựng học thuật C1 và làm đa dạng hóa cấu trúc câu ghép phức."
          initialStrengths={[
            "Quan điểm được khẳng định rõ ràng ngay từ mở bài đến kết bài.",
            "Các luận điểm phân đoạn mạch lạc, liên kết ý tốt.",
          ]}
          initialImprovements={[
            "Cần đa dạng hóa cấu trúc câu điều kiện hoặc đảo ngữ trong đoạn thân bài 2.",
            "Bổ sung thêm một số academic collocations cho tiêu chí Lexical Resource.",
          ]}
        />
      </div>
    </div>
  );
}
