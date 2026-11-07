// Small, pure helpers for editing the ordered CSS fallback stack. Keeping
// these operations outside the popup makes their ordering/deduplication
// behavior easy to pin down without involving browser storage or Radix UI.

export function normalizeFontName(value: string): string {
  return value.trim().replace(/,/g, "");
}

export function distinctFontNames(
  names: readonly string[],
  excluded: readonly string[] = [],
): string[] {
  const seen = new Set(excluded.map((name) => name.toLocaleLowerCase()));
  return names.filter((name) => {
    const key = name.toLocaleLowerCase();
    if (!key.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function addFontToStack(stack: string[], value: string): string[] {
  const name = normalizeFontName(value);
  if (
    !name ||
    stack.some((font) => font.toLocaleLowerCase() === name.toLocaleLowerCase())
  ) {
    return stack;
  }
  return [...stack, name];
}

export function replaceFontInStack(
  stack: string[],
  index: number,
  value: string,
): string[] {
  const name = normalizeFontName(value);
  if (!name || index < 0 || index >= stack.length) {
    return stack;
  }

  const duplicateIndex = stack.findIndex(
    (font, candidateIndex) =>
      candidateIndex !== index &&
      font.toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  if (duplicateIndex >= 0) {
    return stack;
  }

  return stack.map((font, candidateIndex) =>
    candidateIndex === index ? name : font,
  );
}

export function removeFontFromStack(stack: string[], index: number): string[] {
  if (index < 0 || index >= stack.length) {
    return stack;
  }
  return stack.filter((_, candidateIndex) => candidateIndex !== index);
}

export function moveFontInStack(
  stack: string[],
  from: number,
  to: number,
): string[] {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= stack.length ||
    to >= stack.length ||
    from === to
  )
    return stack;
  const next = [...stack];
  const [font] = next.splice(from, 1);
  next.splice(to, 0, font);
  return next;
}
