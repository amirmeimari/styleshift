// Shared chrome.storage.local stub for tests that need a fake but
// observable store: content.test.ts (reactions to storage.onChanged) and
// storage.test.ts (resolveHostSettings/updateHostSettings/clearHostSettings).
//
// Callers own the backing object and can pre-populate it before calling
// stubChrome() so initial state exists before any code under test runs (this
// ordering matters for content.test.ts, which imports content.ts - and its
// module-level loadAndApply() side effect - only after the store is seeded).

import { vi } from "vitest";

export type StorageChange = { oldValue?: unknown; newValue?: unknown };
export type StorageListener = (
  changes: Record<string, StorageChange>,
  area: string,
) => void;

export function createChromeStub(store: Record<string, unknown>) {
  const listeners = new Set<StorageListener>();

  const local = {
    async get(keys?: string | string[] | null) {
      if (keys === null || keys === undefined) {
        return { ...store };
      }
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(
        list.filter((key) => key in store).map((key) => [key, store[key]]),
      );
    },
    async set(items: Record<string, unknown>) {
      const changes: Record<string, StorageChange> = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: store[key], newValue: value };
        store[key] = value;
      }
      listeners.forEach((listener) => listener(changes, "local"));
    },
    async remove(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes: Record<string, StorageChange> = {};
      for (const key of list) {
        if (key in store) {
          changes[key] = { oldValue: store[key], newValue: undefined };
          delete store[key];
        }
      }
      if (Object.keys(changes).length > 0) {
        listeners.forEach((listener) => listener(changes, "local"));
      }
    },
  };

  return {
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
      onMessage: { addListener: () => {} },
    },
    storage: {
      local,
      onChanged: {
        addListener: (listener: StorageListener) => listeners.add(listener),
      },
    },
  };
}

export function stubChrome(store: Record<string, unknown>): void {
  vi.stubGlobal("chrome", createChromeStub(store));
}
