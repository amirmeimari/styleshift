// Minimum font size cannot be expressed as CSS: a `font-size: max(Npx, 1em)
// !important` rule re-resolves `1em` against the parent's already-overridden
// size once `!important` wins, collapsing every element in the subtree to
// exactly the minimum. This uses Chrome's own enlarge-only preference
// instead.
//
// "fontSettings" is a required permission, not optional: Chrome rejects it
// from optional_permissions outright ("Permission 'fontSettings' cannot be
// listed as optional. This permission will be omitted."), along with a
// handful of others (debugger, geolocation, proxy, tts, ttsEngine,
// declarativeNetRequest, webAuthenticationProxy). There is no request/revoke
// dance for it - it's granted at install like the rest of `permissions`.
//
// The preference is browser-global and ignores fontEnabled/cssEnabled - there
// is no per-site hook into Chrome's own font settings. Callers must make that
// plain in the UI.

export async function applyMinimumFontSize(
  pixelSize: number | null,
): Promise<void> {
  if (!chrome.fontSettings) {
    return;
  }

  if (pixelSize === null) {
    await chrome.fontSettings.clearMinimumFontSize({});
    return;
  }

  await chrome.fontSettings.setMinimumFontSize({ pixelSize });
}
