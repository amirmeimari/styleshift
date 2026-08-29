// CodeMirror theme for the custom-CSS editor.
//
// The editor sits inside the popup's "fabric" design, so every colour here is
// taken from the same `--fabric-*` custom properties the rest of the UI uses
// (see src/index.css) rather than from a stock CodeMirror theme. The chrome of
// the editor - border, radius, shadow, mono type scale - deliberately mirrors
// the textarea this replaced so the CSS tab looks unchanged.

import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export const cssEditorTheme = EditorView.theme({
  "&": {
    fontSize: "12px",
    color: "hsl(var(--foreground))",
    backgroundColor: "hsl(var(--card))",
    borderRadius: "var(--radius)",
    border: "1px solid hsl(var(--border))",
    boxShadow: "0 3px 6px rgba(68,42,22,.08), 0 8px 24px rgba(68,42,22,.12)",
    overflow: "hidden",
  },
  "&.cm-focused": {
    outline: "none",
    boxShadow:
      "0 3px 6px rgba(68,42,22,.08), 0 8px 24px rgba(68,42,22,.12), 0 0 0 1px var(--fabric-stitch)",
  },
  ".cm-scroller": {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    lineHeight: "1.25rem",
    minHeight: "160px",
    maxHeight: "40vh",
  },
  ".cm-content": {
    padding: "8px 0",
    caretColor: "var(--fabric-denim)",
  },
  ".cm-line": { padding: "0 10px" },
  ".cm-gutters": {
    backgroundColor: "var(--fabric-linen)",
    color: "hsl(var(--muted-foreground))",
    border: "none",
    borderInlineEnd: "1px dashed var(--fabric-stitch)",
    userSelect: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 6px 0 8px",
    minWidth: "22px",
  },
  ".cm-activeLine": { backgroundColor: "rgba(163,131,98,.10)" },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(163,131,98,.18)",
    color: "hsl(var(--foreground))",
  },
  "&.cm-focused .cm-cursor": { borderInlineStartColor: "var(--fabric-denim)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
    {
      backgroundColor: "rgba(61,91,139,.22)",
    },
  ".cm-selectionMatch": { backgroundColor: "rgba(212,167,78,.28)" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "rgba(92,125,88,.28)",
    outline: "1px solid var(--fabric-green-thread)",
  },
  ".cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    backgroundColor: "rgba(160,74,66,.22)",
    outline: "1px solid var(--fabric-red-thread)",
  },
  ".cm-placeholder": {
    color: "hsl(var(--muted-foreground))",
    fontStyle: "normal",
  },

  // Autocomplete popup - styled like the popover surfaces elsewhere.
  ".cm-tooltip": {
    border: "1px solid var(--fabric-stitch)",
    borderRadius: "calc(var(--radius) - 2px)",
    backgroundColor: "var(--fabric-canvas)",
    color: "hsl(var(--foreground))",
    boxShadow: "0 8px 16px rgba(68,42,22,.14)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "11px",
    maxHeight: "12em",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": { padding: "2px 8px" },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--fabric-denim)",
    color: "hsl(var(--primary-foreground))",
  },
  ".cm-completionIcon": { opacity: 0.6, paddingInlineEnd: "0.6em" },

  // Lint marks and the diagnostic tooltip.
  ".cm-diagnostic": {
    padding: "4px 8px",
    fontSize: "11px",
    borderInlineStartWidth: "3px",
    borderInlineStartStyle: "solid",
  },
  ".cm-diagnostic-error": {
    borderInlineStartColor: "var(--fabric-red-thread)",
  },
  ".cm-diagnostic-warning": { borderInlineStartColor: "var(--fabric-mustard)" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--fabric-red-thread)",
    textUnderlineOffset: "3px",
  },
  ".cm-lintRange-warning": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--fabric-mustard)",
    textUnderlineOffset: "3px",
  },
});

// Syntax colours. CSS only needs a handful of token types; each maps to one of
// the palette's thread colours so highlighting reads as part of the design.
export const cssHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: "hsl(var(--muted-foreground))" },
  {
    tag: [tags.propertyName, tags.definition(tags.propertyName)],
    color: "var(--fabric-denim)",
  },
  { tag: [tags.tagName, tags.typeName], color: "var(--fabric-leather)" },
  { tag: tags.className, color: "var(--fabric-olive)" },
  { tag: tags.labelName, color: "var(--fabric-olive)" },
  { tag: [tags.attributeName, tags.modifier], color: "var(--fabric-olive)" },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: "var(--fabric-green-thread)",
  },
  { tag: [tags.number, tags.unit], color: "var(--fabric-terracotta)" },
  {
    tag: [tags.color, tags.constant(tags.name)],
    color: "var(--fabric-terracotta)",
  },
  { tag: tags.atom, color: "var(--fabric-terracotta)" },
  {
    tag: [tags.keyword, tags.definitionKeyword],
    color: "var(--fabric-red-thread)",
  },
  { tag: tags.function(tags.variableName), color: "var(--fabric-blue-thread)" },
  { tag: tags.variableName, color: "var(--fabric-blue-thread)" },
  { tag: tags.operator, color: "hsl(var(--muted-foreground))" },
  { tag: tags.punctuation, color: "hsl(var(--muted-foreground))" },
  { tag: tags.invalid, color: "var(--fabric-red-thread)" },
]);

export const cssEditorHighlighting = syntaxHighlighting(cssHighlightStyle);
