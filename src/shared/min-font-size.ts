// Minimum font size cannot be expressed as CSS: a `font-size: max(Npx, 1em)
// !important` rule re-resolves `1em` against the parent's already-overridden
// size once `!important` wins, collapsing every element in the subtree to
// exactly the minimum. This uses Chrome's own enlarge-only preference
// instead, gated behind the optional "fontSettings" permission so it never
// disables the extension for existing users on an update.
//
// The preference is browser-global and ignores fontEnabled/cssEnabled - there
// is no per-site hook into Chrome's own font settings. Callers must make that
// plain in the UI.

export async function hasFontSettingsPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ permissions: ["fontSettings"] });
  } catch {
    return false;
  }
}

export async function requestFontSettingsPermission(): Promise<boolean> {
  try {
    return await chrome.permissions.request({ permissions: ["fontSettings"] });
  } catch {
    return false;
  }
}

export async function revokeFontSettingsPermission(): Promise<void> {
  try {
    await chrome.permissions.remove({ permissions: ["fontSettings"] });
  } catch {
    // Nothing to revoke, or the permissions API is unavailable - not worth
    // surfacing.
  }
}

export async function applyMinimumFontSize(
  pixelSize: number | null,
): Promise<void> {
  if (!chrome.fontSettings || !(await hasFontSettingsPermission())) {
    return;
  }

  if (pixelSize === null) {
    await chrome.fontSettings.clearMinimumFontSize({});
    return;
  }

  await chrome.fontSettings.setMinimumFontSize({ pixelSize });
}
