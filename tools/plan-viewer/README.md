# Local plan viewer

A standalone, localhost-only PDF.js prototype for viewing drawing sets and measuring user-calibrated distances. This is not connected to the public site, CRM, or AI providers.

## Run

```sh
cd /Users/uwecerron/liquid_build/tools/plan-viewer
npm ci
npm start -- '/Users/uwecerron/Downloads/311 SW 14 CT.pdf'
```

Open http://127.0.0.1:4317/?page=11 for the ground-floor sheet. `PLAN_PORT` changes the default port. Without a PDF argument, use Open PDF to select a local file. The optional startup file is served only over loopback; file-picker bytes remain in the browser. PDF.js assets are installed locally. No CDN or remote processing is used.

Use Fit sheet, +/- and Rotate. For desktop measurement, enter a known distance in decimal feet, select Calibrate, and click the corresponding endpoints. Then select Measure and click another pair. Calibration is per sheet; different-scale details require recalibration, which clears that sheet's measurements. Browser zoom is not a physical drawing scale.

Save measurements downloads separate JSON with PDF SHA-256, page coordinates, calibration, and measured lines. It leaves the source file unchanged. Working overlays are in memory; refresh clears them. JSON reimport, persistent project storage, snapping, OCR, and automatic wall recognition are not implemented in the plan desk. A separate 3D prototype is described below. Narrow screens support viewing/navigation; the measurement settings panel is desktop-only.

## Test performed September 26, 2026

Input: 311 SW 14 CT.pdf, 39 pages, 23,397,321 bytes.

Automated in headless installed Chrome via Playwright:
- All 39 pages rendered sequentially.
- Page navigation, zoom, rotation, fit, and mobile width.
- Measurement requires calibration; synthetic 10-foot reference round-trip.
- Measurement preserved after zoom/rotation; independent sheet calibration.
- Separate JSON export with PDF hash and page coordinates.
- Zero external network requests and zero JavaScript page errors.

Desktop ground-floor and mobile screenshots were visually inspected. This verifies a working reference viewer, not CAD semantics, field dimensions, technical compliance, or digital signatures. Complex drawings require zooming for readable detail.

`test.cjs` uses the Codex bundled Playwright location on this machine and the installed Chrome channel. Run it with this server already running and the sample PDF loaded. Test screenshots and the synthetic measurement JSON are written outside the repository, under Desktop/output/plan-viewer-test. Do not treat the synthetic overlay as an actual measurement.


## Browser 3D studio

Open http://127.0.0.1:4317/studio.html with the original sample PDF supplied to the server. After source edits, run `npm run build:studio`. The committed bundle can run directly; dependencies and assets are served locally.

The studio is a manually traced concept model of unit 311 on sheet A-1.1 (PDF page 11), with 17 walls and 10 openings. It uses the printed 36 ft 6 in span as a tentative calibration. It checks the original PDF SHA-256 before showing the trace. PDF.js renders the reference; Three.js generates and renders geometry on the client using WebGL. The server serves static assets and PDF bytes only.

- Orbit, pan, zoom, top view, labels, and cutaway.
- Select a wall in the drawing, model, or dropdown; edit its endpoints or opening center/width. Invalid lengths, overlaps and openings outside a wall are rejected. Undo retains the last 30 edits.
- Wall height and uniform thickness are editable assumptions. Openings are rectangular voids, with glass for windows.
- Save locally persists model data in this browser's localStorage. GLB export uses meters and includes source/assumption metadata. JSON export preserves the editable feet-based model; JSON import UI is not implemented.
- Cutaway changes the display only. GLB always exports full model height.

This is not automatic plan recognition. Source tracing and opening widths are approximate; default heights, thicknesses and window sills are assumed. No roof, second floor, stairs, structural details or services are modeled. Room color patches, labels and slab footprint remain fixed when walls are edited. Verify geometry against dimensions, elevations and schedules before extending this into a construction workflow. The original PDF is never modified.

`node studio.test.cjs` tests desktop/mobile browser rendering, rejected edits, undo, local save/reload, and GLB/JSON export with the browser offline after initial loading. It verifies full-height export while the display is cut away, meters metadata, zero external requests, zero server writes, and zero page errors. Outputs are in Desktop/output/plan-studio-test. The test uses a fresh isolated browser context and does not alter the user's saved browser model.
