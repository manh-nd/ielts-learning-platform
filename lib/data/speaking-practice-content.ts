import type { Part1Question } from "@/modules/speaking/domain";
export interface SpeakingPracticeContent {
  id: string;
  title: string;
  category: string;
  description: string;
  difficulty: "Standard" | "Challenging" | "Advanced";
  part1: {
    theme: string;
    questions: Part1Question[];
  };
  part2: {
    topicTitle: string;
    cueCardPrompt: string;
    bulletPoints: string[];
    followUpQuestion?: string;
  };
  part3: {
    theme: string;
    questions: string[];
  };
}

export const SPEAKING_PRACTICE_CONTENT: SpeakingPracticeContent[] = [
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
    part2: {
      topicTitle:
        "A technological device or software that significantly changed your life",
      cueCardPrompt:
        "Describe a technological device or software application that has had a significant impact on your life.",
      bulletPoints: [
        "What it is and when you first started using it",
        "How you use it in your daily routine or studies",
        "What key features make it so useful to you",
        "And explain why it has had such a profound impact on your life",
      ],
      followUpQuestion:
        "Do you think people rely too much on this kind of technology nowadays?",
    },
    part3: {
      theme: "Artificial Intelligence & Future of Work",
      questions: [
        "How do you think Artificial Intelligence will transform employment and human jobs in the next decade?",
        "Should governments establish ethical boundaries and regulations on AI development?",
        "Do you think AI can ever replace human creativity in arts and literature?",
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
    part2: {
      topicTitle: "A memorable public space or park in your city",
      cueCardPrompt:
        "Describe a public park or open community space that you enjoy visiting in your city.",
      bulletPoints: [
        "Where it is located and how often you go there",
        "What people usually do when they visit this place",
        "What amenities or natural scenery it provides",
        "And explain why you find this public space so appealing or refreshing",
      ],
      followUpQuestion: "Are there enough green spaces in modern cities today?",
    },
    part3: {
      theme: "Urbanization & Sustainable Cities",
      questions: [
        "What are the main consequences of rapid urbanization on public infrastructure?",
        "How can city planners balance economic development with green environmental conservation?",
        "Do you think young people will continue moving to metropolitan centers, or will remote work reverse this trend?",
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
    part2: {
      topicTitle: "A memorable cultural journey or trip to a historical place",
      cueCardPrompt:
        "Describe a memorable visit to a historical place or cultural heritage site.",
      bulletPoints: [
        "Where and when you visited this place",
        "Who accompanied you on this journey",
        "What historical relics, architecture, or traditions you witnessed",
        "And explain what made this cultural experience unforgettable for you",
      ],
      followUpQuestion:
        "Would you recommend this destination to foreign tourists?",
    },
    part3: {
      theme: "Impacts of Mass Tourism & Cultural Preservation",
      questions: [
        "How does mass international tourism affect the preservation of local customs and historical landmarks?",
        "What responsibilities should individual tourists bear when visiting delicate cultural heritage sites?",
        "Can virtual reality and digital tours ever substitute for actual physical travel to historical monuments?",
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
    part2: {
      topicTitle: "A challenging skill you learned through persistence",
      cueCardPrompt:
        "Describe a difficult or complex skill that you managed to learn and master.",
      bulletPoints: [
        "What the skill was and why you decided to learn it",
        "How you practiced or who taught you",
        "What difficulties you encountered along the way",
        "And explain how you felt when you successfully achieved proficiency in it",
      ],
      followUpQuestion:
        "Do you think anyone can learn this skill with enough practice?",
    },
    part3: {
      theme: "Future Education & Critical Thinking",
      questions: [
        "How should educational curriculums evolve to prepare students for an automated job market?",
        "Is practical vocational training being undervalued compared to university academic degrees?",
        "To what extent is lifelong self-directed learning essential in modern society?",
      ],
    },
  },
];
