"use client";

import { VariantA } from "./variant-a";
import VariantB from "./variant-b";
import { VariantC } from "./variant-c";
import { VariantD } from "./variant-d";
import { PrototypeSwitcher } from "./prototype-switcher";

export function TeacherReviewPrototype({ variant }: { variant: string }) {
  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      {variant === "D" && <VariantD />}
      {!["A", "B", "C", "D"].includes(variant) && <VariantD />}
      <PrototypeSwitcher />
    </>
  );
}
