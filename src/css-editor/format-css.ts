// Lightweight CSS pretty-printer used by the editor. Splits declarations and
// blocks onto their own lines and re-indents by brace depth, while leaving the
// contents of strings, comments, and parentheses untouched.
export function formatCSS(css: string): string {
  let normalized = "";
  let quote: string | null = null;
  let inComment = false;
  let parenDepth = 0;

  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    const next = css[index + 1];
    const previous = css[index - 1];

    if (inComment) {
      normalized += char;

      if (char === "*" && next === "/") {
        normalized += next;
        index += 1;
        inComment = false;
        normalized += "\n";
      }

      continue;
    }

    if (quote) {
      normalized += char;

      if (char === quote && previous !== "\\") {
        quote = null;
      }

      continue;
    }

    if (char === "/" && next === "*") {
      inComment = true;
      normalized += "/*";
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      normalized += char;
      continue;
    }

    if (char === "(") {
      parenDepth += 1;
      normalized += char;
      continue;
    }

    if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      normalized += char;
      continue;
    }

    if (parenDepth === 0 && (char === "{" || char === "}" || char === ";")) {
      normalized += `${char}\n`;
      continue;
    }

    normalized += char;
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  let depth = 0;

  if (lines.length === 0) {
    return "";
  }

  return `${lines
    .map((line) => {
      if (line.startsWith("}")) {
        depth = Math.max(0, depth - 1);
      }

      const formatted = `${"  ".repeat(depth)}${line}`;

      if (line.endsWith("{")) {
        depth += 1;
      }

      return formatted;
    })
    .join("\n")}\n`;
}
