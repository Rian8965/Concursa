import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97] cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-purple-700 text-white rounded-xl shadow-[0_4px_16px_rgba(124,58,237,0.28)] hover:bg-purple-800 hover:shadow-[0_6px_22px_rgba(124,58,237,0.36)] hover:-translate-y-px",
        destructive:
          "bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100",
        outline:
          "border border-gray-200 bg-white text-gray-600 rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900",
        secondary:
          "bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100",
        ghost:
          "text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl",
        link: "text-purple-700 underline-offset-4 hover:underline p-0 h-auto",
        success:
          "bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100",
      },
      size: {
        default: "h-9 px-4 text-[13px]",
        sm:      "h-7 px-3 text-[12px] rounded-lg",
        lg:      "h-11 px-6 text-[14px]",
        xl:      "h-12 px-7 text-[15px]",
        icon:    "h-8 w-8 rounded-xl",
        "icon-sm": "h-7 w-7 rounded-lg",
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
