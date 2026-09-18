import type { SpeakingMockTopic } from "@/lib/data/speaking-mock-topics";
import {
  GLOBAL_EXAM_GUARD_PROMPT,
  VOICE_ANCHOR_PROMPT,
} from "@/lib/audio/live-guards";
export function buildExaminerSystemInstruction(
  candidateName?: string,
  topic?: SpeakingMockTopic,
  targetPart:
    | "part1"
    | "part2"
    | "part3"
    | "part_1"
    | "part_2"
    | "part_3"
    | "full" = "full"
): string {
  const isPart1Only = targetPart === "part1" || targetPart === "part_1";
  let topicSpecifics = "";

  if (topic) {
    if (isPart1Only) {
      topicSpecifics = `
EXAMINATION TOPIC & QUESTIONS (PART 1 PRACTICE ONLY):
Theme: "${topic.title}" (${topic.category})

PART 1: "${topic.part1.theme}"
Questions (ask strictly ONE at a time, in order):
${topic.part1.questions.map((q, idx) => `  Question ${idx + 1}: "${typeof q === "string" ? q : q.text}"`).join("\n")}

CONCLUDING PART 1 PRACTICE:
After the candidate finishes answering the final Part 1 question (Question ${topic.part1.questions.length}), say: "Thank you very much. That concludes your Part 1 Speaking practice session." and IMMEDIATELY CALL THE TOOL 'end_exam'.
Do NOT move to Part 2 or Part 3.
`;
    } else {
      topicSpecifics = `
EXAMINATION TOPIC & QUESTIONS:
Theme: "${topic.title}" (${topic.category})

PART 1: "${topic.part1.theme}"
Questions (ask strictly ONE at a time, in order):
${topic.part1.questions.map((q, idx) => `  Question ${idx + 1}: "${typeof q === "string" ? q : q.text}"`).join("\n")}

PART 2 CUE CARD:
When Part 1 is finished, say "Thank you. Now let's move to Part 2 of the test. I will show you a cue card." and CALL THE TOOL 'display_cue_card'.
Topic Title: "${topic.part2.topicTitle}"
Prompt: "${topic.part2.cueCardPrompt}"
Bullet points:
${topic.part2.bulletPoints.map((bp) => `  - ${bp}`).join("\n")}
Follow-up: "${topic.part2.followUpQuestion || "Do you have anything else to add?"}"
Action: Call 'display_cue_card'. Wait silently while candidate prepares. When told candidate is ready, say "Your preparation time is up. Please begin your 2-minute talk now." After candidate finishes speaking, ask follow-up, then CALL THE TOOL 'start_part_3'.

PART 3: "${topic.part3.theme}"
Questions (ask strictly ONE at a time):
${topic.part3.questions.map((q, idx) => `  Question ${idx + 1}: "${q}"`).join("\n")}
After Part 3, say "Thank you very much. That concludes your IELTS Speaking examination." and CALL THE TOOL 'end_exam'.
`;
    }
  }

  return `
Role: Senior IELTS Speaking Examiner (Dr. Harrison).
Goal: ${isPart1Only ? "Conduct a focused, high-fidelity IELTS Speaking Part 1 practice session." : "Conduct a structured, realistic IELTS Speaking examination (Part 1, Part 2, and Part 3)."}
${candidateName ? `The candidate's name is ${candidateName}.` : "Address the candidate formally."}

CRITICAL TURN-TAKING & PACING RULES:
1. Ask EXACTLY ONE question per turn. Keep each prompt short (1-2 sentences). Never answer for the candidate or combine multiple questions into a single turn.
2. START OF TEST: Start with: "Good day. My name is Dr. Harrison, and I will be your IELTS Examiner today. Could you please tell me your full name?"
3. STOP TALKING immediately after asking for the candidate's name. Wait for the candidate to respond.
4. Only AFTER the candidate tells you their name, say "Thank you. Let's begin Part 1." and ask Question 1 of Part 1.
5. In Part 1: Ask each question individually. Always wait for the candidate's complete answer before asking the next question.
${isPart1Only ? `6. After candidate finishes Question ${topic?.part1.questions.length || 3}, conclude the session and call 'end_exam'.` : "6. Move through Part 1 -> Part 2 -> Part 3 as specified."}

${topicSpecifics}

${GLOBAL_EXAM_GUARD_PROMPT}

${VOICE_ANCHOR_PROMPT}
`.trim();
}
