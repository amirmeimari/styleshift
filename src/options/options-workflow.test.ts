import { describe, expect, it } from "vitest";
import {
  filterSites,
  normalizeSiteInput,
  optionsSearchForView,
  optionsViewFromSearch,
} from "./options-workflow";

describe("options routing", () => {
  it("opens every named destination directly", () => {
    expect(optionsViewFromSearch("?view=sites")).toBe("sites");
    expect(optionsViewFromSearch("?view=global-css")).toBe("global-css");
    expect(optionsViewFromSearch("?view=library")).toBe("library");
    expect(optionsViewFromSearch("?view=settings")).toBe("settings");
    expect(optionsViewFromSearch("?view=about")).toBe("about");
  });

  it("keeps the popup's legacy full-editor routes working", () => {
    expect(optionsViewFromSearch("?host=gist.github.com")).toBe("sites");
    expect(optionsViewFromSearch("?css=global")).toBe("global-css");
  });

  it("falls back safely and produces stable view URLs", () => {
    expect(optionsViewFromSearch("?view=unknown")).toBe("sites");
    expect(optionsSearchForView("settings")).toBe("?view=settings");
  });
});

describe("site management helpers", () => {
  const sites = [
    { host: "github.com", value: 1 },
    { host: "docs.google.com", value: 2 },
  ];

  it("filters hostnames case-insensitively without changing blank results", () => {
    expect(filterSites(sites, " GITHUB ")).toEqual([sites[0]]);
    expect(filterSites(sites, "google")).toEqual([sites[1]]);
    expect(filterSites(sites, "  ")).toBe(sites);
  });

  it("normalizes hostnames and URLs used by Add site", () => {
    expect(normalizeSiteInput("Example.COM")).toBe("example.com");
    expect(normalizeSiteInput("https://Docs.Example.com/path?q=1")).toBe(
      "docs.example.com",
    );
    expect(normalizeSiteInput("not a host")).toBeNull();
    expect(normalizeSiteInput("")).toBeNull();
  });
});
