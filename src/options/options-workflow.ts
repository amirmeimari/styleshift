export const OPTIONS_VIEWS = [
  "sites",
  "global-css",
  "library",
  "settings",
  "about",
] as const;

export type OptionsView = (typeof OPTIONS_VIEWS)[number];

export type SearchableSite = { host: string };

export function isOptionsView(value: string | null): value is OptionsView {
  return OPTIONS_VIEWS.some((view) => view === value);
}

export function optionsViewFromSearch(search: string): OptionsView {
  const params = new URLSearchParams(search);

  // Preserve the full-editor routes used by the popup before the options
  // redesign introduced explicit view names.
  if (params.get("css") === "global") return "global-css";
  if (params.has("host")) return "sites";

  const requested = params.get("view");
  return isOptionsView(requested) ? requested : "sites";
}

export function optionsSearchForView(view: OptionsView): string {
  return `?view=${view}`;
}

export function filterSites<T extends SearchableSite>(
  sites: T[],
  query: string,
): T[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return sites;
  return sites.filter((site) =>
    site.host.toLocaleLowerCase().includes(normalized),
  );
}

export function normalizeSiteInput(input: string): string | null {
  const trimmed = input.trim().toLocaleLowerCase();
  if (!trimmed) return null;

  try {
    const parsed = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`,
    );
    const host = parsed.hostname.replace(/^\.+|\.+$/g, "");
    return host || null;
  } catch {
    return null;
  }
}
