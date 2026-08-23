import * as React from "react";
import { requireAuthOrRedirect } from "@/lib/authorization";
import { ProtectedHeader } from "@/components/auth/protected-header";
import type { UserProfile } from "@/components/auth/types";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuthOrRedirect("/login");

  const userProfile: UserProfile = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: (session.user.role as "teacher" | "learner") || "learner",
    image: session.user.image,
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      <ProtectedHeader user={userProfile} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-border/30 py-4 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4">
          <p>
            © {new Date().getFullYear()} IELTS Master Platform • Môi trường Học
            tập & Chấm thi bảo mật.
          </p>
        </div>
      </footer>
    </div>
  );
}
