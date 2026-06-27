// Custom font storage. Font binaries are large, so each font's base64 payload is
// split into fixed-size chunks stored under separate keys, with a small index
// describing how to reassemble them.

import {
  CUSTOM_FONTS_KEY,
  CUSTOM_FONT_CHUNK_PREFIX,
  CUSTOM_FONT_CHUNK_SIZE,
  CUSTOM_FONT_INDEX_KEY,
  type CustomFont,
} from "./style-core";

type StoredCustomFontMeta = Omit<CustomFont, "data"> & {
  chunks: number;
};

export function customFontChunkKey(fontId: string, index: number): string {
  return `${CUSTOM_FONT_CHUNK_PREFIX}${fontId}_${index}`;
}

function chunkKeysFor(meta: StoredCustomFontMeta): string[] {
  return Array.from({ length: meta.chunks }, (_, index) =>
    customFontChunkKey(meta.id, index),
  );
}

async function readIndex(): Promise<Record<string, StoredCustomFontMeta>> {
  const stored = (await chrome.storage.local.get(
    CUSTOM_FONT_INDEX_KEY,
  )) as Record<string, Record<string, StoredCustomFontMeta> | undefined>;
  return stored[CUSTOM_FONT_INDEX_KEY] ?? {};
}

export async function readCustomFonts(): Promise<Record<string, CustomFont>> {
  try {
    const index = await readIndex();

    if (Object.keys(index).length > 0) {
      const chunkKeys = Object.values(index).flatMap(chunkKeysFor);
      const chunks = (await chrome.storage.local.get(chunkKeys)) as Record<
        string,
        string | undefined
      >;

      return Object.fromEntries(
        Object.values(index).map((font) => [
          font.id,
          {
            ...font,
            data: chunkKeysFor(font)
              .map((key) => chunks[key] ?? "")
              .join(""),
          },
        ]),
      );
    }

    // Legacy single-blob storage (pre-chunking).
    const legacy = (await chrome.storage.local.get(CUSTOM_FONTS_KEY)) as Record<
      string,
      Record<string, CustomFont> | undefined
    >;
    return legacy[CUSTOM_FONTS_KEY] ?? {};
  } catch {
    return {};
  }
}

export async function updateCustomFont(font: CustomFont): Promise<void> {
  try {
    const index = await readIndex();
    const oldMeta = index[font.id];

    if (oldMeta) {
      await chrome.storage.local.remove(chunkKeysFor(oldMeta));
    }

    const chunks = font.data.match(
      new RegExp(`.{1,${CUSTOM_FONT_CHUNK_SIZE}}`, "g"),
    ) ?? [""];
    index[font.id] = {
      id: font.id,
      name: font.name,
      mimeType: font.mimeType,
      format: font.format,
      chunks: chunks.length,
    };

    // Write the index and all chunks in a single batched set instead of one
    // round-trip per chunk.
    const writes: Record<string, unknown> = { [CUSTOM_FONT_INDEX_KEY]: index };
    chunks.forEach((chunk, chunkIndex) => {
      writes[customFontChunkKey(font.id, chunkIndex)] = chunk;
    });
    await chrome.storage.local.set(writes);
    await chrome.storage.local.remove(CUSTOM_FONTS_KEY);
  } catch (error) {
    console.error("Error saving custom font:", error);
    throw error;
  }
}

export async function deleteCustomFont(fontId: string): Promise<void> {
  try {
    const index = await readIndex();
    const oldMeta = index[fontId];
    delete index[fontId];

    await chrome.storage.local.set({ [CUSTOM_FONT_INDEX_KEY]: index });

    if (oldMeta) {
      await chrome.storage.local.remove(chunkKeysFor(oldMeta));
    }
  } catch (error) {
    console.error("Error deleting custom font:", error);
  }
}
