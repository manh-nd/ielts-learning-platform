/**
 * Speaking Practice Topic Fixtures (Shipped Pilot Surface)
 *
 * Scoped strictly to SpeakingPractice (Part 1 practice only).
 * In accordance with canonical domain boundary: SpeakingPractice != MockTest.
 * Does not contain Part 2 cue cards or Part 3 discussion prompts.
 */

export interface SpeakingPracticeTopic {
  id: string;
  title: string;
  category: string;
  description: string;
  difficulty: "Standard" | "Challenging" | "Advanced";
  part1: {
    theme: string;
    questions: string[];
  };
}

export const SPEAKING_PRACTICE_TOPICS: SpeakingPracticeTopic[] = [
  {
    id: "tech-ai-future",
    title: "Technology & Artificial Intelligence",
    category: "Technology & Modern Life",
    description:
      "Explore the impact of AI, digital tools, and smart automation on daily habits, work, and future human society.",
    difficulty: "Challenging",
    part1: {
      theme: "Technology in Everyday Life",
      questions: [
        "What kind of technological devices do you use most frequently every day?",
        "Do you prefer reading physical books or electronic devices?",
        "Have technological advancements made life easier or more stressful for you?",
      ],
    },
  },
  {
    id: "hometown-urbanization",
    title: "Hometown, Community & Urban Living",
    category: "Society & Environment",
    description:
      "Discuss your birthplace, local neighborhoods, infrastructure development, and the challenges of modern urban growth.",
    difficulty: "Standard",
    part1: {
      theme: "Hometown & Neighborhood",
      questions: [
        "Where is your hometown, and is it a big city or a small town?",
        "What do you like most about living in your neighborhood?",
        "Has your hometown changed much over the last few years?",
      ],
    },
  },
  {
    id: "travel-cultural-heritage",
    title: "Travel, Tourism & Cultural Heritage",
    category: "Culture & Lifestyle",
    description:
      "Reflect on memorable journeys, traditional cultural heritage sites, and the global effects of international tourism.",
    difficulty: "Standard",
    part1: {
      theme: "Travel & Holidays",
      questions: [
        "Do you enjoy traveling to unfamiliar places, and why?",
        "What mode of transport do you usually prefer when taking a trip?",
        "Do you prefer holidaying with friends, family, or traveling solo?",
      ],
    },
  },
  {
    id: "education-lifelong-learning",
    title: "Education, Skills & Lifelong Learning",
    category: "Education & Career",
    description:
      "Discuss modern schooling methods, acquiring new soft and practical skills, and continuous professional development.",
    difficulty: "Advanced",
    part1: {
      theme: "Learning Habits & Subjects",
      questions: [
        "What subject did you find most engaging when you were in secondary school?",
        "Do you find it easier to learn through practical experience or theoretical study?",
        "Have you picked up any new skill or hobby recently?",
      ],
    },
  },
];

export function getPracticeTopicById(id: string): SpeakingPracticeTopic {
  const found = SPEAKING_PRACTICE_TOPICS.find((t) => t.id === id);
  return found || SPEAKING_PRACTICE_TOPICS[0];
}

export function getRandomPracticeTopic(): SpeakingPracticeTopic {
  const index = Math.floor(Math.random() * SPEAKING_PRACTICE_TOPICS.length);
  return SPEAKING_PRACTICE_TOPICS[index];
}
