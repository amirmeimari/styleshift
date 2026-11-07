// CodeMirror theme for the custom-CSS editor.
//
// Compact dark code surface within the neutral StyleShift shell. Code text
// stays LTR in both directions; the same theme is shared with the full editor.
//
// The editor uses dark internal defaults in both surrounding UI themes.

import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export function cssEditorTheme(_dark: boolean): Extension {
  return EditorView.theme(
    {
      "&": {
        // Declared once and reused by .cm-scroller and .cm-content below - see
        // the note on .cm-gutters for why both of them need it spelled out.
        "--styleshift-editor-min-height": "160px",
        // UI chrome inherits the extension font; code/completions stay mono.
        fontFamily: '"Inter", "Vazirmatn", system-ui, sans-serif',
        fontSize: "13px",
        color: "#e6e9f0",
        backgroundColor: "#24272e",
        borderRadius: "var(--radius)",
        border: "1px solid #41454f",
        boxShadow: "none",
        overflow: "hidden",
      },
      "&.cm-focused": {
        outline: "none",
        boxShadow: "0 0 0 2px hsl(var(--ring))",
      },
      ".cm-scroller": {
        fontFamily:
          "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        lineHeight: "1.25rem",
        minHeight: "var(--styleshift-editor-min-height)",
        maxHeight: "min(36vh, 260px)",
      },
      ".cm-content": {
        padding: "8px 0",
        // The brighter -border sibling, not the base fill color: the caret
        // has to read as an ink mark against --card, while --fabric-denim
        // itself stays tuned for badge/button fills (see the note in
        // src/index.css's .dark block).
        caretColor: "#a8b6ff",
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
        backgroundColor: "#20232a",
        color: "#aab1c0",
        border: "none",
        borderInlineEnd: "1px solid #41454f",
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
        color: "#e6e9f0",
      },
      // CodeMirror paints the active line whether or not the editor has
      // focus. On an untouched editor that means a tinted band and a filled
      // gutter cell sat over the placeholder, reading as selected content
      // rather than a hint. Show the highlight only while the user is
      // actually editing.
      "&:not(.cm-focused) .cm-activeLine": { backgroundColor: "transparent" },
      "&:not(.cm-focused) .cm-activeLineGutter": {
        backgroundColor: "transparent",
        color: "#aab1c0",
      },
      "&.cm-focused .cm-cursor": {
        borderInlineStartColor: "#a8b6ff",
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
        color: "#aab1c0",
        fontStyle: "normal",
      },

      // Autocomplete popup - styled like the popover surfaces elsewhere.
      ".cm-tooltip": {
        border: "1px solid #41454f",
        borderRadius: "calc(var(--radius) - 2px)",
        backgroundColor: "#24272e",
        color: "#e6e9f0",
        boxShadow: "0 8px 16px rgba(var(--fabric-shadow-rgb),.14)",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul": {
        fontFamily:
          "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
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
    { dark: true },
  );
}

// Syntax colours. CSS only needs a handful of token types; each maps to one of
// the palette's thread colours so highlighting reads as part of the design.
export const cssHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: "#aab1c0" },
  {
    tag: [tags.propertyName, tags.definition(tags.propertyName)],
    // -border, not the base fill (see the caretColor comment above).
    color: "#80c7ff",
  },
  { tag: [tags.tagName, tags.typeName], color: "#efb3f6" },
  { tag: tags.className, color: "#b8dfa4" },
  { tag: tags.labelName, color: "#b8dfa4" },
  { tag: [tags.attributeName, tags.modifier], color: "#b8dfa4" },
  {
    tag: [tags.string, tags.special(tags.string)],
    color: "#b8dfa4",
  },
  { tag: [tags.number, tags.unit], color: "#e5b9a8" },
  {
    tag: [tags.color, tags.constant(tags.name)],
    color: "#b6b8ff",
  },
  { tag: tags.atom, color: "#b6b8ff" },
  {
    tag: [tags.keyword, tags.definitionKeyword],
    color: "#efb3f6",
  },
  { tag: tags.function(tags.variableName), color: "#80c7ff" },
  { tag: tags.variableName, color: "#80c7ff" },
  { tag: tags.operator, color: "#aab1c0" },
  { tag: tags.punctuation, color: "#aab1c0" },
  { tag: tags.invalid, color: "#ff9a9a" },
]);

export const cssEditorHighlighting = syntaxHighlighting(cssHighlightStyle);
