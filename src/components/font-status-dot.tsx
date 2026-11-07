// Availability indicator for a font name.
//
// Uploaded names indicate provenance only. The library reports byte decoding.

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
