# Creative Whiteboard

Creative Whiteboard is an offline-first infinite digital workspace built with React, TypeScript, Vite, Tauri 2, Konva, and Zustand.

## Current status

The active Electron application now includes an infinite Konva canvas, pointer-centered zoom, panning, dynamic grid, pen, brush, highlighter, object eraser, shapes, arrows, text, selection and transforms, history, clipboard operations, image/document/PDF import, project saving, recovery, a data-driven minimap, and PNG/JPEG/PDF export.

## Prerequisites

- Node.js 20.19 or newer (Node.js 22.12+ recommended)
- Rust stable via `rustup`
- Microsoft C++ Build Tools with the Desktop development with C++ workload
- WebView2 (included with current Windows releases)

## Install and run

```powershell
npm install
npm run dev
```

`npm run dev` launches the React interface inside an Electron desktop window. The development launcher automatically selects an available local port, so an older preview server cannot prevent the application from opening.

To run the browser-only frontend:

```powershell
npm run dev:web
```

The older Tauri prototype remains available after installing its native prerequisites:

```powershell
npm run tauri dev
```

## Pen tablet and stylus support

The Electron canvas consumes standard Windows Pointer Events used by Wacom and
compatible pen tablets. Pen, Brush, and Marker strokes record pressure samples;
high-frequency coalesced pointer samples improve stroke continuity; the stylus
eraser end removes objects; the barrel button pans; and concurrent palm touches
are rejected while the pen is active. Pressure and palm-rejection preferences
are available in Settings. Pressure data is saved in `.cwb` projects and used
when rendering exports. Mouse input and older projects remain compatible.

## Verification

```powershell
npm run lint
npm run test
npm run build
npm run build:desktop
npm run tauri build
```

## Linux installers

Build the Linux packages on a current x64 Debian/Ubuntu or Fedora workstation:

```bash
npm ci
npm run build:linux
```

The packages are written to `release/`:

- `.deb` installs on Debian, Ubuntu, and derivatives with `sudo apt install ./CreativeWhiteboard_*.deb`
- `.rpm` installs on Fedora and derivatives with `sudo dnf install ./CreativeWhiteboard_*.rpm`
- `.AppImage` is the portable fallback; run `chmod +x CreativeWhiteboard_*.AppImage` before launching it

To build only one native package, use `npm run build:linux:deb` or
`npm run build:linux:rpm`. Linux packages should be produced on Linux so native
dependencies and package metadata are generated for the target platform.

## Current limitations

- PDF previews use Chromium's built-in PDF renderer inside isolated floating windows.
- DOCX import is not enabled yet; TXT, Markdown, PDF, PNG, JPEG, WebP, and SVG are supported.
- Projects currently use validated JSON `.cwb` files rather than the later compressed package format.
- The application is unsigned, so Windows SmartScreen may warn on first installation.
# Creative Whiteboard

Creative Whiteboard is an Electron desktop whiteboard for drawing, annotation,
document reference, and visual planning.

## Application information

All editable product, creator, publisher, version, build, copyright, support,
website, licence, identifier, and icon values live in [`app-info.json`](app-info.json).
Run `npm run metadata` after editing it. Production build commands run this
automatically so package and executable metadata remain synchronized.

The placeholder creator, company, publisher, website, and support values must be
replaced before a public release.

## Security model

- The renderer uses context isolation, Chromium sandboxing, no Node integration,
  no webviews, denied runtime permissions, and a narrow preload bridge.
- Main-process IPC verifies the sender and validates every payload.
- Project and export writes require an operating-system save dialog unless the
  path was previously approved for the current process.
- Imports are limited by count and size and checked by extension and signature.
  Executables, scripts, SVG, macros, and unsupported containers are rejected.
- PDF previews use a sandboxed frame without script or operating-system access.
- A strict Content Security Policy blocks remote scripts, objects, forms, and
  unexpected network connections. Navigation and new windows are denied.
- External browsing is restricted to approved HTTPS origins from `app-info.json`.
- Recovery data is local and malformed projects are rejected before loading.

Run `npm run security:audit`, `npm test`, and `npm run lint` before releases.
Dependency locks are recorded in `package-lock.json`; third-party notices are
generated with `npm run notices`.

These controls reduce attack surface but do not guarantee immunity from every
possible vulnerability. See [`SECURITY.md`](SECURITY.md) for reporting guidance.

The local development installer is not Authenticode-signed because no publisher
certificate is configured. Public releases must be signed with the verified
publisher certificate and checked with `Get-AuthenticodeSignature` before
distribution. No automatic updater is enabled; do not add one without signature
and checksum verification.

## Legal and privacy documents

- [`LICENSE`](LICENSE)
- [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)
- [`PRIVACY.md`](PRIVACY.md)
- [`SECURITY.md`](SECURITY.md)

Third-party product names and file formats belong to their respective owners.
