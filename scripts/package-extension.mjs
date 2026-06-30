// Produces a clean, upload-ready zip of the built extension for the Chrome Web
// Store. Builds first, then zips dist/ while excluding OS cruft (.DS_Store) and
// any source maps so nothing extraneous ships to users or reviewers.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const releaseDir = resolve(root, "release");

// manifest.json (not package.json) is the version the Web Store reads, so the
// release filename is named from it to avoid the two ever drifting apart.
const { version } = JSON.parse(
  readFileSync(resolve(root, "public/manifest.json"), "utf8"),
);
const zipPath = resolve(releaseDir, `styleshift-v${version}.zip`);

// 1. Fresh production build.
execFileSync("npm", ["run", "build"], { stdio: "inherit" });

// 2. Strip OS/editor cruft and any stray source maps from dist.
execFileSync("find", [
  "dist",
  "(",
  "-name",
  ".DS_Store",
  "-o",
  "-name",
  "*.map",
  ")",
  "-delete",
]);

// 3. Zip dist/ contents at the archive root (manifest.json must be top-level).
rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });
execFileSync("zip", ["-r", "-X", zipPath, "."], {
  cwd: resolve(root, "dist"),
  stdio: "inherit",
});

console.log(`\nPackaged extension → ${zipPath}`);
