// Barrel re-export. The implementation was split into focused modules:
//   - style-core.ts   pure styling logic + constants + types (chrome-free)
//   - storage.ts      global/per-host settings in chrome.storage
//   - custom-fonts.ts chunked custom-font storage
//   - tabs.ts         active-tab + content-script reinjection helpers
// Existing imports from "@/shared/styleshift" keep working through this barrel.

export * from "./style-core";
export * from "./storage";
export * from "./custom-fonts";
export * from "./tabs";
