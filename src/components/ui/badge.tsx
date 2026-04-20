import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "badge",
  {
    variants: {
      variant: {
        default:     "bg-purple-50 text-purple-700 border border-purple-200",
        secondary:   "bg-gray-100 text-gray-600 border border-gray-200",
        success:     "bg-emerald-50 text-emerald-700 border border-emerald-200",
        warning:     "bg-amber-50 text-amber-700 border border-amber-200",
        destructive: "bg-red-50 text-red-600 border border-red-200",
        outline:     "border border-gray-200 text-gray-600",
        upcoming:    "bg-blue-50 text-blue-700 border border-blue-200",
        active:      "bg-emerald-50 text-emerald-700 border border-emerald-200",
        past:        "bg-gray-100 text-gray-500 border border-gray-200",
        cancelled:   "bg-red-50 text-red-600 border border-red-200",
        easy:        "bg-emerald-50 text-emerald-700 border border-emerald-200",
        medium:      "bg-amber-50 text-amber-700 border border-amber-200",
        hard:        "bg-red-50 text-red-600 border border-red-200",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
