import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-lg border border-border bg-[var(--fabric-canvas)] px-3 py-2 text-base font-medium shadow-[inset_0_2px_4px_rgba(68,42,22,.08)] fabric-stitch-sm placeholder:text-muted-foreground focus-visible:border-[var(--fabric-blue-thread)] focus-visible:outline-none focus-visible:shadow-[inset_0_2px_4px_rgba(68,42,22,.08),0_0_0_3px_rgba(61,91,139,.25)] disabled:cursor-not-allowed disabled:border-dashed disabled:opacity-50 md:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
