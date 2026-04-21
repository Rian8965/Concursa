import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97] cursor-pointer rounded-2xl",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-violet-600 to-violet-700 text-white shadow-[0_4px_18px_rgba(124,58,237,0.3)] hover:from-violet-500 hover:to-violet-700 hover:shadow-[0_8px_26px_rgba(124,58,237,0.38)] hover:-translate-y-px",
        accent:
          "bg-gradient-to-b from-orange-400 to-orange-600 text-white shadow-[0_4px_18px_rgba(234,88,12,0.32)] hover:from-orange-300 hover:to-orange-600 hover:shadow-[0_8px_26px_rgba(234,88,12,0.38)] hover:-translate-y-px",
        destructive:
          "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100",
        outline:
          "border border-gray-200/90 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900",
        secondary:
          "bg-violet-50 text-violet-800 border border-violet-200/90 hover:bg-violet-100",
        ghost:
          "text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-2xl",
        link: "text-violet-700 underline-offset-4 hover:underline p-0 h-auto rounded-none shadow-none bg-transparent",
        success:
          "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100",
      },
      size: {
        default: "h-10 px-5 text-[13px]",
        sm:      "h-8 px-3.5 text-[12px] rounded-xl",
        lg:      "h-11 px-6 text-[14px]",
        xl:      "h-12 px-8 text-[15px]",
        icon:    "h-10 w-10 rounded-2xl",
        "icon-sm": "h-8 w-8 rounded-xl",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
