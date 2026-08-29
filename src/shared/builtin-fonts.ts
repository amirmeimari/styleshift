// Fonts bundled with the extension. The woff2 files live in
// public/fonts/library and are declared as web_accessible_resources so they can
// be referenced from any page the content script runs in.

export type BuiltinFont = {
  name: string;
  /** Drives which picker offers the font: body text or code. */
  category: "sans" | "mono";
  files: { weight: number; file: string }[];
};

export const BUILTIN_FONTS: BuiltinFont[] = [
  {
    name: "Inter",
    category: "sans",
    files: [
      { weight: 400, file: "inter-400.woff2" },
      { weight: 700, file: "inter-700.woff2" },
    ],
  },
  {
    name: "Roboto",
    category: "sans",
    files: [
      { weight: 400, file: "roboto-400.woff2" },
      { weight: 700, file: "roboto-700.woff2" },
    ],
  },
  {
    name: "Open Sans",
    category: "sans",
    files: [
      { weight: 400, file: "open-sans-400.woff2" },
      { weight: 700, file: "open-sans-700.woff2" },
    ],
  },
  {
    name: "Lato",
    category: "sans",
    files: [
      { weight: 400, file: "lato-400.woff2" },
      { weight: 700, file: "lato-700.woff2" },
    ],
  },
  {
    name: "Poppins",
    category: "sans",
    files: [
      { weight: 400, file: "poppins-400.woff2" },
      { weight: 700, file: "poppins-700.woff2" },
    ],
  },
  {
    // SIL Open Font License 1.1 - see JetBrainsMono-OFL.txt alongside the woff2.
    name: "JetBrains Mono",
    category: "mono",
    files: [
      { weight: 400, file: "jetbrains-mono-400.woff2" },
      { weight: 700, file: "jetbrains-mono-700.woff2" },
    ],
  },
];

export const BUILTIN_FONT_NAMES: string[] = BUILTIN_FONTS.map(
  (font) => font.name,
);

// The two pickers offer different fonts: a proportional face is a poor code
// font, and a monospace face is a poor body font. Before this split both
// pickers listed every bundled font, so the code-font picker offered five
// sans faces and no monospace one at all.
export const BUILTIN_SANS_FONTS: BuiltinFont[] = BUILTIN_FONTS.filter(
  (font) => font.category === "sans",
);

export const BUILTIN_MONO_FONTS: BuiltinFont[] = BUILTIN_FONTS.filter(
  (font) => font.category === "mono",
);

export const BUILTIN_SANS_FONT_NAMES: string[] = BUILTIN_SANS_FONTS.map(
  (font) => font.name,
);

export const BUILTIN_MONO_FONT_NAMES: string[] = BUILTIN_MONO_FONTS.map(
  (font) => font.name,
);

/** Bundled code font used when the user has not picked one. */
export const DEFAULT_MONO_FONT = "JetBrains Mono";

export const BUILTIN_FONTS_STYLE_ID = "styleshift-builtin-fonts";

// Builds @font-face rules for every bundled font. `resolveUrl` maps a packaged
// path (e.g. "fonts/library/inter-400.woff2") to a loadable URL - pass
// chrome.runtime.getURL so the rules resolve to the extension origin.
export function builtinFontFaces(resolveUrl: (path: string) => string): string {
  return BUILTIN_FONTS.flatMap((font) =>
    font.files.map(
      ({ weight, file }) =>
        `@font-face {
  font-family: '${font.name}';
  font-weight: ${weight};
  font-style: normal;
  font-display: swap;
  src: url('${resolveUrl(`fonts/library/${file}`)}') format('woff2');
}`,
    ),
  ).join("\n\n");
}
