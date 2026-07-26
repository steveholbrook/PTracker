import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "blue" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-[#edf1f5] text-[#526177]",
    blue: "bg-[#e5f0fd] text-[#1f65b7]",
    success: "bg-[#def4eb] text-[#127453]",
    warning: "bg-[#fff1d2] text-[#976000]",
    danger: "bg-[#fee5e8] text-[#a62b3b]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

