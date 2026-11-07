export type CssScope = "site" | "global";

export type CssDraft = {
  draft: string;
  saved: string;
};

export type CssDrafts = Record<CssScope, CssDraft>;

export function createCssDrafts(site = "", global = ""): CssDrafts {
  return {
    site: { draft: site, saved: site },
    global: { draft: global, saved: global },
  };
}

export function replaceCssScope(
  drafts: CssDrafts,
  scope: CssScope,
  value: string,
): CssDrafts {
  return {
    ...drafts,
    [scope]: { draft: value, saved: value },
  };
}

export function updateCssDraft(
  drafts: CssDrafts,
  scope: CssScope,
  value: string,
): CssDrafts {
  return {
    ...drafts,
    [scope]: { ...drafts[scope], draft: value },
  };
}

export function markCssSaved(
  drafts: CssDrafts,
  scope: CssScope,
  value: string,
): CssDrafts {
  return {
    ...drafts,
    [scope]: { ...drafts[scope], saved: value },
  };
}

export function discardCssDraft(drafts: CssDrafts, scope: CssScope): CssDrafts {
  return updateCssDraft(drafts, scope, drafts[scope].saved);
}

export function isCssDraftDirty(drafts: CssDrafts, scope: CssScope): boolean {
  return drafts[scope].draft !== drafts[scope].saved;
}
