import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    const variants = {
      primary:
        "bg-primary-600 text-white shadow-sm hover:bg-primary-700 active:bg-primary-800",
      secondary:
        "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 active:bg-neutral-300",
      outline:
        "border border-border bg-white text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100",
      ghost: "text-neutral-600 hover:bg-neutral-100 active:bg-neutral-200",
      danger:
        "bg-danger-500 text-white shadow-sm hover:bg-danger-600 active:bg-red-700",
    };
    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-6 text-base",
    };
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none",
          variants[variant],
          sizes[size],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
