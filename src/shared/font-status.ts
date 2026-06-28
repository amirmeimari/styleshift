import { BUILTIN_FONT_NAMES } from "./builtin-fonts";

// Whether a font name is guaranteed available. Browsers do not expose which
// fonts a user has installed locally, so anything that isn't bundled or uploaded
// is "unknown" - it will be used if present, but we cannot confirm it.
export type FontStatus = "bundled" | "uploaded" | "unknown";

export function fontStatus(name: string, uploadedNames: string[]): FontStatus {
  const lower = name.toLowerCase();

  if (BUILTIN_FONT_NAMES.some((builtin) => builtin.toLowerCase() === lower)) {
    return "bundled";
  }

  if (uploadedNames.some((uploaded) => uploaded.toLowerCase() === lower)) {
    return "uploaded";
  }

  return "unknown";
}

// Tailwind dot color and translation key for each status.
export const FONT_STATUS_META: Record<
  FontStatus,
  { dotClass: string; helpKey: string }
> = {
  bundled: { dotClass: "bg-emerald-500", helpKey: "availability.bundled" },
  uploaded: { dotClass: "bg-sky-500", helpKey: "availability.uploaded" },
  unknown: { dotClass: "bg-amber-500", helpKey: "availability.unknown" },
};
