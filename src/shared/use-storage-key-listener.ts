import { useEffect } from "react";

// Invokes `onChange` with the new value whenever `key` changes in
// chrome.storage.local - the subscribe/filter/unsubscribe boilerplate shared
// by every settings provider that mirrors a single key into React state.
export function useStorageKeyListener(
  key: string,
  onChange: (newValue: unknown) => void,
) {
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local" || !changes[key]) {
        return;
      }
      onChange(changes[key].newValue);
    };

    chrome.storage?.onChanged?.addListener(listener);
    return () => {
      chrome.storage?.onChanged?.removeListener(listener);
    };
  }, [key, onChange]);
}
