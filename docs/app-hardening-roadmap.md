# TrueScale App Hardening Roadmap

## Goal

Bring the app layer in `planscale-seo/app` to a stable 1.0 foundation while preserving the current GitHub Pages deployment and existing user workflows: upload image, draw measurements, calibrate scale, detect plan lines, measure areas, undo/redo, export, share, and use the app on desktop/mobile.

## Current Architecture

- Static browser app with no backend.
- Browser scripts still load through ordered `<script>` tags and `window.PlanScale...` namespaces.
- Domain code is now split into dedicated modules for geometry, measurement, dialogs, project format, canvas view transforms, canvas rendering, detection, snapping, export, and the segments panel.
- `app.js` remains the orchestration layer for canvas interaction, state transitions, history, and UI synchronization.

## Implemented In This Cycle

- Added dependency lockfile and local reproducible `npm test` workflow.
- Centralized shared geometry helpers in `PlanScaleGeometry`.
- Added `PlanScaleMeasurement` with normalized meter-based calculations.
- Added `referenceValueMeters` while keeping old `referenceValue`, `unit`, and `unitSystem` fields for compatibility.
- Added correct unit conversion for `m`, `cm`, `mm`, `km`, `ft`, and `in`.
- Added normalized meter and square-meter values to data export.
- Added `.truescale.json` project export/import through `PlanScaleProjectFormat`.
- Replaced browser `prompt()` and `confirm()` with app-owned modal dialogs.
- Extracted app state, history snapshots, canvas view transforms, and canvas rendering into dedicated modules.
- Removed stale DOM references for missing `fitButton` and `resultOutput`.
- Removed the disabled right-angle drawing branch while preserving right-angle coloring metadata.
- Expanded syntax, unit, and smoke tests.

## Remaining Architecture Work

- Continue reducing `app.js` by extracting pointer/keyboard interactions and UI synchronization controllers.
- Split `styles.css` into logical CSS files after the JS behavior stabilizes.
- Move from global namespaces to ES modules.
- Add TypeScript only after ES modules are stable.
- Keep Vite as a later step and preserve the public GitHub Pages path.

## Definition Of Done For 1.0

- Unit conversions stay correct across UI, saved state, share-link, CSV, JSON, and project files.
- Project files can be exported and imported without losing image, scale, segments, polygons, display settings, or view state.
- Desktop and mobile smoke tests pass.
- Math and project-format unit tests pass.
- No local-only repo artifacts are committed.
- The app remains deployable as a static GitHub Pages app.
