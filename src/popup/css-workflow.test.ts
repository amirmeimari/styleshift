import { describe, expect, it } from "vitest";
import {
  createCssDrafts,
  discardCssDraft,
  isCssDraftDirty,
  markCssSaved,
  replaceCssScope,
  updateCssDraft,
} from "./css-workflow";

describe("CSS scope drafts", () => {
  it("keeps site and global edits isolated while changing scope", () => {
    let drafts = createCssDrafts(
      ".site { color: red; }",
      "body { margin: 0; }",
    );
    drafts = updateCssDraft(drafts, "site", ".site { color: blue; }");
    drafts = updateCssDraft(drafts, "global", "body { margin: 1rem; }");

    expect(drafts.site).toEqual({
      draft: ".site { color: blue; }",
      saved: ".site { color: red; }",
    });
    expect(drafts.global).toEqual({
      draft: "body { margin: 1rem; }",
      saved: "body { margin: 0; }",
    });
    expect(isCssDraftDirty(drafts, "site")).toBe(true);
    expect(isCssDraftDirty(drafts, "global")).toBe(true);
  });

  it("marks only the submitted scope and value as saved", () => {
    let drafts = createCssDrafts("site saved", "global saved");
    drafts = updateCssDraft(drafts, "site", "site submitted");
    drafts = markCssSaved(drafts, "site", "site submitted");

    expect(isCssDraftDirty(drafts, "site")).toBe(false);
    expect(drafts.global).toEqual({
      draft: "global saved",
      saved: "global saved",
    });
  });

  it("discards one draft without touching the other scope", () => {
    let drafts = createCssDrafts("site saved", "global saved");
    drafts = updateCssDraft(drafts, "site", "site draft");
    drafts = updateCssDraft(drafts, "global", "global draft");
    drafts = discardCssDraft(drafts, "site");

    expect(drafts.site.draft).toBe("site saved");
    expect(drafts.global.draft).toBe("global draft");
  });

  it("replaces a re-resolved site scope without disturbing global work", () => {
    let drafts = createCssDrafts("inherited", "global saved");
    drafts = updateCssDraft(drafts, "global", "global draft");
    drafts = replaceCssScope(drafts, "site", "own site css");

    expect(drafts.site).toEqual({
      draft: "own site css",
      saved: "own site css",
    });
    expect(drafts.global.draft).toBe("global draft");
  });
});
