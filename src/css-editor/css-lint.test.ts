import { describe, expect, it } from "vitest";
import { cssDiagnostics } from "./css-lint";

const messages = (css: string) =>
  cssDiagnostics(css).map((diagnostic) => diagnostic.message);

describe("cssDiagnostics", () => {
  it("reports nothing for valid CSS", () => {
    expect(cssDiagnostics("body { color: red; }")).toEqual([]);
    expect(cssDiagnostics("a{b:c}")).toEqual([]);
    expect(cssDiagnostics("")).toEqual([]);
  });

  it("flags an unclosed block at the opening brace", () => {
    const [diagnostic] = cssDiagnostics("body {\n  color: red;\n");

    expect(diagnostic.severity).toBe("error");
    expect(diagnostic.message).toMatch(/Unclosed block/);
    expect(diagnostic.from).toBe(5);
  });

  it("flags a stray closing brace where it appears", () => {
    const [diagnostic] = cssDiagnostics("body { color: red; } }");

    expect(diagnostic.severity).toBe("error");
    expect(diagnostic.message).toMatch(/Unexpected }/);
    expect(diagnostic.from).toBe(21);
  });

  it("flags a declaration that is missing its semicolon", () => {
    const found = messages("body {\n  color: red\n  background: blue;\n}");

    expect(found).toEqual([expect.stringMatching(/Missing semicolon/)]);
  });

  it("allows the last declaration in a block to omit its semicolon", () => {
    expect(
      cssDiagnostics("body {\n  color: red;\n  background: blue\n}"),
    ).toEqual([]);
  });

  it("flags an unterminated comment", () => {
    const found = messages("body { color: red; }\n/* never closed");

    expect(found).toEqual([expect.stringMatching(/Unterminated comment/)]);
  });

  it("flags an unterminated string", () => {
    const found = messages('a { content: "oops\n}');

    expect(found).toEqual([expect.stringMatching(/Unterminated string/)]);
  });

  it("ignores braces, semicolons and quotes inside strings", () => {
    expect(cssDiagnostics('a { content: "};{"; }')).toEqual([]);
    expect(cssDiagnostics("a { content: '\\''; }")).toEqual([]);
  });

  it("ignores braces and semicolons inside comments", () => {
    expect(cssDiagnostics("a { /* } ; { */ color: red; }")).toEqual([]);
  });

  it("does not flag selectors or at-rules as missing semicolons", () => {
    expect(cssDiagnostics("@media print {\n  body { color: red; }\n}")).toEqual(
      [],
    );
  });

  it("returns diagnostics ordered by position", () => {
    const found = cssDiagnostics("a {\n  color: red\n  background: blue;\n");

    expect(found.map((diagnostic) => diagnostic.from)).toEqual(
      [...found.map((diagnostic) => diagnostic.from)].sort((a, b) => a - b),
    );
  });
});
