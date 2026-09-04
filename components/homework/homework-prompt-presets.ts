/**
 * Curated Preset Speaking Prompts for quick 1-click homework authoring.
 */

export interface PresetSpeakingPrompt {
  id: string;
  category: string;
  partNumber: 1 | 2 | 3;
  text: string;
  subPrompts?: string[];
}

export const PRESET_SPEAKING_PROMPTS: PresetSpeakingPrompt[] = [
  // Part 1: Short conversational questions
  {
    id: "preset_p1_work_study",
    category: "Work & Studies",
    partNumber: 1,
    text: "Do you work or are you a student? What do you like most about your field?",
  },
  {
    id: "preset_p1_hometown",
    category: "Hometown",
    partNumber: 1,
    text: "What is your hometown like? Would you recommend visitors to go there?",
  },
  {
    id: "preset_p1_leisure",
    category: "Leisure & Hobbies",
    partNumber: 1,
    text: "What do you usually do in your free time to relax after a stressful day?",
  },
  {
    id: "preset_p1_transport",
    category: "Transport",
    partNumber: 1,
    text: "How do you usually travel to school or work? What could improve public transport in your city?",
  },

  // Part 2: Long turn Cue Cards
  {
    id: "preset_p2_journey",
    category: "Travel & Experience",
    partNumber: 2,
    text: "Describe a memorable journey you have taken.",
    subPrompts: [
      "Where you went and who you traveled with",
      "What means of transport you used",
      "What you saw and experienced along the way",
      "And explain why this journey was particularly memorable to you",
    ],
  },
  {
    id: "preset_p2_teacher",
    category: "People & Relationships",
    partNumber: 2,
    text: "Describe a teacher or mentor who had a strong positive influence on your education.",
    subPrompts: [
      "Who this teacher was and what subject they taught",
      "When and where you studied with them",
      "What made their teaching style special or effective",
      "And explain how they influenced your academic or personal path",
    ],
  },
  {
    id: "preset_p2_skill",
    category: "Personal Growth",
    partNumber: 2,
    text: "Describe a useful skill that you learned outside of formal school.",
    subPrompts: [
      "What the skill is and how you learned it",
      "Who helped or taught you",
      "Why you decided to learn this skill",
      "And explain how this skill has helped you in your daily life",
    ],
  },

  // Part 3: In-depth discussion questions
  {
    id: "preset_p3_ai_education",
    category: "Technology in Education",
    partNumber: 3,
    text: "How is artificial intelligence changing the way students learn foreign languages today?",
  },
  {
    id: "preset_p3_tourism_impact",
    category: "Global Issues & Tourism",
    partNumber: 3,
    text: "Do the economic benefits of international tourism outweigh its environmental and cultural costs?",
  },
  {
    id: "preset_p3_online_offline",
    category: "Modern Society",
    partNumber: 3,
    text: "Will remote online classes ever completely replace traditional classroom learning in schools and universities?",
  },
];
