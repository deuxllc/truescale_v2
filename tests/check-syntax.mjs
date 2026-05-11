import { spawnSync } from "node:child_process";

const files = [
  "planscale-seo/app/app-config.js",
  "planscale-seo/app/app-dom.js",
  "planscale-seo/app/app-utils.js",
  "planscale-seo/app/app-export.js",
  "planscale-seo/app/detection-core.js",
  "planscale-seo/app/detection-worker.js",
  "planscale-seo/app/geometry.js",
  "planscale-seo/app/snap.js",
  "planscale-seo/app/segments-panel.js",
  "planscale-seo/app/app.js",
  "tests/app-smoke.mjs",
];

let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  process.exitCode = 1;
}
