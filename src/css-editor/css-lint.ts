// Structural CSS diagnostics for the editor.
//
// This is deliberately not a full CSS validator - it reports the mistakes that
// actually cost a user their stylesheet. The injected <style> is parsed by the
// browser's own CSS parser, which silently discards anything malformed, so an
// unbalanced brace or a missing semicolon can drop every rule after it with no
// feedback at all. These checks give that feedback in the editor instead.

import type { Diagnostic } from "@codemirror/lint";

type Token = {
  char: string;
  index: number;
};

// Walks the source once, skipping over strings and comments, and yields the
// structural characters ({ } ; :) with their absolute offsets.
function structuralTokens(text: string): {
  tokens: Token[];
  unterminatedComment: number | null;
  unterminatedString: number | null;
} {
  const tokens: Token[] = [];
  let unterminatedComment: number | null = null;
  let unterminatedString: number | null = null;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === "/" && text[index + 1] === "*") {
      const end = text.indexOf("*/", index + 2);
      if (end === -1) {
        unterminatedComment = index;
        break;
      }
      index = end + 1;
      continue;
    }

    if (char === '"' || char === "'") {
      let cursor = index + 1;
      let closed = false;
      while (cursor < text.length) {
        if (text[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (text[cursor] === char) {
          closed = true;
          break;
        }
        // An unescaped newline terminates a CSS string as an error.
        if (text[cursor] === "\n") {
          break;
        }
        cursor += 1;
      }
      if (!closed) {
        unterminatedString = index;
        break;
      }
      index = cursor;
      continue;
    }

    if (char === "{" || char === "}" || char === ";") {
      tokens.push({ char, index });
    }
  }

  return { tokens, unterminatedComment, unterminatedString };
}

export function cssDiagnostics(
  text: string,
  phrase: (message: string) => string = (message) => message,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { tokens, unterminatedComment, unterminatedString } =
    structuralTokens(text);

  if (unterminatedComment !== null) {
    diagnostics.push({
      from: unterminatedComment,
      to: Math.min(unterminatedComment + 2, text.length),
      severity: "error",
      source: "styleshift",
      message: phrase(
        "Unterminated comment - this /* is never closed with */.",
      ),
    });
  }

  if (unterminatedString !== null) {
    diagnostics.push({
      from: unterminatedString,
      to: Math.min(unterminatedString + 1, text.length),
      severity: "error",
      source: "styleshift",
      message: phrase("Unterminated string - this quote is never closed."),
    });
  }

  // The scan stops at an unterminated comment or string, so everything after
  // it went untokenized and the brace balance below would be meaningless.
  // Report just the root cause rather than the cascade it produces.
  if (diagnostics.length > 0) {
    return diagnostics;
  }

  // Brace balance. An extra `}` is reported where it appears; unclosed `{`s are
  // reported at the opening brace so the user can see which block is at fault.
  const openBraces: number[] = [];

  for (const token of tokens) {
    if (token.char === "{") {
      openBraces.push(token.index);
      continue;
    }

    if (token.char === "}") {
      if (openBraces.length === 0) {
        diagnostics.push({
          from: token.index,
          to: token.index + 1,
          severity: "error",
          source: "styleshift",
          message: phrase("Unexpected } - there is no open block to close."),
        });
        continue;
      }
      openBraces.pop();
    }
  }

  for (const openIndex of openBraces) {
    diagnostics.push({
      from: openIndex,
      to: openIndex + 1,
      severity: "error",
      source: "styleshift",
      message: phrase(
        "Unclosed block - this { is never closed, so the rules after it are ignored.",
      ),
    });
  }

  // A declaration immediately before a `}` may omit its semicolon, but one
  // followed by another declaration may not. Flag `prop: value` runs that are
  // followed by a newline and another declaration without a separator.
  diagnostics.push(...missingSemicolons(text, tokens, phrase));

  return diagnostics.sort((a, b) => a.from - b.from);
}

function missingSemicolons(
  text: string,
  tokens: Token[],
  phrase: (message: string) => string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Slice the source into block bodies: everything between a `{` and its
  // matching `}` at the same depth.
  const stack: number[] = [];

  for (const token of tokens) {
    if (token.char === "{") {
      stack.push(token.index);
      continue;
    }
    if (token.char !== "}" || stack.length === 0) {
      continue;
    }

    const openIndex = stack.pop() as number;
    if (stack.length > 0) {
      // Only inspect innermost blocks - nested at-rule bodies contain rules,
      // not declarations, and would produce noise.
      continue;
    }

    const body = text.slice(openIndex + 1, token.index);
    if (body.includes("{")) {
      continue;
    }

    // Each newline-separated chunk of a declaration block should end in `;`.
    let offset = openIndex + 1;
    for (const rawLine of body.split("\n")) {
      const trimmedStart = rawLine.length - rawLine.trimStart().length;
      const line = rawLine.trim();
      const lineStart = offset + trimmedStart;
      offset += rawLine.length + 1;

      if (!line || line.startsWith("/*") || line.endsWith(";")) {
        continue;
      }
      // The last declaration in a block may legally drop its semicolon.
      if (lineStart + line.length >= token.index - countTrailingSpace(body)) {
        continue;
      }
      // Only flag things that actually look like a declaration.
      if (!/^[-\w]+\s*:/.test(line)) {
        continue;
      }

      diagnostics.push({
        from: lineStart,
        to: lineStart + line.length,
        severity: "warning",
        source: "styleshift",
        message: phrase(
          "Missing semicolon - without it the browser discards this declaration and the next one.",
        ),
      });
    }
  }

  return diagnostics;
}

function countTrailingSpace(body: string): number {
  return body.length - body.trimEnd().length;
}
