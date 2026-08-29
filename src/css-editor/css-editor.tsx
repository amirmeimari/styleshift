// CodeMirror-backed editor for the CSS tab.
//
// CodeMirror owns its own document, so this is *not* a controlled React input.
// The `value` prop is pushed into the editor only when it differs from what the
// editor already holds (see the sync effect below); doing it unconditionally on
// every render would reset the selection and make the cursor jump on every
// keystroke.
//
// Extensions are picked individually rather than pulling in `basicSetup`: the
// popup is 480px wide, so the line-number gutter and folding controls that
// come with the batteries-included setup would eat most of the width.

import { useEffect, useRef } from "react";
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder as placeholderExtension,
  rectangularSelection,
} from "@codemirror/view";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { lintKeymap, linter, lintGutter } from "@codemirror/lint";
import { css as cssLanguage } from "@codemirror/lang-css";
import { cssEditorHighlighting, cssEditorTheme } from "./css-editor-theme";
import { cssDiagnostics } from "./css-lint";

type CssEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  /** Locale direction; the editor content itself always stays LTR. */
  className?: string;
};

const editableCompartment = new Compartment();

function baseExtensions(placeholderText: string): Extension[] {
  return [
    lineNumbers(),
    lintGutter(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    // Two spaces, matching the old textarea's Tab handler and formatCSS output.
    indentUnit.of("  "),
    bracketMatching(),
    closeBrackets(),
    autocompletion({ activateOnTyping: true, icons: false }),
    rectangularSelection(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    cssLanguage(),
    // The CSS-specific style comes first so it wins over the generic fallback.
    cssEditorHighlighting,
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    linter((view) => cssDiagnostics(view.state.doc.toString()), { delay: 400 }),
    placeholderExtension(placeholderText),
    cssEditorTheme,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
      spellcheck: "false",
      autocapitalize: "off",
      autocorrect: "off",
      // CSS is always LTR even when the surrounding UI is Arabic or Farsi.
      dir: "ltr",
      "aria-label": "Custom CSS",
    }),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...completionKeymap,
      ...lintKeymap,
      // Must come last: it claims Tab, which earlier keymaps also bind.
      indentWithTab,
    ]),
  ];
}

export function CssEditor({
  value,
  onChange,
  placeholder = "",
  readOnly = false,
  className,
}: CssEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Held in a ref so the update listener never goes stale without having to
  // tear down and rebuild the editor when the callback identity changes.
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          ...baseExtensions(placeholder),
          editableCompartment.of([
            EditorView.editable.of(!readOnly),
            EditorState.readOnly.of(readOnly),
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: host,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Built once. `value`/`readOnly` are pushed in by the effects below;
    // rebuilding on every change would discard undo history and selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push external value changes (Format, Reset, initial load, tab switch) into
  // the editor, but only when they differ from the current document - otherwise
  // echoing our own onChange back would reset the cursor on every keystroke.
  useEffect(() => {
    const view = viewRef.current;

    if (!view || value === view.state.doc.toString()) {
      return;
    }

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      // Keep the cursor in range after a shrinking replacement.
      selection: {
        anchor: Math.min(view.state.selection.main.anchor, value.length),
      },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;

    if (!view) {
      return;
    }

    view.dispatch({
      effects: editableCompartment.reconfigure([
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
      ]),
    });
  }, [readOnly]);

  return (
    <div
      ref={hostRef}
      dir="ltr"
      className={[
        "styleshift-css-editor overflow-hidden rounded-lg",
        readOnly ? "opacity-60" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
