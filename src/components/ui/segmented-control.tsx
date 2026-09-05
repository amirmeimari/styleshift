import type { ComponentType } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
};

// A row of mutually-exclusive Buttons (theme, language, ...). Options with an
// icon always show it; options without one show a checkmark on the active
// choice instead.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map((option) => {
        const isActive = option.value === value;
        const Icon = option.icon;
        return (
          <Button
            key={option.value}
            type="button"
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(option.value)}
            className="gap-1.5 h-7 text-xs"
            aria-pressed={isActive}
          >
            {Icon ? (
              <Icon className="h-3 w-3" />
            ) : isActive ? (
              <Check className="h-3 w-3" />
            ) : null}
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
