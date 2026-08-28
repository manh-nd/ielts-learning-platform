import {
  LandingHeader,
  LandingHero,
  InteractiveSpeakingPreview,
  InteractiveWritingPreview,
  InteractiveTeacherPreview,
  LearningJourneyWorkflow,
  LandingCtaBanner,
  LandingFooter,
} from "@/components/landing";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 scroll-smooth">
      {/* Top Sticky Header */}
      <LandingHeader />

      {/* Main Content Sections */}
      <main className="flex-1 flex flex-col items-center justify-center w-full">
        {/* 1. Hero Section */}
        <LandingHero />

        {/* 2. Speaking Live AI Simulator Showcase */}
        <InteractiveSpeakingPreview />

        {/* 3. Writing Diagnostic & 4-Criteria Calculator Showcase */}
        <InteractiveWritingPreview />

        {/* 4. Teacher Review & Two-Stage Diff Workspace Showcase */}
        <InteractiveTeacherPreview />

        {/* 5. 4-Step Synergistic Learning Journey */}
        <LearningJourneyWorkflow />

        {/* 6. Conversion CTA Banner */}
        <LandingCtaBanner />
      </main>

      {/* Multi-column Footer */}
      <LandingFooter />
    </div>
  );
}
