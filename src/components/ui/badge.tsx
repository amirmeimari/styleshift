import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-3 py-1 text-xs font-bold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 fabric-stitch-sm",
  {
    variants: {
      variant: {
        default:
          "border-[var(--fabric-denim-border)] bg-[var(--fabric-denim)] text-[var(--fabric-on-denim)] shadow-[inset_0_1px_0_rgba(var(--fabric-sheen-rgb),.15)]",
        secondary:
          "border-border bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_rgba(var(--fabric-sheen-rgb),.3)]",
        destructive:
          "border-[var(--fabric-terracotta-border)] bg-[var(--fabric-terracotta)] text-[var(--fabric-on-terracotta)] shadow-[inset_0_1px_0_rgba(var(--fabric-sheen-rgb),.14)]",
        olive:
          "border-[var(--fabric-olive-border)] bg-[var(--fabric-olive)] text-[var(--fabric-on-olive)] shadow-[inset_0_1px_0_rgba(var(--fabric-sheen-rgb),.12)]",
        mustard:
          "border-[var(--fabric-mustard-border)] bg-[var(--fabric-mustard)] text-[var(--fabric-on-mustard)] shadow-[inset_0_1px_0_rgba(var(--fabric-sheen-rgb),.2)]",
        info: "border-[var(--fabric-blue-thread-border)] bg-[var(--fabric-blue-thread)] text-[var(--fabric-on-denim)] shadow-[inset_0_1px_0_rgba(var(--fabric-sheen-rgb),.14)]",
        outline: "text-foreground border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
