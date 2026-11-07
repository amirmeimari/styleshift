import { BUILTIN_FONT_NAMES } from "./builtin-fonts";

// Uploaded indicates storage provenance, not successful decoding. The library
// checks uploaded bytes; typed local family availability remains unknown.
export type FontStatus = "bundled" | "uploaded" | "unknown";

export function fontStatus(name: string, uploadedNames: string[]): FontStatus {
  const lower = name.toLowerCase();

  // An uploaded face can share a bundled/local family name. Its stored
  // provenance must not become a decoding guarantee through that collision.
  if (uploadedNames.some((uploaded) => uploaded.toLowerCase() === lower)) {
    return "uploaded";
  }

  if (BUILTIN_FONT_NAMES.some((builtin) => builtin.toLowerCase() === lower)) {
    return "bundled";
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
