import { describe, expect, it } from "vitest";
import { formatCSS } from "./format-css";

describe("formatCSS", () => {
  it("puts declarations and braces on their own indented lines", () => {
    expect(formatCSS("body{color:red;background:blue;}")).toBe(
      "body{\n  color:red;\n  background:blue;\n}\n",
    );
  });

  it("indents nested blocks by depth", () => {
    expect(formatCSS("@media print{body{color:black;}}")).toBe(
      "@media print{\n  body{\n    color:black;\n  }\n}\n",
    );
  });

  it("does not split semicolons inside parentheses", () => {
    const out = formatCSS("a{background:url(data:image/svg;base64,xyz);}");
    expect(out).toContain("background:url(data:image/svg;base64,xyz);");
  });

  it("returns empty string for blank input", () => {
    expect(formatCSS("   \n  ")).toBe("");
  });

  it("is idempotent", () => {
    const once = formatCSS("body{color:red;}");
    expect(formatCSS(once)).toBe(once);
  });
});
