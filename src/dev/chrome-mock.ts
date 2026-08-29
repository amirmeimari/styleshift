// Development-only stub of the handful of chrome.* APIs the popup touches.
//
// Loaded from main.tsx behind `import.meta.env.DEV`, so it is tree-shaken out of
// the production bundle and never ships. Without it `npm run dev` renders the
// popup with every control disabled - `getActiveTab()` throws because there is
// no chrome.tabs outside an extension host - which makes the dev server useless
// for working on the UI.

type StorageListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  areaName: string,
) => void;

const MOCK_TAB = {
  id: 1,
  url: "https://github.com/mimalef70/fontara",
  active: true,
  windowId: 1,
};

export function installChromeMock(): void {
  if (typeof globalThis.chrome !== "undefined" && globalThis.chrome?.tabs) {
    return;
  }

  const store = new Map<string, unknown>();
  const listeners = new Set<StorageListener>();

  const readKeys = (keys: string | string[] | null | undefined) => {
    if (keys === null || keys === undefined) {
      return Object.fromEntries(store);
    }
    const list = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      list
        .filter((key) => store.has(key))
        .map((key) => [key, store.get(key)] as const),
    );
  };

  const local = {
    async get(keys?: string | string[] | null) {
      return readKeys(keys);
    },
    async set(items: Record<string, unknown>) {
      const changes: Record<
        string,
        { oldValue?: unknown; newValue?: unknown }
      > = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: store.get(key), newValue: value };
        store.set(key, value);
      }
      listeners.forEach((listener) => listener(changes, "local"));
    },
    async remove(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes: Record<
        string,
        { oldValue?: unknown; newValue?: unknown }
      > = {};
      for (const key of list) {
        if (store.has(key)) {
          changes[key] = { oldValue: store.get(key), newValue: undefined };
          store.delete(key);
        }
      }
      if (Object.keys(changes).length > 0) {
        listeners.forEach((listener) => listener(changes, "local"));
      }
    },
  };

  const chromeMock = {
    storage: {
      local,
      onChanged: {
        addListener: (listener: StorageListener) => listeners.add(listener),
        removeListener: (listener: StorageListener) =>
          listeners.delete(listener),
      },
    },
    tabs: {
      async query() {
        return [MOCK_TAB];
      },
      async sendMessage() {
        return undefined;
      },
    },
    scripting: {
      async executeScript() {
        return [];
      },
    },
    runtime: {
      getURL: (path: string) => `/${path.replace(/^\//, "")}`,
      onMessage: { addListener: () => {}, removeListener: () => {} },
      onInstalled: { addListener: () => {} },
    },
  };

  Object.defineProperty(globalThis, "chrome", {
    value: chromeMock,
    configurable: true,
    writable: true,
  });

  console.info(
    "[StyleShift] dev chrome mock installed - storage is in-memory and resets on reload.",
  );
}
