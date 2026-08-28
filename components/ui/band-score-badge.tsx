import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type BandTier = "expert" | "competent" | "modest" | "limited";

export interface BandDescriptorInfo {
  tier: BandTier;
  levelLabelVi: string;
  levelLabelEn: string;
  badgeStyle: string;
}

/**
 * Determines the official IELTS proficiency tier and styling
 */
export function getIeltsBandTierInfo(score: number): BandDescriptorInfo {
  if (score >= 8.0) {
    return {
      tier: "expert",
      levelLabelVi: "Xuất sắc / Thành thạo (C1/C2)",
      levelLabelEn: "Very Good / Expert User",
      badgeStyle:
        "bg-emerald-100/70 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100 border-emerald-600/40 dark:border-emerald-400/40",
    };
  }
  if (score >= 6.5) {
    return {
      tier: "competent",
      levelLabelVi: "Khá / Đạt chuẩn (B2/C1)",
      levelLabelEn: "Competent / Good User",
      badgeStyle:
        "bg-blue-100/70 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100 border-blue-600/40 dark:border-blue-400/40",
    };
  }
  if (score >= 5.0) {
    return {
      tier: "modest",
      levelLabelVi: "Trung bình (B1/B2)",
      levelLabelEn: "Modest User",
      badgeStyle:
        "bg-amber-100/70 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100 border-amber-600/40 dark:border-amber-400/40",
    };
  }
  return {
    tier: "limited",
    levelLabelVi: "Cần cải thiện (A2/B1)",
    levelLabelEn: "Limited User",
    badgeStyle:
      "bg-rose-100/70 text-rose-950 dark:bg-rose-950/60 dark:text-rose-100 border-rose-600/40 dark:border-rose-400/40",
  };
}

const bandScoreBadgeVariants = cva(
  "inline-flex items-center justify-center font-semibold rounded-full border transition-colors tabular-nums select-none",
  {
    variants: {
      size: {
        sm: "px-2 py-0.5 text-xs gap-1 h-5",
        md: "px-2.5 py-0.5 text-xs gap-1.5 h-6",
        lg: "px-3 py-1 text-sm gap-2 h-7 font-bold shadow-xs",
        xl: "px-4 py-1.5 text-base gap-2.5 h-9 font-bold shadow-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface BandScoreBadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof bandScoreBadgeVariants> {
  score: number;
  showPrefix?: boolean;
  showDescriptor?: boolean;
  descriptorLang?: "vi" | "en";
}

export function BandScoreBadge({
  score,
  size = "md",
  showPrefix = true,
  showDescriptor = false,
  descriptorLang = "vi",
  className,
  ...props
}: BandScoreBadgeProps) {
  const tierInfo = getIeltsBandTierInfo(score);
  const formattedScore = Number.isInteger(score)
    ? `${score}.0`
    : score.toFixed(1);
  const descriptor =
    descriptorLang === "vi" ? tierInfo.levelLabelVi : tierInfo.levelLabelEn;

  return (
    <span
      className={cn(
        bandScoreBadgeVariants({ size }),
        tierInfo.badgeStyle,
        className
      )}
      data-tier={tierInfo.tier}
      data-score={score}
      {...props}
    >
      <span>
        {showPrefix && <span className="font-medium mr-1">Band</span>}
        {formattedScore}
      </span>
      {showDescriptor && (
        <span className="text-[0.6875rem] font-medium border-l border-current/30 pl-1.5 ml-0.5">
          {descriptor}
        </span>
      )}
    </span>
  );
}
