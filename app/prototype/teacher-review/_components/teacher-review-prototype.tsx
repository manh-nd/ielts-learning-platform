"use client";

import { VariantA } from "./variant-a";
import VariantB from "./variant-b";
import { VariantC } from "./variant-c";
import { PrototypeSwitcher } from "./prototype-switcher";

export function TeacherReviewPrototype({ variant }: { variant: string }) {
  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      {!["A", "B", "C"].includes(variant) && <VariantA />}
      <PrototypeSwitcher />
    </>
  );
}
