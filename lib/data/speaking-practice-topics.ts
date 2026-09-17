import { Part1Question } from "@/modules/speaking/domain";

export interface SpeakingPracticeTopic {
  id: string;
  title: string;
  category: string;
  description: string;
  difficulty: "Standard" | "Challenging" | "Advanced";
  part1: {
    theme: string;
    questions: Part1Question[];
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
        {
          id: "tech-device-frequency",
          text: "What kind of technological devices do you use most frequently every day?",
          order: 1,
        },
        {
          id: "tech-reading-preference",
          text: "Do you prefer reading physical books or electronic devices?",
          order: 2,
        },
        {
          id: "tech-advancements-impact",
          text: "Have technological advancements made life easier or more stressful for you?",
          order: 3,
        },
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
        {
          id: "hometown-location",
          text: "Where is your hometown, and is it a big city or a small town?",
          order: 1,
        },
        {
          id: "hometown-neighborhood-likes",
          text: "What do you like most about living in your neighborhood?",
          order: 2,
        },
        {
          id: "hometown-recent-changes",
          text: "Has your hometown changed much over the last few years?",
          order: 3,
        },
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
        {
          id: "travel-unfamiliar-places",
          text: "Do you enjoy traveling to unfamiliar places, and why?",
          order: 1,
        },
        {
          id: "travel-transport-preference",
          text: "What mode of transport do you usually prefer when taking a trip?",
          order: 2,
        },
        {
          id: "travel-companions",
          text: "Do you prefer holidaying with friends, family, or traveling solo?",
          order: 3,
        },
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
        {
          id: "education-engaging-subject",
          text: "What subject did you find most engaging when you were in secondary school?",
          order: 1,
        },
        {
          id: "education-learning-style",
          text: "Do you find it easier to learn through practical experience or theoretical study?",
          order: 2,
        },
        {
          id: "education-new-skills",
          text: "Have you picked up any new skill or hobby recently?",
          order: 3,
        },
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
