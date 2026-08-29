// Availability indicator for a font name.
//
// Browsers do not expose which fonts a user has installed, so the honest answer
// for a typed-in name is "unknown" - StyleShift will ask for it and the page
// falls back if it isn't there. Bundled and uploaded fonts, by contrast, are
// guaranteed. Surfacing that difference is the point: before this, a user could
// type any name into the font stack and get no signal at all about whether it
// would do anything.

import { fontStatus, FONT_STATUS_META } from "@/shared/font-status";
import { useI18n } from "@/shared/i18n/use-i18n";

type FontStatusDotProps = {
  name: string;
  uploadedNames: string[];
};

export function FontStatusDot({ name, uploadedNames }: FontStatusDotProps) {
  const { t } = useI18n();
  const status = fontStatus(name, uploadedNames);
  const { dotClass, helpKey } = FONT_STATUS_META[status];
  const label = t(helpKey);

  return (
    <span
      className={[
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        dotClass,
      ].join(" ")}
      title={label}
      aria-label={label}
      role="img"
    />
  );
}
