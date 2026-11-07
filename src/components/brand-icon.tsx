import { cn } from "@/lib/utils";

/** Decorative brand mark; adjacent text supplies the accessible name. */
export function BrandIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-8 w-8 shrink-0", className)}
    >
      <img
        src="/icons/dark/icon128.png"
        alt=""
        width={128}
        height={128}
        className="h-full w-full object-contain dark:hidden"
      />
      <img
        src="/icons/light/icon128.png"
        alt=""
        width={128}
        height={128}
        className="hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
}
