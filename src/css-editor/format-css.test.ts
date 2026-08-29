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

  it("breaks before a closing brace when the last semicolon is omitted", () => {
    // The final semicolon in a block is optional in CSS. Without a break
    // before `}` the brace stayed glued to the declaration and the re-indent
    // pass never dedented.
    expect(formatCSS("a{b:c}")).toBe("a{\n  b:c\n}\n");
    expect(formatCSS("body{color:red;background:blue}")).toBe(
      "body{\n  color:red;\n  background:blue\n}\n",
    );
  });

  it("indents nested blocks that omit trailing semicolons", () => {
    expect(formatCSS("@media (min-width:600px){body{color:red}}")).toBe(
      "@media (min-width:600px){\n  body{\n    color:red\n  }\n}\n",
    );
  });

  it("is idempotent without trailing semicolons", () => {
    const once = formatCSS("a{b:c}");
    expect(formatCSS(once)).toBe(once);
  });

  it("leaves braces inside strings and urls alone", () => {
    expect(formatCSS('a{content:"}"}')).toBe('a{\n  content:"}"\n}\n');
  });
});
