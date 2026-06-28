import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        default:
          "border border-[var(--fabric-denim-border)] bg-[var(--fabric-denim)] text-[#F8F3EA] shadow-fabric-button hover:brightness-110 hover:-translate-y-0.5 hover:shadow-fabric active:shadow-fabric-pressed",
        destructive:
          "border border-[var(--fabric-terracotta-border)] bg-[var(--fabric-terracotta)] text-[#FFF6F2] shadow-fabric-button hover:brightness-108 hover:-translate-y-0.5 hover:shadow-fabric active:shadow-fabric-pressed",
        olive:
          "border border-[var(--fabric-olive-border)] bg-[var(--fabric-olive)] text-[#F5F1E8] shadow-fabric-button hover:brightness-110 hover:-translate-y-0.5 hover:shadow-fabric active:shadow-fabric-pressed",
        mustard:
          "border border-[var(--fabric-mustard-border)] bg-[var(--fabric-mustard)] text-[#3E2E16] font-bold shadow-fabric-button hover:brightness-106 hover:-translate-y-0.5 hover:shadow-fabric active:shadow-fabric-pressed",
        leather:
          "border border-[var(--fabric-leather-border)] bg-[var(--fabric-leather)] text-[#F8F2E8] shadow-fabric-button hover:brightness-112 hover:-translate-y-0.5 hover:shadow-fabric active:shadow-fabric-pressed",
        outline:
          "border border-border bg-[var(--fabric-canvas)] shadow-sm hover:brightness-[.97] hover:-translate-y-0.5 hover:shadow-fabric active:shadow-fabric-pressed fabric-stitch-sm",
        secondary:
          "border border-border bg-secondary text-secondary-foreground shadow-sm hover:brightness-[.97] hover:-translate-y-0.5 hover:shadow-fabric active:shadow-fabric-pressed",
        ghost: "hover:bg-accent/50 active:shadow-fabric-pressed",
        link: "text-[var(--fabric-blue-thread)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
