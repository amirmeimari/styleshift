// Content script: the single place that reads StyleShift settings and applies
// them to a page. Extension pages (popup, editors) only write settings to
// chrome.storage and nudge this script - all styling logic lives in the shared
// modules imported below.

import {
  CUSTOM_FONTS_STYLE_ID,
  CUSTOM_FONTS_KEY,
  CUSTOM_FONT_CHUNK_PREFIX,
  CUSTOM_FONT_INDEX_KEY,
  CSS_STYLE_ID,
  EDITABLE_SELECTOR,
  FABRICIZE_STYLE_ID,
  FONT_STYLE_ID,
  GLOBAL_ENABLED_KEY,
  GLOBAL_FONT_STACK_KEY,
  GLOBAL_MONO_FONT_STACK_KEY,
  applySettings,
  customFontFaces,
  ensureStyle,
  removeInjectedStyles,
  serializeFontStack,
} from "@/shared/style-core";
import {
  readGlobalEnabled,
  readGlobalFontStack,
  readGlobalMonoFontStack,
  readHostSettings,
} from "@/shared/storage";
import { readCustomFonts } from "@/shared/custom-fonts";
import {
  BUILTIN_FONTS_STYLE_ID,
  BUILTIN_FONT_NAMES,
  builtinFontFaces,
} from "@/shared/builtin-fonts";
import { isReinjectMessage } from "@/shared/messages";

// Bundled fonts are declared once; their @font-face rules reference packaged
// woff2 files via the extension origin (web_accessible_resources).
function injectBuiltinFonts(): void {
  ensureStyle(
    BUILTIN_FONTS_STYLE_ID,
    builtinFontFaces((path) => chrome.runtime.getURL(path)),
  );
}

async function injectCustomFonts(): Promise<string[]> {
  try {
    const fonts = await readCustomFonts();
    const faces = customFontFaces(fonts);

    if (faces.trim()) {
      ensureStyle(CUSTOM_FONTS_STYLE_ID, faces);
    }

    return Object.values(fonts).map((font) => font.name);
  } catch (error) {
    console.error("Error injecting custom fonts:", error);
    return [];
  }
}

let applyGeneration = 0;

async function loadAndApply() {
  const generation = ++applyGeneration;
  const hostname = window.location.hostname;

  if (!hostname) {
    return;
  }

  const globalEnabled = await readGlobalEnabled();

  if (generation !== applyGeneration) {
    return;
  }

  if (!globalEnabled) {
    removeInjectedStyles();
    return;
  }

  const [settings, globalFontStack, globalMonoFontStack] = await Promise.all([
    readHostSettings(hostname),
    readGlobalFontStack(),
    readGlobalMonoFontStack(),
  ]);

  if (generation !== applyGeneration) {
    return;
  }

  settings.fontFamily = serializeFontStack(globalFontStack);
  settings.monoFontFamily = serializeFontStack(globalMonoFontStack);
  injectBuiltinFonts();
  const customFontNames = await injectCustomFonts();

  if (generation !== applyGeneration) {
    return;
  }

  // Bundled fonts are always available, alongside any uploaded/imported ones.
  applySettings(settings, [...BUILTIN_FONT_NAMES, ...customFontNames]);
}

let currentUrl = window.location.href;
let reapplyTimer: number | undefined;

function scheduleLoadAndApply(delay = 50) {
  window.clearTimeout(reapplyTimer);
  reapplyTimer = window.setTimeout(() => {
    reapplyTimer = undefined;
    loadAndApply();
  }, delay);
}

const INJECTED_STYLE_IDS = [
  FONT_STYLE_ID,
  CSS_STYLE_ID,
  CUSTOM_FONTS_STYLE_ID,
  BUILTIN_FONTS_STYLE_ID,
  FABRICIZE_STYLE_ID,
];
const INJECTED_STYLE_SELECTOR = INJECTED_STYLE_IDS.map((id) => `#${id}`).join(
  ", ",
);

function hasInjectedStyle(node: Node): boolean {
  if (!(node instanceof Element)) {
    return false;
  }

  if (INJECTED_STYLE_IDS.includes(node.id)) {
    return true;
  }

  return Boolean(node.querySelector(INJECTED_STYLE_SELECTOR));
}

function watchUrlChanges() {
  const handlePossibleUrlChange = () => {
    if (window.location.href === currentUrl) {
      return;
    }

    currentUrl = window.location.href;
    scheduleLoadAndApply(25);
  };

  const scheduleUrlCheck = () => {
    queueMicrotask(handlePossibleUrlChange);
  };

  const wrapHistoryMethod = (methodName: "pushState" | "replaceState") => {
    const originalMethod = window.history[methodName];

    try {
      window.history[methodName] = function (
        this: History,
        ...args: Parameters<typeof history.pushState>
      ) {
        const result = originalMethod.apply(this, args);
        scheduleUrlCheck();
        return result;
      };
    } catch (error) {
      console.warn(`StyleShift could not watch history.${methodName}.`, error);
    }
  };

  // SPA navigations go through pushState/replaceState; back/forward through
  // popstate/hashchange. Together these cover client-side routing without the
  // cost of a forever-running polling interval.
  wrapHistoryMethod("pushState");
  wrapHistoryMethod("replaceState");

  window.addEventListener("popstate", scheduleUrlCheck);
  window.addEventListener("hashchange", scheduleUrlCheck);
}

function watchPageLifecycle() {
  window.addEventListener("pageshow", () => {
    scheduleLoadAndApply(25);
  });
  window.addEventListener("focus", () => {
    scheduleLoadAndApply(50);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      scheduleLoadAndApply(50);
    }
  });
}

function watchDynamicPageChanges() {
  const observer = new MutationObserver((mutations) => {
    // A reapply is already queued - no need to inspect this batch, the pending
    // run will pick up the latest DOM state.
    if (reapplyTimer !== undefined) {
      return;
    }

    let needsReapply = false;

    for (const mutation of mutations) {
      // One of our injected <style> elements was removed (or the whole
      // documentElement was swapped) - reapply to restore it.
      if (
        mutation.target === document.documentElement ||
        Array.from(mutation.removedNodes).some(hasInjectedStyle)
      ) {
        needsReapply = true;
        break;
      }

      // New editable content appeared - it may need the form-text font rules.
      const addedEditable = Array.from(mutation.addedNodes).some((node) => {
        if (!(node instanceof HTMLElement)) {
          return false;
        }

        return (
          node.matches(EDITABLE_SELECTOR) ||
          Boolean(node.querySelector(EDITABLE_SELECTOR))
        );
      });

      if (addedEditable) {
        needsReapply = true;
        break;
      }
    }

    if (needsReapply) {
      scheduleLoadAndApply(100);
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

loadAndApply();
watchDynamicPageChanges();
watchUrlChanges();
watchPageLifecycle();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  const hostname = window.location.hostname;

  const customFontsChanged =
    changes[CUSTOM_FONTS_KEY] ||
    changes[CUSTOM_FONT_INDEX_KEY] ||
    Object.keys(changes).some((key) =>
      key.startsWith(CUSTOM_FONT_CHUNK_PREFIX),
    );

  if (customFontsChanged) {
    scheduleLoadAndApply(0);
    return;
  }

  const globalChange = changes[GLOBAL_ENABLED_KEY];

  if (globalChange?.newValue === false) {
    removeInjectedStyles();
    return;
  }

  const settingsChanged =
    globalChange ||
    changes[GLOBAL_FONT_STACK_KEY] ||
    changes[GLOBAL_MONO_FONT_STACK_KEY] ||
    changes[hostname];

  if (settingsChanged) {
    scheduleLoadAndApply(0);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (isReinjectMessage(message)) {
    scheduleLoadAndApply(0);
  }
});
