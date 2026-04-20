import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block mb-1.5 font-semibold"
            style={{ fontSize: 13, color: "#374151" }}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "#9CA3AF" }}
            >
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            id={inputId}
            className={cn(
              "input",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "!border-red-400 focus:!border-red-500 focus:!shadow-[0_0_0_3px_rgba(220,38,38,0.1)]",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }}>
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5" style={{ fontSize: 12, color: "#DC2626" }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="mt-1.5" style={{ fontSize: 12, color: "#9CA3AF" }}>{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
