// Google Fonts integration. The API key (stored locally) is used only to list
// the catalog. Importing a font downloads its regular weight and stores it as a
// custom font, so it then injects on pages exactly like an uploaded font - no
// remote requests at render time and no page-CSP issues.

import type { CustomFont } from "./style-core";

export const GOOGLE_API_KEY_STORAGE_KEY = "__styleshift_google_api_key__";

export async function readGoogleApiKey(): Promise<string> {
  try {
    const stored = (await chrome.storage.local.get(
      GOOGLE_API_KEY_STORAGE_KEY,
    )) as Record<string, string | undefined>;
    return stored[GOOGLE_API_KEY_STORAGE_KEY] ?? "";
  } catch {
    return "";
  }
}

export async function saveGoogleApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({
    [GOOGLE_API_KEY_STORAGE_KEY]: key.trim(),
  });
}

export type GoogleFontItem = {
  family: string;
  category: string;
};

export async function fetchGoogleFontCatalog(
  apiKey: string,
): Promise<GoogleFontItem[]> {
  const url = `https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=${encodeURIComponent(
    apiKey,
  )}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      response.status === 400 || response.status === 403
        ? "Invalid Google Fonts API key."
        : `Google Fonts API error (${response.status}).`,
    );
  }

  const data = (await response.json()) as {
    items?: { family: string; category: string }[];
  };
  return (data.items ?? []).map((item) => ({
    family: item.family,
    category: item.category,
  }));
}

export function googleFontId(family: string): string {
  return `google-font-${family.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

// Downloads a Google font's regular weight and returns it as a CustomFont ready
// to store. The css2 endpoint returns woff2 for modern browser user agents.
export async function importGoogleFont(family: string): Promise<CustomFont> {
  const cssResponse = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family,
    )}&display=swap`,
  );

  if (!cssResponse.ok) {
    throw new Error(`Could not load ${family} (${cssResponse.status}).`);
  }

  const css = await cssResponse.text();
  const match = css.match(/url\((https:\/\/[^)]+\.woff2)\)/);

  if (!match) {
    throw new Error(`No woff2 source found for ${family}.`);
  }

  const fontResponse = await fetch(match[1]);

  if (!fontResponse.ok) {
    throw new Error(`Could not download ${family} (${fontResponse.status}).`);
  }

  const base64 = arrayBufferToBase64(await fontResponse.arrayBuffer());

  return {
    id: googleFontId(family),
    name: family,
    data: base64,
    mimeType: "font/woff2",
    format: "woff2",
  };
}
