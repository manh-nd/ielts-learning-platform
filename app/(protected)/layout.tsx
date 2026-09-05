import * as React from "react";
import { requireAuthOrRedirect } from "@/lib/authorization";
import { AppShell } from "@/components/layout";
import type { UserProfile, UserRole } from "@/components/auth/types";

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
    role: (session.user.role as UserRole) || "learner",
    image: session.user.image,
  };

  return <AppShell user={userProfile}>{children}</AppShell>;
}
