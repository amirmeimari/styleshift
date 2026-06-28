// Fonts bundled with the extension. The woff2 files live in
// public/fonts/library and are declared as web_accessible_resources so they can
// be referenced from any page the content script runs in.

export type BuiltinFont = {
  name: string;
  files: { weight: number; file: string }[];
};

export const BUILTIN_FONTS: BuiltinFont[] = [
  {
    name: "Inter",
    files: [
      { weight: 400, file: "inter-400.woff2" },
      { weight: 700, file: "inter-700.woff2" },
    ],
  },
  {
    name: "Roboto",
    files: [
      { weight: 400, file: "roboto-400.woff2" },
      { weight: 700, file: "roboto-700.woff2" },
    ],
  },
  {
    name: "Open Sans",
    files: [
      { weight: 400, file: "open-sans-400.woff2" },
      { weight: 700, file: "open-sans-700.woff2" },
    ],
  },
  {
    name: "Lato",
    files: [
      { weight: 400, file: "lato-400.woff2" },
      { weight: 700, file: "lato-700.woff2" },
    ],
  },
  {
    name: "Poppins",
    files: [
      { weight: 400, file: "poppins-400.woff2" },
      { weight: 700, file: "poppins-700.woff2" },
    ],
  },
];

export const BUILTIN_FONT_NAMES: string[] = BUILTIN_FONTS.map(
  (font) => font.name,
);

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
