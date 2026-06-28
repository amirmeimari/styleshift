import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-border bg-[var(--fabric-canvas)] px-3 py-1 text-base font-medium shadow-[inset_0_2px_4px_rgba(68,42,22,.08)] transition-all fabric-stitch-sm file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-[var(--fabric-blue-thread)] focus-visible:outline-none focus-visible:shadow-[inset_0_2px_4px_rgba(68,42,22,.08),0_0_0_3px_rgba(61,91,139,.25)] disabled:cursor-not-allowed disabled:border-dashed disabled:bg-secondary disabled:text-muted-foreground md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
