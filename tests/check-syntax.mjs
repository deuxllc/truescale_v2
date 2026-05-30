import { spawnSync } from "node:child_process";

const files = [
  "planscale-seo/app/app-config.js",
  "planscale-seo/app/app-dom.js",
  "planscale-seo/app/app-utils.js",
  "planscale-seo/app/app-export.js",
  "planscale-seo/app/detection-core.js",
  "planscale-seo/app/detection-worker.js",
  "planscale-seo/app/geometry.js",
  "planscale-seo/app/measurement.js",
  "planscale-seo/app/app-dialogs.js",
  "planscale-seo/app/app-state.js",
  "planscale-seo/app/app-history.js",
  "planscale-seo/app/project-format.js",
  "planscale-seo/app/canvas-view.js",
  "planscale-seo/app/canvas-hit-testing.js",
  "planscale-seo/app/canvas-renderer.js",
  "planscale-seo/app/canvas-wheel.js",
  "planscale-seo/app/app-keyboard.js",
  "planscale-seo/app/app-resize.js",
  "planscale-seo/app/pointer-tracker.js",
  "planscale-seo/app/segment-context-actions.js",
  "planscale-seo/app/snap.js",
  "planscale-seo/app/segments-panel.js",
  "planscale-seo/app/app.js",
  "tests/app-unit.mjs",
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
