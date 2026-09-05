// CodeMirror theme for the custom-CSS editor.
//
// The editor sits inside the popup's "fabric" design, so every colour here is
// taken from the same `--fabric-*` custom properties the rest of the UI uses
// (see src/index.css) rather than from a stock CodeMirror theme. The chrome of
// the editor - border, radius, shadow, mono type scale - deliberately mirrors
// the textarea this replaced so the CSS tab looks unchanged.
//
// `dark` only tells CodeMirror which base theme class (`cm-theme-light` /
// `cm-theme-dark`) to attach for its own internal defaults; every colour
// below already flips with the `--fabric-*` custom properties, so the same
// spec object works for both and needs no dark-specific branches.

import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export function cssEditorTheme(dark: boolean): Extension {
  return EditorView.theme(
    {
      "&": {
        // Declared once and reused by .cm-scroller and .cm-content below - see
        // the note on .cm-gutters for why both of them need it spelled out.
        "--styleshift-editor-min-height": "160px",
        fontSize: "13px",
        color: "hsl(var(--foreground))",
        backgroundColor: "hsl(var(--card))",
        borderRadius: "var(--radius)",
        border: "1px solid hsl(var(--border))",
        boxShadow:
          "0 3px 6px rgba(var(--fabric-shadow-rgb),.08), 0 8px 24px rgba(var(--fabric-shadow-rgb),.12)",
        overflow: "hidden",
      },
      "&.cm-focused": {
        outline: "none",
        boxShadow:
          "0 3px 6px rgba(var(--fabric-shadow-rgb),.08), 0 8px 24px rgba(var(--fabric-shadow-rgb),.12), 0 0 0 1px var(--fabric-stitch)",
      },
      ".cm-scroller": {
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        lineHeight: "1.25rem",
        minHeight: "var(--styleshift-editor-min-height)",
        maxHeight: "40vh",
      },
      ".cm-content": {
        padding: "8px 0",
        caretColor: "var(--fabric-denim)",
        // CodeMirror's base theme gives this `min-height: 100%` so the
        // editable area fills the box. That percentage resolves against
        // .cm-scroller, whose own height is a percentage of an auto-height
        // .cm-editor - an indefinite chain, so it collapses to `auto` and the
        // content box ends at the last line. Restate it as a length so it
        // actually resolves. A min-height (not stretch) because the box
        // still has to grow past it for a long document.
        minHeight: "var(--styleshift-editor-min-height)",
      },
      ".cm-line": { padding: "0 10px" },
      ".cm-gutters": {
        // Same broken percentage chain as .cm-content above: the base
        // theme's `height: 100%` collapses to the content height, so the
        // linen column and its stitched edge stopped at the last line and
        // left a stub floating in the top-left of an otherwise empty editor.
        // Stretching to the flex line fills the box; CodeMirror's own inline
        // `min-height: <content height>` still wins for a document taller
        // than the viewport, so the column keeps tracking the text when it
        // scrolls.
        alignSelf: "stretch",
        height: "auto",
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
      ".cm-activeLine": {
        backgroundColor:
          "color-mix(in srgb, var(--fabric-stitch) 10%, transparent)",
      },
      ".cm-activeLineGutter": {
        backgroundColor:
          "color-mix(in srgb, var(--fabric-stitch) 18%, transparent)",
        color: "hsl(var(--foreground))",
      },
      // CodeMirror paints the active line whether or not the editor has
      // focus. On an untouched editor that means a tinted band and a filled
      // gutter cell sat over the placeholder, reading as selected content
      // rather than a hint. Show the highlight only while the user is
      // actually editing.
      "&:not(.cm-focused) .cm-activeLine": { backgroundColor: "transparent" },
      "&:not(.cm-focused) .cm-activeLineGutter": {
        backgroundColor: "transparent",
        color: "hsl(var(--muted-foreground))",
      },
      "&.cm-focused .cm-cursor": {
        borderInlineStartColor: "var(--fabric-denim)",
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
        {
          backgroundColor:
            "color-mix(in srgb, var(--fabric-blue-thread) 22%, transparent)",
        },
      ".cm-selectionMatch": {
        backgroundColor:
          "color-mix(in srgb, var(--fabric-mustard) 28%, transparent)",
      },
      ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
        backgroundColor:
          "color-mix(in srgb, var(--fabric-green-thread) 28%, transparent)",
        outline: "1px solid var(--fabric-green-thread)",
      },
      ".cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket": {
        backgroundColor:
          "color-mix(in srgb, var(--fabric-red-thread) 22%, transparent)",
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
        boxShadow: "0 8px 16px rgba(var(--fabric-shadow-rgb),.14)",
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
      ".cm-diagnostic-warning": {
        borderInlineStartColor: "var(--fabric-mustard)",
      },
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
    },
    { dark },
  );
}

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
