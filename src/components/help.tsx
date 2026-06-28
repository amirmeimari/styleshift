import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Label } from "@/components/ui/label";

const helpButtonClass =
  "inline-flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring";

export function HelpTooltip({ help, label }: { help: string; label: string }) {
  return (
    <button
      type="button"
      className={helpButtonClass}
      aria-label={`${label} help`}
      title={help}
    >
      <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

export function LabelWithHelp({
  children,
  htmlFor,
  help,
  muted = false,
}: {
  children: ReactNode;
  htmlFor?: string;
  help: string;
  muted?: boolean;
}) {
  const labelText = typeof children === "string" ? children : "Section";

  return (
    <div className="flex items-center gap-1.5">
      <Label
        htmlFor={htmlFor}
        className={muted ? "text-xs text-muted-foreground" : undefined}
      >
        {children}
      </Label>
      <HelpTooltip help={help} label={labelText} />
    </div>
  );
}
