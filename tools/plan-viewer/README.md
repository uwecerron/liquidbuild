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

Save measurements downloads separate JSON with PDF SHA-256, page coordinates, calibration, and measured lines. It leaves the source file unchanged. Working overlays are in memory; refresh clears them. JSON reimport, persistent project storage, snapping, OCR, wall recognition, and 3D are not implemented. Narrow screens support viewing/navigation; the measurement settings panel is desktop-only.

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
