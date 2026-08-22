/**
 * PROTOTYPE — Teacher Review Workspace
 * Three radically different variants, switchable via ?variant=A|B|C.
 * Throwaway code — do not merge to main.
 */

import { Suspense } from "react";
import { TeacherReviewPrototype } from "./_components/teacher-review-prototype";

export default async function PrototypePage(
  props: PageProps<"/prototype/teacher-review">
) {
  const searchParams = await props.searchParams;
  const variant = (searchParams.variant as string) ?? "A";

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-muted-foreground">
          Loading prototype…
        </div>
      }
    >
      <TeacherReviewPrototype variant={variant} />
    </Suspense>
  );
}
