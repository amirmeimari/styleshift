// Decode bytes in an isolated face: never register it in document.fonts or let
// an installed family with the same name hide a corrupt uploaded payload.
export async function validateFontData(data: string): Promise<void> {
  const binary = atob(data);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const face = new FontFace("StyleShiftUploadValidation", bytes);
  await face.load();
}
